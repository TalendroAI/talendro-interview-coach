import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

interface ProfileData {
  id: string;
  email: string;
  pro_session_reset_date: string | null;
  user_id: string | null;
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

const DASHBOARD_URL = "https://coach.talendro.com/dashboard";

function generateWelcomeEmail(magicLink: string, email: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Interview Coach Pro</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 40px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                    Talendro<span style="color: #f59e0b;">™</span>
                  </h1>
                  <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">Interview Coach Pro</p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px;">
                  <h2 style="margin: 0 0 20px; color: #1e3a5f; font-size: 24px;">Welcome to Interview Coach Pro!</h2>
                  <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                    Thank you for subscribing! Click the button below to access your dashboard and start your first session:
                  </p>
                  
                  <!-- CTA Button -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="padding: 20px 0;">
                        <a href="${magicLink}" style="display: inline-block; background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                          Access My Dashboard
                        </a>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- Benefits -->
                  <div style="margin: 30px 0; padding: 24px; background-color: #f8fafc; border-radius: 8px;">
                    <p style="margin: 0 0 16px; color: #1e3a5f; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Your subscription includes:</p>
                    <ul style="margin: 0; padding: 0 0 0 20px; color: #4b5563; font-size: 15px; line-height: 1.8;">
                      <li>Unlimited Quick Prep sessions</li>
                      <li>6 Mock Interviews per month</li>
                      <li>2 Audio Mock sessions per month</li>
                    </ul>
                  </div>
                  
                  <p style="margin: 24px 0 0; color: #6b7280; font-size: 14px;">
                    This link expires in 24 hours. If it doesn't work, visit <a href="https://coach.talendro.com/login" style="color: #1e3a5f;">coach.talendro.com/login</a> to request a new one.
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 30px 40px; background-color: #f8fafc; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0; color: #6b7280; font-size: 14px; text-align: center;">
                    Questions? Reply to this email — we're here to help.
                  </p>
                  <p style="margin: 16px 0 0; color: #9ca3af; font-size: 12px; text-align: center;">
                    © ${new Date().getFullYear()} Talendro. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!stripeSecretKey || !supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing required environment variables");
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-04-30.basil" });
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const resend = resendApiKey ? new Resend(resendApiKey) : null;

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    let event: Stripe.Event;

    if (stripeWebhookSecret) {
      if (!signature) {
        logStep("Missing Stripe signature header");
        return new Response(JSON.stringify({ error: "Missing Stripe signature" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        event = await stripe.webhooks.constructEventAsync(body, signature, stripeWebhookSecret);
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
        await handleSubscriptionUpdate(supabaseClient, stripe, subscription, resend, event.type === "customer.subscription.created");
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
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription") {
          await handleCheckoutCompleted(supabaseClient, stripe, session, resend);
        }
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

async function getCustomerName(stripe: Stripe, customerId: string): Promise<string | null> {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) return null;
    return (customer as Stripe.Customer).name || null;
  } catch {
    return null;
  }
}

// deno-lint-ignore no-explicit-any
async function ensureAuthAccount(supabaseClient: any, email: string, resend: any): Promise<string | null> {
  logStep("Ensuring auth account", { email });

  const fromEmail = Deno.env.get("RESEND_FROM") ?? "Talendro <onboarding@resend.dev>";

  // Check if user already exists
  const { data: existingUsers, error: listError } = await supabaseClient.auth.admin.listUsers();

  if (listError) {
    logStep("Error listing users", { error: listError.message });
    return null;
  }

  const existingUser = existingUsers?.users?.find((u: { email: string }) => u.email === email);

  let userId: string;

  if (existingUser) {
    userId = existingUser.id;
    logStep("Auth account already exists", { email, userId });
  } else {
    logStep("Creating new auth account", { email });

    const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
      email,
      email_confirm: true, // Auto-confirm since they just paid
    });

    if (createError) {
      logStep("Error creating auth user", { error: createError.message });
      return null;
    }

    userId = newUser.user.id;
    logStep("Auth account created", { email, userId });
  }

  // Generate magic link (always)
  const { data: linkData, error: linkError } = await supabaseClient.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: DASHBOARD_URL,
    },
  });

  if (linkError) {
    logStep("Error generating magic link", { error: linkError.message });
    return userId;
  }

  const magicLink = linkData?.properties?.action_link;

  if (!magicLink) {
    logStep("Magic link missing from generateLink response", { email });
    return userId;
  }

  if (!resend) {
    logStep("RESEND_API_KEY not configured; cannot send email", { email });
    return userId;
  }

  try {
    const resp = await resend.emails.send({
      from: fromEmail,
      to: [email],
      subject: "Your login link — Interview Coach Pro",
      html: generateWelcomeEmail(magicLink, email),
    });
    logStep("Welcome email queued", { email, id: resp?.id });
  } catch (emailError) {
    logStep("Error sending welcome email", { error: String(emailError) });
  }

  return userId;
}

// deno-lint-ignore no-explicit-any
async function handleCheckoutCompleted(supabaseClient: any, stripe: Stripe, session: Stripe.Checkout.Session, resend: any) {
  const email =
    session.customer_email ??
    session.customer_details?.email ??
    (typeof session.customer === "string" ? await getCustomerEmail(stripe, session.customer) : null);

  if (!email) {
    logStep("Checkout completed but no email found", { sessionId: session.id });
    return;
  }

  logStep("Checkout completed, ensuring auth account", { email });
  await ensureAuthAccount(supabaseClient, email, resend);
}

// deno-lint-ignore no-explicit-any
async function handleSubscriptionUpdate(supabaseClient: any, stripe: Stripe, subscription: Stripe.Subscription, resend: any, isNewSubscription: boolean) {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  const email = await getCustomerEmail(stripe, customerId);
  if (!email) return;

  const isActive = subscription.status === 'active' || subscription.status === 'trialing';
  const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();
  const cancelAtPeriodEnd = subscription.cancel_at_period_end || false;

  // For new subscriptions, ensure auth account exists
  let userId: string | null = null;
  if (isNewSubscription && isActive) {
    userId = await ensureAuthAccount(supabaseClient, email, resend);
  }

  const { data: existingProfile } = await supabaseClient
    .from("profiles")
    .select("id, pro_session_reset_date, pro_subscription_start, user_id")
    .eq("email", email)
    .maybeSingle();

  const typedProfile = existingProfile as (ProfileData & { pro_subscription_start?: string }) | null;

  if (typedProfile) {
    const shouldResetCounters = !typedProfile.pro_session_reset_date;
    const isNewSub = !typedProfile.pro_subscription_start;
    
    const updateData: Record<string, unknown> = {
      is_pro_subscriber: isActive,
      pro_subscription_end: periodEnd,
      pro_cancel_at_period_end: cancelAtPeriodEnd,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      updated_at: new Date().toISOString(),
    };
    
    // Link user_id if we have it and profile doesn't
    if (userId && !typedProfile.user_id) {
      updateData.user_id = userId;
    }
    
    // Set subscription start date if this is a new subscription
    if (isNewSub && isActive) {
      updateData.pro_subscription_start = new Date().toISOString();
    }
    
    if (shouldResetCounters) {
      updateData.pro_mock_sessions_used = 0;
      updateData.pro_audio_sessions_used = 0;
      updateData.pro_session_reset_date = new Date().toISOString();
    }
    await supabaseClient.from("profiles").update(updateData).eq("id", typedProfile.id);
    logStep("Profile updated", { email, isActive, cancelAtPeriodEnd, userId });
  } else {
    // Get customer name for new profile
    const fullName = await getCustomerName(stripe, customerId);
    
    await supabaseClient.from("profiles").insert({
      email,
      full_name: fullName,
      user_id: userId,
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
    logStep("Profile created", { email, userId });
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
