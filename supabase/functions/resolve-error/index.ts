import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADMIN_EMAIL = "support@interviewcoachpro.com"; // Change to your email

// Responsive email width constants
const EMAIL_MAX_WIDTH_DESKTOP = 920;
const EMAIL_MAX_WIDTH_TABLET = 720;

// Error resolution knowledge base - AI uses this to resolve common issues
const ERROR_RESOLUTIONS = {
  session: {
    "session_not_found": {
      resolution: "The session may have expired or the link is invalid. Please start a new session from the homepage.",
      canAutoResolve: true
    },
    "session_expired": {
      resolution: "Your session has expired. Don't worry - if you've paid, you can start a fresh session. Your payment covers one complete session.",
      canAutoResolve: true
    },
    "ai_connection_failed": {
      resolution: "We're experiencing a temporary connection issue with our AI coach. Please wait 30 seconds and try again. If the issue persists, we'll get you sorted right away.",
      canAutoResolve: true
    },
    "session_already_completed": {
      resolution: "This session has already been completed. To start a new practice session, please purchase another session from our products page.",
      canAutoResolve: true
    }
  },
  discount: {
    "code_not_found": {
      resolution: "That discount code doesn't exist in our system. Please double-check the code and try again. Codes are case-sensitive.",
      canAutoResolve: true
    },
    "code_expired": {
      resolution: "This discount code has expired. Check our website or social media for current promotions!",
      canAutoResolve: true
    },
    "code_already_used": {
      resolution: "You've already used this discount code. Each code can only be used once per email address.",
      canAutoResolve: true
    },
    "code_not_applicable": {
      resolution: "This discount code isn't valid for the product you selected. Some codes are product-specific.",
      canAutoResolve: true
    },
    "code_usage_limit_reached": {
      resolution: "This discount code has reached its maximum number of uses. Check for other available promotions!",
      canAutoResolve: true
    }
  },
  general: {
    "network_error": {
      resolution: "We're having trouble connecting. Please check your internet connection and try again.",
      canAutoResolve: true
    },
    "rate_limit": {
      resolution: "You're sending requests too quickly. Please wait a moment and try again.",
      canAutoResolve: true
    }
  }
};

// Generate responsive email wrapper
const getResponsiveEmailWrapper = (title: string, subtitle: string) => `
<!DOCTYPE html>
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
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #f0f4f8; }
    .ExternalClass { width: 100%; }
    .ExternalClass, .ExternalClass p, .ExternalClass span, .ExternalClass font, .ExternalClass td, .ExternalClass div { line-height: 100%; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
    u + #body a { color: inherit; text-decoration: none; }
    #MessageViewBody a { color: inherit; text-decoration: none; }

    /* RESPONSIVE BREAKPOINTS */
    @media only screen and (max-width: 599px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .content-padding { padding: 24px 16px !important; }
      .header-padding { padding: 24px 16px !important; }
      .footer-padding { padding: 24px 16px !important; }
      h1.email-title { font-size: 22px !important; }
    }
    @media only screen and (min-width: 600px) and (max-width: 899px) {
      .email-container { width: 94% !important; max-width: ${EMAIL_MAX_WIDTH_TABLET}px !important; }
    }
    @media only screen and (min-width: 900px) {
      .email-container { width: 100% !important; max-width: ${EMAIL_MAX_WIDTH_DESKTOP}px !important; }
    }
  </style>
</head>
<body id="body" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #2C2F38; margin: 0; padding: 0; background-color: #f0f4f8; width: 100% !important; -webkit-font-smoothing: antialiased;">
  <!--[if mso]>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f0f4f8;">
  <tr><td align="center" valign="top" style="padding: 24px 12px;">
  <table role="presentation" width="${EMAIL_MAX_WIDTH_DESKTOP}" cellpadding="0" cellspacing="0" border="0">
  <tr><td>
  <![endif]-->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f0f4f8;">
    <tr>
      <td align="center" valign="top" style="padding: 24px 12px;">
        <table role="presentation" class="email-container" width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: ${EMAIL_MAX_WIDTH_DESKTOP}px; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td class="header-padding" style="background-color: #2F6DF6; padding: 40px 48px; text-align: center;">
              <div style="font-size: 36px; font-weight: 800; color: #ffffff; letter-spacing: -1px;">
                Talendro<span style="font-size: 16px; vertical-align: super; color: #00C4CC; font-weight: 600;">™</span>
              </div>
              <h1 class="email-title" style="color: white; margin: 20px 0 0 0; font-size: 28px; font-weight: 700;">${title}</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 12px 0 0 0; font-size: 17px;">${subtitle}</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td class="content-padding" style="padding: 48px;">
`;

const getResponsiveEmailFooter = () => `
              <!-- Signature -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 40px; padding-top: 32px; border-top: 1px solid #e5e7eb;">
                <tr>
                  <td>
                    <p style="margin: 10px 0; color: #2C2F38; font-size: 17px;">We're here to help!</p>
                    <p style="margin: 10px 0; color: #2C2F38; font-size: 17px;"><strong>— The Talendro™ Team</strong></p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td class="footer-padding" style="background-color: #0F172A; padding: 44px 48px; text-align: center;">
              <div style="font-size: 28px; font-weight: 800; color: white; margin-bottom: 12px;">Talendro<span style="font-size: 14px; vertical-align: super; color: #00C4CC;">™</span></div>
              <p style="color: #00C4CC; font-style: italic; font-size: 16px; margin: 14px 0 24px 0;">"Your partner in interview success"</p>
              <p style="margin: 24px 0; font-size: 14px; color: #9FA6B2;">🇺🇸 American-Built • 🎖️ Veteran-Led • ✅ Recruiter-Tested</p>
              <p style="margin: 24px 0;">
                <a href="https://www.linkedin.com/company/talendro" style="color: #9FA6B2; text-decoration: none; margin: 0 16px; font-size: 15px;">LinkedIn</a>
                <a href="https://talendro.com" style="color: #9FA6B2; text-decoration: none; margin: 0 16px; font-size: 15px;">Website</a>
              </p>
              <p style="color: #6B7280; font-size: 13px; margin-top: 24px;">© ${new Date().getFullYear()} Talendro. All rights reserved.</p>
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { 
      errorType, 
      errorCode, 
      errorMessage, 
      userEmail, 
      sessionId, 
      context 
    } = await req.json();

    console.log(`[resolve-error] Received error: ${errorType}/${errorCode} - ${errorMessage}`);

    // Step 1: Log the error
    const { data: errorLog, error: logError } = await supabase
      .from('error_logs')
      .insert({
        error_type: errorType,
        error_code: errorCode,
        error_message: errorMessage,
        user_email: userEmail,
        session_id: sessionId,
        context: context
      })
      .select()
      .single();

    if (logError) {
      console.error('[resolve-error] Failed to log error:', logError);
    }

    // Step 2: Try to resolve with known resolutions first
    let resolution: string | null = null;
    let canAutoResolve = false;

    if (errorType in ERROR_RESOLUTIONS && errorCode) {
      const typeResolutions = ERROR_RESOLUTIONS[errorType as keyof typeof ERROR_RESOLUTIONS] as Record<string, { resolution: string; canAutoResolve: boolean }>;
      const known = typeResolutions[errorCode];
      if (known) {
        resolution = known.resolution;
        canAutoResolve = known.canAutoResolve;
      }
    }

    // Step 3: If no known resolution, use AI to generate a helpful response
    if (!resolution && lovableApiKey) {
      console.log('[resolve-error] No known resolution, consulting AI...');
      
      try {
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: `You are a helpful customer support AI for Interview Coach Pro, an AI-powered interview preparation service. 
                
Your job is to help users who encounter errors. Be warm, empathetic, and solution-focused. Keep responses concise (2-3 sentences max).

The service offers:
- Quick Prep ($9): 5-minute AI interview prep
- Full Mock ($19): 30-minute practice interview
- Premium Audio ($29): Voice-based coaching

Common issues you can help with:
- Session problems: expired sessions, connection issues, AI not responding
- Discount codes: invalid, expired, already used, wrong product
- General: network issues, page not loading

If you can't resolve the issue, let them know a human will follow up shortly.`
              },
              {
                role: 'user',
                content: `A user encountered this error:
Type: ${errorType}
Code: ${errorCode || 'unknown'}
Message: ${errorMessage}
Context: ${JSON.stringify(context || {})}

Please provide a helpful, friendly response to resolve their issue.`
              }
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          resolution = aiData.choices?.[0]?.message?.content;
          canAutoResolve = true;
          console.log('[resolve-error] AI generated resolution:', resolution);
        }
      } catch (aiError) {
        console.error('[resolve-error] AI resolution failed:', aiError);
      }
    }

    // Step 4: Update error log with resolution attempt
    const wasResolved = !!resolution && canAutoResolve;
    
    if (errorLog?.id) {
      await supabase
        .from('error_logs')
        .update({
          ai_resolution_attempted: true,
          ai_resolution_successful: wasResolved,
          ai_resolution_response: resolution,
          resolved: wasResolved,
          resolved_at: wasResolved ? new Date().toISOString() : null,
          escalated_to_admin: !wasResolved
        })
        .eq('id', errorLog.id);
    }

    // Step 5: Send email to user with resolution (using responsive template)
    if (userEmail && resolution && resendApiKey) {
      try {
        const userEmailHtml = getResponsiveEmailWrapper(
          "We noticed an issue",
          "Let us help you get back on track"
        ) + `
              <p style="margin: 0 0 20px 0; font-size: 17px; color: #2C2F38;">Hi there,</p>
              <p style="margin: 20px 0; font-size: 17px; color: #2C2F38; line-height: 1.7;">We detected that you ran into a problem while using Talendro™ Interview Coach. Here's what happened and how we can help:</p>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
                <tr>
                  <td style="background-color: #f8fafc; border-left: 4px solid #F59E0B; padding: 24px; border-radius: 0 12px 12px 0;">
                    <p style="margin: 0 0 8px 0; color: #D97706; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">Issue Detected</p>
                    <p style="margin: 0; color: #2C2F38; font-size: 15px;">${errorMessage}</p>
                  </td>
                </tr>
              </table>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
                <tr>
                  <td style="background-color: #E8F4FE; border: 1px solid #2F6DF6; padding: 24px; border-radius: 12px;">
                    <p style="margin: 0 0 12px 0; color: #2F6DF6; font-size: 17px; font-weight: 700;">✅ Resolution</p>
                    <p style="margin: 0; color: #2C2F38; font-size: 15px; line-height: 1.6;">${resolution}</p>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 20px 0; font-size: 17px; color: #2C2F38; line-height: 1.6;">If you're still experiencing issues, simply reply to this email and a human will get back to you promptly.</p>
              
              <p style="margin: 20px 0; font-size: 17px; color: #2C2F38;">Best of luck with your interview prep!</p>
        ` + getResponsiveEmailFooter();

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Talendro Interview Coach <support@talendro.com>',
            to: userEmail,
            subject: "We're here to help - Issue Resolution",
            html: userEmailHtml,
          }),
        });
        console.log('[resolve-error] Resolution email sent to user');
      } catch (emailError) {
        console.error('[resolve-error] Failed to send user email:', emailError);
      }
    }

    // Step 6: Always notify admin (you) with a copy (also responsive)
    if (resendApiKey) {
      try {
        const adminEmailHtml = getResponsiveEmailWrapper(
          wasResolved ? '✅ Error Auto-Resolved' : '⚠️ Error Needs Attention',
          `${errorType}/${errorCode || 'unknown'}`
        ) + `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 28px 0; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #6B7280; width: 120px;">Time</td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #2C2F38;">${new Date().toISOString()}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #6B7280;">User</td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #2C2F38;">${userEmail || 'Unknown'}</td>
                </tr>
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #6B7280;">Type</td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #2C2F38;">${errorType}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #6B7280;">Code</td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #2C2F38;">${errorCode || 'N/A'}</td>
                </tr>
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #6B7280;">Message</td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #2C2F38;">${errorMessage}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; font-weight: 600; color: #6B7280; vertical-align: top;">Context</td>
                  <td style="padding: 12px 16px; color: #2C2F38;"><pre style="margin: 0; font-size: 12px; white-space: pre-wrap; word-break: break-word;">${JSON.stringify(context, null, 2)}</pre></td>
                </tr>
              </table>
              
              ${resolution ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
                <tr>
                  <td style="background-color: #E8F4FE; border: 1px solid #2F6DF6; padding: 24px; border-radius: 12px;">
                    <p style="margin: 0 0 12px 0; color: #2F6DF6; font-size: 17px; font-weight: 700;">AI Resolution Sent</p>
                    <p style="margin: 0; color: #2C2F38; font-size: 15px;">${resolution}</p>
                  </td>
                </tr>
              </table>
              ` : `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
                <tr>
                  <td style="background-color: #FEF3E8; border: 1px solid #F59E0B; padding: 24px; border-radius: 12px;">
                    <p style="margin: 0; color: #D97706; font-size: 17px; font-weight: 700;">⚠️ No auto-resolution available. Manual intervention may be needed.</p>
                  </td>
                </tr>
              </table>
              `}
        ` + getResponsiveEmailFooter();

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Talendro Interview Coach <support@talendro.com>',
            to: ADMIN_EMAIL,
            subject: `${wasResolved ? '[Resolved]' : '[NEEDS ATTENTION]'} Error: ${errorType}/${errorCode || 'unknown'}`,
            html: adminEmailHtml,
          }),
        });
        console.log('[resolve-error] Admin notification sent');

        // Update admin notified timestamp
        if (errorLog?.id) {
          await supabase
            .from('error_logs')
            .update({ admin_notified_at: new Date().toISOString() })
            .eq('id', errorLog.id);
        }
      } catch (adminEmailError) {
        console.error('[resolve-error] Failed to send admin email:', adminEmailError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        resolved: wasResolved,
        resolution: resolution,
        errorLogId: errorLog?.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[resolve-error] Function error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
