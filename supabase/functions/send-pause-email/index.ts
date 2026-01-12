import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-PAUSE-EMAIL] ${step}${detailsStr}`);
};

const EMAIL_MAX_WIDTH_DESKTOP = 920;
const EMAIL_MAX_WIDTH_TABLET = 720;

// TALENDRO BRAND COLORS
const BRAND = {
  blue: "#2F6DF6",      // Primary / CTAs
  aqua: "#00C4CC",      // Taglines / Highlights
  lime: "#A4F400",      // Accent
  slate: "#2C2F38",     // Body text / Dark backgrounds
  gray: "#9FA6B2",      // Secondary text
  soft: "#F4F7FF",      // Light background
};

const sessionTypeLabels: Record<string, string> = {
  quick_prep: "Quick Prep Session",
  full_mock: "Mock Interview",
  premium_audio: "Audio Mock Interview",
  pro: "Pro Coaching Session"
};

// Total question counts for each session type
const sessionQuestionCounts: Record<string, number> = {
  quick_prep: 5,
  full_mock: 10,
  premium_audio: 16,
  pro: 10
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const resendKeyRaw = Deno.env.get("RESEND_API_KEY") ?? "";
    const resendKey = resendKeyRaw
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\s+/g, "")
      .trim();

    if (!resendKey || resendKey.includes("*")) {
      throw new Error("Email service is not configured properly");
    }

    const resend = new Resend(resendKey);

    const {
      session_id,
      email,
      session_type,
      questions_completed,
      paused_at,
      is_reminder,
      app_url,
      job_title,
      company_name,
    } = await req.json();

    if (!session_id || !email) {
      throw new Error("session_id and email are required");
    }

    logStep("Processing pause email", {
      session_id,
      email: "***",
      session_type,
      questions_completed,
      is_reminder,
    });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify session exists
    const { data: session, error: sessionError } = await supabaseClient
      .from("coaching_sessions")
      .select("*")
      .eq("id", session_id)
      .single();

    if (sessionError || !session) {
      logStep("Invalid session", { sessionError });
      throw new Error("Invalid session ID");
    }

    // Build resume URL with session parameters
    const rawAppUrl = typeof app_url === 'string' ? app_url : '';
    const appUrl = rawAppUrl && rawAppUrl.startsWith('http')
      ? rawAppUrl.replace(/\/$/, '')
      : 'https://coach.talendro.com';

    const resumeUrl = `${appUrl}/interview-coach?resume_session=${session_id}&email=${encodeURIComponent(email)}`;

    const sessionLabel = sessionTypeLabels[session_type] || "Interview Session";
    const pausedDate = new Date(paused_at || session.paused_at);
    const expirationDate = new Date(pausedDate.getTime() + 24 * 60 * 60 * 1000);
    const hoursRemaining = Math.max(
      0,
      Math.floor((expirationDate.getTime() - Date.now()) / (1000 * 60 * 60))
    );

    const totalQuestions = sessionQuestionCounts[session_type] || 10;

    // Get position info from passed data or session
    const positionTitle = job_title || session.job_title || '';
    const positionCompany = company_name || session.company_name || '';
    const positionDisplay = positionTitle && positionCompany 
      ? `${positionTitle} at ${positionCompany}`
      : positionTitle || positionCompany || 'Not specified';

    const emailHtml = generatePauseEmail({
      sessionLabel,
      positionDisplay,
      expirationDate,
      hoursRemaining,
      resumeUrl,
      isReminder: is_reminder || false,
    });

    const subject = is_reminder
      ? `⚠️ Your Interview Session Expires in ${hoursRemaining} Hours`
      : "Your Talendro Interview Session is Paused";

    const primaryFrom = "Talendro Interview Coach <noreply@talendro.com>";
    const fallbackFrom = "Talendro Interview Coach <onboarding@resend.dev>";

    let emailResponse = await resend.emails.send({
      from: primaryFrom,
      reply_to: "support@talendro.com",
      to: [email],
      subject,
      html: emailHtml,
    });

    // If the custom domain isn't verified in the email provider, fall back to resend.dev
    if (emailResponse.error) {
      logStep("Primary sender failed; retrying with fallback sender", {
        error: emailResponse.error,
      });

      emailResponse = await resend.emails.send({
        from: fallbackFrom,
        reply_to: "support@talendro.com",
        to: [email],
        subject,
        html: emailHtml,
      });
    }

    logStep("Email sent", { emailResponse });

    const sendError = (emailResponse as any)?.error;
    if (sendError) {
      const msg =
        typeof sendError === "object" && sendError !== null
          ? String((sendError as any).message ?? JSON.stringify(sendError))
          : String(sendError);

      throw new Error(`Email sending failed: ${msg || "Unknown error"}`);
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: is_reminder ? "Reminder email sent" : "Pause confirmation email sent"
    }), {
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

interface PauseEmailParams {
  sessionLabel: string;
  positionDisplay: string;
  expirationDate: Date;
  hoursRemaining: number;
  resumeUrl: string;
  isReminder: boolean;
}

function generatePauseEmail(params: PauseEmailParams): string {
  const {
    sessionLabel,
    positionDisplay,
    expirationDate,
    hoursRemaining,
    resumeUrl,
    isReminder
  } = params;

  const formatDate = (date: Date) => {
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC',
    });
  };

  const headerTitle = isReminder 
    ? "Your Session Expires Soon!"
    : "Session Paused";

  const headerSubtitle = isReminder
    ? `Resume now — only ${hoursRemaining} hours left`
    : "You can resume anytime within 24 hours";

  const heroEmoji = isReminder ? "⏰" : "⏸️";
  const heroTitle = isReminder 
    ? "Don't Lose Your Progress!"
    : "Session Saved Successfully";
  const heroSubtitle = isReminder
    ? `Your interview session will expire in ${hoursRemaining} hours. Resume now to continue where you left off.`
    : "Your progress has been saved. Click below to pick up right where you left off.";

  // Use orange for urgent reminders, Talendro Blue for regular pause
  const headerBgColor = isReminder ? "#D97706" : BRAND.blue;
  const urgentAccentColor = "#D97706";

  const urgencyBanner = isReminder ? `
              <!-- Urgency Banner -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 28px 0;">
                <tr>
                  <td style="background-color: #FEF3E8; border: 2px solid ${urgentAccentColor}; padding: 20px; border-radius: 12px; text-align: center;">
                    <p style="margin: 0; color: ${urgentAccentColor}; font-size: 16px; font-weight: 700;">
                      ⚠️ Your progress will be lost if you don't resume by ${formatDate(expirationDate)} (UTC)
                    </p>
                  </td>
                </tr>
              </table>
  ` : '';

  return `
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
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
      .content-padding { padding: 24px 16px !important; }
      .header-padding { padding: 24px 16px !important; }
      .hero-padding { padding: 24px 16px !important; }
      .footer-padding { padding: 24px 16px !important; }
      .mobile-text-center { text-align: center !important; }
      h1.email-title { font-size: 22px !important; }
      .cta-button { padding: 16px 32px !important; font-size: 16px !important; }
    }
    @media only screen and (min-width: 600px) and (max-width: 899px) {
      .email-container { width: 94% !important; max-width: ${EMAIL_MAX_WIDTH_TABLET}px !important; }
    }
    @media only screen and (min-width: 900px) {
      .email-container { width: 100% !important; max-width: ${EMAIL_MAX_WIDTH_DESKTOP}px !important; }
    }
  </style>
</head>
<body id="body" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: ${BRAND.slate}; margin: 0; padding: 0; background-color: ${BRAND.soft}; width: 100% !important; -webkit-font-smoothing: antialiased;">
  <!--[if mso]>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${BRAND.soft};">
  <tr><td align="center" valign="top" style="padding: 24px 12px;">
  <table role="presentation" width="${EMAIL_MAX_WIDTH_DESKTOP}" cellpadding="0" cellspacing="0" border="0">
  <tr><td>
  <![endif]-->
  
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${BRAND.soft};">
    <tr>
      <td align="center" valign="top" style="padding: 24px 12px;">
        <table role="presentation" class="email-container" width="${EMAIL_MAX_WIDTH_DESKTOP}" cellpadding="0" cellspacing="0" border="0" style="width: ${EMAIL_MAX_WIDTH_DESKTOP}px; max-width: 100%; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td class="header-padding" style="background-color: ${headerBgColor}; padding: 40px 48px; text-align: center;">
              <div style="font-size: 36px; font-weight: 800; color: #ffffff; letter-spacing: -1px;">
                Talendro<span style="font-size: 16px; vertical-align: super; color: ${isReminder ? '#FEF3E8' : BRAND.aqua}; font-weight: 600;">™</span>
              </div>
              <h1 class="email-title" style="color: white; margin: 20px 0 0 0; font-size: 28px; font-weight: 700;">${headerTitle}</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 12px 0 0 0; font-size: 17px;">${headerSubtitle}</p>
            </td>
          </tr>
          <!-- Hero Banner -->
          <tr>
            <td class="hero-padding" style="background-color: ${isReminder ? '#FEF3E8' : BRAND.soft}; padding: 36px 48px; text-align: center; border-bottom: 1px solid #e5e7eb;">
              <div style="font-size: 56px; margin-bottom: 16px;">${heroEmoji}</div>
              <h2 style="color: ${BRAND.slate}; font-size: 22px; font-weight: 600; margin: 0 0 10px 0;">${heroTitle}</h2>
              <p style="color: ${BRAND.gray}; font-size: 16px; margin: 0;">${heroSubtitle}</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td class="content-padding" style="padding: 48px;">
              ${urgencyBanner}
              
              <!-- Session Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 28px 0;">
                <tr>
                  <td style="background-color: #f8fafc; border-left: 4px solid ${BRAND.blue}; padding: 24px; border-radius: 0 12px 12px 0;">
                    <p style="margin: 0 0 16px 0; color: ${BRAND.blue}; font-size: 17px; font-weight: 700;">📋 Session Details</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; color: ${BRAND.gray}; font-size: 15px; width: 140px;">Session Type:</td>
                        <td style="padding: 8px 0; color: ${BRAND.slate}; font-size: 15px; font-weight: 600;">${sessionLabel}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: ${BRAND.gray}; font-size: 15px;">Position:</td>
                        <td style="padding: 8px 0; color: ${BRAND.slate}; font-size: 15px; font-weight: 600;">${positionDisplay}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: ${BRAND.gray}; font-size: 15px;">Expires At:</td>
                        <td style="padding: 8px 0; color: ${isReminder ? urgentAccentColor : BRAND.slate}; font-size: 15px; font-weight: 600;">${formatDate(expirationDate)} (UTC)</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 32px 0;">
                <tr>
                  <td align="center">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${resumeUrl}" style="height:52px;v-text-anchor:middle;width:280px;" arcsize="15%" stroke="f" fillcolor="${isReminder ? urgentAccentColor : BRAND.blue}">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-family:sans-serif;font-size:18px;font-weight:bold;">Resume Your Interview →</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${resumeUrl}" class="cta-button" style="display: inline-block; mso-hide: all; background-color: ${isReminder ? urgentAccentColor : BRAND.blue}; color: #ffffff !important; padding: 18px 48px; font-size: 18px; font-weight: 700; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 12px rgba(47, 109, 246, 0.3);">
                      Resume Your Interview →
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>

              <!-- What Happens Next -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
                <tr>
                  <td style="background-color: ${BRAND.soft}; border: 1px solid ${BRAND.blue}; border-radius: 12px; padding: 24px;">
                    <p style="margin: 0 0 12px 0; color: ${BRAND.blue}; font-size: 17px; font-weight: 700;">✨ When You Resume</p>
                    <p style="margin: 8px 0; color: ${BRAND.slate}; font-size: 15px;">✓ Your coach will remember everything from before</p>
                    <p style="margin: 8px 0; color: ${BRAND.slate}; font-size: 15px;">✓ You'll pick up right where you left off</p>
                    <p style="margin: 8px 0; color: ${BRAND.slate}; font-size: 15px;">✓ No need to re-enter your documents</p>
                  </td>
                </tr>
              </table>

              <!-- Signature -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 28px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 16px 0; color: ${BRAND.slate}; font-size: 15px; line-height: 1.6;">
                      Good luck with the rest of your interview prep!
                    </p>
                    <p style="margin: 0; color: ${BRAND.slate}; font-size: 15px;">
                      <strong>Greg Jackson</strong><br>
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
              <p style="margin: 0 0 16px 0; color: ${BRAND.gray}; font-size: 14px;">
                Questions? <a href="mailto:support@talendro.com" style="color: ${BRAND.aqua}; text-decoration: none;">support@talendro.com</a>
              </p>
              <p style="margin: 0; color: ${BRAND.gray}; font-size: 12px;">
                © ${new Date().getFullYear()} Talendro™ — AI-Powered Interview Coaching
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
