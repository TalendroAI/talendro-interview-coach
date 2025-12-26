import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRICE_CONFIG = {
  quick_prep: { name: "Quick Prep Packet", amount: 1200 },
  full_mock: { name: "Full Mock Interview", amount: 2900 },
  premium_audio: { name: "Premium Audio Interview", amount: 4900 },
  pro: { name: "Pro Coaching Subscription", amount: 7900 },
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-PAYMENT] ${step}${detailsStr}`);
};

// Generate email HTML for new/standard purchase (Template A)
const generateNewPurchaseEmail = (sessionType: string, email: string, customerName?: string) => {
  const productName = PRICE_CONFIG[sessionType as keyof typeof PRICE_CONFIG]?.name || "Interview Coaching Session";
  const sessionUrl = `https://coach.talendro.com/interview-coach?session_type=${sessionType}&email=${encodeURIComponent(email)}`;
  const firstName = customerName ? customerName.split(' ')[0].charAt(0).toUpperCase() + customerName.split(' ')[0].slice(1).toLowerCase() : null;
  const greeting = firstName ? `Hi ${firstName}!` : 'Hi there!';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; margin: 0; padding: 0; background-color: #f0f4f8;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f4f8; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0d4b3e 100%); padding: 40px 30px; text-align: center;">
              <div style="font-size: 36px; font-weight: 800; color: white; letter-spacing: -1px;">
                Talendro<span style="font-size: 16px; vertical-align: super; color: #10b981; font-weight: 600;">™</span>
              </div>
              <h1 style="color: white; margin: 16px 0 0 0; font-size: 26px; font-weight: 700;">Welcome to Interview Success!</h1>
              <p style="color: rgba(255,255,255,0.85); margin: 10px 0 0 0; font-size: 16px;">Your coaching session is ready to begin</p>
            </td>
          </tr>
          <!-- Hero Banner -->
          <tr>
            <td style="background: linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%); padding: 30px; text-align: center; border-bottom: 1px solid #e5e7eb;">
              <div style="font-size: 48px; margin-bottom: 12px;">🎯</div>
              <h2 style="color: #0f172a; font-size: 20px; font-weight: 600; margin: 0 0 8px 0;">Be the Most Prepared Candidate in the Room</h2>
              <p style="color: #64748b; font-size: 15px; margin: 0;">AI-powered coaching backed by 30 years of recruiting experience</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #374151;">${greeting}</p>
              
              <p style="margin: 16px 0; font-size: 16px; color: #374151;">Thank you for choosing <strong>Talendro™ Interview Coach</strong>! Your purchase is confirmed and your personalized coaching session is ready.</p>
              
              <!-- Product Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
                <tr>
                  <td style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-left: 4px solid #10b981; padding: 24px; border-radius: 0 12px 12px 0;">
                    <p style="margin: 0 0 10px 0; color: #10b981; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700;">Your Purchase</p>
                    <p style="margin: 0; font-size: 20px; font-weight: 700; color: #0f172a;">${productName}</p>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 16px 0; font-size: 16px; color: #374151;">Our AI-powered coaching system is designed to help you walk into your next interview with unshakeable confidence.</p>
              
              <!-- What Happens Next -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
                <tr>
                  <td style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 24px;">
                    <p style="margin: 0 0 16px 0; color: #059669; font-size: 17px; font-weight: 700;">🚀 What Happens Next?</p>
                    <p style="margin: 10px 0; color: #374151; font-size: 15px;">• Click the button below to start your session</p>
                    <p style="margin: 10px 0; color: #374151; font-size: 15px;">• Upload your resume and job description for personalized coaching</p>
                    <p style="margin: 10px 0; color: #374151; font-size: 15px;">• Complete your session and receive detailed feedback</p>
                    <p style="margin: 10px 0; color: #374141; font-size: 15px;">• Get your results emailed to you automatically</p>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 36px 0;">
                <tr>
                  <td align="center">
                    <a href="${sessionUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; padding: 18px 48px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 16px;">Start Your Session →</a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 16px 0; font-size: 16px; color: #374151;">If you have any questions or need assistance, simply reply to this email. We're here to help you succeed.</p>
              
              <!-- Signature -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 36px; padding-top: 28px; border-top: 1px solid #e5e7eb;">
                <tr>
                  <td>
                    <p style="margin: 8px 0; color: #374151;">Let's ace your next interview together.</p>
                    <p style="margin: 8px 0; color: #374151;"><strong>— Greg Jackson</strong><br>Founder, Talendro™</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 36px 30px; text-align: center;">
              <div style="font-size: 24px; font-weight: 800; color: white; margin-bottom: 8px;">Talendro<span style="font-size: 12px; vertical-align: super; color: #10b981;">™</span></div>
              <p style="color: #10b981; font-style: italic; font-size: 15px; margin: 12px 0 20px 0;">"Your partner in interview success"</p>
              <p style="margin: 20px 0; font-size: 13px; color: #94a3b8;">🇺🇸 American-Built • 🎖️ Veteran-Led • ✅ Recruiter-Tested</p>
              <p style="margin: 20px 0;">
                <a href="https://www.linkedin.com/company/talendro" style="color: #94a3b8; text-decoration: none; margin: 0 12px; font-size: 14px;">LinkedIn</a>
                <a href="https://talendro.com" style="color: #94a3b8; text-decoration: none; margin: 0 12px; font-size: 14px;">Website</a>
              </p>
              <p style="color: #64748b; font-size: 12px; margin-top: 20px;">© ${new Date().getFullYear()} Talendro. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

// Generate email HTML for upgrade purchase (Template B)
const generateUpgradeEmail = (sessionType: string, email: string, upgradeCredit: number, previousPurchase: string, customerName?: string) => {
  const productName = PRICE_CONFIG[sessionType as keyof typeof PRICE_CONFIG]?.name || "Interview Coaching Session";
  const previousProductName = PRICE_CONFIG[previousPurchase as keyof typeof PRICE_CONFIG]?.name || previousPurchase;
  const sessionUrl = `https://coach.talendro.com/interview-coach?session_type=${sessionType}&email=${encodeURIComponent(email)}`;
  const firstName = customerName ? customerName.split(' ')[0].charAt(0).toUpperCase() + customerName.split(' ')[0].slice(1).toLowerCase() : null;
  const greeting = firstName ? `Hi ${firstName}!` : 'Hi there!';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; margin: 0; padding: 0; background-color: #f0f4f8;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f4f8; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0d4b3e 100%); padding: 40px 30px; text-align: center;">
              <div style="font-size: 36px; font-weight: 800; color: white; letter-spacing: -1px;">
                Talendro<span style="font-size: 16px; vertical-align: super; color: #10b981; font-weight: 600;">™</span>
              </div>
              <h1 style="color: white; margin: 16px 0 0 0; font-size: 26px; font-weight: 700;">🚀 Your Upgrade Is Complete!</h1>
              <p style="color: rgba(255,255,255,0.85); margin: 10px 0 0 0; font-size: 16px;">You're now on a more powerful plan</p>
            </td>
          </tr>
          <!-- Hero Banner -->
          <tr>
            <td style="background: linear-gradient(180deg, #ecfdf5 0%, #ffffff 100%); padding: 30px; text-align: center; border-bottom: 1px solid #e5e7eb;">
              <div style="font-size: 48px; margin-bottom: 12px;">⬆️</div>
              <h2 style="color: #0f172a; font-size: 20px; font-weight: 600; margin: 0 0 8px 0;">Unlocking Your Full Interview Potential</h2>
              <p style="color: #64748b; font-size: 15px; margin: 0;">Enhanced AI coaching with deeper, more personalized insights</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #374151;">${greeting}</p>
              
              <p style="margin: 16px 0; font-size: 16px; color: #374151;">Thank you for upgrading your <strong>Talendro™</strong> experience! Your enhanced plan is now active and ready to elevate your interview preparation.</p>
              
              <!-- Product Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
                <tr>
                  <td style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-left: 4px solid #10b981; padding: 24px; border-radius: 0 12px 12px 0;">
                    <p style="margin: 0 0 10px 0; color: #10b981; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700;">Your Upgraded Plan</p>
                    <p style="margin: 0; font-size: 20px; font-weight: 700; color: #0f172a;">${productName}</p>
                  </td>
                </tr>
              </table>
              
              <!-- Upgrade Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
                <tr>
                  <td style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border: 1px solid #10b981; padding: 24px; border-radius: 12px;">
                    <p style="margin: 0 0 16px 0; color: #059669; font-size: 17px; font-weight: 700;">💰 Upgrade Credit Applied</p>
                    <p style="margin: 10px 0; color: #065f46; font-size: 15px;"><strong>Previous purchase:</strong> ${previousProductName}</p>
                    <p style="margin: 10px 0; color: #065f46; font-size: 15px;"><strong>Credit applied:</strong> $${(upgradeCredit / 100).toFixed(2)}</p>
                    <p style="margin: 10px 0; color: #065f46; font-size: 15px;">Your previous purchase was automatically credited toward this upgrade</p>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 16px 0; font-size: 16px; color: #374151;">You now have full access to everything included in your enhanced plan. We're excited to help you take your interview preparation to the next level.</p>
              
              <!-- What's Included -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
                <tr>
                  <td style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 24px;">
                    <p style="margin: 0 0 16px 0; color: #059669; font-size: 17px; font-weight: 700;">✨ What's Included in Your Upgrade?</p>
                    <p style="margin: 10px 0; color: #374151; font-size: 15px;">• Enhanced AI coaching with deeper analysis</p>
                    <p style="margin: 10px 0; color: #374151; font-size: 15px;">• More comprehensive feedback and recommendations</p>
                    <p style="margin: 10px 0; color: #374151; font-size: 15px;">• Access to all features in your new tier</p>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 36px 0;">
                <tr>
                  <td align="center">
                    <a href="${sessionUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; padding: 18px 48px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 16px;">Continue Your Session →</a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 16px 0; font-size: 16px; color: #374151;">If you'd like guidance, strategic prep advice, or help getting the most from your new plan, reply to this email anytime. You've got support here.</p>
              
              <!-- Signature -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 36px; padding-top: 28px; border-top: 1px solid #e5e7eb;">
                <tr>
                  <td>
                    <p style="margin: 8px 0; color: #374151;">Let's strengthen your next interview together.</p>
                    <p style="margin: 8px 0; color: #374151;"><strong>— Greg Jackson</strong><br>Founder, Talendro™</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 36px 30px; text-align: center;">
              <div style="font-size: 24px; font-weight: 800; color: white; margin-bottom: 8px;">Talendro<span style="font-size: 12px; vertical-align: super; color: #10b981;">™</span></div>
              <p style="color: #10b981; font-style: italic; font-size: 15px; margin: 12px 0 20px 0;">"Your partner in interview success"</p>
              <p style="margin: 20px 0; font-size: 13px; color: #94a3b8;">🇺🇸 American-Built • 🎖️ Veteran-Led • ✅ Recruiter-Tested</p>
              <p style="margin: 20px 0;">
                <a href="https://www.linkedin.com/company/talendro" style="color: #94a3b8; text-decoration: none; margin: 0 12px; font-size: 14px;">LinkedIn</a>
                <a href="https://talendro.com" style="color: #94a3b8; text-decoration: none; margin: 0 12px; font-size: 14px;">Website</a>
              </p>
              <p style="color: #64748b; font-size: 12px; margin-top: 20px;">© ${new Date().getFullYear()} Talendro. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

// Send purchase confirmation email
const sendPurchaseEmail = async (
  resend: any,
  email: string,
  sessionType: string,
  isUpgrade: boolean,
  upgradeCredit: number,
  previousPurchase: string,
  customerName?: string
) => {
  const productName = PRICE_CONFIG[sessionType as keyof typeof PRICE_CONFIG]?.name || "Interview Coaching Session";
  const firstName = customerName ? customerName.split(' ')[0] : null;
  
  const subject = isUpgrade 
    ? `Your Talendro Upgrade Is Complete 🚀`
    : firstName 
      ? `${firstName}, Welcome to Talendro™ - ${productName}`
      : `Welcome to Talendro™ - ${productName}`;
  
  const html = isUpgrade 
    ? generateUpgradeEmail(sessionType, email, upgradeCredit, previousPurchase, customerName)
    : generateNewPurchaseEmail(sessionType, email, customerName);
  
  try {
    const result = await resend.emails.send({
      from: "Talendro Interview Coach <noreply@talendro.com>",
      reply_to: "greg@talendro.com",
      to: [email],
      subject,
      html,
    });
    
    logStep("Purchase confirmation email sent", { 
      email, 
      sessionType, 
      isUpgrade,
      customerName: customerName || 'not provided',
      result: result.data ? 'success' : 'failed',
      error: result.error 
    });
    
    return result;
  } catch (error) {
    logStep("Error sending purchase email", { error: String(error) });
    throw error;
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");
    
    const { checkout_session_id, email, session_type, test_email } = await req.json();
    
    // Test email mode - just send a sample email without verification
    if (test_email && email) {
      logStep("Test email mode triggered", { email, session_type });
      
      const resendKeyRaw = Deno.env.get("RESEND_API_KEY") ?? "";
      const resendKey = resendKeyRaw
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/\s+/g, "")
        .trim();
      
      if (!resendKey || resendKey.includes("*")) {
        return new Response(JSON.stringify({ 
          error: "RESEND_API_KEY not configured properly" 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        });
      }
      
      const resend = new Resend(resendKey);
      const testSessionType = session_type || "quick_prep";
      const emailHtml = generateNewPurchaseEmail(testSessionType, email, "Test User");
      
      const emailResult = await resend.emails.send({
        from: "Talendro Interview Coach <coaching@talendro.com>",
        to: [email],
        subject: "🎯 [TEST] Your Talendro Interview Coaching Session is Ready!",
        html: emailHtml,
      });
      
      logStep("Test email sent", { emailResult });
      
      return new Response(JSON.stringify({ 
        success: true,
        message: "Test email sent",
        emailResult 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    
    if (!checkout_session_id && !email) {
      throw new Error("checkout_session_id or email is required");
    }

    logStep("Request validated", { checkout_session_id, email, session_type });

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

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

    const resend = resendKey && !resendKey.includes("*") ? new Resend(resendKey) : null;

    if (!resendKey) {
      logStep("WARNING: RESEND_API_KEY missing/blank - emails will not be sent");
    } else if (resendKey.includes("*")) {
      logStep("WARNING: RESEND_API_KEY appears masked - emails will not be sent");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // If we have a checkout session ID, verify it
    if (checkout_session_id) {
      const checkoutSession = await stripe.checkout.sessions.retrieve(checkout_session_id);
      
      logStep("Retrieved checkout session", { 
        status: checkoutSession.payment_status,
        customerEmail: checkoutSession.customer_email,
        metadata: checkoutSession.metadata
      });

      if (checkoutSession.payment_status === "paid") {
        const sessionTypeFromMetadata = checkoutSession.metadata?.session_type || session_type;
        const customerEmail = checkoutSession.customer_email || email;
        
        // FIRST: Check if session for this checkout is already completed
        const { data: existingSession } = await supabaseClient
          .from("coaching_sessions")
          .select("*, session_results(*)")
          .eq("stripe_checkout_session_id", checkout_session_id)
          .single();
        
        if (existingSession?.status === "completed") {
          logStep("Session already completed", { sessionId: existingSession.id });
          
          // Fetch session results if not already included
          const sessionResults = existingSession.session_results?.[0] || null;
          
          return new Response(JSON.stringify({ 
            verified: false, 
            session: existingSession,
            session_status: "completed",
            session_results: sessionResults,
            message: "Session already completed"
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
        
        // Update the session status to active
        const { data: updatedSession, error: updateError } = await supabaseClient
          .from("coaching_sessions")
          .update({ 
            status: "active",
            stripe_payment_intent_id: checkoutSession.payment_intent as string
          })
          .eq("stripe_checkout_session_id", checkout_session_id)
          .select()
          .single();

        if (updateError) {
          logStep("Error updating session", { error: updateError });
        } else {
          logStep("Session updated to active", { sessionId: updatedSession?.id });
        }

        // Check if this was an upgrade (has upgrade credit in metadata)
        const upgradeCredit = checkoutSession.metadata?.upgrade_credit_applied 
          ? parseFloat(checkoutSession.metadata.upgrade_credit_applied) * 100 
          : 0;
        const upgradedFromSession = checkoutSession.metadata?.upgraded_from_session;
        
        // Determine if this is an upgrade based on metadata
        const isUpgrade = upgradeCredit > 0 && upgradedFromSession;
        
        // Get previous purchase type if this is an upgrade
        let previousPurchase = '';
        if (isUpgrade && upgradedFromSession) {
          const { data: previousSession } = await supabaseClient
            .from("coaching_sessions")
            .select("session_type")
            .eq("id", upgradedFromSession)
            .single();
          
          previousPurchase = previousSession?.session_type || '';
        }

        // Get customer name from Stripe checkout session
        const customerName = checkoutSession.customer_details?.name || undefined;

        // Send purchase confirmation email
        if (resend && customerEmail && sessionTypeFromMetadata) {
          try {
            await sendPurchaseEmail(
              resend,
              customerEmail,
              sessionTypeFromMetadata,
              isUpgrade,
              upgradeCredit,
              previousPurchase,
              customerName
            );
          } catch (emailError) {
            // Don't fail the whole request if email fails
            logStep("Email sending failed but continuing", { error: String(emailError) });
          }
        }

        return new Response(JSON.stringify({ 
          verified: true, 
          session: updatedSession,
          session_status: "active",
          message: "Payment verified successfully"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      } else {
        return new Response(JSON.stringify({ 
          verified: false, 
          message: "Payment not completed"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    // If no checkout session ID, check for active session by email first
    const { data: activeSession, error: activeError } = await supabaseClient
      .from("coaching_sessions")
      .select("*")
      .eq("email", email)
      .eq("session_type", session_type)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeError) {
      logStep("Error fetching active session", { error: activeError });
    }

    if (activeSession) {
      logStep("Active session found", { sessionId: activeSession.id });
      return new Response(JSON.stringify({ 
        verified: true, 
        session: activeSession,
        session_status: "active",
        message: "Active session found"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check for completed session by email
    const { data: completedSession, error: completedError } = await supabaseClient
      .from("coaching_sessions")
      .select("*")
      .eq("email", email)
      .eq("session_type", session_type)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (completedError) {
      logStep("Error fetching completed session", { error: completedError });
    }

    if (completedSession) {
      logStep("Completed session found", { sessionId: completedSession.id });
      
      // Also fetch the session results if available
      const { data: sessionResults } = await supabaseClient
        .from("session_results")
        .select("*")
        .eq("session_id", completedSession.id)
        .maybeSingle();

      return new Response(JSON.stringify({ 
        verified: false, 
        session: completedSession,
        session_status: "completed",
        session_results: sessionResults,
        message: "Session already completed"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check for Pro subscription
    const customers = await stripe.customers.list({ email, limit: 1 });
    if (customers.data.length > 0) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customers.data[0].id,
        status: "active",
        limit: 1,
      });

      if (subscriptions.data.length > 0) {
        // Create a new session for pro subscriber
        const { data: newSession, error: createError } = await supabaseClient
          .from("coaching_sessions")
          .insert({
            email,
            session_type: session_type || "pro",
            status: "active",
          })
          .select()
          .single();

        if (!createError) {
          return new Response(JSON.stringify({ 
            verified: true, 
            session: newSession,
            session_status: "active",
            is_pro: true,
            message: "Pro subscriber verified"
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      }
    }

    return new Response(JSON.stringify({ 
      verified: false, 
      message: "No valid payment or subscription found"
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
