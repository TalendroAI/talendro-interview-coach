import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[SEND-LOGIN-LINK] ${step}${detailsStr}`);
};

function generateLoginEmailHtml(magicLink: string): string {
  return `
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Your Talendro Login Link</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: ${BRAND.slate}; margin: 0; padding: 0; background-color: ${BRAND.soft};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${BRAND.soft};">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="${EMAIL_MAX_WIDTH}" cellpadding="0" cellspacing="0" border="0" style="max-width: ${EMAIL_MAX_WIDTH}px; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          
          <!-- Blue Header -->
          <tr>
            <td align="center" style="background-color: ${BRAND.blue}; padding: 32px 40px;">
              <div style="font-size: 28px; font-weight: 800; color: #ffffff;">
                Talendro<span style="font-size: 12px; vertical-align: super; color: ${BRAND.aqua};">™</span>
              </div>
              <p style="color: ${BRAND.aqua}; margin: 4px 0 0 0; font-size: 14px; font-weight: 500;">Interview Coach Pro</p>
            </td>
          </tr>

          <!-- Hero Section with Emoji -->
          <tr>
            <td align="center" style="padding: 32px 40px 24px 40px;">
              <div style="font-size: 48px; margin-bottom: 16px;">🎉</div>
              <h1 style="color: ${BRAND.slate}; font-size: 24px; font-weight: 700; margin: 0 0 8px 0;">Welcome Back!</h1>
              <p style="color: ${BRAND.aqua}; font-size: 16px; margin: 0; font-weight: 500;">Your login link is ready</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 0 40px 32px 40px;">
              <p style="margin: 0 0 24px 0; color: ${BRAND.slate}; font-size: 15px; line-height: 1.7;">
                Thank you for using <strong style="color: ${BRAND.blue};">Interview Coach Pro</strong>! Click the button below to access your dashboard and continue your interview preparation:
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 8px 0 24px 0;">
                    <a href="${magicLink}" style="display: inline-block; background-color: ${BRAND.blue}; color: #ffffff; padding: 14px 32px; font-size: 16px; font-weight: 700; text-decoration: none; border-radius: 6px;">
                      Access My Dashboard
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Info Box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="background-color: ${BRAND.soft}; border-left: 4px solid ${BRAND.aqua}; padding: 16px; border-radius: 0 8px 8px 0;">
                    <p style="margin: 0; color: ${BRAND.blue}; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">YOUR DASHBOARD INCLUDES:</p>
                    <p style="margin: 8px 0 0 0; color: ${BRAND.slate}; font-size: 14px;">✓ Unlimited Quick Prep sessions</p>
                    <p style="margin: 4px 0 0 0; color: ${BRAND.slate}; font-size: 14px;">✓ 6 Mock Interviews per month</p>
                    <p style="margin: 4px 0 0 0; color: ${BRAND.slate}; font-size: 14px;">✓ 2 Audio Mock sessions per month</p>
                  </td>
                </tr>
              </table>

              <!-- Fallback Link -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px;">
                    <p style="margin: 0 0 8px 0; color: ${BRAND.gray}; font-size: 13px;">If the button doesn't work, copy this link:</p>
                    <p style="margin: 0; font-size: 12px; word-break: break-all;">
                      <a href="${magicLink}" style="color: ${BRAND.blue}; text-decoration: underline;">${magicLink}</a>
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0 0; color: ${BRAND.gray}; font-size: 13px;">
                This link expires in 24 hours. Need a new one? Visit <a href="https://coach.talendro.com/login" style="color: ${BRAND.blue};">coach.talendro.com/login</a>
              </p>

              <p style="margin: 16px 0 0 0; color: ${BRAND.slate}; font-size: 14px;">
                Questions? Reply to this email — we're here to help.
              </p>

              <p style="margin: 16px 0 0 0; color: ${BRAND.slate}; font-size: 14px;">
                — <strong style="color: ${BRAND.blue};">Greg Jackson</strong>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td align="center" style="background-color: ${BRAND.slate}; padding: 24px 40px;">
              <div style="font-size: 20px; font-weight: 800; color: #ffffff; margin-bottom: 4px;">
                Talendro<span style="font-size: 10px; vertical-align: super; color: ${BRAND.aqua};">™</span>
              </div>
              <p style="color: ${BRAND.aqua}; font-style: italic; font-size: 13px; margin: 0 0 8px 0;">Precision Matches. Faster results.</p>
              <p style="margin: 0 0 8px 0; font-size: 12px; color: ${BRAND.gray};">🇺🇸 American-Built · 🎖️ Veteran-Led · ✅ Recruiter-Tested</p>
              <p style="color: ${BRAND.gray}; font-size: 11px; margin: 0;">
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
    const { email } = await req.json().catch(() => ({ email: null }));

    if (!email || typeof email !== "string" || !isValidEmail(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing backend environment variables");
    }

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const fromEmail = "Talendro <noreply@talendro.com>";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    logStep("Ensuring auth account", { email });

    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      throw new Error(`Failed to list users: ${listError.message}`);
    }

    const existingUser = existingUsers?.users?.find(
      (u) => (u.email ?? "").toLowerCase() === email.toLowerCase(),
    );

    if (!existingUser) {
      const { error: createError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
      });

      if (createError) {
        throw new Error(`Failed to create user: ${createError.message}`);
      }

      logStep("Auth user created", { email });
    } else {
      logStep("Auth user exists", { email, userId: existingUser.id });
    }

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo: DASHBOARD_URL,
      },
    });

    if (linkError) {
      throw new Error(`Failed to generate link: ${linkError.message}`);
    }

    const magicLink = linkData?.properties?.action_link;
    if (!magicLink) {
      throw new Error("Magic link missing from generateLink response");
    }

    const emailResponse = await resend.emails.send({
      from: fromEmail,
      to: [email],
      subject: "Your Talendro Login Link",
      html: generateLoginEmailHtml(magicLink),
    });

    const resendError = (emailResponse as any)?.error;
    if (resendError) {
      throw new Error(
        `Resend send failed: ${resendError?.message ?? JSON.stringify(resendError)}`,
      );
    }

    const emailId = (emailResponse as any)?.data?.id ?? (emailResponse as any)?.id ?? null;

    logStep("Email send attempted", { email, fromEmail, emailId });
    console.log("[SEND-LOGIN-LINK] Resend raw response", emailResponse);

    return new Response(JSON.stringify({ ok: true, id: emailId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    logStep("ERROR", { message: error?.message ?? String(error) });
    return new Response(
      JSON.stringify({ error: error?.message ?? String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
