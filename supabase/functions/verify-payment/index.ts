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
const generateNewPurchaseEmail = (sessionType: string, email: string) => {
  const productName = PRICE_CONFIG[sessionType as keyof typeof PRICE_CONFIG]?.name || "Interview Coaching Session";
  const sessionUrl = `https://coach.talendro.com/interview-coach?session_type=${sessionType}&email=${encodeURIComponent(email)}`;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.8; color: #2C2F38; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: linear-gradient(135deg, #2F6DF6, #00C4CC); padding: 40px 30px; text-align: center; }
    .logo-text { font-size: 32px; font-weight: 700; color: white; margin-bottom: 8px; letter-spacing: -0.5px; }
    .logo-text span { color: #00C4CC; }
    .header h1 { color: white; margin: 0; font-size: 24px; font-weight: 600; }
    .header p { color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 16px; }
    .content { padding: 40px 30px; }
    .content p { margin: 16px 0; font-size: 16px; }
    .product-box { background: #f8fafc; border-left: 4px solid #2F6DF6; padding: 20px; margin: 24px 0; border-radius: 0 8px 8px 0; }
    .product-box h3 { margin: 0 0 8px 0; color: #2F6DF6; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
    .product-box a { margin: 0; font-size: 18px; font-weight: 600; color: #2C2F38; text-decoration: none; }
    .product-box a:hover { color: #2F6DF6; text-decoration: underline; }
    .cta-container { text-align: center; margin: 32px 0; }
    .cta { display: inline-block; background: #2F6DF6; color: #ffffff !important; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; }
    .cta:hover { background: #1e5bc6; }
    .what-next { background: #f0f9ff; border-radius: 8px; padding: 20px; margin: 24px 0; }
    .what-next h3 { margin: 0 0 12px 0; color: #2F6DF6; font-size: 16px; }
    .what-next ul { margin: 0; padding-left: 20px; }
    .what-next li { margin: 8px 0; color: #374151; }
    .signature { margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; }
    .signature p { margin: 8px 0; }
    .footer { background: #2C2F38; color: white; padding: 30px; text-align: center; }
    .footer p { margin: 8px 0; font-size: 14px; }
    .footer .tagline { color: #00C4CC; font-style: italic; margin-bottom: 16px; }
    .footer .badges { margin: 16px 0; font-size: 13px; }
    .footer .copyright { color: #9ca3af; font-size: 12px; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-text">Talendro<span>&trade;</span></div>
      <h1>Welcome!</h1>
      <p>Your interview coaching session is ready</p>
    </div>
    <div class="content">
      <p>Hi There!</p>
      
      <p>Thank you for choosing <strong>Talendro&trade; Interview Coach</strong>! Your purchase is confirmed and your session is ready to begin.</p>
      
      <div class="product-box">
        <h3>Your Purchase</h3>
        <a href="${sessionUrl}">${productName}</a>
      </div>
      
      <p>You now have access to everything included in your plan. Our AI-powered coaching system is designed to help you walk into your next interview with confidence.</p>
      
      <div class="what-next">
        <h3>What Happens Next?</h3>
        <ul>
          <li>Click the button below to start your session</li>
          <li>Upload your resume and job description for personalized coaching</li>
          <li>Complete your session and receive detailed feedback</li>
          <li>Get your results emailed to you automatically</li>
        </ul>
      </div>
      
      <div class="cta-container">
        <a href="${sessionUrl}" class="cta">Start Your Session</a>
      </div>
      
      <p>If you have any questions or need assistance, simply reply to this email. We're here to help you succeed.</p>
      
      <div class="signature">
        <p>Let's ace your next interview together.</p>
        <p><strong>&mdash; Greg Jackson</strong><br>Founder, Talendro&trade;</p>
      </div>
    </div>
    <div class="footer">
      <p class="tagline">Precision Matches. Faster Results.</p>
      <p><strong>Talendro&trade;</strong></p>
      <p class="badges">&#127482;&#127480; American-Built &bull; &#127894; Veteran-Led &bull; &#10004; Recruiter-Tested</p>
      <p class="copyright">&copy; ${new Date().getFullYear()} Talendro. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;
};

// Generate email HTML for upgrade purchase (Template B)
const generateUpgradeEmail = (sessionType: string, email: string, upgradeCredit: number, previousPurchase: string) => {
  const productName = PRICE_CONFIG[sessionType as keyof typeof PRICE_CONFIG]?.name || "Interview Coaching Session";
  const previousProductName = PRICE_CONFIG[previousPurchase as keyof typeof PRICE_CONFIG]?.name || previousPurchase;
  const sessionUrl = `https://coach.talendro.com/interview-coach?session_type=${sessionType}&email=${encodeURIComponent(email)}`;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.8; color: #2C2F38; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: linear-gradient(135deg, #2F6DF6, #00C4CC); padding: 40px 30px; text-align: center; }
    .logo-text { font-size: 32px; font-weight: 700; color: white; margin-bottom: 8px; letter-spacing: -0.5px; }
    .logo-text span { color: #00C4CC; }
    .header h1 { color: white; margin: 0; font-size: 24px; font-weight: 600; }
    .header p { color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 16px; }
    .content { padding: 40px 30px; }
    .content p { margin: 16px 0; font-size: 16px; }
    .product-box { background: #f8fafc; border-left: 4px solid #2F6DF6; padding: 20px; margin: 24px 0; border-radius: 0 8px 8px 0; }
    .product-box h3 { margin: 0 0 8px 0; color: #2F6DF6; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
    .product-box a { margin: 0; font-size: 18px; font-weight: 600; color: #2C2F38; text-decoration: none; }
    .product-box a:hover { color: #2F6DF6; text-decoration: underline; }
    .upgrade-details { background: #ecfdf5; border: 1px solid #10b981; padding: 20px; margin: 24px 0; border-radius: 8px; }
    .upgrade-details h3 { margin: 0 0 12px 0; color: #059669; font-size: 16px; }
    .upgrade-details ul { margin: 0; padding-left: 20px; }
    .upgrade-details li { margin: 8px 0; color: #065f46; }
    .cta-container { text-align: center; margin: 32px 0; }
    .cta { display: inline-block; background: #2F6DF6; color: #ffffff !important; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; }
    .cta:hover { background: #1e5bc6; }
    .what-next { background: #f0f9ff; border-radius: 8px; padding: 20px; margin: 24px 0; }
    .what-next h3 { margin: 0 0 12px 0; color: #2F6DF6; font-size: 16px; }
    .what-next ul { margin: 0; padding-left: 20px; }
    .what-next li { margin: 8px 0; color: #374151; }
    .signature { margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; }
    .signature p { margin: 8px 0; }
    .footer { background: #2C2F38; color: white; padding: 30px; text-align: center; }
    .footer p { margin: 8px 0; font-size: 14px; }
    .footer .tagline { color: #00C4CC; font-style: italic; margin-bottom: 16px; }
    .footer .badges { margin: 16px 0; font-size: 13px; }
    .footer .copyright { color: #9ca3af; font-size: 12px; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-text">Talendro<span>&trade;</span></div>
      <h1>Your Upgrade Is Complete</h1>
      <p>You're now on a more powerful plan</p>
    </div>
    <div class="content">
      <p>Hi There!</p>
      
      <p>Thank you for upgrading your Talendro&trade; experience! Your new plan is now active and ready to go.</p>
      
      <div class="product-box">
        <h3>Your Upgraded Plan</h3>
        <a href="${sessionUrl}">${productName}</a>
      </div>
      
      <div class="upgrade-details">
        <h3>&#128176; Upgrade Credit Applied</h3>
        <ul>
          <li><strong>Previous purchase:</strong> ${previousProductName}</li>
          <li><strong>Credit applied:</strong> $${(upgradeCredit / 100).toFixed(2)}</li>
          <li>Your previous purchase was automatically credited toward this upgrade</li>
        </ul>
      </div>
      
      <p>You now have full access to everything included in your enhanced plan. We're excited to help you take your interview preparation to the next level.</p>
      
      <div class="what-next">
        <h3>What's Included in Your Upgrade?</h3>
        <ul>
          <li>Enhanced AI coaching with deeper analysis</li>
          <li>More comprehensive feedback and recommendations</li>
          <li>Access to all features in your new tier</li>
        </ul>
      </div>
      
      <div class="cta-container">
        <a href="${sessionUrl}" class="cta">Continue Your Session</a>
      </div>
      
      <p>If you'd like guidance, strategic prep advice, or help getting the most from your new plan, reply to this email anytime. You've got support here.</p>
      
      <div class="signature">
        <p>Let's strengthen your next interview together.</p>
        <p><strong>&mdash; Greg Jackson</strong><br>Founder, Talendro&trade;</p>
      </div>
    </div>
    <div class="footer">
      <p class="tagline">Precision Matches. Faster Results.</p>
      <p><strong>Talendro&trade;</strong></p>
      <p class="badges">&#127482;&#127480; American-Built &bull; &#127894; Veteran-Led &bull; &#10004; Recruiter-Tested</p>
      <p class="copyright">&copy; ${new Date().getFullYear()} Talendro. All rights reserved.</p>
    </div>
  </div>
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
  previousPurchase: string
) => {
  const productName = PRICE_CONFIG[sessionType as keyof typeof PRICE_CONFIG]?.name || "Interview Coaching Session";
  
  const subject = isUpgrade 
    ? `Your Talendro Upgrade Is Complete 🚀`
    : `Welcome to Talendro™ - ${productName}`;
  
  const html = isUpgrade 
    ? generateUpgradeEmail(sessionType, email, upgradeCredit, previousPurchase)
    : generateNewPurchaseEmail(sessionType, email);
  
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
    
    const { checkout_session_id, email, session_type } = await req.json();
    
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

        // Send purchase confirmation email
        if (resend && customerEmail && sessionTypeFromMetadata) {
          try {
            await sendPurchaseEmail(
              resend,
              customerEmail,
              sessionTypeFromMetadata,
              isUpgrade,
              upgradeCredit,
              previousPurchase
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
