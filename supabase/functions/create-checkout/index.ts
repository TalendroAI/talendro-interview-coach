import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Stripe Price IDs and amounts from your existing products
const PRICE_CONFIG = {
  quick_prep: { price_id: "price_1SUJpOCoFieNARvY61k4XFm3", amount: 1200 }, // $12 in cents
  full_mock: { price_id: "price_1SUJX1CoFieNARvYE286d1lq", amount: 2900 }, // $29 in cents
  premium_audio: { price_id: "price_1SUJwECoFieNARvYch9Y4PAY", amount: 4900 }, // $49 in cents
  pro: { price_id: "price_1SX74aCoFieNARvY06cE5g5e", amount: 7900, recurring: true }, // $79/month in cents
};

// Product tier order (lowest to highest)
const TIER_ORDER = ["quick_prep", "full_mock", "premium_audio", "pro"];

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");
    
    const { session_type, email } = await req.json();
    
    if (!session_type || !PRICE_CONFIG[session_type as keyof typeof PRICE_CONFIG]) {
      throw new Error("Invalid session type");
    }
    
    if (!email) {
      throw new Error("Email is required");
    }

    logStep("Request validated", { session_type, email });

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    // Log key type (without exposing actual key)
    const keyType = stripeKey.startsWith('sk_live_') ? 'LIVE' :
                    stripeKey.startsWith('sk_test_') ? 'TEST' : 'UNKNOWN';
    logStep("Stripe key type", { keyType });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Definitive signal: Stripe account mode as seen by the API key in use
    let stripeAccountLivemode: boolean | null = null;
    try {
      const account = await stripe.accounts.retrieve();
      stripeAccountLivemode = (account as any).livemode ?? null;
      logStep("Stripe account mode", { accountId: account.id, livemode: stripeAccountLivemode });
    } catch (e) {
      logStep("Stripe account mode lookup failed", { message: String(e) });
    }
    // Check if customer exists
    const customers = await stripe.customers.list({ email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
    }

    const priceConfig = PRICE_CONFIG[session_type as keyof typeof PRICE_CONFIG];
    const priceId = priceConfig.price_id;
    const isSubscription = session_type === "pro";
    const currentTierIndex = TIER_ORDER.indexOf(session_type);

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check for upgrade credit - look for purchases within last 24 hours
    let upgradeCredit = 0;
    let upgradedFromSession = null;
    
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: recentSessions, error: recentError } = await supabaseClient
      .from("coaching_sessions")
      .select("*")
      .eq("email", email)
      .eq("status", "active")
      .gte("created_at", twentyFourHoursAgo)
      .order("created_at", { ascending: false });

    if (!recentError && recentSessions && recentSessions.length > 0) {
      logStep("Found recent sessions", { count: recentSessions.length });
      
      // Find the highest tier purchase within 24 hours that is lower than current purchase
      for (const session of recentSessions) {
        const sessionTierIndex = TIER_ORDER.indexOf(session.session_type);
        
        // Only apply credit if upgrading to a higher tier
        if (sessionTierIndex >= 0 && sessionTierIndex < currentTierIndex) {
          const sessionPrice = PRICE_CONFIG[session.session_type as keyof typeof PRICE_CONFIG];
          if (sessionPrice && sessionPrice.amount > upgradeCredit) {
            upgradeCredit = sessionPrice.amount;
            upgradedFromSession = session;
            logStep("Upgrade credit found", { 
              from: session.session_type, 
              credit: upgradeCredit / 100,
              sessionId: session.id 
            });
          }
        }
      }
    }

    // Create a pending session in database
    const { data: sessionData, error: sessionError } = await supabaseClient
      .from("coaching_sessions")
      .insert({
        email,
        session_type,
        status: "pending",
      })
      .select()
      .single();

    if (sessionError) {
      logStep("Error creating session", { error: sessionError });
      throw new Error("Failed to create session");
    }

    logStep("Created pending session", { sessionId: sessionData.id });

    const origin = req.headers.get("origin") || "https://coach.talendro.com";
    
    // Build checkout session options
    const checkoutOptions: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      customer_email: customerId ? undefined : email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: isSubscription ? "subscription" : "payment",
      ui_mode: "hosted", // Force standard Checkout UI
      success_url: `${origin}/interview-coach?session_type=${session_type}&email=${encodeURIComponent(email)}&checkout_session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?canceled=true`,
      metadata: {
        session_id: sessionData.id,
        session_type,
        upgraded_from_session: upgradedFromSession?.id || null,
        upgrade_credit_applied: upgradeCredit > 0 ? (upgradeCredit / 100).toString() : null,
      },
    };

    // Apply upgrade credit as a coupon if applicable
    if (upgradeCredit > 0 && !isSubscription) {
      // Create a one-time coupon for the upgrade credit
      const coupon = await stripe.coupons.create({
        amount_off: upgradeCredit,
        currency: "usd",
        duration: "once",
        name: `Upgrade credit from ${upgradedFromSession?.session_type}`,
        max_redemptions: 1,
      });
      
      logStep("Created upgrade coupon", { 
        couponId: coupon.id, 
        amountOff: upgradeCredit / 100,
        originalPrice: priceConfig.amount / 100,
        finalPrice: (priceConfig.amount - upgradeCredit) / 100
      });

      checkoutOptions.discounts = [{ coupon: coupon.id }];
    }

    // Create checkout session
    const checkoutSession = await stripe.checkout.sessions.create(checkoutOptions);

    // Update session with checkout session ID
    await supabaseClient
      .from("coaching_sessions")
      .update({ stripe_checkout_session_id: checkoutSession.id })
      .eq("id", sessionData.id);

    let checkoutUrlHost: string | null = null;
    try {
      if (typeof checkoutSession.url === "string") {
        checkoutUrlHost = new URL(checkoutSession.url).host;
      }
    } catch {
      checkoutUrlHost = null;
    }

    logStep("Checkout session created", {
      checkoutSessionId: checkoutSession.id,
      checkoutUrlHost,
      stripeAccountLivemode,
      checkoutLivemode: (checkoutSession as any).livemode ?? null,
      urlHasTestPrefix:
        typeof checkoutSession.url === "string" ? checkoutSession.url.includes("/test_") : null,
      upgradeCreditApplied: upgradeCredit > 0 ? upgradeCredit / 100 : 0,
    });

    return new Response(
      JSON.stringify({
        url: checkoutSession.url,
        debug: {
          stripe_key_type: keyType,
          stripe_account_livemode: stripeAccountLivemode,
          checkout_url_host: checkoutUrlHost,
        },
        upgrade_credit_applied: upgradeCredit > 0 ? upgradeCredit / 100 : 0,
        original_price: priceConfig.amount / 100,
        final_price: (priceConfig.amount - upgradeCredit) / 100,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
