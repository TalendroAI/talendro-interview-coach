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

const stripProblemChars = (input: string) =>
  input
    // ASCII control chars except \t (9) and \n (10)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    // zero-width + BOM
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    // bidi / direction isolates
    .replace(/[\u202A-\u202E\u2066-\u2069]/g, "");

const escapeHtml = (input: string) =>
  stripProblemChars(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatMarkdownToHtml = (markdown: string): string => {
  const lines = markdown.split('\n');
  const result: string[] = [];
  let inList = false;
  let listType: 'ul' | 'ol' | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].replace(/\r/g, "");
    
    if (!line.trim()) {
      if (inList) {
        result.push(listType === 'ul' ? '</ul>' : '</ol>');
        inList = false;
        listType = null;
      }
      result.push('<br>');
      continue;
    }
    
    if (/^---+$/.test(line.trim())) {
      if (inList) {
        result.push(listType === 'ul' ? '</ul>' : '</ol>');
        inList = false;
        listType = null;
      }
      result.push('<hr style="border:none;border-top:2px solid #E5E7EB;margin:24px 0;">');
      continue;
    }
    
    const h1Match = line.match(/^#\s+(.+)$/);
    const h2Match = line.match(/^##\s+(.+)$/);
    const h3Match = line.match(/^###\s+(.+)$/);
    
    if (h3Match) {
      if (inList) { result.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
      const content = escapeHtml(h3Match[1]).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      result.push(`<div style="color:#2F6DF6;font-size:16px;font-weight:600;margin:20px 0 10px 0;padding-bottom:6px;border-bottom:1px solid #E5E7EB;line-height:1.25;mso-line-height-rule:exactly;">${content}</div>`);
      continue;
    }
    if (h2Match) {
      if (inList) { result.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
      const content = escapeHtml(h2Match[1]).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      result.push(`<div style="color:#2F6DF6;font-size:18px;font-weight:700;margin:28px 0 12px 0;padding-bottom:8px;border-bottom:2px solid #00C4CC;line-height:1.25;mso-line-height-rule:exactly;">${content}</div>`);
      continue;
    }
    if (h1Match) {
      if (inList) { result.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
      const content = escapeHtml(h1Match[1]).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      result.push(`<div style="color:#2F6DF6;font-size:22px;font-weight:800;margin:32px 0 16px 0;padding-bottom:10px;border-bottom:3px solid #2F6DF6;line-height:1.2;mso-line-height-rule:exactly;">${content}</div>`);
      continue;
    }
    
    const bulletMatch = line.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      if (!inList || listType !== 'ul') {
        if (inList) result.push(listType === 'ul' ? '</ul>' : '</ol>');
        result.push('<ul style="margin:12px 0;padding-left:24px;list-style-type:disc;">');
        inList = true;
        listType = 'ul';
      }
      let content = escapeHtml(bulletMatch[1]);
      content = content.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#2C2F38;">$1</strong>');
      result.push(`<li style="margin:8px 0;color:#4B5563;line-height:1.6;">${content}</li>`);
      continue;
    }
    
    const numMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (numMatch) {
      if (!inList || listType !== 'ol') {
        if (inList) result.push(listType === 'ul' ? '</ul>' : '</ol>');
        result.push('<ol style="margin:12px 0;padding-left:24px;list-style-type:decimal;">');
        inList = true;
        listType = 'ol';
      }
      let content = escapeHtml(numMatch[2]);
      content = content.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#2C2F38;">$1</strong>');
      result.push(`<li style="margin:8px 0;color:#4B5563;line-height:1.6;">${content}</li>`);
      continue;
    }
    
    if (inList) {
      result.push(listType === 'ul' ? '</ul>' : '</ol>');
      inList = false;
      listType = null;
    }
    
    let content = escapeHtml(line);
    content = content.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#2C2F38;">$1</strong>');
    content = content.replace(/\*(.+?)\*/g, '<em>$1</em>');
    result.push(`<p style="margin:10px 0;color:#4B5563;line-height:1.7;font-size:15px;">${content}</p>`);
  }
  
  if (inList) {
    result.push(listType === 'ul' ? '</ul>' : '</ol>');
  }
  
  return result.join('\n');
};

const formatTranscriptToHtml = (transcript: string): string => {
  const parts = transcript.split(/\n---\n/).filter(p => p.trim());
  const result: string[] = [];
  
  result.push('<div style="margin:0;">');
  
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    
    const isCoach = trimmed.startsWith('Sarah (Coach):');
    const isUser = trimmed.startsWith('You:');
    
    let content = trimmed;
    let speaker = '';
    let bgColor = '';
    let borderColor = '';
    
    if (isCoach) {
      content = trimmed.replace('Sarah (Coach):', '').trim();
      speaker = '🎯 Sarah (Coach)';
      bgColor = '#EFF6FF';
      borderColor = '#2F6DF6';
    } else if (isUser) {
      content = trimmed.replace('You:', '').trim();
      speaker = '👤 You';
      bgColor = '#F3F4F6';
      borderColor = '#9CA3AF';
    } else {
      content = trimmed;
      speaker = '';
      bgColor = '#F9FAFB';
      borderColor = '#E5E7EB';
    }
    
    content = escapeHtml(content);
    content = content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    content = content.replace(/\n/g, '<br>');
    
    result.push(`
      <div style="background:${bgColor};border-left:4px solid ${borderColor};border-radius:0 8px 8px 0;padding:16px;margin:12px 0;">
        ${speaker ? `<div style="font-size:13px;font-weight:600;color:${isCoach ? '#2F6DF6' : '#6B7280'};margin-bottom:8px;">${speaker}</div>` : ''}
        <div style="color:#374151;line-height:1.6;font-size:14px;white-space:pre-wrap;">${content}</div>
      </div>
    `);
  }
  
  result.push('</div>');
  return result.join('');
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

function generateResultsEmailHtml(opts: {
  sessionLabel: string;
  sessionType: string;
  email: string;
  messageCount: number;
  prepPacket: string | null;
  transcript: string;
  analysisMarkdown: string;
}): string {
  const prepHtml = opts.prepPacket ? formatMarkdownToHtml(opts.prepPacket) : null;
  const isQuickPrep = opts.sessionType === "quick_prep";
  const hasTranscript = !isQuickPrep && opts.transcript && opts.transcript.trim().length > 0;

  // Build sections based on session type
  const section1Html = `
    <h2 style="color:#2F6DF6;font-size:20px;margin:0 0 16px 0;padding-bottom:10px;border-bottom:2px solid #00C4CC;">📋 SECTION 1 — Prep Packet</h2>
    ${prepHtml ? `<div style="margin:14px 0 36px 0;padding:20px;background:#F8FAFC;border-radius:12px;border:1px solid #E5E7EB;">${prepHtml}</div>` : `<p style="margin:0 0 36px 0;color:#6B7280;font-style:italic;">No prep packet was saved for this session.</p>`}
  `;

  const section2Html = hasTranscript ? `
    <h2 style="color:#2F6DF6;font-size:20px;margin:0 0 16px 0;padding-bottom:10px;border-bottom:2px solid #00C4CC;">💬 SECTION 2 — Interview Transcript</h2>
    <div style="margin:14px 0 36px 0;">${formatTranscriptToHtml(opts.transcript)}</div>
  ` : "";

  const section3Html = !isQuickPrep ? `
    <h2 style="color:#2F6DF6;font-size:20px;margin:0 0 16px 0;padding-bottom:10px;border-bottom:2px solid #00C4CC;">📊 SECTION 3 — Final Summary</h2>
    <div style="margin:14px 0 36px 0;padding:20px;background:#F0FDF4;border-radius:12px;border:1px solid #BBF7D0;">${formatMarkdownToHtml(opts.analysisMarkdown)}</div>
  ` : "";

  return `
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style type="text/css">
    body, table, td, div, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse !important; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #f0f4f8; }
    @media only screen and (max-width: 599px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .content-padding { padding: 24px 16px !important; }
    }
  </style>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.6;color:#2C2F38;margin:0;padding:0;background-color:#f0f4f8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f4f8;">
    <tr>
      <td align="center" valign="top" style="padding:24px 12px;">
        <table role="presentation" class="email-container" width="${EMAIL_MAX_WIDTH_DESKTOP}" cellpadding="0" cellspacing="0" border="0" style="width:${EMAIL_MAX_WIDTH_DESKTOP}px;max-width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
          <tr>
            <td bgcolor="#2F6DF6" style="background-color:#2F6DF6;background-image:linear-gradient(135deg,#2F6DF6 0%,#1E40AF 100%);padding:40px 48px;text-align:center;">
              <div style="font-size:36px;font-weight:800;color:#ffffff;letter-spacing:-1px;line-height:1.1;mso-line-height-rule:exactly;">Talendro<span style="font-size:16px;vertical-align:super;color:#00C4CC;font-weight:600;">™</span></div>
              <div style="color:#ffffff;margin:20px 0 0 0;font-size:28px;font-weight:700;line-height:1.2;mso-line-height-rule:exactly;">Your ${escapeHtml(opts.sessionLabel)} Results</div>
              <div style="color:rgba(255,255,255,0.92);margin:12px 0 0 0;font-size:17px;line-height:1.4;mso-line-height-rule:exactly;">Session complete — full deliverable below</div>
            </td>
          </tr>

          <tr>
            <td style="background-color:#E8F4FE;padding:28px 48px;border-bottom:1px solid #e5e7eb;">
              <p style="margin:0;color:#6B7280;font-size:14px;">📧 Sent to: <strong style="color:#2C2F38;">${escapeHtml(opts.email)}</strong></p>
              ${!isQuickPrep ? `<p style="margin:10px 0 0 0;color:#6B7280;font-size:14px;">💬 Messages captured: <strong style="color:#2C2F38;">${opts.messageCount}</strong></p>` : ''}
            </td>
          </tr>

          <tr>
            <td class="content-padding" style="padding:48px;">
              ${section1Html}
              ${section2Html}
              ${section3Html}

              <table width="100%" cellpadding="0" cellspacing="0" style="margin:40px 0;">
                <tr>
                  <td align="center">
                    <a href="https://coach.talendro.com/#products" style="display:inline-block;background:linear-gradient(135deg,#2F6DF6 0%,#00C4CC 100%);color:#ffffff;padding:16px 44px;text-decoration:none;border-radius:10px;font-weight:700;font-size:16px;">🚀 Practice Again</a>
                  </td>
                </tr>
              </table>

              <p style="margin:28px 0 0 0;font-size:15px;color:#2C2F38;line-height:1.6;">Questions? Reply to this email — we'll help.</p>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:36px;padding-top:28px;border-top:1px solid #e5e7eb;">
                <tr>
                  <td>
                    <p style="margin:10px 0;color:#2C2F38;font-size:16px;"><strong>🎯 Go crush that interview!</strong></p>
                    <p style="margin:10px 0;color:#2C2F38;font-size:16px;"><strong>— Greg Jackson</strong><br>Founder, Talendro™</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background-color:#0F172A;padding:44px 48px;text-align:center;">
              <div style="font-size:28px;font-weight:800;color:white;margin-bottom:12px;">Talendro<span style="font-size:14px;vertical-align:super;color:#00C4CC;">™</span></div>
              <p style="color:#00C4CC;font-style:italic;font-size:16px;margin:14px 0 24px 0;">"Your partner in interview success"</p>
              <p style="margin:24px 0;font-size:14px;color:#9FA6B2;">🇺🇸 American-Built · 🎖️ Veteran-Led · ✅ Recruiter-Tested</p>
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
    const resendKey = resendKeyRaw.replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, "").trim();

    if (!resendKey) throw new Error("Email service is not configured");
    if (resendKey.includes("*")) throw new Error("Email service is misconfigured");

    const resend = new Resend(resendKey);

    const body = await req.json();
    const { session_id, email, session_type, test_email, results } = body ?? {};

     const sanitizeEmailHtml = (html: string) =>
       stripProblemChars(html).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

    const extractFinalSummaryMarkdown = (messages: ChatMessageRow[]): string | null => {
      const sorted = [...messages].sort((a, b) => {
        const ta = a.created_at ? Date.parse(a.created_at) : 0;
        const tb = b.created_at ? Date.parse(b.created_at) : 0;
        return ta - tb;
      });

      const assistantMessages = sorted.filter(
        (m) => (m.role || "").toLowerCase() === "assistant" && typeof m.content === "string"
      );

      for (let i = assistantMessages.length - 1; i >= 0; i--) {
        const c = assistantMessages[i].content.trim();
        if (!c) continue;
        if (/INTERVIEW COMPLETE/i.test(c) || /Overall Performance Score/i.test(c) || /Final Summary/i.test(c)) {
          return c;
        }
      }
      return null;
    };

    if (test_email && email) {
      const testSessionType = session_type || "full_mock";
      const testLabel = testSessionType === "quick_prep" ? "Quick Prep Packet" : 
                        testSessionType === "premium_audio" ? "Premium Audio Interview" : "Full Mock Interview";
      const htmlRaw = generateResultsEmailHtml({
        sessionLabel: testLabel,
        sessionType: testSessionType,
        email,
        messageCount: 35,
        prepPacket: "## Company Overview\nAcme Corp is a leading technology company.\n\n### Key Products\n- Product A\n- Product B\n\n### Interview Tips\n**Be specific** about your experience.",
        transcript: "Sarah (Coach):\nLet's start with your first question. Tell me about a time you led a challenging project.\n\n---\n\nYou:\nAt my previous company, I led a team of 5 engineers to rebuild our payment system. We faced tight deadlines and legacy code challenges.\n\n---\n\nSarah (Coach):\n**Great structure!** You clearly identified the situation and challenge. Next question: How did you handle a conflict with a team member?",
        analysisMarkdown: "# 🎯 INTERVIEW COMPLETE\n\n## Overall Performance Score: 85/100\n\n### Score Breakdown\n- Communication: 82/100\n- Technical Depth: 88/100\n- Problem Solving: 85/100\n\n---\n\n## ✅ Top 3 Strengths\n\n**1. Clear Communication**\nYou articulated complex ideas simply and effectively.\n\n**2. Strong Examples**\nYour STAR responses were well-structured with specific metrics.\n\n**3. Technical Knowledge**\nDemonstrated deep understanding of system architecture.\n\n---\n\n## 📈 Top 3 Areas for Improvement\n\n**1. Time Management**\nSome answers ran long. Practice 2-minute responses.\n\n**2. Quantify Results**\nAdd more specific numbers and percentages.\n\n**3. Ask Clarifying Questions**\nDon't assume - ask before answering.\n\n---\n\n## 🎯 Personalized Action Items\n\n1. Practice STAR responses with a timer\n2. Prepare 5 quantified achievements\n3. Record yourself and review",
      });

      const html = sanitizeEmailHtml(htmlRaw);

      const emailResult = await resend.emails.send({
        from: "Talendro Interview Coach <results@talendro.com>",
        reply_to: "Talendro Support <support@talendro.com>",
        to: [email],
        subject: `[TEST] Your ${testLabel} Results - Talendro™`,
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
      throw new Error("Email does not match session");
    }

    if (session.status !== "active" && session.status !== "completed") {
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
      if (typeof raw === "object") {
        const candidate =
          raw.content ??
          raw.markdown ??
          raw.text ??
          raw.prep_packet ??
          raw.prepPacket;
        if (typeof candidate === "string") return candidate;
      }
      // last resort: allow caller to pass it
      if (typeof results?.prep_packet === "string") return results.prep_packet;
      if (typeof results?.prepPacket === "string") return results.prepPacket;
      return null;
    })();

    const chatMessages = (session.chat_messages as ChatMessageRow[]) ?? [];
    const messageCount = chatMessages.length;
    const transcript = buildTranscriptMarkdown(chatMessages);

    const analysisMarkdown =
      effectiveSessionType === "quick_prep"
        ? prepPacket ?? "No prep packet was saved for this session."
        : extractFinalSummaryMarkdown(chatMessages) ?? "# Final Summary\n\nYour full transcript is included above.";

    logStep("Building email", {
      sessionType: effectiveSessionType,
      hasPrepPacket: Boolean(prepPacket),
      prepPacketChars: prepPacket ? prepPacket.length : 0,
      messageCount,
    });

    const emailHtml = sanitizeEmailHtml(
      generateResultsEmailHtml({ sessionLabel, sessionType: effectiveSessionType, email, messageCount, prepPacket, transcript, analysisMarkdown }),
    );

    // Optional: server-side preview for debugging (does not send or write to DB)
    if (body?.dry_run === true || body?.return_html === true) {
      return new Response(
        JSON.stringify({
          success: true,
          preview: true,
          html: body?.return_html === true ? emailHtml : undefined,
          report: { prepPacket, transcript, analysisMarkdown },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    const emailResponse = await resend.emails.send({
      from: "Talendro Interview Coach <results@talendro.com>",
      reply_to: "Talendro Support <support@talendro.com>",
      to: [email],
      subject: `Your ${sessionLabel} Results - Talendro™`,
      html: emailHtml,
    });

    // Log full Resend response for debugging delivery issues
    logStep("Resend API response", { 
      id: (emailResponse as any)?.data?.id || (emailResponse as any)?.id,
      error: (emailResponse as any)?.error,
      recipient: email,
      sessionType: session.session_type
    });

    if ((emailResponse as any)?.error) {
      throw new Error(`Email sending failed: ${(emailResponse as any).error?.message || "Unknown error"}`);
    }

    const overallScore = (() => {
      const m = analysisMarkdown.match(/Overall\s*(?:Performance\s*)?Score\s*[:\s]*(\d+)/i);
      return m ? Number(m[1]) : null;
    })();

    const sessionResultsToStore = {
      overall_score: typeof overallScore === "number" ? overallScore : null,
      strengths: results?.strengths ?? null,
      improvements: results?.improvements ?? null,
      recommendations: results?.recommendations ?? null,
    };

    const { data: existingResults } = await supabaseClient
      .from("session_results")
      .select("id")
      .eq("session_id", session_id)
      .order("created_at", { ascending: false })
      .limit(1);

    const existingId = Array.isArray(existingResults) ? existingResults[0]?.id : null;

    if (existingId) {
      await supabaseClient.from("session_results").update({
        ...sessionResultsToStore,
        email_sent: true,
        email_sent_at: new Date().toISOString(),
      }).eq("id", existingId);
    } else {
      await supabaseClient.from("session_results").insert({
        session_id,
        ...sessionResultsToStore,
        email_sent: true,
        email_sent_at: new Date().toISOString(),
      });
    }

    if (session.status !== "completed") {
      await supabaseClient.from("coaching_sessions").update({
        status: "completed",
        completed_at: new Date().toISOString(),
      }).eq("id", session_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Results email sent successfully",
        session_results: sessionResultsToStore,
        report: { prepPacket, transcript, analysisMarkdown },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
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
