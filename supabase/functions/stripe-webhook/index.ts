import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

interface ProfileData {
  id: string;
  email: string;
  pro_session_reset_date: string | null;
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!stripeSecretKey || !supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing required environment variables");
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-04-30.basil" });
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    let event: Stripe.Event;

    if (stripeWebhookSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret);
        logStep("Webhook signature verified", { eventType: event.type });
      } catch (err) {
        logStep("Webhook signature verification failed", { error: String(err) });
        return new Response(JSON.stringify({ error: "Webhook signature verification failed" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      event = JSON.parse(body);
      logStep("Processing event without signature verification", { eventType: event.type });
    }

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(supabaseClient, stripe, subscription);
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCanceled(supabaseClient, stripe, subscription);
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(supabaseClient, stripe, invoice);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Payment failed - Stripe dunning will handle", { invoiceId: invoice.id });
        break;
      }
      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
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

async function getCustomerEmail(stripe: Stripe, customerId: string): Promise<string | null> {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) return null;
    return (customer as Stripe.Customer).email || null;
  } catch {
    return null;
  }
}

// deno-lint-ignore no-explicit-any
async function handleSubscriptionUpdate(supabaseClient: any, stripe: Stripe, subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  const email = await getCustomerEmail(stripe, customerId);
  if (!email) return;

  const isActive = subscription.status === 'active' || subscription.status === 'trialing';
  const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();
  const cancelAtPeriodEnd = subscription.cancel_at_period_end || false;

  const { data: existingProfile } = await supabaseClient
    .from("profiles")
    .select("id, pro_session_reset_date, pro_subscription_start")
    .eq("email", email)
    .maybeSingle();

  const typedProfile = existingProfile as (ProfileData & { pro_subscription_start?: string }) | null;

  if (typedProfile) {
    const shouldResetCounters = !typedProfile.pro_session_reset_date;
    const isNewSubscription = !typedProfile.pro_subscription_start;
    
    const updateData: Record<string, unknown> = {
      is_pro_subscriber: isActive,
      pro_subscription_end: periodEnd,
      pro_cancel_at_period_end: cancelAtPeriodEnd,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      updated_at: new Date().toISOString(),
    };
    
    // Set subscription start date if this is a new subscription
    if (isNewSubscription && isActive) {
      updateData.pro_subscription_start = new Date().toISOString();
    }
    
    if (shouldResetCounters) {
      updateData.pro_mock_sessions_used = 0;
      updateData.pro_audio_sessions_used = 0;
      updateData.pro_session_reset_date = new Date().toISOString();
    }
    await supabaseClient.from("profiles").update(updateData).eq("id", typedProfile.id);
    logStep("Profile updated", { email, isActive, cancelAtPeriodEnd });
  } else {
    await supabaseClient.from("profiles").insert({
      email,
      is_pro_subscriber: isActive,
      pro_subscription_end: periodEnd,
      pro_subscription_start: new Date().toISOString(),
      pro_cancel_at_period_end: cancelAtPeriodEnd,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      pro_mock_sessions_used: 0,
      pro_audio_sessions_used: 0,
      pro_session_reset_date: new Date().toISOString(),
    });
    logStep("Profile created", { email });
  }
}

// deno-lint-ignore no-explicit-any
async function handleSubscriptionCanceled(supabaseClient: any, stripe: Stripe, subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  const email = await getCustomerEmail(stripe, customerId);
  if (!email) return;

  await supabaseClient.from("profiles").update({ is_pro_subscriber: false, updated_at: new Date().toISOString() }).eq("email", email);
  logStep("Subscription cancelled", { email });
}

// deno-lint-ignore no-explicit-any
async function handleInvoicePaid(supabaseClient: any, stripe: Stripe, invoice: Stripe.Invoice) {
  if (!invoice.subscription) return;
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  const email = await getCustomerEmail(stripe, customerId);
  if (!email) return;

  // Get subscription to update period end date
  const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id;
  let periodEnd: string | undefined;
  
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    periodEnd = new Date(subscription.current_period_end * 1000).toISOString();
  } catch (e) {
    logStep("Could not fetch subscription for period end", { error: String(e) });
  }

  const updateData: Record<string, unknown> = {
    is_pro_subscriber: true,
    pro_mock_sessions_used: 0,
    pro_audio_sessions_used: 0,
    pro_session_reset_date: new Date().toISOString(),
    pro_cancel_at_period_end: false, // Reset cancel flag on renewal
    updated_at: new Date().toISOString(),
  };
  
  if (periodEnd) {
    updateData.pro_subscription_end = periodEnd;
  }

  await supabaseClient.from("profiles").update(updateData).eq("email", email);
  logStep("Session counters reset for renewal", { email, periodEnd });
}
