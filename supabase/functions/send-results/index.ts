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
    const resendKey = resendKeyRaw.trim();

    if (!resendKey) {
      logStep("Missing RESEND_API_KEY", { present: false });
      throw new Error("Email service is not configured");
    }

    logStep("Resend key loaded", {
      present: true,
      length: resendKey.length,
      startsWithRe: resendKey.startsWith("re_"),
    });

    const resend = new Resend(resendKey);

    const { session_id, email, session_type, results, prep_content } = await req.json();

    if (!session_id || !email) {
      throw new Error("session_id and email are required");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get session details
    const { data: session } = await supabaseClient
      .from("coaching_sessions")
      .select("*, chat_messages(*)")
      .eq("id", session_id)
      .single();

    logStep("Session retrieved", { sessionId: session_id });

    // Format the results for email
    const sessionTypeLabels = {
      quick_prep: "Quick Prep Packet",
      full_mock: "Full Mock Interview",
      premium_audio: "Premium Audio Interview",
      pro: "Pro Coaching Session"
    };

    const sessionLabel = sessionTypeLabels[session_type as keyof typeof sessionTypeLabels] || "Interview Coaching";

    // Convert markdown content to HTML if present
    const formatMarkdownToHtml = (markdown: string): string => {
      return markdown
        .replace(/^### (.+)$/gm, '<h3 style="color: #2F6DF6; font-size: 16px; margin-top: 20px;">$1</h3>')
        .replace(/^## (.+)$/gm, '<h2 style="color: #2F6DF6; font-size: 18px; margin-top: 24px;">$1</h2>')
        .replace(/^# (.+)$/gm, '<h1 style="color: #2F6DF6; font-size: 20px; margin-top: 28px;">$1</h1>')
        .replace(/^\* (.+)$/gm, '<li>$1</li>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');
    };

    // Build email HTML
    let emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #2C2F38; }
          .container { max-width: 700px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #2F6DF6, #00C4CC); padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
          .header h1 { color: white; margin: 0; font-size: 24px; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; }
          .section { margin-bottom: 24px; }
          .section h2 { color: #2F6DF6; font-size: 18px; margin-bottom: 12px; }
          .section p { margin: 8px 0; }
          .prep-content { background: #f8fafc; padding: 24px; border-radius: 8px; border-left: 4px solid #2F6DF6; }
          .prep-content h1, .prep-content h2, .prep-content h3 { color: #2F6DF6; }
          .prep-content ul { padding-left: 20px; }
          .prep-content li { margin: 8px 0; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
          .cta { display: inline-block; background: #2F6DF6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎯 Your ${sessionLabel} Results</h1>
          </div>
          <div class="content">
            <div class="section">
              <p>Thank you for completing your interview coaching session with Talendro™!</p>
            </div>
    `;

    // Add Quick Prep content if present
    if (prep_content) {
      const formattedContent = formatMarkdownToHtml(prep_content);
      emailHtml += `
        <div class="section">
          <h2>📋 Your Interview Prep Materials</h2>
          <div class="prep-content">
            <p>${formattedContent}</p>
          </div>
        </div>
      `;
    }

    // Add results content
    if (results) {
      if (results.overall_score) {
        emailHtml += `
          <div class="section">
            <h2>Overall Score: ${results.overall_score}/100</h2>
          </div>
        `;
      }
      
      if (results.strengths && results.strengths.length > 0) {
        emailHtml += `
          <div class="section">
            <h2>Your Strengths</h2>
            <ul>
              ${results.strengths.map((s: string) => `<li>${s}</li>`).join('')}
            </ul>
          </div>
        `;
      }

      if (results.improvements && results.improvements.length > 0) {
        emailHtml += `
          <div class="section">
            <h2>Areas for Improvement</h2>
            <ul>
              ${results.improvements.map((i: string) => `<li>${i}</li>`).join('')}
            </ul>
          </div>
        `;
      }

      if (results.recommendations) {
        emailHtml += `
          <div class="section">
            <h2>Recommendations</h2>
            <p>${results.recommendations}</p>
          </div>
        `;
      }
    }

    // Add transcript summary if available
    if (session?.chat_messages && session.chat_messages.length > 0) {
      emailHtml += `
        <div class="section">
          <h2>Session Summary</h2>
          <p>Your session included ${session.chat_messages.length} messages. Full transcript is available in your dashboard.</p>
        </div>
      `;
    }

    emailHtml += `
            <div class="section" style="text-align: center;">
              <p>Ready for more practice?</p>
              <a href="https://coach.talendro.com" class="cta">Start Another Session</a>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Talendro™ Interview Coach</p>
              <p>Questions? Reply to this email.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email
    let emailResponse;
    try {
      emailResponse = await resend.emails.send({
        from: "Talendro Interview Coach <greg@talendro.com>",
        to: [email],
        subject: `Your ${sessionLabel} Results - Talendro™`,
        html: emailHtml,
      });

      logStep("Email sent", { emailResponse });

      // Check if email actually sent successfully
      if (emailResponse.error) {
        logStep("Email API returned error", { error: emailResponse.error });
        throw new Error(`Email sending failed: ${emailResponse.error.message || 'Unknown error'}`);
      }
    } catch (emailError) {
      logStep("Email sending exception", { error: String(emailError) });
      throw new Error(`Failed to send email: ${emailError instanceof Error ? emailError.message : String(emailError)}`);
    }

    // Save results to database
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

    // Update session status to completed and store prep content
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
