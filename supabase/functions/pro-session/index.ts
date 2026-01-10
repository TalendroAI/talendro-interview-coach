import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Pro monthly limits
const PRO_LIMITS = {
  quick_prep: Infinity, // Unlimited
  full_mock: 8,
  premium_audio: 4,
};

interface ProfileData {
  id: string;
  email: string;
  is_pro_subscriber: boolean | null;
  pro_subscription_end: string | null;
  pro_mock_sessions_used: number;
  pro_audio_sessions_used: number;
  pro_session_reset_date: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PRO-SESSION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!supabaseUrl || !supabaseServiceKey || !stripeSecretKey) {
      throw new Error("Missing required environment variables");
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-04-30.basil" });

    const { action, email, session_type } = await req.json();
    logStep("Request received", { action, email, session_type });

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    switch (action) {
      case "check_pro_status": {
        return await handleCheckProStatus(supabaseClient, stripe, email);
      }

      case "check_session_limit": {
        if (!session_type) {
          return new Response(JSON.stringify({ error: "session_type is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return await handleCheckSessionLimit(supabaseClient, email, session_type);
      }

      case "increment_session_count": {
        if (!session_type) {
          return new Response(JSON.stringify({ error: "session_type is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return await handleIncrementSessionCount(supabaseClient, email, session_type);
      }

      case "get_remaining_sessions": {
        return await handleGetRemainingSessions(supabaseClient, email);
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

// deno-lint-ignore no-explicit-any
async function handleCheckProStatus(
  supabaseClient: any,
  stripe: Stripe,
  email: string
) {
  logStep("Checking Pro status", { email });

  // First check profile for cached subscription status
  const { data: profile, error: profileError } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (profileError) {
    logStep("Error fetching profile", { error: profileError });
    throw profileError;
  }

  const typedProfile = profile as ProfileData | null;

  // If profile exists and shows active Pro, verify with Stripe
  if (typedProfile?.is_pro_subscriber) {
    // Check if subscription is still active in Stripe
    if (typedProfile.stripe_subscription_id) {
      try {
        const subscription = await stripe.subscriptions.retrieve(typedProfile.stripe_subscription_id);
        const isActive = subscription.status === 'active' || subscription.status === 'trialing';
        
        if (!isActive) {
          // Subscription is no longer active - update profile
          await supabaseClient
            .from("profiles")
            .update({ 
              is_pro_subscriber: false,
              updated_at: new Date().toISOString()
            })
            .eq("id", typedProfile.id);

          return new Response(JSON.stringify({ 
            is_pro: false, 
            message: "Subscription is no longer active" 
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }

        // Calculate remaining sessions
        const remaining = calculateRemainingSessions(typedProfile);

        return new Response(JSON.stringify({ 
          is_pro: true,
          subscription_end: typedProfile.pro_subscription_end,
          remaining_sessions: remaining,
          reset_date: typedProfile.pro_session_reset_date,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      } catch (stripeError) {
        logStep("Error checking Stripe subscription", { error: String(stripeError) });
        // Fall through to check by email
      }
    }

    // Fallback: Check pro_subscription_end date
    if (typedProfile.pro_subscription_end) {
      const endDate = new Date(typedProfile.pro_subscription_end);
      if (endDate > new Date()) {
        const remaining = calculateRemainingSessions(typedProfile);
        return new Response(JSON.stringify({ 
          is_pro: true,
          subscription_end: typedProfile.pro_subscription_end,
          remaining_sessions: remaining,
          reset_date: typedProfile.pro_session_reset_date,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }
  }

  // Check Stripe directly for active subscription
  try {
    const customers = await stripe.customers.list({ email, limit: 1 });
    if (customers.data.length > 0) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customers.data[0].id,
        status: "active",
        limit: 1,
      });

      if (subscriptions.data.length > 0) {
        const subscription = subscriptions.data[0];
        const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();

        // Update or create profile with subscription info
        if (typedProfile) {
          await supabaseClient
            .from("profiles")
            .update({
              is_pro_subscriber: true,
              pro_subscription_end: periodEnd,
              stripe_customer_id: customers.data[0].id,
              stripe_subscription_id: subscription.id,
              pro_session_reset_date: typedProfile.pro_session_reset_date || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", typedProfile.id);
        } else {
          await supabaseClient
            .from("profiles")
            .insert({
              email,
              is_pro_subscriber: true,
              pro_subscription_end: periodEnd,
              stripe_customer_id: customers.data[0].id,
              stripe_subscription_id: subscription.id,
              pro_mock_sessions_used: 0,
              pro_audio_sessions_used: 0,
              pro_session_reset_date: new Date().toISOString(),
            });
        }

        // Fetch updated profile for remaining sessions
        const { data: updatedProfile } = await supabaseClient
          .from("profiles")
          .select("*")
          .eq("email", email)
          .maybeSingle();

        const typedUpdatedProfile = updatedProfile as ProfileData | null;

        const remaining = calculateRemainingSessions(typedUpdatedProfile || {
          pro_mock_sessions_used: 0,
          pro_audio_sessions_used: 0,
        } as ProfileData);

        return new Response(JSON.stringify({ 
          is_pro: true,
          subscription_end: periodEnd,
          remaining_sessions: remaining,
          reset_date: typedUpdatedProfile?.pro_session_reset_date || new Date().toISOString(),
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }
  } catch (stripeError) {
    logStep("Error checking Stripe for subscription", { error: String(stripeError) });
  }

  return new Response(JSON.stringify({ 
    is_pro: false, 
    message: "No active Pro subscription found" 
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
}

function calculateRemainingSessions(profile: Partial<ProfileData>) {
  const mockUsed = profile.pro_mock_sessions_used || 0;
  const audioUsed = profile.pro_audio_sessions_used || 0;

  return {
    quick_prep: { used: 0, limit: null, remaining: null }, // Unlimited
    full_mock: { 
      used: mockUsed, 
      limit: PRO_LIMITS.full_mock, 
      remaining: Math.max(0, PRO_LIMITS.full_mock - mockUsed) 
    },
    premium_audio: { 
      used: audioUsed, 
      limit: PRO_LIMITS.premium_audio, 
      remaining: Math.max(0, PRO_LIMITS.premium_audio - audioUsed) 
    },
  };
}

// deno-lint-ignore no-explicit-any
async function handleCheckSessionLimit(
  supabaseClient: any,
  email: string,
  sessionType: string
) {
  logStep("Checking session limit", { email, sessionType });

  // Quick prep is unlimited
  if (sessionType === 'quick_prep') {
    return new Response(JSON.stringify({ 
      allowed: true, 
      remaining: null,
      limit: null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }

  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    logStep("Error fetching profile", { error });
    throw error;
  }

  const typedProfile = profile as ProfileData | null;

  if (!typedProfile || !typedProfile.is_pro_subscriber) {
    return new Response(JSON.stringify({ 
      allowed: false, 
      error: "No active Pro subscription",
      remaining: 0,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }

  // Check if we need to reset counters (30 days from reset date)
  let needsReset = false;
  if (typedProfile.pro_session_reset_date) {
    const resetDate = new Date(typedProfile.pro_session_reset_date);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    if (resetDate < thirtyDaysAgo) {
      needsReset = true;
    }
  } else {
    needsReset = true;
  }

  if (needsReset) {
    // Reset counters
    await supabaseClient
      .from("profiles")
      .update({
        pro_mock_sessions_used: 0,
        pro_audio_sessions_used: 0,
        pro_session_reset_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", typedProfile.id);

    // After reset, allow the session
    const limit = sessionType === 'full_mock' ? PRO_LIMITS.full_mock : PRO_LIMITS.premium_audio;
    return new Response(JSON.stringify({ 
      allowed: true, 
      remaining: limit,
      limit,
      reset_occurred: true,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }

  // Check current usage against limit
  const used = sessionType === 'full_mock' 
    ? typedProfile.pro_mock_sessions_used || 0
    : typedProfile.pro_audio_sessions_used || 0;

  const limit = sessionType === 'full_mock' 
    ? PRO_LIMITS.full_mock 
    : PRO_LIMITS.premium_audio;

  const remaining = Math.max(0, limit - used);
  const allowed = remaining > 0;

  // Calculate next reset date
  const resetDate = typedProfile.pro_session_reset_date 
    ? new Date(typedProfile.pro_session_reset_date)
    : new Date();
  const nextResetDate = new Date(resetDate);
  nextResetDate.setDate(nextResetDate.getDate() + 30);

  return new Response(JSON.stringify({ 
    allowed,
    remaining,
    limit,
    used,
    next_reset: nextResetDate.toISOString(),
    message: allowed ? undefined : `You've used all ${limit} ${sessionType === 'full_mock' ? 'Mock Interview' : 'Audio Mock'} sessions this month. Resets on ${nextResetDate.toLocaleDateString()}.`,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
}

// deno-lint-ignore no-explicit-any
async function handleIncrementSessionCount(
  supabaseClient: any,
  email: string,
  sessionType: string
) {
  logStep("Incrementing session count", { email, sessionType });

  // Quick prep doesn't count
  if (sessionType === 'quick_prep') {
    return new Response(JSON.stringify({ 
      ok: true, 
      message: "Quick prep does not count against limits" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }

  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (error || !profile) {
    return new Response(JSON.stringify({ 
      ok: false, 
      error: "Profile not found" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }

  const typedProfile = profile as ProfileData;

  const updateField = sessionType === 'full_mock' 
    ? 'pro_mock_sessions_used' 
    : 'pro_audio_sessions_used';

  const currentCount = sessionType === 'full_mock'
    ? typedProfile.pro_mock_sessions_used || 0
    : typedProfile.pro_audio_sessions_used || 0;

  const { error: updateError } = await supabaseClient
    .from("profiles")
    .update({
      [updateField]: currentCount + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", typedProfile.id);

  if (updateError) {
    logStep("Error incrementing count", { error: updateError });
    return new Response(JSON.stringify({ ok: false, error: "Failed to update count" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }

  logStep("Session count incremented", { 
    email, 
    sessionType, 
    newCount: currentCount + 1 
  });

  return new Response(JSON.stringify({ 
    ok: true, 
    new_count: currentCount + 1 
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
}

// deno-lint-ignore no-explicit-any
async function handleGetRemainingSessions(
  supabaseClient: any,
  email: string
) {
  logStep("Getting remaining sessions", { email });

  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    logStep("Error fetching profile", { error });
    throw error;
  }

  const typedProfile = profile as ProfileData | null;

  if (!typedProfile || !typedProfile.is_pro_subscriber) {
    return new Response(JSON.stringify({ 
      is_pro: false,
      remaining: null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }

  // Check if we need to reset counters
  let mockUsed = typedProfile.pro_mock_sessions_used || 0;
  let audioUsed = typedProfile.pro_audio_sessions_used || 0;
  let resetDate = typedProfile.pro_session_reset_date;

  if (resetDate) {
    const resetDateObj = new Date(resetDate);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    if (resetDateObj < thirtyDaysAgo) {
      // Counters would reset
      mockUsed = 0;
      audioUsed = 0;
      resetDate = new Date().toISOString();
    }
  }

  const nextResetDate = resetDate 
    ? new Date(new Date(resetDate).getTime() + 30 * 24 * 60 * 60 * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  return new Response(JSON.stringify({ 
    is_pro: true,
    subscription_end: typedProfile.pro_subscription_end,
    remaining: {
      quick_prep: { used: 0, limit: null, remaining: null }, // Unlimited
      full_mock: { 
        used: mockUsed, 
        limit: PRO_LIMITS.full_mock, 
        remaining: Math.max(0, PRO_LIMITS.full_mock - mockUsed) 
      },
      premium_audio: { 
        used: audioUsed, 
        limit: PRO_LIMITS.premium_audio, 
        remaining: Math.max(0, PRO_LIMITS.premium_audio - audioUsed) 
      },
    },
    next_reset: nextResetDate.toISOString(),
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
}
