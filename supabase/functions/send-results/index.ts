import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_MAX_WIDTH_DESKTOP = 920;
const EMAIL_MAX_WIDTH_TABLET = 720;

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[SEND-RESULTS] ${step}${detailsStr}`);
};

type Role = "user" | "assistant";

type ChatMessageRow = {
  role: string;
  content: string;
  created_at?: string;
};

type ReportResult = {
  overall_score?: number | null;
  score_breakdown?: Record<string, number> | null;
  strengths?: Array<{ title: string; evidence_quote?: string; why_it_matters?: string }>;
  improvements?: Array<{ title: string; evidence_quote?: string; fix?: string; stronger_example?: string }>;
  per_question?: Array<{
    question_number: number;
    question: string;
    answer_summary: string;
    score: number | null;
    what_was_strong: string;
    what_to_improve: string;
    stronger_example: string;
    evidence_quote?: string;
  }>;
  action_items?: string[];
};

const escapeHtml = (input: string) =>
  input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatMarkdownToHtml = (markdown: string): string => {
  // Very small markdown subset for emails.
  // Note: We escape HTML first to prevent injection.
  const safe = escapeHtml(markdown);

  return safe
    .replace(/^### (.+)$/gm, '<h3 style="color:#2F6DF6;font-size:16px;margin:20px 0 8px 0;">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="color:#2F6DF6;font-size:18px;margin:24px 0 10px 0;">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="color:#2F6DF6;font-size:20px;margin:28px 0 12px 0;">$1</h1>')
    .replace(/^\* (.+)$/gm, '<li style="margin:6px 0;color:#2C2F38;">$1</li>')
    .replace(/^- (.+)$/gm, '<li style="margin:6px 0;color:#2C2F38;">$1</li>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n\n/g, '</p><p style="margin:12px 0;color:#2C2F38;">')
    .replace(/\n/g, "<br>");
};

const formatPreToHtml = (text: string) => {
  const safe = escapeHtml(text);
  return `
    <div style="background:#0B1220;color:#E5E7EB;border-radius:12px;padding:16px;white-space:pre-wrap;word-break:break-word;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;font-size:13px;line-height:1.6;">
      ${safe}
    </div>
  `;
};

function buildTranscriptMarkdown(messages: ChatMessageRow[]): string {
  const sorted = [...messages].sort((a, b) => {
    const ta = a.created_at ? Date.parse(a.created_at) : 0;
    const tb = b.created_at ? Date.parse(b.created_at) : 0;
    return ta - tb;
  });

  const lines: string[] = [];
  for (const m of sorted) {
    const role: Role = m.role === "assistant" ? "assistant" : "user";
    const who = role === "assistant" ? "Sarah (Coach)" : "You";
    lines.push(`${who}:\n${m.content}`);
    lines.push("\n---\n");
  }

  return lines.join("\n").replace(/\n---\n\n$/g, "").trim();
}

function buildAnalysisMarkdown(report: ReportResult): string {
  const score = report.overall_score ?? null;
  const breakdown = report.score_breakdown ?? null;
  const strengths = report.strengths ?? [];
  const improvements = report.improvements ?? [];
  const perQ = report.per_question ?? [];
  const actionItems = report.action_items ?? [];

  const lines: string[] = [];

  lines.push("# Final Summary");
  lines.push("");
  lines.push(`Overall Score: ${score ?? "--"}/100`);

  if (breakdown && Object.keys(breakdown).length) {
    lines.push("");
    lines.push("## Score Breakdown");
    for (const [k, v] of Object.entries(breakdown)) {
      lines.push(`- ${k}: ${v}/100`);
    }
  }

  if (strengths.length) {
    lines.push("");
    lines.push("## Top Strengths (with evidence)\n");
    strengths.slice(0, 3).forEach((s, idx) => {
      lines.push(`${idx + 1}. ${s.title}`);
      if (s.evidence_quote) lines.push(`   - Evidence: "${s.evidence_quote}"`);
      if (s.why_it_matters) lines.push(`   - Why it matters: ${s.why_it_matters}`);
    });
  }

  if (improvements.length) {
    lines.push("");
    lines.push("## Top Improvements (specific + fix)\n");
    improvements.slice(0, 3).forEach((i, idx) => {
      lines.push(`${idx + 1}. ${i.title}`);
      if (i.evidence_quote) lines.push(`   - Where this showed up: "${i.evidence_quote}"`);
      if (i.fix) lines.push(`   - Fix: ${i.fix}`);
      if (i.stronger_example) lines.push(`   - Stronger example: ${i.stronger_example}`);
    });
  }

  if (actionItems.length) {
    lines.push("");
    lines.push("## Personalized Action Items\n");
    actionItems.slice(0, 8).forEach((a) => lines.push(`- ${a}`));
  }

  if (perQ.length) {
    lines.push("");
    lines.push("# Interview Transcript Review (10 Questions)\n");
    perQ
      .slice(0, 10)
      .sort((a, b) => a.question_number - b.question_number)
      .forEach((q) => {
        lines.push(`## Question ${q.question_number}`);
        lines.push(`Question: ${q.question}`);
        lines.push(`Score: ${q.score ?? "--"}/10`);
        lines.push(`Your answer (summary): ${q.answer_summary}`);
        if (q.evidence_quote) lines.push(`Evidence quote: "${q.evidence_quote}"`);
        lines.push(`What was strong: ${q.what_was_strong}`);
        lines.push(`What to improve: ${q.what_to_improve}`);
        lines.push(`Example of a stronger answer: ${q.stronger_example}`);
        lines.push("");
      });
  }

  return lines.join("\n").trim();
}

async function generateReportWithClaude(opts: {
  prepPacket: string | null;
  transcript: string;
  sessionType: string;
}) {
  const key = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
  if (!key) throw new Error("ANTHROPIC_API_KEY is not configured");

  const transcript = opts.transcript.length > 120_000
    ? opts.transcript.slice(0, 120_000) + "\n\n[TRUNCATED: transcript exceeded 120k characters]"
    : opts.transcript;

  const system = `You are an expert interview coach and scoring analyst.\n\nYou will be given:\n- a prep packet (may be empty)\n- a full text transcript of a 10-question mock interview including the interviewer's feedback and any 1-10 scores\n\nReturn STRICT JSON ONLY with this schema:\n{\n  \"overall_score\": number|null,\n  \"score_breakdown\": {\n    \"communication\": number,\n    \"content\": number,\n    \"structure\": number\n  },\n  \"strengths\": [\n    {\"title\": string, \"evidence_quote\": string, \"why_it_matters\": string}\n  ],\n  \"improvements\": [\n    {\"title\": string, \"evidence_quote\": string, \"fix\": string, \"stronger_example\": string}\n  ],\n  \"per_question\": [\n    {\n      \"question_number\": number,\n      \"question\": string,\n      \"answer_summary\": string,\n      \"score\": number|null,\n      \"what_was_strong\": string,\n      \"what_to_improve\": string,\n      \"stronger_example\": string,\n      \"evidence_quote\": string\n    }\n  ],\n  \"action_items\": [string]\n}\n\nRules:\n- Use EXACT quotes from the candidate's answers for evidence_quote fields (short snippets).\n- Provide exactly 10 per_question items whenever possible.\n- Make fixes highly specific to this candidate, this role, and this company. Avoid generic advice.`;

  const user = `SESSION TYPE: ${opts.sessionType}\n\nPREP PACKET (if present):\n${opts.prepPacket ?? "(none)"}\n\nTRANSCRIPT:\n${transcript}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${text}`);
  }

  const data = await response.json();
  const text = data?.content?.[0]?.text ?? "";

  try {
    return JSON.parse(text) as ReportResult;
  } catch {
    // Fallback: try to salvage JSON from a fenced block
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]) as ReportResult;
    }
    throw new Error("Failed to parse report JSON from model output");
  }
}

function generateResultsEmailHtml(opts: {
  sessionLabel: string;
  email: string;
  messageCount: number;
  prepPacket: string | null;
  transcript: string;
  analysisMarkdown: string;
}): string {
  const prepHtml = opts.prepPacket ? formatMarkdownToHtml(opts.prepPacket) : null;

  return `
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <style type="text/css">
    body, table, td, div, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse !important; }
    img { -ms-interpolation-mode: bicubic; border: 0; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #f0f4f8; }
    .ExternalClass { width: 100%; }
    .ExternalClass, .ExternalClass p, .ExternalClass span, .ExternalClass font, .ExternalClass td, .ExternalClass div { line-height: 100%; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
    u + #body a { color: inherit; text-decoration: none; }
    #MessageViewBody a { color: inherit; text-decoration: none; }

    @media only screen and (max-width: 599px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .content-padding { padding: 24px 16px !important; }
      .header-padding { padding: 24px 16px !important; }
      .hero-padding { padding: 24px 16px !important; }
      .footer-padding { padding: 24px 16px !important; }
      h1.email-title { font-size: 22px !important; }
    }
    @media only screen and (min-width: 600px) and (max-width: 899px) {
      .email-container { width: 94% !important; max-width: ${EMAIL_MAX_WIDTH_TABLET}px !important; }
    }
    @media only screen and (min-width: 900px) {
      .email-container { width: 100% !important; max-width: ${EMAIL_MAX_WIDTH_DESKTOP}px !important; }
    }
  </style>
</head>
<body id="body" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.6;color:#2C2F38;margin:0;padding:0;background-color:#f0f4f8;width:100%!important;-webkit-font-smoothing:antialiased;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f4f8;">
    <tr>
      <td align="center" valign="top" style="padding:24px 12px;">
        <table role="presentation" class="email-container" width="${EMAIL_MAX_WIDTH_DESKTOP}" cellpadding="0" cellspacing="0" border="0" style="width:${EMAIL_MAX_WIDTH_DESKTOP}px;max-width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
          <tr>
            <td class="header-padding" style="background-color:#2F6DF6;padding:40px 48px;text-align:center;">
              <div style="font-size:36px;font-weight:800;color:#ffffff;letter-spacing:-1px;">Talendro<span style="font-size:16px;vertical-align:super;color:#00C4CC;font-weight:600;">™</span></div>
              <h1 class="email-title" style="color:white;margin:20px 0 0 0;font-size:28px;font-weight:700;">Your ${escapeHtml(opts.sessionLabel)} Results</h1>
              <p style="color:rgba(255,255,255,0.9);margin:12px 0 0 0;font-size:17px;">Session complete — full deliverable below</p>
            </td>
          </tr>

          <tr>
            <td class="hero-padding" style="background-color:#E8F4FE;padding:28px 48px;text-align:left;border-bottom:1px solid #e5e7eb;">
              <p style="margin:0;color:#6B7280;font-size:14px;">Sent to: <strong style="color:#2C2F38;">${escapeHtml(opts.email)}</strong></p>
              <p style="margin:10px 0 0 0;color:#6B7280;font-size:14px;">Session messages captured: <strong style="color:#2C2F38;">${opts.messageCount}</strong></p>
            </td>
          </tr>

          <tr>
            <td class="content-padding" style="padding:48px;">
              <h2 style="color:#2F6DF6;font-size:20px;margin:0 0 12px 0;">SECTION 1 — Prep Packet</h2>
              ${prepHtml ? `<div style="margin:14px 0 28px 0;">${prepHtml}</div>` : `<p style="margin:0 0 28px 0;color:#6B7280;">No prep packet was saved for this session.</p>`}

              <h2 style="color:#2F6DF6;font-size:20px;margin:0 0 12px 0;">SECTION 2 — Interview Transcript</h2>
              <div style="margin:14px 0 28px 0;">${formatPreToHtml(opts.transcript)}</div>

              <h2 style="color:#2F6DF6;font-size:20px;margin:0 0 12px 0;">SECTION 3 — Results  26 Recommendations</h2>
              <div style="margin:14px 0 28px 0;">${formatMarkdownToHtml(opts.analysisMarkdown)}</div>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin:40px 0;">
                <tr>
                  <td align="center">
                    <a href="https://coach.talendro.com/#products" style="display:inline-block;background-color:#2F6DF6;color:#ffffff;padding:16px 44px;text-decoration:none;border-radius:10px;font-weight:700;font-size:16px;">Practice Again F501</a>
                  </td>
                </tr>
              </table>

              <p style="margin:28px 0 0 0;font-size:15px;color:#2C2F38;line-height:1.6;">Questions? Reply to this email — well help.</p>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:36px;padding-top:28px;border-top:1px solid #e5e7eb;">
                <tr>
                  <td>
                    <p style="margin:10px 0;color:#2C2F38;font-size:16px;"><strong>F947 Go crush that interview!</strong></p>
                    <p style="margin:10px 0;color:#2C2F38;font-size:16px;"><strong>- Greg Jackson</strong><br>Founder, Talendro™</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="footer-padding" style="background-color:#0F172A;padding:44px 48px;text-align:center;">
              <div style="font-size:28px;font-weight:800;color:white;margin-bottom:12px;">Talendro<span style="font-size:14px;vertical-align:super;color:#00C4CC;">™</span></div>
              <p style="color:#00C4CC;font-style:italic;font-size:16px;margin:14px 0 24px 0;">"Your partner in interview success"</p>
              <p style="margin:24px 0;font-size:14px;color:#9FA6B2;">🇺🇸 American-Built  b7 🎖️ Veteran-Led  b7 ✅ Recruiter-Tested</p>
              <p style="color:#6B7280;font-size:13px;margin-top:24px;">© ${new Date().getFullYear()} Talendro. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const resendKeyRaw = Deno.env.get("RESEND_API_KEY") ?? "";
    const resendKey = resendKeyRaw
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\s+/g, "")
      .trim();

    if (!resendKey) throw new Error("Email service is not configured");
    if (resendKey.includes("*")) throw new Error("Email service is misconfigured (API key appears masked)");

    const resend = new Resend(resendKey);

    const body = await req.json();
    const {
      session_id,
      email,
      session_type,
      test_email,
    }: {
      session_id?: string;
      email?: string;
      session_type?: string;
      test_email?: boolean;
    } = body ?? {};

    // Lightweight test mode (does not hit DB)
    if (test_email && email) {
      const html = generateResultsEmailHtml({
        sessionLabel: session_type || "Interview Coaching",
        email,
        messageCount: 35,
        prepPacket: "## Company Overview\nAcme Corp...",
        transcript: "Sarah (Coach):\nQuestion 1 of 10...\n\n---\n\nYou:\nMy answer...",
        analysisMarkdown:
          "# Final Summary\n\nOverall Score: 85/100\n\n## Score Breakdown\n- communication: 82/100\n- content: 88/100\n- structure: 84/100\n",
      });

      const emailResult = await resend.emails.send({
        from: "Talendro Interview Coach <noreply@talendro.com>",
        reply_to: "greg@talendro.com",
        to: [email],
        subject: `[TEST] Your ${session_type || "Interview Coaching"} Results - Talendro™`,
        html,
      });

      return new Response(JSON.stringify({ success: true, emailResult }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (!session_id || !email) {
      throw new Error("session_id and email are required");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: session, error: sessionError } = await supabaseClient
      .from("coaching_sessions")
      .select("id, email, status, session_type, prep_packet, chat_messages(role, content, created_at)")
      .eq("id", session_id)
      .single();

    if (sessionError || !session) {
      logStep("Invalid session", { hasSession: false });
      throw new Error("Invalid session ID");
    }

    if ((session.email ?? "").toLowerCase() !== email.toLowerCase()) {
      logStep("Email mismatch", { sessionEmail: "***", providedEmail: "***" });
      throw new Error("Email does not match session");
    }

    // Allow send for active or completed (re-sends)
    if (session.status !== "active" && session.status !== "completed") {
      logStep("Session not eligible", { status: session.status });
      throw new Error("Session is not eligible for results");
    }

    const effectiveSessionType = session_type || session.session_type;

    const sessionTypeLabels: Record<string, string> = {
      quick_prep: "Quick Prep Packet",
      full_mock: "Full Mock Interview",
      premium_audio: "Premium Audio Interview",
      pro: "Pro Coaching Session",
    };

    const sessionLabel = sessionTypeLabels[effectiveSessionType] || "Interview Coaching";

    const prepPacket = (() => {
      const raw = session.prep_packet as any;
      if (!raw) return null;
      if (typeof raw === "string") return raw;
      if (typeof raw === "object" && typeof raw.content === "string") return raw.content;
      return null;
    })();

    const chatMessages = (session.chat_messages as ChatMessageRow[]) ?? [];
    const messageCount = chatMessages.length;

    const transcript = buildTranscriptMarkdown(chatMessages);

    logStep("Generating report", {
      sessionType: effectiveSessionType,
      hasPrepPacket: Boolean(prepPacket),
      transcriptChars: transcript.length,
      messageCount,
    });

    const report = await generateReportWithClaude({
      prepPacket,
      transcript,
      sessionType: effectiveSessionType,
    });

    const analysisMarkdown = buildAnalysisMarkdown(report);

    const emailHtml = generateResultsEmailHtml({
      sessionLabel,
      email,
      messageCount,
      prepPacket,
      transcript,
      analysisMarkdown,
    });

    const emailResponse = await resend.emails.send({
      from: "Talendro Interview Coach <noreply@talendro.com>",
      reply_to: "greg@talendro.com",
      to: [email],
      subject: `Your ${sessionLabel} Results - Talendro™`,
      html: emailHtml,
    });

    logStep("Email sent", { hasError: Boolean((emailResponse as any)?.error) });

    if ((emailResponse as any)?.error) {
      throw new Error(`Email sending failed: ${(emailResponse as any).error?.message || "Unknown error"}`);
    }

    // Save a compact summary to session_results (no schema changes)
    const strengthsStrings = (report.strengths || []).slice(0, 3).map((s) =>
      s.evidence_quote ? `${s.title} — “${s.evidence_quote}”` : s.title
    );

    const improvementsStrings = (report.improvements || []).slice(0, 3).map((i) =>
      i.evidence_quote ? `${i.title} — “${i.evidence_quote}”` : i.title
    );

    const compactRecommendations = (report.action_items || []).slice(0, 6).join("\n");

    const sessionResultsToStore = {
      overall_score: report.overall_score ?? null,
      strengths: strengthsStrings.length ? strengthsStrings : null,
      improvements: improvementsStrings.length ? improvementsStrings : null,
      recommendations: compactRecommendations || null,
    };

    await supabaseClient.from("session_results").insert({
      session_id,
      overall_score: sessionResultsToStore.overall_score,
      strengths: sessionResultsToStore.strengths,
      improvements: sessionResultsToStore.improvements,
      recommendations: sessionResultsToStore.recommendations,
      email_sent: true,
      email_sent_at: new Date().toISOString(),
    });

    if (session.status !== "completed") {
      await supabaseClient
        .from("coaching_sessions")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", session_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Results email sent successfully",
        session_results: sessionResultsToStore,
        report: {
          prepPacket,
          transcript,
          analysisMarkdown,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
