import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-PAYMENT] ${step}${detailsStr}`);
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
        customerEmail: checkoutSession.customer_email 
      });

      if (checkoutSession.payment_status === "paid") {
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
