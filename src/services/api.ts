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

  if (!data?.url) {
    console.error("[FRONTEND] No URL in response:", data);
    throw new Error("No checkout URL returned");
  }

  console.log('[FRONTEND] Checkout URL received:', data.url);
  return data.url;
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
