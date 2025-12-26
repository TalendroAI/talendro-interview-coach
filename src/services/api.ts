import { supabase } from "@/integrations/supabase/client";
import { SessionType } from "@/types/session";

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
  message?: string;
}

export async function createCheckout(sessionType: SessionType, email: string): Promise<string> {
  console.log('[FRONTEND] Calling create-checkout edge function', { sessionType, email });

  const { data, error } = await supabase.functions.invoke("create-checkout", {
    body: { session_type: sessionType, email },
  });

  console.log('[FRONTEND] Edge function response:', { data, error });

  if (error) {
    console.error("[FRONTEND] Create checkout error:", error);
    throw new Error(error.message || "Failed to create checkout session");
  }

  const url = data?.url as string | undefined;
  const debug = data?.debug as
    | {
        stripe_key_type?: string;
        stripe_account_livemode?: boolean | null;
        checkout_url_host?: string | null;
      }
    | undefined;

  if (!url) {
    console.error("[FRONTEND] No URL in response:", data);
    throw new Error("No checkout URL returned");
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
    console.error('[FRONTEND] Unexpected checkout URL host/mode', { url, host, debug });
    throw new Error(
      `Checkout misconfigured: received ${host ?? 'unknown host'} (${debug?.stripe_key_type ?? 'key:unknown'}, livemode=${String(debug?.stripe_account_livemode)})`
    );
  }

  console.log('[FRONTEND] Checkout URL received:', { host, debug });
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
  isInitial?: boolean
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
    },
  });

  if (error) {
    console.error("AI coach error:", error);
    throw new Error(error.message || "Failed to get AI response");
  }

  return data.message;
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
    throw new Error(error.message || "Failed to send results");
  }
}
