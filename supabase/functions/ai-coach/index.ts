import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// System prompts for each session type
const SYSTEM_PROMPTS = {
  quick_prep: `You are an expert interview coach creating a comprehensive interview preparation packet. 

Based on the candidate's resume, job description, and company information, generate a detailed prep packet that includes:

1. **Company Overview** - Key facts, culture, recent news, and what to know before the interview
2. **Role Analysis** - Key responsibilities, required skills, and how the candidate's experience aligns
3. **Top 10 Interview Questions** - Tailored behavioral, situational, and technical questions likely to be asked
4. **Suggested Answers** - STAR-formatted responses using the candidate's actual experience
5. **Key Talking Points** - 3-5 unique value propositions the candidate should highlight
6. **Questions to Ask** - Smart questions that show genuine interest and research
7. **Red Flags to Address** - Potential concerns in the resume and how to proactively address them

Be specific, actionable, and reference actual details from the provided materials.`,

  full_mock: `You are an expert interview coach conducting a realistic mock interview.

You will ask 10 tailored interview questions based on the candidate's resume, the job description, and target company. Mix behavioral (STAR), situational, and role-specific questions.

For each response the candidate gives:
1. Provide specific, constructive feedback
2. Score the answer (1-10)
3. Suggest an improved answer using STAR format with their actual experience

Keep the conversation natural but professional. After all 10 questions, provide a comprehensive summary including:
- Overall performance score
- Top 3 strengths demonstrated
- Top 3 areas for improvement
- Specific recommendations for the real interview

Start by introducing yourself and asking the first question.`,

  premium_audio: `You are an expert voice interview coach conducting a realistic phone/video interview simulation.

Speak naturally and professionally as if on an actual interview call. Ask one question at a time, listen carefully to responses, and provide real-time guidance.

Focus on:
- Natural conversation flow
- Clear, concise questions
- Immediate verbal feedback on communication style
- Coaching on pace, clarity, and confidence

After the interview, provide verbal feedback on:
- Overall communication effectiveness
- Specific strengths in verbal delivery
- Areas to improve for phone/video interviews`,

  pro: `You are a premium interview coach providing unlimited, personalized coaching.

As a Pro subscriber, you have access to:
- Quick Prep packets
- Full Mock Interviews
- Audio Interview Practice
- Ongoing coaching and follow-up

Ask what type of session they'd like today, and provide the appropriate coaching based on their choice. Remember previous sessions and build on past feedback when possible.`
};

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
      is_initial 
    } = await req.json();

    if (!session_type) {
      throw new Error("session_type is required");
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Build context from documents
    let documentContext = "";
    if (resume) {
      documentContext += `\n\n## CANDIDATE'S RESUME:\n${resume}`;
    }
    if (job_description) {
      documentContext += `\n\n## TARGET JOB DESCRIPTION:\n${job_description}`;
    }
    if (company_url) {
      documentContext += `\n\n## TARGET COMPANY URL:\n${company_url}`;
    }

    const systemPrompt = SYSTEM_PROMPTS[session_type as keyof typeof SYSTEM_PROMPTS] || SYSTEM_PROMPTS.full_mock;
    const fullSystemPrompt = systemPrompt + documentContext;

    // Get conversation history if session exists
    let messages: Array<{role: string, content: string}> = [];
    
    if (session_id && !is_initial) {
      const { data: chatHistory } = await supabaseClient
        .from("chat_messages")
        .select("role, content")
        .eq("session_id", session_id)
        .order("created_at", { ascending: true });

      if (chatHistory) {
        messages = chatHistory.map(m => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content
        }));
      }
    }

    // Add current message
    if (message) {
      messages.push({ role: "user", content: message });
      
      // Save user message to database
      if (session_id) {
        await supabaseClient
          .from("chat_messages")
          .insert({
            session_id,
            role: "user",
            content: message
          });
      }
    } else if (is_initial) {
      // For initial message, prompt the AI to start
      messages.push({ 
        role: "user", 
        content: "Please begin the interview coaching session based on my documents." 
      });
    }

    logStep("Calling Anthropic API", { messageCount: messages.length, sessionType: session_type });

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
      throw new Error(`Anthropic API error: ${response.status}`);
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

    // For quick_prep, also save as prep_packet
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
