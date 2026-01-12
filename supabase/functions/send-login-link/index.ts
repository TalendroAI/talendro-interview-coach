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
  slate: "#2C2F38",     // Body text
  gray: "#9FA6B2",      // Secondary text
  navy: "#0F172A",      // Footer background
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
            <td class="header-padding" style="background: linear-gradient(135deg, ${BRAND.blue} 0%, ${BRAND.aqua} 100%); padding: 40px 48px; text-align: center;">
              <div style="font-size: 32px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                Talendro<span style="font-size: 14px; vertical-align: super; color: ${BRAND.aqua}; font-weight: 600;">™</span>
              </div>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 15px; font-weight: 500; font-style: italic;">Precision Matches. Faster results.</p>
            </td>
          </tr>

          <!-- Hero Section -->
          <tr>
            <td style="background-color: ${BRAND.soft}; padding: 32px 48px; text-align: center; border-bottom: 1px solid #e5e7eb;">
              <div style="font-size: 48px; margin-bottom: 12px;">🔐</div>
              <h1 class="email-title" style="color: ${BRAND.blue}; font-size: 26px; font-weight: 700; margin: 0 0 8px 0;">Access Your Dashboard</h1>
              <p style="color: ${BRAND.gray}; font-size: 16px; margin: 0;">Click the button below to securely sign in</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td class="content-padding" style="padding: 40px 48px;">
              <p style="margin: 0 0 28px 0; color: ${BRAND.slate}; font-size: 16px; line-height: 1.7;">
                Use this secure link to access your Talendro Interview Coach dashboard. This link is valid for <strong style="color: ${BRAND.blue};">1 hour</strong> and can only be used once.
              </p>
              
              <!-- CTA Button with VML fallback for Outlook -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 32px 0;">
                <tr>
                  <td align="center">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${magicLink}" style="height:52px;v-text-anchor:middle;width:220px;" arcsize="15%" stroke="f" fillcolor="${BRAND.blue}">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-family:sans-serif;font-size:17px;font-weight:bold;">Open Dashboard</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${magicLink}" class="cta-button" style="display: inline-block; mso-hide: all; background: ${BRAND.blue}; color: #ffffff !important; padding: 16px 40px; font-size: 17px; font-weight: 700; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 12px rgba(47, 109, 246, 0.3);">
                      Open Dashboard
                    </a>
                    <!--<![endif]-->
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

              <!-- Security Note -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0 0 0;">
                <tr>
                  <td style="background-color: #F0FDF4; border-left: 4px solid ${BRAND.aqua}; border-radius: 0 8px 8px 0; padding: 16px;">
                    <p style="margin: 0; color: ${BRAND.slate}; font-size: 14px;">
                      <strong>🔒 Security Note:</strong> This link expires in 1 hour. If you didn't request this email, you can safely ignore it.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td class="footer-padding" style="background-color: ${BRAND.navy}; padding: 32px 48px; text-align: center;">
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
