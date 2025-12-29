import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action = "append_turn" | "get_history" | "log_event";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Backend not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const body = await req.json().catch(() => ({}));

    const action = (body?.action as Action) ?? "append_turn";
    const sessionId = body?.sessionId as string | undefined;
    const email = body?.email as string | undefined;

    if (!sessionId || !email) {
      throw new Error("sessionId and email are required");
    }

    // Validate the requester matches the session.
    const { data: session, error: sessionError } = await supabase
      .from("coaching_sessions")
      .select("id,email,session_type")
      .eq("id", sessionId)
      .eq("email", email)
      .single();

    if (sessionError || !session) {
      throw new Error("Session not found for this email");
    }

    if (action === "get_history") {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id,role,content,created_at,question_number")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true })
        .limit(500);

      if (error) throw error;

      return new Response(JSON.stringify({ messages: data ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "append_turn") {
      const role = body?.role as string | undefined;
      const content = body?.content as string | undefined;
      const questionNumber = (body?.questionNumber as number | null | undefined) ?? null;

      if (!role || !content) {
        throw new Error("role and content are required");
      }

      const { error } = await supabase.from("chat_messages").insert({
        session_id: sessionId,
        role,
        content,
        question_number: questionNumber,
      });

      if (error) throw error;

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "log_event") {
      const eventType = (body?.eventType as string | undefined) ?? "audio_event";
      const message = (body?.message as string | undefined) ?? "(no message)";
      const code = (body?.code as string | undefined) ?? null;
      const context = (body?.context as Record<string, unknown> | null | undefined) ?? null;

      const { error } = await supabase.from("error_logs").insert({
        error_type: eventType,
        error_message: message,
        error_code: code,
        session_id: sessionId,
        user_email: email,
        context,
      });

      if (error) throw error;

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Unsupported action");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("audio-session error:", message);

    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
