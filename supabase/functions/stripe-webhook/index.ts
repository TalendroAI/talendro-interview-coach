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
const EMAIL_MAX_WIDTH = 600;

// TALENDRO BRAND COLORS
const BRAND = {
  blue: "#2F6DF6",      // Primary / CTAs
  aqua: "#00C4CC",      // Taglines / Highlights
  lime: "#A4F400",      // Accent
  slate: "#2C2F38",     // Body text / Dark backgrounds
  gray: "#9FA6B2",      // Secondary text
  soft: "#F4F7FF",      // Light background
};

function generateWelcomeEmail(magicLink: string): string {
  return `
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <!--[if gte mso 9]>
  <xml>
    <o:OfficeDocumentSettings>
      <o:AllowPNG/>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings>
  </xml>
  <![endif]-->
  <style type="text/css">
    body, table, td, div, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse !important; }
    img { -ms-interpolation-mode: bicubic; border: 0; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: ${BRAND.soft}; }
    .ExternalClass { width: 100%; }
    .ExternalClass, .ExternalClass p, .ExternalClass span, .ExternalClass font, .ExternalClass td, .ExternalClass div { line-height: 100%; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
    u + #body a { color: inherit; text-decoration: none; }
    #MessageViewBody a { color: inherit; text-decoration: none; }
    
    @media only screen and (max-width: 599px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .content-padding { padding: 24px 20px !important; }
      .header-padding { padding: 32px 20px !important; }
      .footer-padding { padding: 24px 20px !important; }
      h1.email-title { font-size: 24px !important; }
      .cta-button { padding: 16px 32px !important; font-size: 16px !important; }
    }
  </style>
</head>
<body id="body" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: ${BRAND.slate}; margin: 0; padding: 0; background-color: ${BRAND.soft}; width: 100% !important; -webkit-font-smoothing: antialiased;">
  <!--[if mso]>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${BRAND.soft};">
  <tr><td align="center" valign="top" style="padding: 40px 20px;">
  <table role="presentation" width="${EMAIL_MAX_WIDTH}" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff;">
  <tr><td>
  <![endif]-->
  
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${BRAND.soft};">
    <tr>
      <td align="center" valign="top" style="padding: 40px 20px;">
        <table role="presentation" class="email-container" width="${EMAIL_MAX_WIDTH}" cellpadding="0" cellspacing="0" border="0" style="width: ${EMAIL_MAX_WIDTH}px; max-width: 100%; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          
          <!-- Header with Talendro branding -->
          <tr>
            <td class="header-padding" style="background-color: ${BRAND.blue}; padding: 40px 48px; text-align: center;">
              <div style="font-size: 32px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                Talendro<span style="font-size: 14px; vertical-align: super; color: ${BRAND.lime}; font-weight: 600;">™</span>
              </div>
              <p style="color: ${BRAND.aqua}; margin: 8px 0 0 0; font-size: 15px; font-weight: 500;">Interview Coach Pro</p>
            </td>
          </tr>

          <!-- Hero Section -->
          <tr>
            <td style="background-color: #ffffff; padding: 32px 48px; text-align: center; border-bottom: 1px solid #e5e7eb;">
              <div style="font-size: 48px; margin-bottom: 12px;">🎉</div>
              <h1 class="email-title" style="color: ${BRAND.slate}; font-size: 26px; font-weight: 700; margin: 0 0 8px 0;">Welcome to Pro!</h1>
              <p style="color: ${BRAND.aqua}; font-size: 16px; margin: 0;">Your subscription is now active</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td class="content-padding" style="padding: 40px 48px;">
              <p style="margin: 0 0 24px 0; color: ${BRAND.slate}; font-size: 16px; line-height: 1.7;">
                Thank you for subscribing to <strong style="color: ${BRAND.blue};">Interview Coach Pro</strong>! Click the button below to access your dashboard and start your first session:
              </p>
              
              <!-- CTA Button with VML fallback for Outlook -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${magicLink}" style="height:52px;v-text-anchor:middle;width:240px;" arcsize="15%" stroke="f" fillcolor="${BRAND.blue}">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-family:sans-serif;font-size:17px;font-weight:bold;">Access My Dashboard</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${magicLink}" class="cta-button" style="display: inline-block; mso-hide: all; background: ${BRAND.blue}; color: #ffffff !important; padding: 16px 40px; font-size: 17px; font-weight: 700; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 12px rgba(47, 109, 246, 0.3);">
                      Access My Dashboard
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>

              <!-- Benefits Box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
                <tr>
                  <td style="background-color: #f8fafc; border-left: 4px solid ${BRAND.blue}; border-radius: 0 8px 8px 0; padding: 20px 24px;">
                    <p style="margin: 0 0 12px 0; color: ${BRAND.blue}; font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Your subscription includes:</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 6px 0; color: ${BRAND.slate}; font-size: 15px;">✓ Unlimited Quick Prep sessions</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: ${BRAND.slate}; font-size: 15px;">✓ 6 Mock Interviews per month</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: ${BRAND.slate}; font-size: 15px;">✓ 2 Audio Mock sessions per month</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Fallback Link -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
                <tr>
                  <td style="background-color: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px;">
                    <p style="margin: 0 0 8px 0; color: ${BRAND.gray}; font-size: 13px; font-weight: 600;">If the button doesn't work, copy this link:</p>
                    <p style="margin: 0; font-size: 12px; color: ${BRAND.blue}; word-break: break-all;">
                      <a href="${magicLink}" style="color: ${BRAND.blue}; text-decoration: underline;">${magicLink}</a>
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0 0; color: ${BRAND.gray}; font-size: 14px;">
                This link expires in 24 hours. Need a new one? Visit <a href="https://coach.talendro.com/login" style="color: ${BRAND.blue}; font-weight: 600;">coach.talendro.com/login</a>
              </p>

              <!-- Signature -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 24px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 8px 0; color: ${BRAND.slate}; font-size: 15px;">Questions? Reply to this email — we're here to help.</p>
                    <p style="margin: 16px 0 0 0; color: ${BRAND.blue}; font-size: 15px;">
                      <strong>— Greg Jackson</strong><br>
                      <span style="color: ${BRAND.gray};">Founder, Talendro</span>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td class="footer-padding" style="background-color: ${BRAND.slate}; padding: 32px 48px; text-align: center;">
              <div style="font-size: 24px; font-weight: 800; color: #ffffff; margin-bottom: 8px;">
                Talendro<span style="font-size: 12px; vertical-align: super; color: ${BRAND.aqua};">™</span>
              </div>
              <p style="color: ${BRAND.aqua}; font-style: italic; font-size: 14px; margin: 0 0 12px 0;">Precision Matches. Faster results.</p>
              <p style="margin: 0 0 16px 0; font-size: 13px; color: ${BRAND.gray};">🇺🇸 American-Built · 🎖️ Veteran-Led · ✅ Recruiter-Tested</p>
              <p style="color: ${BRAND.gray}; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} Talendro. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  
  <!--[if mso]>
  </td></tr></table>
  </td></tr></table>
  <![endif]-->
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

  const fromEmail = "Talendro <noreply@talendro.com>";

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
      subject: "Welcome to Interview Coach Pro — Talendro™",
      html: generateWelcomeEmail(magicLink),
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
