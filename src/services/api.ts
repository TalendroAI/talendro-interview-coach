import { supabase } from "@/integrations/supabase/client";
import { SessionType, DiscountValidation } from "@/types/session";
import { reportSessionError, reportDiscountError } from "@/services/errorHandler";

export interface VerifyPaymentResponse {
  verified: boolean;
  session?: {
    id: string;
    email: string;
    session_type: string;
    status: string;
  };
  session_status?: 'active' | 'completed' | 'pending' | 'cancelled';
  session_results?: {
    overall_score?: number;
    strengths?: string[];
    improvements?: string[];
    recommendations?: string;
  };
  is_pro?: boolean;
  session_limit_reached?: boolean;
  next_reset?: string;
  message?: string;
}

export interface CheckUpgradeResponse {
  hasUpgradeCredit: boolean;
  upgradeCredit: number;
  upgradedFromType?: SessionType;
  upgradedFromSessionId?: string;
}

export async function checkUpgradeCredit(email: string, targetSessionType: SessionType): Promise<CheckUpgradeResponse> {
  // Pro subscriptions are NOT eligible for upgrade credits - they are recurring subscriptions
  // Upgrade credits only apply to single-purchase products upgrading to other single-purchase products
  if (targetSessionType === 'pro') {
    return { hasUpgradeCredit: false, upgradeCredit: 0 };
  }

  // Check for recent purchases in the last 24 hours that qualify for upgrade credit
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  // Only single-purchase products are eligible for upgrade path
  const TIER_ORDER: SessionType[] = ['quick_prep', 'full_mock', 'premium_audio'];
  const PRICE_MAP: Record<SessionType, number> = {
    quick_prep: 1200,
    full_mock: 2900,
    premium_audio: 4900,
    pro: 7900, // Keep for reference but Pro is excluded from upgrades
  };
  
  const currentTierIndex = TIER_ORDER.indexOf(targetSessionType);
  
  const { data: recentSessions, error } = await supabase
    .from("coaching_sessions")
    .select("*")
    .eq("email", email)
    .in("status", ["active", "completed"]) // paid sessions
    .gte("created_at", twentyFourHoursAgo)
    .order("created_at", { ascending: false });

  if (error || !recentSessions || recentSessions.length === 0) {
    return { hasUpgradeCredit: false, upgradeCredit: 0 };
  }

  let upgradeCredit = 0;
  let upgradedFromType: SessionType | undefined;
  let upgradedFromSessionId: string | undefined;

  for (const session of recentSessions) {
    const sessionType = session.session_type as SessionType;
    const sessionTierIndex = TIER_ORDER.indexOf(sessionType);
    
    // Only apply credit if upgrading to a higher tier
    if (sessionTierIndex >= 0 && sessionTierIndex < currentTierIndex) {
      const sessionPrice = PRICE_MAP[sessionType];
      if (sessionPrice > upgradeCredit) {
        upgradeCredit = sessionPrice;
        upgradedFromType = sessionType;
        upgradedFromSessionId = session.id;
      }
    }
  }

  return {
    hasUpgradeCredit: upgradeCredit > 0,
    upgradeCredit,
    upgradedFromType,
    upgradedFromSessionId,
  };
}

export async function validateDiscountCode(
  code: string,
  email: string,
  sessionType: SessionType
): Promise<DiscountValidation> {
  const { data, error } = await supabase.functions.invoke("validate-discount", {
    body: { code, email, session_type: sessionType },
  });

  if (error) {
    console.error("Validate discount error:", error);
    // Report discount validation errors to AI resolution system
    await reportDiscountError(
      error.message || "Failed to validate code",
      "validation_error",
      email,
      { action: "validate_discount", additionalInfo: { code, sessionType } }
    );
    return { valid: false, error: "Failed to validate code" };
  }

  // If the code is invalid, report it for tracking
  if (!data.valid && data.error) {
    const errorCode = data.error.includes("expired") ? "code_expired" 
      : data.error.includes("already used") ? "code_already_used"
      : data.error.includes("not applicable") ? "code_not_applicable"
      : data.error.includes("limit") ? "code_usage_limit_reached"
      : "code_not_found";
    
    await reportDiscountError(
      data.error,
      errorCode,
      email,
      { action: "validate_discount", additionalInfo: { code, sessionType } }
    );
  }

  return data;
}

export interface CreateCheckoutOptions {
  sessionType: SessionType;
  email: string;
  discountCodeId?: string;
  discountPercent?: number;
}

export async function createCheckout(
  sessionType: SessionType,
  email: string,
  discountCodeId?: string,
  discountPercent?: number
): Promise<string> {
  console.log('[FRONTEND] Calling create-checkout backend function', {
    sessionType,
    hasEmail: !!email,
    hasDiscountCode: !!discountCodeId,
    discountPercent,
  });

  // IMPORTANT: Use a direct fetch (with AbortController timeout) so checkout cannot hang indefinitely,
  // and so it does not depend on any local auth session state.
  const backendUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

  if (!backendUrl || !anonKey) {
    throw new Error('Backend configuration missing. Please refresh and try again.');
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 20000);

  let data: any;
  let requestId: string | null = null;

  try {
    const res = await fetch(`${backendUrl}/functions/v1/create-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      credentials: 'omit',
      body: JSON.stringify({
        session_type: sessionType,
        email,
        discount_code_id: discountCodeId,
        discount_percent: discountPercent,
      }),
      signal: controller.signal,
    });

    requestId = res.headers.get('sb-request-id');

    const text = await res.text();
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      const msg = data?.error ? String(data.error) : text || `Request failed (${res.status})`;
      throw new Error(`${msg}${requestId ? ` (request_id: ${requestId})` : ''}`);
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new Error('Checkout request timed out. Please try again.');
    }
    throw e;
  } finally {
    window.clearTimeout(timeoutId);
  }

  console.log('[FRONTEND] create-checkout response', {
    hasUrl: !!data?.url,
    requestId,
    host: (() => {
      try {
        return data?.url ? new URL(String(data.url)).host : null;
      } catch {
        return null;
      }
    })(),
  });

  const url = data?.url as string | undefined;
  const debug = data?.debug as
    | {
        stripe_key_type?: string;
        stripe_account_livemode?: boolean | null;
        checkout_url_host?: string | null;
      }
    | undefined;

  if (!url) {
    console.error('[FRONTEND] No URL in response:', data);
    throw new Error(`No checkout URL returned${requestId ? ` (request_id: ${requestId})` : ''}`);
  }

  // Guardrail: if the browser is still being sent to a deleted test payment link, stop here and surface proof.
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return null;
    }
  })();

  if (typeof url === 'string' && (url.includes('/test_') || host === 'buy.stripe.com')) {
    console.error('[FRONTEND] Unexpected checkout URL host/mode', { url, host, debug, requestId });
    throw new Error(
      `Checkout misconfigured: received ${host ?? 'unknown host'} (${debug?.stripe_key_type ?? 'key:unknown'}, livemode=${String(
        debug?.stripe_account_livemode
      )})${requestId ? ` (request_id: ${requestId})` : ''}`
    );
  }

  console.log('[FRONTEND] Checkout URL received:', { host, keyType: debug?.stripe_key_type, requestId });
  return url;
}


export async function verifyPayment(
  checkoutSessionId?: string,
  email?: string,
  sessionType?: SessionType
): Promise<VerifyPaymentResponse> {
  const { data, error } = await supabase.functions.invoke("verify-payment", {
    body: { 
      checkout_session_id: checkoutSessionId,
      email,
      session_type: sessionType
    },
  });

  if (error) {
    console.error("Verify payment error:", error);
    throw new Error(error.message || "Failed to verify payment");
  }

  return data;
}

export async function sendAIMessage(
  sessionId: string | undefined,
  sessionType: SessionType,
  message?: string,
  resume?: string,
  jobDescription?: string,
  companyUrl?: string,
  isInitial?: boolean,
  firstName?: string
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("ai-coach", {
    body: {
      session_id: sessionId,
      session_type: sessionType,
      message,
      resume,
      job_description: jobDescription,
      company_url: companyUrl,
      is_initial: isInitial,
      first_name: firstName,
    },
  });

  if (error) {
    // Try to extract the backend JSON error body from the Response stored in error.context
    let detailedMessage: string | undefined;
    try {
      const ctx = (error as any)?.context;
      if (ctx && typeof ctx.clone === "function") {
        try {
          const body = await ctx.clone().json();
          if (body?.error) {
            detailedMessage = String(body.error);
            if (body?.request_id) {
              detailedMessage += ` (request_id: ${String(body.request_id)})`;
            }
          }
        } catch {
          // ignore JSON parse errors
        }

        if (!detailedMessage) {
          try {
            const text = await ctx.clone().text();
            if (text) detailedMessage = text;
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    }

    const messageToUse = detailedMessage || (error as any)?.message || "Failed to get AI response";

    console.error("AI coach error:", error);
    await reportSessionError(
      messageToUse,
      "ai_connection_failed",
      undefined, // We don't always have email in this context
      sessionId,
      { action: "send_ai_message", sessionType, additionalInfo: { isInitial } }
    );

    throw new Error(messageToUse);
  }

  const assistantMessage = (data as any)?.message as string | undefined;
  if (!assistantMessage) {
    throw new Error("No message returned from AI");
  }

  return assistantMessage;
}

export async function sendSessionResults(
  sessionId: string,
  email: string,
  sessionType: SessionType,
  results?: {
    overall_score?: number;
    strengths?: string[];
    improvements?: string[];
    recommendations?: string;
  }
): Promise<void> {
  const { error } = await supabase.functions.invoke("send-results", {
    body: {
      session_id: sessionId,
      email,
      session_type: sessionType,
      results,
    },
  });

  if (error) {
    console.error("Send results error:", error);
    // Report session results sending errors
    await reportSessionError(
      error.message || "Failed to send results",
      "results_send_failed",
      email,
      sessionId,
      { action: "send_results", sessionType }
    );
    throw new Error(error.message || "Failed to send results");
  }
}
