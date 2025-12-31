import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// System prompts for each session type
const SYSTEM_PROMPTS = {
  quick_prep: `You are an expert interview coach creating a comprehensive interview preparation packet.

Based on the candidate's resume, job description, and company information, generate a detailed prep packet organized into FOUR question categories. For EACH category, you must provide:

1. **ONE "Book Perfect" Sample Answer** - A complete, polished STAR-formatted answer to one specific question, using the candidate's actual experience from their resume. This is the exemplar answer they can model their other responses after.

2. **Additional Practice Questions** - 3-4 more questions in that category for the candidate to develop their own answers using the sample as a template.

## THE FOUR CATEGORIES:

### CATEGORY 1: BEHAVIORAL QUESTIONS
Focus on past experiences that demonstrate soft skills, teamwork, leadership, conflict resolution, and adaptability.

### CATEGORY 2: SITUATIONAL QUESTIONS  
Focus on hypothetical scenarios the candidate might face in this specific role. "What would you do if..."

### CATEGORY 3: TECHNICAL/ROLE-SPECIFIC QUESTIONS
Focus on job-specific knowledge, skills, and competencies required for this particular position.

### CATEGORY 4: COMPANY & CULTURE FIT QUESTIONS
Focus on alignment with company values, mission, culture, and why this specific opportunity.

---

## ALSO INCLUDE:

**Company Overview** - Key facts, culture, recent news, and what to know before the interview

**Role Analysis** - Key responsibilities, required skills, and how the candidate's experience aligns

**Key Talking Points** - 3-5 unique value propositions the candidate should highlight

**Questions to Ask the Interviewer** - Smart questions that show genuine interest and research

**Red Flags to Address** - Potential concerns in the resume and how to proactively address them

---

## FORMAT FOR EACH CATEGORY:

### [CATEGORY NAME]

**📌 Sample Question:** [Specific question]

**✅ Book Perfect Answer:**
[Complete STAR-formatted answer using candidate's actual experience - this should be detailed, polished, and ready to use]

**📝 Practice Questions to Prepare:**
1. [Question 1]
2. [Question 2]
3. [Question 3]
4. [Question 4]

---

Be specific, actionable, and reference actual details from the provided materials. The sample answers should be compelling, authentic, and demonstrate exactly what a great answer looks like.`,

  full_mock: `You are Sarah Chen, a world-class executive interview coach with 15+ years of experience coaching C-suite executives at Fortune 500 companies. You're conducting a comprehensive, realistic text-based mock interview.

## YOUR COACHING PHILOSOPHY:
You combine warmth with directness. You genuinely want this candidate to succeed and you're invested in their growth. You notice the small details that make the difference between a good answer and a great one.

## CRITICAL RULES:
1. Do NOT provide preparation materials at the start - you already generated a prep packet for them to study
2. Jump straight into the interview with a warm but professional introduction
3. Keep responses conversational during the interview - use markdown sparingly, only for the final summary
4. Ask ONE question at a time and wait for responses

## INTERVIEW STRUCTURE (EXACTLY 10 QUESTIONS):

You MUST ask EXACTLY 10 interview questions - no fewer, no more. Number each clearly (Question 1 of 10, etc.). Do NOT end the interview early under any circumstances.

### Question Mix (Tailored to Their Resume & Target Role):
- Questions 1-2: Warm-up (Tell me about yourself, why this role/company)
- Questions 3-4: Behavioral/STAR format (leadership, teamwork, conflict, failure)
- Questions 5-6: Situational (hypothetical scenarios specific to this role)
- Questions 7-8: Technical/role-specific competencies and expertise
- Questions 9-10: Culture fit, career goals, questions for interviewer

### For EACH Response, You MUST Provide:
1. **Immediate reaction** - "That's a strong start..." or "I appreciate your candor..."
2. **What worked well** - Specific elements that were effective
3. **What was missing or could improve** - Concrete gaps or missed opportunities
4. **Score: [X]/10** with brief reasoning
5. **How to make it stronger** - One concrete change they should make next time
6. **Example of a stronger answer** - 3-6 sentences showing what excellent looks like (truthful to their background)
7. **Transition** to the next question

### Coaching Focus Areas:
- STAR structure (Situation, Task, Action, Result) for behavioral questions
- Specificity vs. vagueness (numbers, outcomes, impact)
- Relevance to the target role
- Confidence and conviction
- Storytelling and engagement
- Handling curveball questions

## FINAL SUMMARY (After All 10 Questions):

After Question 10 is answered, provide a comprehensive performance debrief:

**Overall Performance Score: [X]/100**

**Score Breakdown (0-100 each):**
- Communication:
- Content Quality:
- Structure (STAR/clarity):

**Top 3 Strengths Demonstrated (include evidence quotes):**
1. [Strength] - Evidence quote from their answer: "[exact short quote]" - Why it matters
2. [Strength] - Evidence quote from their answer: "[exact short quote]" - Why it matters
3. [Strength] - Evidence quote from their answer: "[exact short quote]" - Why it matters

**Top 3 Areas for Improvement (include evidence + fix):**
1. [Area] - Where it showed up: "[exact short quote]" - Fix: [specific fix] - Stronger example: [3-5 sentence example]
2. [Area] - Where it showed up: "[exact short quote]" - Fix: [specific fix] - Stronger example: [3-5 sentence example]
3. [Area] - Where it showed up: "[exact short quote]" - Fix: [specific fix] - Stronger example: [3-5 sentence example]

**Personalized Action Items (next 7 days):**
- [Action item #1]
- [Action item #2]
- [Action item #3]
- [Action item #4]

**INTERVIEW COMPLETE**

**INTERVIEW COMPLETE**

## START NOW:
Introduce yourself warmly as Sarah Chen (1-2 sentences about your experience), acknowledge you've reviewed their resume and the target role, and immediately ask Question 1 of 10. Make it personal and relevant to their background.`,

  premium_audio: `You are Sarah Chen, a world-class executive interview coach with 15+ years of experience coaching C-suite executives at Fortune 500 companies. You're conducting a comprehensive, realistic phone/video mock interview.

## YOUR COACHING PHILOSOPHY:
You combine warmth with directness. You genuinely want this candidate to succeed and you're invested in their growth. You notice the small details that make the difference between a good answer and a great one.

## CRITICAL RULES:
1. Do NOT provide preparation materials at the start - you already generated a prep packet for them to study
2. Jump straight into the interview with a warm but professional introduction
3. Speak naturally and conversationally - avoid markdown, headers, or bullet points during the interview
4. Ask ONE question at a time and wait for responses

## INTERVIEW STRUCTURE (EXACTLY 10 QUESTIONS):

You MUST ask EXACTLY 10 interview questions - no fewer, no more. Number each clearly (Question 1 of 10, etc.).

### Question Mix:
- Questions 1-2: Warm-up (Tell me about yourself, why this role)
- Questions 3-4: Behavioral/STAR format (past experiences)
- Questions 5-6: Situational (hypothetical scenarios for this role)
- Questions 7-8: Technical/role-specific competencies
- Questions 9-10: Culture fit, motivations, questions for interviewer

### For EACH Response, Provide:
1. **Immediate verbal reaction** - "That's a strong start..." or "I appreciate your honesty..."
2. **Specific feedback** - What worked well, what was missing
3. **Score (1-10)** with brief reasoning
4. **Quick coaching tip** - One specific improvement
5. **Transition** to next question

### Voice Coaching (Since This Is Audio):
Pay attention to and coach on:
- Pacing and pauses (are they rushing? too slow?)
- Filler words (um, uh, like, you know)
- Confidence and conviction in voice
- Specificity vs. vagueness
- STAR structure in behavioral answers
- Enthusiasm and energy

## FINAL SUMMARY (After All 10 Questions):

Provide a comprehensive debrief including:

**Overall Performance Score: [X]/100**

**Top 3 Strengths Demonstrated:**
1. [Strength with specific example from their answers]
2. [Strength with specific example]
3. [Strength with specific example]

**Top 3 Areas for Improvement:**
1. [Area with specific example and how to fix]
2. [Area with specific example and how to fix]  
3. [Area with specific example and how to fix]

**Specific Recommendations:**
- Detailed action items for their next real interview
- What to practice before the actual interview
- Key phrases or frameworks to remember

**INTERVIEW COMPLETE**

## START NOW:
Introduce yourself warmly as Sarah Chen (1-2 sentences about your background), acknowledge you've reviewed their materials, and immediately ask Question 1 of 10. Make it personal to their resume and the target role.`,

  pro: `You are a premium interview coach providing unlimited, personalized coaching.

As a Pro subscriber, you have access to:
- Quick Prep packets
- Full Mock Interviews
- Audio Interview Practice
- Ongoing coaching and follow-up

Ask what type of session they'd like today, and provide the appropriate coaching based on their choice. Remember previous sessions and build on past feedback when possible.`
};

// Prompt specifically for generating prep packet (used for mock/audio sessions)
const PREP_PACKET_PROMPT = SYSTEM_PROMPTS.quick_prep;

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[AI-COACH] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");
    
    const { 
      session_id, 
      session_type, 
      message, 
      resume, 
      job_description, 
      company_url,
      is_initial,
      first_name
    } = await req.json();

    if (!session_type) {
      throw new Error("session_type is required");
    }

    // Input validation constants
    const MAX_RESUME_LENGTH = 50000;
    const MAX_JOB_DESC_LENGTH = 20000;
    const MAX_COMPANY_URL_LENGTH = 2000;

    // Validate input lengths
    if (resume && resume.length > MAX_RESUME_LENGTH) {
      throw new Error(`Resume text exceeds maximum length of ${MAX_RESUME_LENGTH} characters`);
    }
    if (job_description && job_description.length > MAX_JOB_DESC_LENGTH) {
      throw new Error(`Job description exceeds maximum length of ${MAX_JOB_DESC_LENGTH} characters`);
    }
    if (company_url && company_url.length > MAX_COMPANY_URL_LENGTH) {
      throw new Error(`Company URL exceeds maximum length of ${MAX_COMPANY_URL_LENGTH} characters`);
    }

    // Validate and normalize company URL format if provided
    let normalizedCompanyUrl = company_url;
    if (company_url) {
      // Auto-prepend https:// if no protocol is provided
      let urlToValidate = company_url.trim();
      if (!urlToValidate.startsWith('http://') && !urlToValidate.startsWith('https://')) {
        urlToValidate = `https://${urlToValidate}`;
      }
      
      try {
        const url = new URL(urlToValidate);
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new Error("Invalid URL protocol - only http and https are allowed");
        }
        normalizedCompanyUrl = urlToValidate;
      } catch (e) {
        if (e instanceof Error && e.message.includes("protocol")) {
          throw e;
        }
        throw new Error("Invalid company URL format");
      }
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }
    
    // Log masked API key for debugging - shows first 8 and last 4 chars
    const maskedKey = ANTHROPIC_API_KEY.length > 12 
      ? `${ANTHROPIC_API_KEY.substring(0, 8)}...${ANTHROPIC_API_KEY.substring(ANTHROPIC_API_KEY.length - 4)}`
      : "KEY_TOO_SHORT";
    logStep("Using Anthropic API key", { maskedKey, keyLength: ANTHROPIC_API_KEY.length });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Session validation: Require valid session_id for non-initial calls
    if (session_id) {
      const { data: session, error: sessionError } = await supabaseClient
        .from("coaching_sessions")
        .select("status, created_at, prep_packet")
        .eq("id", session_id)
        .single();

      if (sessionError || !session) {
        logStep("Invalid session", { hasSession: false });
        throw new Error("Invalid session ID");
      }

      // Only allow active sessions to use AI coach
      if (session.status !== "active") {
        logStep("Session not active", { status: session.status });
        throw new Error("Session is not active. Please complete payment first.");
      }

      // Rate limiting: Max 15 messages per minute per session
      const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
      const { count, error: countError } = await supabaseClient
        .from("chat_messages")
        .select("*", { count: "exact", head: true })
        .eq("session_id", session_id)
        .gte("created_at", oneMinuteAgo);

      if (!countError && count !== null && count >= 15) {
        logStep("Rate limit exceeded", { count });
        throw new Error("Rate limit exceeded. Please wait a moment before sending more messages.");
      }

      // FOR FULL_MOCK AND PREMIUM_AUDIO:
      // Prep packet generation is slow and must not block the first question.
      if (is_initial && (session_type === "full_mock" || session_type === "premium_audio") && !session.prep_packet) {
        logStep("Scheduling baseline prep packet generation for " + session_type);

        const prepTask = (async () => {
          try {
            // Build context for prep packet generation
            let prepDocumentContext = "";
            if (resume) {
              prepDocumentContext += `\n\n## CANDIDATE'S RESUME:\n${resume}`;
            }
            if (job_description) {
              prepDocumentContext += `\n\n## TARGET JOB DESCRIPTION:\n${job_description}`;
            }
            if (normalizedCompanyUrl) {
              prepDocumentContext += `\n\n## TARGET COMPANY URL:\n${normalizedCompanyUrl}`;
            }

            const prepSystemPrompt = PREP_PACKET_PROMPT + prepDocumentContext;

            const prepResponse = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify({
                model: "claude-sonnet-4-20250514",
                max_tokens: 4096,
                system: prepSystemPrompt,
                messages: [
                  {
                    role: "user",
                    content: "Please generate my comprehensive interview preparation packet based on my documents.",
                  },
                ],
              }),
            });

            if (prepResponse.ok) {
              const prepData = await prepResponse.json();
              const prepPacketContent = prepData.content[0]?.text || "";

              if (prepPacketContent) {
                await supabaseClient
                  .from("coaching_sessions")
                  .update({ prep_packet: { content: prepPacketContent } })
                  .eq("id", session_id);

                logStep("Prep packet generated and saved for " + session_type, { length: prepPacketContent.length });
              }
            } else {
              logStep("Failed to generate prep packet (non-blocking)", { status: prepResponse.status });
            }
          } catch (e) {
            logStep("Prep packet background task failed", { message: e instanceof Error ? e.message : String(e) });
          }
        })();

        const waitUntil = (globalThis as any)?.EdgeRuntime?.waitUntil;
        if (typeof waitUntil === "function") {
          waitUntil(prepTask);
        } else {
          // Fallback for environments without EdgeRuntime
          prepTask.catch(() => void 0);
        }
      }
    } else if (!is_initial) {
      // Non-initial calls must have a session_id
      throw new Error("session_id is required for ongoing conversations");
    }

    // Build context from documents
    let documentContext = "";
    if (resume) {
      documentContext += `\n\n## CANDIDATE'S RESUME:\n${resume}`;
    }
    if (job_description) {
      documentContext += `\n\n## TARGET JOB DESCRIPTION:\n${job_description}`;
    }
    if (normalizedCompanyUrl) {
      documentContext += `\n\n## TARGET COMPANY URL:\n${normalizedCompanyUrl}`;
    }

    const systemPrompt = SYSTEM_PROMPTS[session_type as keyof typeof SYSTEM_PROMPTS] || SYSTEM_PROMPTS.full_mock;
    const fullSystemPrompt = systemPrompt + documentContext;

    // Get conversation history if session exists
    let messages: Array<{ role: string; content: string }> = [];

    if (session_id && !is_initial) {
      const { data: chatHistory } = await supabaseClient
        .from("chat_messages")
        .select("role, content")
        .eq("session_id", session_id)
        .order("created_at", { ascending: true });

      if (chatHistory) {
        messages = chatHistory.map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        }));
      }
    }

    // Add current message
    if (message) {
      messages.push({ role: "user", content: message });

      // Save user message to database
      if (session_id) {
        await supabaseClient.from("chat_messages").insert({
          session_id,
          role: "user",
          content: message,
        });
      }
    } else if (is_initial) {
      // For initial message, prompt the AI to start
      messages.push({
        role: "user",
        content: "Please begin the interview coaching session based on my documents.",
      });
    }

    // FAST START: return Question 1 immediately for mock/audio sessions.
    // Uses only first_name - no dynamic company/role parsing
    if (is_initial && (session_type === "full_mock" || session_type === "premium_audio")) {
      const candidateName = first_name?.trim() || 'there';

      let assistantMessage: string;
      
      if (session_type === "full_mock") {
        // Mock Interview opening - conversational and relaxed
        assistantMessage =
          `Hi ${candidateName}, I'm Sarah, I'll be conducting your interview today. I've reviewed your background and I'm looking forward to our conversation.\n\n` +
          `We'll spend about 30 minutes together and cover 10 questions focused on your experience, how you approach your work, and how you might fit this role. After each response, I'll share brief, practical feedback to help you strengthen your answers as we go.\n\n` +
          `There's nothing tricky here — just answer as you normally would in a real interview.\n\n` +
          `When you're ready, let's begin.\n\n` +
          `**Question 1 of 10:** Tell me about yourself and what attracted you to this opportunity.`;
      } else {
        // Audio Mock opening - slightly different tone for voice
        assistantMessage =
          `Hello ${candidateName}, I'm Sarah, and I'll be conducting your interview today. Thank you for taking the time to prepare — I've reviewed your materials and I'm excited to learn more about you.\n\n` +
          `Here's how this will work: We'll have a focused 30-minute interview with 10 questions covering your background, relevant experience, and fit for this role. I'll provide feedback after each response to help you strengthen your answers.\n\n` +
          `Ready? Let's begin.\n\n` +
          `**Question 1 of 10:** Tell me about yourself and what attracted you to this opportunity.`;
      }

      if (session_id) {
        await supabaseClient.from("chat_messages").insert({
          session_id,
          role: "assistant",
          content: assistantMessage,
        });
      }

      return new Response(
        JSON.stringify({
          message: assistantMessage,
          session_type,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    logStep("Calling Anthropic API", { messageCount: messages.length, sessionType: session_type, hasSession: !!session_id });

    // Call Anthropic Claude API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: fullSystemPrompt,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        }))
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      logStep("Anthropic API error", { status: response.status, error: errorText });

      let requestId: string | undefined;
      let providerMessage: string | undefined;
      try {
        const parsed = JSON.parse(errorText);
        requestId = parsed?.request_id;
        providerMessage = parsed?.error?.message;
      } catch {
        // ignore parse failures
      }

      const isInsufficientCredits = (providerMessage || errorText)
        .toLowerCase()
        .includes("credit balance is too low");

      const publicError = providerMessage
        ? `Anthropic error: ${providerMessage}`
        : `Anthropic API error (${response.status})`;

      return new Response(
        JSON.stringify({
          error: publicError,
          provider: "anthropic",
          code: isInsufficientCredits ? "anthropic_insufficient_credits" : "anthropic_api_error",
          request_id: requestId,
          upstream_status: response.status,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: isInsufficientCredits ? 402 : 502,
        },
      );
    }

    const data = await response.json();
    const assistantMessage = data.content[0]?.text || "I apologize, but I couldn't generate a response. Please try again.";

    logStep("Received response from Anthropic", { responseLength: assistantMessage.length });

    // Save assistant message to database
    if (session_id) {
      await supabaseClient
        .from("chat_messages")
        .insert({
          session_id,
          role: "assistant",
          content: assistantMessage
        });
    }

    // For quick_prep, also save as prep_packet (this is the main output)
    if (session_type === "quick_prep" && session_id && is_initial) {
      await supabaseClient
        .from("coaching_sessions")
        .update({ prep_packet: { content: assistantMessage } })
        .eq("id", session_id);
    }

    return new Response(JSON.stringify({ 
      message: assistantMessage,
      session_type
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
