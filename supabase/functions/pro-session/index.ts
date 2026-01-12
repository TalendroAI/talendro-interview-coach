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
  full_mock: 6,
  premium_audio: 2,
};

interface ProfileData {
  id: string;
  email: string;
  full_name?: string | null;
  user_id?: string | null;

  is_pro_subscriber: boolean | null;
  pro_subscription_start: string | null;
  pro_subscription_end: string | null;
  pro_cancel_at_period_end?: boolean | null;

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

const secondsToIso = (seconds?: number | null) => {
  if (!seconds || typeof seconds !== "number") return null;
  const d = new Date(seconds * 1000);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const isActiveSubscription = (sub: Stripe.Subscription) =>
  sub.status === "active" || sub.status === "trialing";

async function resolveCustomerId(stripe: Stripe, email: string, existingCustomerId: string | null) {
  if (existingCustomerId) return existingCustomerId;
  const customers = await stripe.customers.list({ email, limit: 1 });
  return customers.data[0]?.id ?? null;
}

async function resolveActiveSubscription(
  stripe: Stripe,
  customerId: string,
  existingSubscriptionId: string | null
) {
  if (existingSubscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(existingSubscriptionId);
      if (isActiveSubscription(sub)) return sub;
    } catch {
      // ignore and fall back to listing by customer
    }
  }

  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 10,
  });

  return subs.data.find(isActiveSubscription) ?? null;
}

// Ensures the profile has the subscription fields required by the dashboard.
// Returns the latest profile row (or null).
// deno-lint-ignore no-explicit-any
async function syncProProfileFromStripe(
  supabaseClient: any,
  stripe: Stripe,
  email: string,
  existingProfile: ProfileData | null
): Promise<ProfileData | null> {
  const customerId = await resolveCustomerId(stripe, email, existingProfile?.stripe_customer_id ?? null);

  if (!customerId) {
    // If we can't find the customer in Stripe, we can't treat them as Pro.
    if (existingProfile?.is_pro_subscriber) {
      await supabaseClient
        .from("profiles")
        .update({ is_pro_subscriber: false, updated_at: new Date().toISOString() })
        .eq("id", existingProfile.id);
    }
    return existingProfile;
  }

  const subscription = await resolveActiveSubscription(
    stripe,
    customerId,
    existingProfile?.stripe_subscription_id ?? null
  );

  if (!subscription || !isActiveSubscription(subscription)) {
    if (existingProfile?.is_pro_subscriber) {
      await supabaseClient
        .from("profiles")
        .update({
          is_pro_subscriber: false,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription?.id ?? existingProfile?.stripe_subscription_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingProfile.id);
    }
    return existingProfile;
  }

  const periodStart = secondsToIso(subscription.current_period_start);
  const periodEnd = secondsToIso(subscription.current_period_end);
  const subscriptionStart = secondsToIso(subscription.start_date) ?? periodStart;

  const updateData: Record<string, unknown> = {
    is_pro_subscriber: true,
    pro_subscription_end: periodEnd,
    pro_cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    updated_at: new Date().toISOString(),
  };

  // Only set these if missing to avoid overwriting historical anchors.
  if (!existingProfile?.pro_subscription_start && subscriptionStart) {
    updateData.pro_subscription_start = subscriptionStart;
  }
  if (!existingProfile?.pro_session_reset_date && (periodStart || subscriptionStart)) {
    updateData.pro_session_reset_date = periodStart ?? subscriptionStart;
    updateData.pro_mock_sessions_used = 0;
    updateData.pro_audio_sessions_used = 0;
  }

  if (existingProfile) {
    await supabaseClient.from("profiles").update(updateData).eq("id", existingProfile.id);
  } else {
    await supabaseClient.from("profiles").insert({
      email,
      is_pro_subscriber: true,
      pro_subscription_start: subscriptionStart,
      pro_subscription_end: periodEnd,
      pro_cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      pro_mock_sessions_used: 0,
      pro_audio_sessions_used: 0,
      pro_session_reset_date: periodStart ?? subscriptionStart,
      updated_at: new Date().toISOString(),
    });
  }

  const { data: refreshed } = await supabaseClient
    .from("profiles")
    .select("*")
    .ilike("email", email)
    .maybeSingle();

  return refreshed as ProfileData | null;
}

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
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-08-27.basil" });

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
        return await handleGetRemainingSessions(supabaseClient, stripe, email);
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
  const normalizedEmail = email.toLowerCase().trim();
  logStep("Checking Pro status", { email: normalizedEmail });

  // Load current profile (if any)
  const { data: profile, error: profileError } = await supabaseClient
    .from("profiles")
    .select("*")
    .ilike("email", normalizedEmail)
    .maybeSingle();

  if (profileError) {
    logStep("Error fetching profile", { error: profileError });
    throw profileError;
  }

  let typedProfile = profile as ProfileData | null;

  // Always attempt to sync from Stripe so the dashboard fields never stay blank.
  try {
    typedProfile = await syncProProfileFromStripe(supabaseClient, stripe, normalizedEmail, typedProfile);
  } catch (stripeError) {
    logStep("Stripe sync failed (falling back to cached profile)", { error: String(stripeError) });
  }

  // If we still look Pro, return cached values.
  if (typedProfile?.is_pro_subscriber) {
    const remaining = calculateRemainingSessions(typedProfile);

    return new Response(
      JSON.stringify({
        is_pro: true,
        subscription_start: typedProfile.pro_subscription_start,
        subscription_end: typedProfile.pro_subscription_end,
        remaining_sessions: remaining,
        reset_date: typedProfile.pro_session_reset_date,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  }

  return new Response(
    JSON.stringify({ is_pro: false, message: "No active Pro subscription found" }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    }
  );
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
  stripe: Stripe,
  email: string
) {
  const normalizedEmail = email.toLowerCase().trim();
  logStep("Getting remaining sessions", { email: normalizedEmail });

  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .ilike("email", normalizedEmail)
    .maybeSingle();

  if (error) {
    logStep("Error fetching profile", { error });
    throw error;
  }

  let typedProfile = profile as ProfileData | null;

  // Keep subscription fields synced so the dashboard can render dates reliably.
  try {
    typedProfile = await syncProProfileFromStripe(supabaseClient, stripe, normalizedEmail, typedProfile);
  } catch (e) {
    logStep("Stripe sync failed in get_remaining_sessions", { error: String(e) });
  }

  if (!typedProfile || !typedProfile.is_pro_subscriber) {
    return new Response(
      JSON.stringify({
        is_pro: false,
        remaining: null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
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

  return new Response(
    JSON.stringify({
      is_pro: true,
      subscription_end: typedProfile.pro_subscription_end,
      remaining: {
        quick_prep: { used: 0, limit: null, remaining: null }, // Unlimited
        full_mock: {
          used: mockUsed,
          limit: PRO_LIMITS.full_mock,
          remaining: Math.max(0, PRO_LIMITS.full_mock - mockUsed),
        },
        premium_audio: {
          used: audioUsed,
          limit: PRO_LIMITS.premium_audio,
          remaining: Math.max(0, PRO_LIMITS.premium_audio - audioUsed),
        },
      },
      next_reset: nextResetDate.toISOString(),
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    }
  );
}
