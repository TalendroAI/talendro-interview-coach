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

// Product tier order (lowest to highest) - Pro is EXCLUDED from upgrade path
// Pro is a subscription product, not part of single-purchase upgrade credits
const TIER_ORDER = ["quick_prep", "full_mock", "premium_audio"];

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
    
    const { session_type, email, discount_code_id, discount_percent } = await req.json();
    
    if (!session_type || !PRICE_CONFIG[session_type as keyof typeof PRICE_CONFIG]) {
      throw new Error("Invalid session type");
    }
    
    if (!email) {
      throw new Error("Email is required");
    }

    logStep("Request validated", { session_type, hasEmail: !!email, hasDiscountCode: !!discount_code_id, discount_percent });

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

    // Create Supabase client with service role to bypass RLS
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    logStep("Checking for upgrade credit eligibility", { email, targetTier: session_type, isSubscription });

    // Check for upgrade credit ("pay the difference")
    // Policy:
    // - If the customer purchased a LOWER tier within the last 24 hours, they can upgrade by applying that prior purchase amount as a credit.
    // - Pro subscriptions are NOT eligible for upgrade credits - they are recurring products, not single purchases.
    // NOTE: The frontend displays upgrade credit based on this rule; to avoid charging the wrong amount, we do not attempt to infer "already used" here.
    let upgradeCredit = 0;
    let upgradedFromSession: any = null;

    // Skip upgrade credit check entirely for Pro subscriptions
    if (isSubscription) {
      logStep("Pro subscription - upgrade credits do not apply", { session_type });
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: recentSessions, error: recentError } = await supabaseClient
      .from("coaching_sessions")
      .select("id, session_type, status, created_at")
      .eq("email", email.toLowerCase().trim())
      .in("status", ["active", "completed"]) // paid sessions
      .gte("created_at", twentyFourHoursAgo)
      .order("created_at", { ascending: false });

    if (recentError) {
      logStep("ERROR fetching recent sessions", { error: recentError.message, code: recentError.code });
    }

    logStep("Upgrade credit window", {
      email: email.toLowerCase().trim(),
      targetTier: session_type,
      cutoff: twentyFourHoursAgo,
      recentCount: recentSessions?.length ?? 0,
    });

    // Only check for upgrade credits if NOT a subscription (Pro)
    if (!isSubscription && !recentError && recentSessions && recentSessions.length > 0) {
      logStep("Recent paid sessions", {
        sessions: recentSessions.map((s) => ({
          id: s.id,
          type: s.session_type,
          status: s.status,
          created: s.created_at,
        })),
      });

      // Pick the BEST (highest value) lower-tier purchase within 24h.
      // Only consider single-purchase products (exclude 'pro' from source sessions too)
      for (const session of recentSessions) {
        // Skip pro sessions as source - they're subscriptions, not single purchases
        if (session.session_type === 'pro') continue;
        
        const sessionTierIndex = TIER_ORDER.indexOf(session.session_type);
        if (sessionTierIndex >= 0 && sessionTierIndex < currentTierIndex) {
          const sessionPrice = PRICE_CONFIG[session.session_type as keyof typeof PRICE_CONFIG];
          if (sessionPrice && sessionPrice.amount > upgradeCredit) {
            upgradeCredit = sessionPrice.amount;
            upgradedFromSession = session;
          }
        }
      }

      if (upgradedFromSession && upgradeCredit > 0) {
        logStep("Upgrade credit found!", {
          from: upgradedFromSession.session_type,
          to: session_type,
          creditCents: upgradeCredit,
          creditDollars: upgradeCredit / 100,
          sessionId: upgradedFromSession.id,
        });
      } else {
        logStep("No upgrade credit (no qualifying lower-tier purchase in last 24h)");
      }
    } else if (isSubscription) {
      logStep("Skipped upgrade credit check - Pro subscriptions are always full price");
    } else {
      logStep("No recent paid sessions found within 24 hours", { cutoff: twentyFourHoursAgo });
    }

    // Calculate promo discount amount
    let promoDiscountAmount = 0;
    if (discount_percent && discount_percent > 0) {
      promoDiscountAmount = Math.floor(priceConfig.amount * (discount_percent / 100));
      logStep("Promo discount calculated", { 
        discount_percent,
        promoDiscountAmount: promoDiscountAmount / 100 
      });
    }

    // ADMIN RULE: Users can only use ONE discount - the GREATER of:
    // 1. Upgrade credit (from previous purchase within 24hrs)
    // 2. Promo code discount
    // They CANNOT be combined.
    let appliedDiscount = 0;
    let discountType: 'none' | 'upgrade' | 'promo' = 'none';
    let appliedDiscountCodeId: string | null = null;

    if (upgradeCredit > 0 || promoDiscountAmount > 0) {
      if (upgradeCredit >= promoDiscountAmount) {
        // Upgrade credit wins - ignore promo code
        appliedDiscount = upgradeCredit;
        discountType = 'upgrade';
        appliedDiscountCodeId = null; // Don't record promo code usage
        logStep("Using UPGRADE credit (greater value)", { 
          upgradeCredit: upgradeCredit / 100,
          promoDiscountAmount: promoDiscountAmount / 100,
          winner: 'upgrade'
        });
      } else {
        // Promo code wins - ignore upgrade credit
        appliedDiscount = promoDiscountAmount;
        discountType = 'promo';
        appliedDiscountCodeId = discount_code_id || null;
        upgradedFromSession = null; // Clear upgrade reference since we're not using it
        logStep("Using PROMO code (greater value)", { 
          upgradeCredit: upgradeCredit / 100,
          promoDiscountAmount: promoDiscountAmount / 100,
          winner: 'promo'
        });
      }
    }

    const finalPrice = Math.max(0, priceConfig.amount - appliedDiscount);

    logStep("Final pricing (single discount applied)", {
      originalPrice: priceConfig.amount / 100,
      upgradeCredit: upgradeCredit / 100,
      promoDiscount: promoDiscountAmount / 100,
      discountType,
      appliedDiscount: appliedDiscount / 100,
      finalPrice: finalPrice / 100,
    });

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

    // Record the discount code usage ONLY if promo code was the winning discount
    if (appliedDiscountCodeId && discountType === 'promo') {
      const { error: usageError } = await supabaseClient
        .from("discount_code_usage")
        .insert({
          code_id: appliedDiscountCodeId,
          email: email.toLowerCase().trim(),
          session_id: sessionData.id,
        });

      if (usageError) {
        logStep("Warning: Failed to record discount usage", { error: usageError });
        // Don't throw - we still want to proceed with checkout
      } else {
        logStep("Recorded discount code usage", { code_id: appliedDiscountCodeId });
      }
    }

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
        discount_type: discountType,
        upgraded_from_session: discountType === 'upgrade' ? upgradedFromSession?.id : null,
        discount_applied: appliedDiscount > 0 ? (appliedDiscount / 100).toString() : null,
        discount_code_id: discountType === 'promo' ? appliedDiscountCodeId : null,
      },
    };

    // Apply the single winning discount as a coupon
    if (appliedDiscount > 0 && !isSubscription) {
      const couponName = discountType === 'upgrade'
        ? `Upgrade credit from ${upgradedFromSession?.session_type}`
        : `Promo discount (${discount_percent}% off)`;

      const coupon = await stripe.coupons.create({
        amount_off: appliedDiscount,
        currency: "usd",
        duration: "once",
        name: couponName,
        max_redemptions: 1,
      });
      
      logStep("Created discount coupon", { 
        couponId: coupon.id, 
        discountType,
        amountOff: appliedDiscount / 100,
        originalPrice: priceConfig.amount / 100,
        finalPrice: finalPrice / 100
      });

      checkoutOptions.discounts = [{ coupon: coupon.id }];
    }

    // Create checkout session
    logStep("Stripe checkout.sessions.create payload (sanitized)", {
      mode: checkoutOptions.mode,
      ui_mode: (checkoutOptions as any).ui_mode ?? null,
      line_items: checkoutOptions.line_items,
      discounts: (checkoutOptions as any).discounts ?? null,
      customer: checkoutOptions.customer ?? null,
      customer_email: checkoutOptions.customer_email ?? null,
      metadata: checkoutOptions.metadata ?? null,
      success_url: checkoutOptions.success_url,
      cancel_url: checkoutOptions.cancel_url,
    });

    const checkoutSession = await stripe.checkout.sessions.create(checkoutOptions);

    // Fail-safe: verify Stripe actually applied the expected discount.
    // If Stripe doesn't reflect the correct total, we EXPIRE the session and hard-fail so customers cannot be charged the wrong amount.
    let stripeAmountTotal: number | null = null;
    let stripeAmountDiscount: number | null = null;
    if (appliedDiscount > 0 && !isSubscription) {
      try {
        const verified = await stripe.checkout.sessions.retrieve(checkoutSession.id, {
          expand: ["total_details"],
        });

        stripeAmountTotal = (verified as any).amount_total ?? null;
        stripeAmountDiscount = (verified as any).total_details?.amount_discount ?? null;

        const expectedTotal = finalPrice;
        const expectedDiscount = appliedDiscount;

        if (stripeAmountTotal !== expectedTotal || stripeAmountDiscount !== expectedDiscount) {
          logStep("DISCOUNT VERIFICATION FAILED — expiring checkout session", {
            checkoutSessionId: checkoutSession.id,
            expectedTotalCents: expectedTotal,
            stripeAmountTotalCents: stripeAmountTotal,
            expectedDiscountCents: expectedDiscount,
            stripeAmountDiscountCents: stripeAmountDiscount,
            discountType,
          });

          await stripe.checkout.sessions.expire(checkoutSession.id);
          throw new Error(
            `Checkout discount mismatch (blocked): expected total $${(expectedTotal / 100).toFixed(2)} with $${(
              expectedDiscount / 100
            ).toFixed(2)} discount.`
          );
        }

        logStep("Discount verified", {
          checkoutSessionId: checkoutSession.id,
          amountTotal: stripeAmountTotal,
          amountDiscount: stripeAmountDiscount,
        });
      } catch (e) {
        // If anything about verification fails, fail closed.
        const msg = e instanceof Error ? e.message : String(e);
        logStep("Discount verification error (failing closed)", { message: msg });
        throw new Error(msg);
      }
    }

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
      discountType,
      discountApplied: appliedDiscount > 0 ? appliedDiscount / 100 : 0,
      stripeAmountTotal,
      stripeAmountDiscount,
    });

    return new Response(
      JSON.stringify({
        url: checkoutSession.url,
        checkout_session_id: checkoutSession.id,
        debug: {
          stripe_key_type: keyType,
          stripe_account_livemode: stripeAccountLivemode,
          checkout_url_host: checkoutUrlHost,
          stripe_amount_total: stripeAmountTotal !== null ? stripeAmountTotal / 100 : null,
          stripe_amount_discount: stripeAmountDiscount !== null ? stripeAmountDiscount / 100 : null,
        },
        discount_type: discountType,
        discount_applied: appliedDiscount > 0 ? appliedDiscount / 100 : 0,
        upgrade_credit_available: upgradeCredit > 0 ? upgradeCredit / 100 : 0,
        promo_discount_available: promoDiscountAmount > 0 ? promoDiscountAmount / 100 : 0,
        original_price: priceConfig.amount / 100,
        final_price: finalPrice / 100,
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
