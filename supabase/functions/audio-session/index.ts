import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action =
  | "append_turn"
  | "get_history"
  | "get_session"
  | "save_documents"
  | "log_event"
  | "pause_session"
  | "resume_session"
  | "get_paused_sessions"
  | "abandon_session";

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
    const app_url = body?.app_url as string | undefined;

    // For get_paused_sessions, only email is required
    if (action === "get_paused_sessions") {
      if (!email) {
        throw new Error("email is required");
      }

      // Find sessions that are paused (paused_at IS NOT NULL) and not expired (within 24 hours)
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from("coaching_sessions")
        .select("id, session_type, paused_at, current_question_number, created_at")
        .eq("email", email)
        .eq("status", "active")
        .not("paused_at", "is", null)
        .gte("paused_at", twentyFourHoursAgo)
        .order("paused_at", { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify({ sessions: data ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!sessionId || !email) {
      throw new Error("sessionId and email are required");
    }

    // Validate the requester matches the session.
    const { data: session, error: sessionError } = await supabase
      .from("coaching_sessions")
      .select(
        "id, email, session_type, paused_at, current_question_number, status, resume_text, job_description, company_url, first_name"
      )
      .eq("id", sessionId)
      .eq("email", email)
      .single();

    if (sessionError || !session) {
      throw new Error("Session not found for this email");
    }

    // === GET SESSION (docs + metadata for deep links) ===
    if (action === "get_session") {
      return new Response(
        JSON.stringify({
          ok: true,
          session: {
            id: session.id,
            sessionType: session.session_type,
            status: session.status,
            pausedAt: session.paused_at,
            currentQuestionNumber: session.current_question_number,
            documents: {
              firstName: session.first_name ?? "",
              resume: session.resume_text ?? "",
              jobDescription: session.job_description ?? "",
              companyUrl: session.company_url ?? "",
            },
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === SAVE DOCUMENTS (persists resume/job/company/first name for resume links) ===
    if (action === "save_documents") {
      const resume =
        (body?.resume as string | undefined) ??
        (body?.resume_text as string | undefined) ??
        null;
      const jobDescription =
        (body?.jobDescription as string | undefined) ??
        (body?.job_description as string | undefined) ??
        null;
      const companyUrl =
        (body?.companyUrl as string | undefined) ??
        (body?.company_url as string | undefined) ??
        null;
      const firstName =
        (body?.firstName as string | undefined) ??
        (body?.first_name as string | undefined) ??
        null;

      const { error } = await supabase
        .from("coaching_sessions")
        .update({
          resume_text: resume,
          job_description: jobDescription,
          company_url: companyUrl,
          first_name: firstName,
        })
        .eq("id", sessionId);

      if (error) throw error;

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === GET HISTORY ===
    if (action === "get_history") {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, role, content, created_at, question_number")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true })
        .limit(500);

      if (error) throw error;

      return new Response(
        JSON.stringify({
          messages: data ?? [],
          sessionStatus: session.status,
          pausedAt: session.paused_at,
          currentQuestionNumber: session.current_question_number,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === APPEND TURN ===
    if (action === "append_turn") {
      const role = body?.role as string | undefined;
      const content = body?.content as string | undefined;
      const questionNumber = (body?.questionNumber as number | null | undefined) ?? null;

      if (!role || !content) {
        throw new Error("role and content are required");
      }

      // Deduplicate: check if same content was just inserted
      const { data: recent } = await supabase
        .from("chat_messages")
        .select("id, content")
        .eq("session_id", sessionId)
        .eq("role", role)
        .order("created_at", { ascending: false })
        .limit(1);

      if (recent && recent.length > 0 && recent[0].content === content) {
        // Already exists, skip insert
        return new Response(JSON.stringify({ ok: true, duplicate: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabase.from("chat_messages").insert({
        session_id: sessionId,
        role,
        content,
        question_number: questionNumber,
      });

      if (error) throw error;

      // Update current question number if provided
      if (questionNumber !== null) {
        await supabase
          .from("coaching_sessions")
          .update({ current_question_number: questionNumber })
          .eq("id", sessionId);
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === LOG EVENT ===
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

    // === PAUSE SESSION ===
    if (action === "pause_session") {
      const pausedAt = new Date().toISOString();

      // Compute progress from DB (not client):
      // - Count assistant messages that contain "?" (questions asked)
      // - If the last message is an assistant question, assume it is unanswered → completed = asked - 1
      const { count: askedCount, error: countError } = await supabase
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("session_id", sessionId)
        .eq("role", "assistant")
        .ilike("content", "%?%");

      if (countError) throw countError;

      const { data: lastMsg, error: lastMsgError } = await supabase
        .from("chat_messages")
        .select("role, content")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (lastMsgError) throw lastMsgError;

      const lastRole = (lastMsg?.[0]?.role as string | undefined) ?? null;
      const lastContent = (lastMsg?.[0]?.content as string | undefined) ?? "";

      const questionsAsked = askedCount ?? 0;
      const lastWasUnansweredQuestion = lastRole === "assistant" && lastContent.includes("?");
      const questionsCompleted = lastWasUnansweredQuestion
        ? Math.max(questionsAsked - 1, 0)
        : questionsAsked;

      const { error } = await supabase
        .from("coaching_sessions")
        .update({
          paused_at: pausedAt,
          current_question_number: questionsCompleted,
        })
        .eq("id", sessionId);

      if (error) throw error;

      // Log the pause event
      await supabase.from("error_logs").insert({
        error_type: "session_paused",
        error_message: `Session paused at question ${questionsCompleted}`,
        session_id: sessionId,
        user_email: email,
        context: { questionsAsked, questionsCompleted, lastRole, lastContentHasQuestion: lastContent.includes("?") },
      });

      // Send pause confirmation email (best-effort; do not fail pause if email fails)
      try {
        const emailPayload = {
          session_id: sessionId,
          email: email,
          session_type: session.session_type,
          questions_completed: questionsCompleted,
          paused_at: pausedAt,
          is_reminder: false,
          app_url,
        };

        console.log("[audio-session] Sending pause email:", emailPayload);

        // Call send-pause-email using the backend client (avoids manual HTTP wiring)
        const { data: emailData, error: emailError } = await supabase.functions.invoke(
          "send-pause-email",
          {
            body: emailPayload,
          }
        );

        if (emailError) {
          console.error("[audio-session] Pause email invoke error:", emailError);

          await supabase.from("error_logs").insert({
            error_type: "pause_email_failed",
            error_message: emailError.message ?? "Pause email failed",
            session_id: sessionId,
            user_email: email,
            context: { emailPayload, emailData },
          });
        } else {
          console.log("[audio-session] Pause email sent successfully", emailData);
        }
      } catch (emailError) {
        console.error("[audio-session] Error sending pause email:", emailError);
        // Don't fail the pause operation if email fails
      }

      return new Response(JSON.stringify({ ok: true, pausedAt, questionsCompleted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === RESUME SESSION ===
    if (action === "resume_session") {
      // Check if session is expired (paused more than 24 hours ago)
      if (session.paused_at) {
        const pausedTime = new Date(session.paused_at).getTime();
        const now = Date.now();
        const hoursSincePaused = (now - pausedTime) / (1000 * 60 * 60);

        if (hoursSincePaused > 24) {
          return new Response(
            JSON.stringify({
              ok: false,
              expired: true,
              message: "Session expired. Paused sessions are only resumable for 24 hours.",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Clear paused_at to mark as resumed
      const { error: updateError } = await supabase
        .from("coaching_sessions")
        .update({ paused_at: null })
        .eq("id", sessionId);

      if (updateError) throw updateError;

      // Fetch full conversation history
      const { data: messages, error: historyError } = await supabase
        .from("chat_messages")
        .select("id, role, content, created_at, question_number")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true })
        .limit(500);

      if (historyError) throw historyError;

      // Log the resume event
      await supabase.from("error_logs").insert({
        error_type: "session_resumed",
        error_message: `Session resumed from question ${session.current_question_number}`,
        session_id: sessionId,
        user_email: email,
        context: { currentQuestionNumber: session.current_question_number },
      });

      return new Response(
        JSON.stringify({
          ok: true,
          messages: messages ?? [],
          currentQuestionNumber: session.current_question_number,
          sessionType: session.session_type,
          documents: {
            firstName: session.first_name ?? "",
            resume: session.resume_text ?? "",
            jobDescription: session.job_description ?? "",
            companyUrl: session.company_url ?? "",
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === ABANDON SESSION ===
    if (action === "abandon_session") {
      // Mark the session as cancelled and clear paused state
      const { error: updateError } = await supabase
        .from("coaching_sessions")
        .update({
          status: "cancelled",
          paused_at: null,
        })
        .eq("id", sessionId);

      if (updateError) throw updateError;

      // Log the abandon event
      await supabase.from("error_logs").insert({
        error_type: "session_abandoned",
        error_message: `Session abandoned at question ${session.current_question_number}`,
        session_id: sessionId,
        user_email: email,
        context: { currentQuestionNumber: session.current_question_number },
      });

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
