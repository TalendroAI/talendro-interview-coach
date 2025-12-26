import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADMIN_EMAIL = "support@interviewcoachpro.com"; // Change to your email

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

    // Step 5: Send email to user with resolution
    if (userEmail && resolution && resendApiKey) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Interview Coach Pro <support@interviewcoachpro.com>',
            to: userEmail,
            subject: 'We\'re here to help - Issue Resolution',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1a1a2e;">We noticed an issue</h2>
                <p>Hi there,</p>
                <p>We detected that you ran into a problem while using Interview Coach Pro. Here's what happened and how we can help:</p>
                
                <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0;"><strong>Issue:</strong> ${errorMessage}</p>
                </div>
                
                <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0;"><strong>Resolution:</strong> ${resolution}</p>
                </div>
                
                <p>If you're still experiencing issues, simply reply to this email and a human will get back to you promptly.</p>
                
                <p>Best of luck with your interview prep!</p>
                <p>- The Interview Coach Pro Team</p>
              </div>
            `,
          }),
        });
        console.log('[resolve-error] Resolution email sent to user');
      } catch (emailError) {
        console.error('[resolve-error] Failed to send user email:', emailError);
      }
    }

    // Step 6: Always notify admin (you) with a copy
    if (resendApiKey) {
      try {
        const adminEmailBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: ${wasResolved ? '#2e7d32' : '#c62828'};">
              ${wasResolved ? '✅ Error Auto-Resolved' : '⚠️ Error Needs Attention'}
            </h2>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Time:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${new Date().toISOString()}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>User:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${userEmail || 'Unknown'}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Type:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${errorType}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Code:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${errorCode || 'N/A'}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Message:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${errorMessage}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Context:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;"><pre>${JSON.stringify(context, null, 2)}</pre></td></tr>
            </table>
            
            ${resolution ? `
            <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <strong>AI Resolution Sent:</strong><br/>
              ${resolution}
            </div>
            ` : `
            <div style="background: #ffebee; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <strong>⚠️ No auto-resolution available. Manual intervention may be needed.</strong>
            </div>
            `}
          </div>
        `;

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Interview Coach Pro <support@interviewcoachpro.com>',
            to: ADMIN_EMAIL,
            subject: `${wasResolved ? '[Resolved]' : '[NEEDS ATTENTION]'} Error: ${errorType}/${errorCode || 'unknown'}`,
            html: adminEmailBody,
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
