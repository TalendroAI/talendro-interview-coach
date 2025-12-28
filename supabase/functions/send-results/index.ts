import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-RESULTS] ${step}${detailsStr}`);
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

    logStep("Resend key loaded", {
      present: Boolean(resendKey),
      rawLength: resendKeyRaw.length,
      length: resendKey.length,
      startsWithRe: resendKey.startsWith("re_"),
      containsStar: resendKey.includes("*"),
      normalized: resendKeyRaw !== resendKey,
    });

    if (!resendKey) {
      throw new Error("Email service is not configured");
    }

    if (resendKey.includes("*")) {
      throw new Error("Email service is misconfigured (API key appears masked)");
    }

    const resend = new Resend(resendKey);

    const { session_id, email, session_type, results, prep_content, test_email } = await req.json();

    // Test email mode
    if (test_email && email) {
      logStep("Test email mode triggered", { email, session_type });
      
      const testSessionType = session_type || "quick_prep";
      const sessionTypeLabels: Record<string, string> = {
        quick_prep: "Quick Prep Packet",
        full_mock: "Full Mock Interview",
        premium_audio: "Premium Audio Interview",
        pro: "Pro Coaching Session"
      };
      const sessionLabel = sessionTypeLabels[testSessionType] || "Interview Coaching";
      
      const testResults = {
        overall_score: 85,
        strengths: ["Clear communication style", "Strong STAR method usage", "Confident delivery"],
        improvements: ["Add more specific metrics", "Practice concise answers"],
        recommendations: "Focus on quantifying your achievements and practicing 2-minute response timing."
      };
      
      const testPrepContent = "### Company Overview\nAcme Corp is a leading technology company...\n\n### Key Interview Tips\n* Research the team structure\n* Prepare questions about growth opportunities";
      
      const emailHtml = generateResultsEmail(sessionLabel, testResults, testPrepContent, 5);
      
      const emailResult = await resend.emails.send({
        from: "Talendro Interview Coach <noreply@talendro.com>",
        reply_to: "greg@talendro.com",
        to: [email],
        subject: `[TEST] Your ${sessionLabel} Results - Talendro™`,
        html: emailHtml,
      });
      
      logStep("Test email sent", { emailResult });
      
      return new Response(JSON.stringify({ 
        success: true,
        message: "Test results email sent",
        emailResult 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (!session_id || !email) {
      throw new Error("session_id and email are required");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: session } = await supabaseClient
      .from("coaching_sessions")
      .select("*, chat_messages(*)")
      .eq("id", session_id)
      .single();

    logStep("Session retrieved", { sessionId: session_id });

    const sessionTypeLabels: Record<string, string> = {
      quick_prep: "Quick Prep Packet",
      full_mock: "Full Mock Interview",
      premium_audio: "Premium Audio Interview",
      pro: "Pro Coaching Session"
    };

    const sessionLabel = sessionTypeLabels[session_type as string] || "Interview Coaching";
    const messageCount = session?.chat_messages?.length || 0;

    const emailHtml = generateResultsEmail(sessionLabel, results, prep_content, messageCount);

    let emailResponse;
    try {
      emailResponse = await resend.emails.send({
        from: "Talendro Interview Coach <noreply@talendro.com>",
        reply_to: "greg@talendro.com",
        to: [email],
        subject: `Your ${sessionLabel} Results - Talendro™`,
        html: emailHtml,
      });

      logStep("Email sent", { emailResponse });

      if (emailResponse.error) {
        logStep("Email API returned error", { error: emailResponse.error });
        throw new Error(`Email sending failed: ${emailResponse.error.message || 'Unknown error'}`);
      }
    } catch (emailError) {
      logStep("Email sending exception", { error: String(emailError) });
      throw new Error(`Failed to send email: ${emailError instanceof Error ? emailError.message : String(emailError)}`);
    }

    await supabaseClient
      .from("session_results")
      .insert({
        session_id,
        overall_score: results?.overall_score,
        strengths: results?.strengths,
        improvements: results?.improvements,
        recommendations: results?.recommendations,
        email_sent: true,
        email_sent_at: new Date().toISOString()
      });

    await supabaseClient
      .from("coaching_sessions")
      .update({ 
        status: "completed",
        completed_at: new Date().toISOString(),
        prep_packet: prep_content ? { content: prep_content } : null
      })
      .eq("id", session_id);

    return new Response(JSON.stringify({ 
      success: true,
      message: "Results email sent successfully"
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

// Generate results email HTML with Talendro brand standards
function generateResultsEmail(sessionLabel: string, results: any, prep_content: string | null, messageCount: number): string {
  const formatMarkdownToHtml = (markdown: string): string => {
    return markdown
      .replace(/^### (.+)$/gm, '<h3 style="color: #2F6DF6; font-size: 16px; margin-top: 20px; margin-bottom: 8px;">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 style="color: #2F6DF6; font-size: 18px; margin-top: 24px; margin-bottom: 10px;">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 style="color: #2F6DF6; font-size: 20px; margin-top: 28px; margin-bottom: 12px;">$1</h1>')
      .replace(/^\* (.+)$/gm, '<li style="margin: 6px 0; color: #2C2F38;">$1</li>')
      .replace(/^- (.+)$/gm, '<li style="margin: 6px 0; color: #2C2F38;">$1</li>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p style="margin: 12px 0; color: #2C2F38;">')
      .replace(/\n/g, '<br>');
  };

  let emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    /* Force Outlook/Windows to render at proper width */
    body, table, td, div, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; }
    /* Reset styles */
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
    /* Prevent Apple blue links */
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
    /* Gmail fix */
    u + #body a { color: inherit; text-decoration: none; font-size: inherit; font-family: inherit; font-weight: inherit; line-height: inherit; }
    /* Samsung Mail */
    #MessageViewBody a { color: inherit; text-decoration: none; font-size: inherit; font-family: inherit; font-weight: inherit; line-height: inherit; }
  </style>
</head>
<body id="body" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #2C2F38; margin: 0; padding: 0; background-color: #f0f4f8; width: 100% !important; min-width: 100%;">
  <!--[if mso]>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td align="center" style="padding: 20px 0;">
  <![endif]-->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f0f4f8;">
    <tr>
      <td align="center" style="padding: 20px 10px;">
        <!--[if mso]>
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0">
        <tr><td>
        <![endif]-->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #2F6DF6; padding: 30px; text-align: center;">
              <div style="font-size: 32px; font-weight: 800; color: #ffffff; letter-spacing: -1px;">
                Talendro<span style="font-size: 14px; vertical-align: super; color: #00C4CC; font-weight: 600;">™</span>
              </div>
              <h1 style="color: white; margin: 16px 0 0 0; font-size: 26px; font-weight: 700;">Your ${sessionLabel} Results</h1>
              <p style="color: rgba(255,255,255,0.85); margin: 12px 0 0 0; font-size: 16px;">Your interview coaching session is complete</p>
            </td>
          </tr>
          <!-- Hero Banner -->
          <tr>
            <td style="background-color: #E8F4FE; padding: 30px; text-align: center; border-bottom: 1px solid #e5e7eb;">
              <div style="font-size: 48px; margin-bottom: 12px;">🎉</div>
              <h2 style="color: #2C2F38; font-size: 20px; font-weight: 600; margin: 0 0 8px 0;">Session Complete!</h2>
              <p style="color: #9FA6B2; font-size: 15px; margin: 0;">Here's everything you need to ace your interview</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 24px 0; font-size: 16px; color: #2C2F38;">Thank you for completing your interview coaching session with <strong>Talendro™</strong>! Below you'll find your personalized results and recommendations.</p>
  `;

  // Add prep content if present
  if (prep_content) {
    const formattedContent = formatMarkdownToHtml(prep_content);
    emailHtml += `
              <!-- Prep Materials -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
                <tr>
                  <td style="background-color: #f8fafc; border-left: 4px solid #2F6DF6; padding: 24px; border-radius: 0 12px 12px 0;">
                    <p style="margin: 0 0 16px 0; color: #2F6DF6; font-size: 17px; font-weight: 700;">📋 Your Interview Prep Materials</p>
                    <div style="color: #2C2F38; font-size: 15px;">${formattedContent}</div>
                  </td>
                </tr>
              </table>
    `;
  }

  // Add results content
  if (results) {
    if (results.overall_score) {
      emailHtml += `
              <!-- Score -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
                <tr>
                  <td style="background-color: #E8F4FE; border: 1px solid #2F6DF6; padding: 24px; border-radius: 12px; text-align: center;">
                    <p style="margin: 0 0 8px 0; color: #2F6DF6; font-size: 14px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700;">Overall Score</p>
                    <p style="margin: 0; font-size: 48px; font-weight: 800; color: #2F6DF6;">${results.overall_score}<span style="font-size: 24px; color: #9FA6B2;">/100</span></p>
                  </td>
                </tr>
              </table>
      `;
    }
    
    if (results.strengths && results.strengths.length > 0) {
      emailHtml += `
              <!-- Strengths -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
                <tr>
                  <td style="background: #E8F4FE; border: 1px solid #2F6DF6; border-radius: 12px; padding: 24px;">
                    <p style="margin: 0 0 16px 0; color: #2F6DF6; font-size: 17px; font-weight: 700;">💪 Your Strengths</p>
                    ${results.strengths.map((s: string) => `<p style="margin: 10px 0; color: #2C2F38; font-size: 15px;">✓ ${s}</p>`).join('')}
                  </td>
                </tr>
              </table>
      `;
    }

    if (results.improvements && results.improvements.length > 0) {
      emailHtml += `
              <!-- Improvements -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
                <tr>
                  <td style="background: #FEF3E8; border: 1px solid #F59E0B; border-radius: 12px; padding: 24px;">
                    <p style="margin: 0 0 16px 0; color: #D97706; font-size: 17px; font-weight: 700;">📈 Areas for Improvement</p>
                    ${results.improvements.map((i: string) => `<p style="margin: 10px 0; color: #2C2F38; font-size: 15px;">• ${i}</p>`).join('')}
                  </td>
                </tr>
              </table>
      `;
    }

    if (results.recommendations) {
      emailHtml += `
              <!-- Recommendations -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
                <tr>
                  <td style="background-color: #f8fafc; border-left: 4px solid #00C4CC; padding: 24px; border-radius: 0 12px 12px 0;">
                    <p style="margin: 0 0 12px 0; color: #00C4CC; font-size: 17px; font-weight: 700;">💡 Recommendations</p>
                    <p style="margin: 0; color: #2C2F38; font-size: 15px;">${results.recommendations}</p>
                  </td>
                </tr>
              </table>
      `;
    }
  }

  // Add session summary if messages exist
  if (messageCount > 0) {
    emailHtml += `
              <!-- Session Summary -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
                <tr>
                  <td style="background-color: #f8fafc; padding: 20px; border-radius: 12px; text-align: center;">
                    <p style="margin: 0; color: #9FA6B2; font-size: 14px;">Your session included <strong style="color: #2C2F38;">${messageCount} messages</strong></p>
                  </td>
                </tr>
              </table>
    `;
  }

  emailHtml += `
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 36px 0;">
                <tr>
                  <td align="center">
                    <p style="margin: 0 0 16px 0; color: #2C2F38; font-size: 16px;">Ready for more practice?</p>
                    <a href="https://coach.talendro.com/#products" style="display: inline-block; background-color: #2F6DF6; color: #ffffff; padding: 18px 48px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 16px;">Upgrade Your Prep →</a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 24px 0 0 0; font-size: 16px; color: #2C2F38;">Questions? Simply reply to this email. We're here to help you succeed.</p>
              
              <!-- Signature -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 36px; padding-top: 28px; border-top: 1px solid #e5e7eb;">
                <tr>
                  <td>
                    <p style="margin: 8px 0; color: #2C2F38;">Go crush that interview!</p>
                    <p style="margin: 8px 0; color: #2C2F38;"><strong>— Greg Jackson</strong><br>Founder, Talendro™</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #0F172A; padding: 36px 30px; text-align: center;">
              <div style="font-size: 24px; font-weight: 800; color: white; margin-bottom: 8px;">Talendro<span style="font-size: 12px; vertical-align: super; color: #00C4CC;">™</span></div>
              <p style="color: #00C4CC; font-style: italic; font-size: 15px; margin: 12px 0 20px 0;">"Your partner in interview success"</p>
              <p style="margin: 20px 0; font-size: 13px; color: #9FA6B2;">🇺🇸 American-Built • 🎖️ Veteran-Led • ✅ Recruiter-Tested</p>
              <p style="margin: 20px 0;">
                <a href="https://www.linkedin.com/company/talendro" style="color: #9FA6B2; text-decoration: none; margin: 0 12px; font-size: 14px;">LinkedIn</a>
                <a href="https://talendro.com" style="color: #9FA6B2; text-decoration: none; margin: 0 12px; font-size: 14px;">Website</a>
              </p>
              <p style="color: #9FA6B2; font-size: 12px; margin-top: 20px;">© ${new Date().getFullYear()} Talendro. All rights reserved.</p>
            </td>
          </tr>
        </table>
        <!--[if mso]>
        </td></tr></table>
        <![endif]-->
      </td>
    </tr>
  </table>
  <!--[if mso]>
  </td></tr></table>
  <![endif]-->
</body>
</html>
  `;

  return emailHtml;
}
