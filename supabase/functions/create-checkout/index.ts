import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Stripe Price IDs from your existing products
const PRICE_CONFIG = {
  quick_prep: "price_1SUJpOCoFieNARvY61k4XFm3", // $12
  full_mock: "price_1SUJX1CoFieNARvYE286d1lq", // $29
  premium_audio: "price_1SUJwECoFieNARvYch9Y4PAY", // $49
  pro: "price_1SX74aCoFieNARvY06cE5g5e", // $79/month
};

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

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    
    // Check if customer exists
    const customers = await stripe.customers.list({ email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
    }

    const priceId = PRICE_CONFIG[session_type as keyof typeof PRICE_CONFIG];
    const isSubscription = session_type === "pro";

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

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
    
    // Create checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: isSubscription ? "subscription" : "payment",
      success_url: `${origin}/interview-coach?session_type=${session_type}&email=${encodeURIComponent(email)}&checkout_session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?canceled=true`,
      metadata: {
        session_id: sessionData.id,
        session_type,
      },
    });

    // Update session with checkout session ID
    await supabaseClient
      .from("coaching_sessions")
      .update({ stripe_checkout_session_id: checkoutSession.id })
      .eq("id", sessionData.id);

    logStep("Checkout session created", { checkoutSessionId: checkoutSession.id });

    return new Response(JSON.stringify({ url: checkoutSession.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
