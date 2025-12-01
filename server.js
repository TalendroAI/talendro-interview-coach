const express = require('express');
const cors = require('cors');
const path = require('path');
const { google } = require('googleapis');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// STRIPE CONFIGURATION
// ============================================

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
let stripe = null;
if (STRIPE_SECRET_KEY) {
  stripe = require('stripe')(STRIPE_SECRET_KEY);
  console.log('Stripe API initialized');
} else {
  console.warn('Stripe secret key not configured - session resolution disabled');
}

// Product name to session type mapping
const PRODUCT_TO_SESSION_TYPE = {
  'Talendro™ Interview Coach - Quick Prep': 'quick_prep',
  'Talendro™ Interview Coach - Full Mock': 'full_mock',
  'Talendro™ Interview Coach - Premium Audio': 'audio_mock',
  'Talendro™ Interview Coach Pro': 'pro'
};

// ============================================
// GOOGLE SHEETS CONFIGURATION
// ============================================

// Credentials loaded from environment variable
const GOOGLE_CREDENTIALS = JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}');
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || '1nLXvn83ziFGpMNgBfbHE0rKCZe5PkxGHzXwGtAnKvrs';
const SHEET_NAME = 'Sheet1';

// Column mapping
const COLUMNS = {
  EMAIL: 'C',
  QUICK_PREP_REMAINING: 'W',
  FULL_MOCK_REMAINING: 'Z',
  AUDIO_MOCK_REMAINING: 'AC',
  IS_PRO: 'AD',
  QUICK_PREP_TRANSCRIPT: 'AF',
  QUICK_PREP_GENERATED_AT: 'AG',
  FULL_MOCK_TRANSCRIPT: 'AH',
  FULL_MOCK_STARTED_AT: 'AI',
  FULL_MOCK_STATUS: 'AJ',
  AUDIO_MOCK_TRANSCRIPT: 'AK',
  AUDIO_MOCK_STARTED_AT: 'AL',
  AUDIO_MOCK_STATUS: 'AM'
};

// Initialize Google Sheets API
let sheets = null;
if (GOOGLE_CREDENTIALS.client_email) {
  const auth = new google.auth.GoogleAuth({
    credentials: GOOGLE_CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  sheets = google.sheets({ version: 'v4', auth });
  console.log('Google Sheets API initialized');
} else {
  console.warn('Google credentials not configured - session validation disabled');
}

// ============================================
// GOOGLE SHEETS HELPER FUNCTIONS
// ============================================

async function findUserRow(email) {
  if (!sheets) return null;
  
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!C:C`
    });
    
    const rows = response.data.values || [];
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] && rows[i][0].toLowerCase() === email.toLowerCase()) {
        return i + 1;
      }
    }
    return null;
  } catch (error) {
    console.error('Error finding user row:', error);
    throw error;
  }
}

async function getUserData(email) {
  if (!sheets) return null;
  
  try {
    const rowNum = await findUserRow(email);
    if (!rowNum) {
      return null;
    }
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A${rowNum}:AM${rowNum}`
    });
    
    const row = response.data.values ? response.data.values[0] : [];
    
    // DEBUG LOGGING
    console.log('=== DEBUG getUserData ===');
    console.log('Row number:', rowNum);
    console.log('Row length:', row.length);
    console.log('Row[22] (Quick Prep Remaining):', row[22]);
    console.log('Row[25] (Full Mock Remaining):', row[25]);
    console.log('Row[35] (Full Mock Status):', row[35]);
    console.log('Full row data:', JSON.stringify(row));
    console.log('=========================');
    
    return {
      rowNum,
      email: row[2] || '',
      quickPrepRemaining: parseInt(row[22]) || 0,
      fullMockRemaining: parseInt(row[25]) || 0,
      audioMockRemaining: parseInt(row[28]) || 0,
      isPro: row[29]?.toLowerCase() === 'true' || row[29]?.toLowerCase() === 'yes',
      quickPrepTranscript: row[31] || '',
      quickPrepGeneratedAt: row[32] || '',
      fullMockTranscript: row[33] || '',
      fullMockStartedAt: row[34] || '',
      fullMockStatus: row[35] || '',
      audioMockTranscript: row[36] || '',
      audioMockStartedAt: row[37] || '',
      audioMockStatus: row[38] || ''
    };
  } catch (error) {
    console.error('Error getting user data:', error);
    throw error;
  }
}

async function updateMultipleCells(rowNum, updates) {
  if (!sheets) return;
  
  try {
    const data = updates.map(({ column, value }) => ({
      range: `${SHEET_NAME}!${column}${rowNum}`,
      values: [[value]]
    }));
    
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: {
        valueInputOption: 'RAW',
        data
      }
    });
  } catch (error) {
    console.error('Error updating multiple cells:', error);
    throw error;
  }
}

// ============================================
// SESSION VALIDATION LOGIC
// ============================================

function isWithin48Hours(dateString) {
  if (!dateString) return false;
  const startTime = new Date(dateString);
  const now = new Date();
  const hoursDiff = (now - startTime) / (1000 * 60 * 60);
  return hoursDiff <= 48;
}

async function validateSession(email, sessionType) {
  const userData = await getUserData(email);
  
  if (!userData) {
    return {
      allowed: false,
      reason: 'User not found. Please complete your purchase first.',
      showTranscript: false
    };
  }
  
  switch (sessionType) {
    case 'quick_prep':
      if (userData.quickPrepTranscript) {
        return {
          allowed: false,
          reason: 'completed',
          showTranscript: true,
          transcript: userData.quickPrepTranscript,
          generatedAt: userData.quickPrepGeneratedAt
        };
      }
      if (userData.quickPrepRemaining <= 0 && !userData.isPro) {
        return {
          allowed: false,
          reason: 'No Quick Prep sessions remaining. Please purchase another session.',
          showTranscript: false
        };
      }
      return { allowed: true };
      
    case 'full_mock':
      if (userData.fullMockTranscript && userData.fullMockStatus === 'completed') {
        return {
          allowed: false,
          reason: 'completed',
          showTranscript: true,
          transcript: userData.fullMockTranscript,
          generatedAt: userData.fullMockStartedAt
        };
      }
      if (userData.fullMockStatus === 'in_progress' && isWithin48Hours(userData.fullMockStartedAt)) {
        return { 
          allowed: true, 
          reconnection: true,
          message: 'Reconnecting to your in-progress session...'
        };
      }
      if (userData.fullMockStatus === 'in_progress' && !isWithin48Hours(userData.fullMockStartedAt)) {
        return {
          allowed: false,
          reason: 'Your session expired after 48 hours. Please purchase a new session.',
          showTranscript: false
        };
      }
      if (userData.fullMockRemaining <= 0 && !userData.isPro) {
        return {
          allowed: false,
          reason: 'No Full Mock sessions remaining. Please purchase another session.',
          showTranscript: false
        };
      }
      return { allowed: true };
      
    case 'audio_mock':
      if (userData.audioMockTranscript && userData.audioMockStatus === 'completed') {
        return {
          allowed: false,
          reason: 'completed',
          showTranscript: true,
          transcript: userData.audioMockTranscript,
          generatedAt: userData.audioMockStartedAt
        };
      }
      if (userData.audioMockStatus === 'in_progress' && isWithin48Hours(userData.audioMockStartedAt)) {
        return { 
          allowed: true, 
          reconnection: true,
          message: 'Reconnecting to your in-progress session...'
        };
      }
      if (userData.audioMockStatus === 'in_progress' && !isWithin48Hours(userData.audioMockStartedAt)) {
        return {
          allowed: false,
          reason: 'Your session expired after 48 hours. Please purchase a new session.',
          showTranscript: false
        };
      }
      if (userData.audioMockRemaining <= 0 && !userData.isPro) {
        return {
          allowed: false,
          reason: 'No Audio Mock sessions remaining. Please purchase another session.',
          showTranscript: false
        };
      }
      return { allowed: true };
      
    case 'pro':
      if (!userData.isPro) {
        return {
          allowed: false,
          reason: 'Pro subscription required. Please upgrade to Pro.',
          showTranscript: false
        };
      }
      return { allowed: true };
      
    default:
      return {
        allowed: false,
        reason: 'Invalid session type.',
        showTranscript: false
      };
  }
}

// ============================================
// API ENDPOINTS
// ============================================

// Resolve Stripe checkout session to get customer email and product
app.get('/api/resolve-stripe-session', async (req, res) => {
  try {
    const { session_id } = req.query;
    
    if (!session_id) {
      return res.status(400).json({ error: 'Session ID required' });
    }
    
    if (!stripe) {
      console.error('Stripe not configured');
      return res.status(500).json({ error: 'Stripe not configured' });
    }
    
    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['line_items', 'line_items.data.price.product']
    });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Get customer email
    const email = session.customer_details?.email || session.customer_email;
    
    if (!email) {
      return res.status(400).json({ error: 'No email found in session' });
    }
    
    // Get product name and map to session type
    let sessionType = 'quick_prep'; // default
    
    if (session.line_items?.data?.length > 0) {
      const productName = session.line_items.data[0].price?.product?.name || 
                          session.line_items.data[0].description;
      
      // Try exact match first
      if (PRODUCT_TO_SESSION_TYPE[productName]) {
        sessionType = PRODUCT_TO_SESSION_TYPE[productName];
      } else {
        // Try partial matching
        const productLower = productName?.toLowerCase() || '';
        if (productLower.includes('full mock')) {
          sessionType = 'full_mock';
        } else if (productLower.includes('audio') || productLower.includes('premium')) {
          sessionType = 'audio_mock';
        } else if (productLower.includes('pro')) {
          sessionType = 'pro';
        } else if (productLower.includes('quick prep')) {
          sessionType = 'quick_prep';
        }
      }
    }
    
    console.log(`Resolved Stripe session: email=${email}, sessionType=${sessionType}`);
    
    res.json({ 
      success: true, 
      email, 
      sessionType,
      redirectUrl: `/?session_type=${sessionType}&email=${encodeURIComponent(email)}`
    });
    
  } catch (error) {
    console.error('Error resolving Stripe session:', error);
    res.status(500).json({ error: 'Failed to resolve session', details: error.message });
  }
});

app.post('/api/check-session', async (req, res) => {
  try {
    const { email, sessionType } = req.body;
    
    if (!email || !sessionType) {
      return res.status(400).json({ error: 'Email and session type required' });
    }
    
    // If Google Sheets not configured, allow access
    if (!sheets) {
      return res.json({ allowed: true });
    }
    
    const validation = await validateSession(email, sessionType);
    res.json(validation);
  } catch (error) {
    console.error('Error checking session:', error);
    res.status(500).json({ error: 'Failed to validate session' });
  }
});

app.post('/api/start-session', async (req, res) => {
  try {
    const { email, sessionType } = req.body;
    
    if (!email || !sessionType) {
      return res.status(400).json({ error: 'Email and session type required' });
    }
    
    if (!sheets) {
      return res.json({ success: true, startedAt: new Date().toISOString() });
    }
    
    const userData = await getUserData(email);
    if (!userData) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const now = new Date().toISOString();
    
    if (sessionType === 'full_mock') {
      if (userData.fullMockStatus !== 'in_progress') {
        await updateMultipleCells(userData.rowNum, [
          { column: COLUMNS.FULL_MOCK_STARTED_AT, value: now },
          { column: COLUMNS.FULL_MOCK_STATUS, value: 'in_progress' }
        ]);
      }
    } else if (sessionType === 'audio_mock') {
      if (userData.audioMockStatus !== 'in_progress') {
        await updateMultipleCells(userData.rowNum, [
          { column: COLUMNS.AUDIO_MOCK_STARTED_AT, value: now },
          { column: COLUMNS.AUDIO_MOCK_STATUS, value: 'in_progress' }
        ]);
      }
    }
    
    res.json({ success: true, startedAt: now });
  } catch (error) {
    console.error('Error starting session:', error);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

app.post('/api/save-transcript', async (req, res) => {
  try {
    const { email, sessionType, transcript } = req.body;
    
    if (!email || !sessionType || !transcript) {
      return res.status(400).json({ error: 'Email, session type, and transcript required' });
    }
    
    if (!sheets) {
      return res.json({ success: true, savedAt: new Date().toISOString() });
    }
    
    const userData = await getUserData(email);
    if (!userData) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const now = new Date().toISOString();
    
    switch (sessionType) {
      case 'quick_prep':
        await updateMultipleCells(userData.rowNum, [
          { column: COLUMNS.QUICK_PREP_TRANSCRIPT, value: transcript },
          { column: COLUMNS.QUICK_PREP_GENERATED_AT, value: now }
        ]);
        break;
        
      case 'full_mock':
        await updateMultipleCells(userData.rowNum, [
          { column: COLUMNS.FULL_MOCK_TRANSCRIPT, value: transcript },
          { column: COLUMNS.FULL_MOCK_STATUS, value: 'completed' }
        ]);
        break;
        
      case 'audio_mock':
        await updateMultipleCells(userData.rowNum, [
          { column: COLUMNS.AUDIO_MOCK_TRANSCRIPT, value: transcript },
          { column: COLUMNS.AUDIO_MOCK_STATUS, value: 'completed' }
        ]);
        break;
    }
    
    res.json({ success: true, savedAt: now });
  } catch (error) {
    console.error('Error saving transcript:', error);
    res.status(500).json({ error: 'Failed to save transcript' });
  }
});

// Generate polished interview debrief for Full Mock
app.post('/api/generate-debrief', async (req, res) => {
  try {
    const { conversationHistory, documents, sessionType } = req.body;
    
    if (!conversationHistory || conversationHistory.length === 0) {
      return res.status(400).json({ error: 'Conversation history required' });
    }
    
    // Format conversation for the prompt
    const conversationText = conversationHistory.map(msg => {
      const role = msg.role === 'user' ? 'CANDIDATE' : 'INTERVIEWER';
      return `${role}: ${msg.content}`;
    }).join('\n\n');
    
    // Determine session type label
    const sessionTypeLabel = sessionType === 'audio_mock' 
      ? 'Premium Audio Mock Interview' 
      : 'Full Mock Interview';
    
    // Count questions (approximate based on interviewer messages)
    const interviewerMessages = conversationHistory.filter(msg => msg.role === 'assistant');
    const questionCount = Math.max(interviewerMessages.length, 5);
    
    // Extract document info
    const resume = documents?.resume || 'Not provided';
    const jobDescription = documents?.jobDescription || 'Not provided';
    const companyUrl = documents?.companyUrl || 'Not provided';
    
    const debriefPrompt = `You are creating a professional Interview Debrief Document for a candidate who just completed a mock interview session.

Based on the mock interview transcript below, create a beautifully formatted debrief document.

## INTERVIEW TRANSCRIPT:
${conversationText}

## CONTEXT:
- Company URL: ${companyUrl}
- Job Description: ${jobDescription}

---

Create a comprehensive Interview Debrief Document with this EXACT structure:

# 🎯 Interview Debrief Report

## Session Overview
- **Date:** ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
- **Session Type:** ${sessionTypeLabel}
- **Questions Completed:** ${questionCount}

---

## 📊 Overall Performance Score: [X]/10

[Write 2-3 sentences summarizing their overall performance]

---

## ✅ Top 3 Strengths

### 1. [Strength Title]
[Specific example from their answers demonstrating this strength]

### 2. [Strength Title]
[Specific example from their answers demonstrating this strength]

### 3. [Strength Title]
[Specific example from their answers demonstrating this strength]

---

## 🎯 Top 3 Areas for Improvement

### 1. [Area Title]
**What happened:** [Brief description]
**How to improve:** [Specific, actionable advice]

### 2. [Area Title]
**What happened:** [Brief description]
**How to improve:** [Specific, actionable advice]

### 3. [Area Title]
**What happened:** [Brief description]
**How to improve:** [Specific, actionable advice]

---

## 📝 Question-by-Question Breakdown

### Question 1: Opening
**Question Asked:** [The question]
**Your Response Summary:** [2-3 sentence summary of their answer]
**Assessment:** [Strong / Good / Needs Work] - [Brief feedback]

### Question 2: Experience
**Question Asked:** [The question]
**Your Response Summary:** [2-3 sentence summary of their answer]
**Assessment:** [Strong / Good / Needs Work] - [Brief feedback]

[Continue for all questions in the transcript...]

---

## 💬 Key Phrases to Use

1. **"[Powerful phrase]"** - [Why it works]
2. **"[Another phrase]"** - [Why it works]
3. **"[Another phrase]"** - [Why it works]

---

## ⚠️ Phrases to Avoid

1. ❌ "[Weak phrase they used]" → ✅ "[Better alternative]"
2. ❌ "[Another weak phrase]" → ✅ "[Better alternative]"

---

## 📚 Bonus Practice Questions

Practice these additional questions to continue improving:

### Experience-Based
1. [Additional experience question]
2. [Additional experience question]

### Behavioral (STAR Method)
1. [Additional behavioral question]
2. [Additional behavioral question]

### Role-Specific
1. [Additional technical/strategic question]
2. [Additional technical/strategic question]

---

## 🚀 Your Action Plan

1. **This Week:** [Specific action to take]
2. **Before Your Interview:** [Specific action to take]
3. **During Your Interview:** [Key thing to remember]

---

## Final Thoughts

[2-3 sentences of encouragement and motivation. End on a positive, confidence-building note.]

---

*Generated by Talendro™ Interview Coach*
*Your partner in interview success*

---

IMPORTANT: Create all 10 question breakdowns. Be specific and reference their actual answers. Make this document valuable and actionable.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 6000,
        messages: [{ role: 'user', content: debriefPrompt }]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Anthropic API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const debrief = data.content[0].text;

    res.json({ success: true, debrief });
  } catch (error) {
    console.error('Error generating debrief:', error);
    res.status(500).json({ error: 'Failed to generate debrief' });
  }
});

app.get('/api/transcript/:email/:sessionType', async (req, res) => {
  try {
    const { email, sessionType } = req.params;
    
    if (!sheets) {
      return res.json({ transcript: '', generatedAt: '' });
    }
    
    const userData = await getUserData(email);
    if (!userData) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    let transcript = '';
    let generatedAt = '';
    
    switch (sessionType) {
      case 'quick_prep':
        transcript = userData.quickPrepTranscript;
        generatedAt = userData.quickPrepGeneratedAt;
        break;
      case 'full_mock':
        transcript = userData.fullMockTranscript;
        generatedAt = userData.fullMockStartedAt;
        break;
      case 'audio_mock':
        transcript = userData.audioMockTranscript;
        generatedAt = userData.audioMockStartedAt;
        break;
    }
    
    res.json({ transcript, generatedAt });
  } catch (error) {
    console.error('Error getting transcript:', error);
    res.status(500).json({ error: 'Failed to get transcript' });
  }
});

// ============================================
// COMPLETE SESSION ENDPOINT (Zapier webhook)
// ============================================

app.post('/api/complete', async (req, res) => {
  try {
    const { email, sessionType, sessionId, transcript, documents } = req.body;
    
    // Build transcript text from conversation history
    const transcriptText = Array.isArray(transcript) 
      ? transcript.map(msg => {
          const role = msg.role === 'user' ? '[USER]' : '[COACH]';
          return `${role}: ${msg.content}`;
        }).join('\n\n')
      : transcript;
    
    // Send to Zapier webhook
    const zapierWebhookUrl = 'https://hooks.zapier.com/hooks/catch/9843127/uko6xa9/';
    
    await fetch(zapierWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        sessionType: sessionType,
        sessionId: sessionId,
        transcript: transcriptText,
        documents: documents,
        completedAt: new Date().toISOString()
      })
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Complete session error:', error);
    res.status(500).json({ error: 'Failed to complete session' });
  }
});

// ============================================
// ELEVENLABS CONFIGURATION
// ============================================

app.get('/api/config', (req, res) => {
  res.json({ 
    agentId: process.env.ELEVENLABS_AGENT_ID || 'agent_01jwpkjy1xeyxdh51gbqy62wd0'
  });
});

app.get('/api/signed-url', async (req, res) => {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const agentId = process.env.ELEVENLABS_AGENT_ID || 'agent_01jwpkjy1xeyxdh51gbqy62wd0';
    
    if (!apiKey) {
      return res.status(500).json({ error: 'ElevenLabs API key not configured' });
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get signed URL: ${response.statusText}`);
    }

    const data = await response.json();
    res.json({ signedUrl: data.signed_url });
  } catch (error) {
    console.error('Error getting signed URL:', error);
    res.status(500).json({ error: 'Failed to get signed URL' });
  }
});

// ============================================
// SYSTEM PROMPTS
// ============================================

const SYSTEM_PROMPTS = {
  quick_prep: `You are an expert interview coach providing a Quick Prep session.

CRITICAL: When the user has provided a resume and/or job description, DO NOT ask clarifying questions. Immediately deliver the prep packet using whatever information is available.

DELIVER THE FOLLOWING SECTIONS IN THIS EXACT ORDER AND FORMAT:

---

# QUICK INTERVIEW PREP PACKET

## 1. Company Quick Facts
- [Bullet point 1 about the company]
- [Bullet point 2 about the company]
- [Bullet point 3 about the company]

## 2. Role Alignment Summary
[One paragraph explaining how the candidate's background aligns with this specific role]

## 3. Most Likely Interview Questions

### Strategic/Leadership Questions:
1. "[Question 1]"
2. "[Question 2]"
3. "[Question 3]"
4. "[Question 4]"

### Experience-Based Questions:
1. "[Question 1]"
2. "[Question 2]"
3. "[Question 3]"
4. "[Question 4]"

### Behavioral Questions:
1. "[Question 1]"
2. "[Question 2]"
3. "[Question 3]"
4. "[Question 4]"

### Culture Fit Questions:
1. "[Question 1]"
2. "[Question 2]"
3. "[Question 3]"
4. "[Question 4]"

## 4. Sample Answers

### For Strategic/Leadership:
**Question:** [Restate question 1 from above]
**Sample Answer:** [Detailed STAR-method answer using their actual resume details - Situation, Task, Action, Result]

### For Experience-Based:
**Question:** [Restate question 1 from above]
**Sample Answer:** [Detailed STAR-method answer using their actual resume details]

### For Behavioral:
**Question:** [Restate question 1 from above]
**Sample Answer:** [Detailed STAR-method answer using their actual resume details]

### For Culture Fit:
**Question:** [Restate question 1 from above]
**Sample Answer:** [Detailed STAR-method answer using their actual resume details]

## 5. Questions to Ask the Interviewer
1. [Thoughtful question tailored to this role/company]
2. [Thoughtful question tailored to this role/company]
3. [Thoughtful question tailored to this role/company]

## 6. Red Flags to Address
- [Any gap or concern they should be prepared to explain]
- [Another potential concern, if applicable]

---

RULES:
- Follow this EXACT structure every time
- Always provide exactly 4 questions per category (16 total questions)
- Always provide exactly 4 sample answers (one per category)
- Always provide exactly 3 questions to ask the interviewer
- Use markdown headers exactly as shown (## for main sections, ### for subsections)
- Do NOT skip any section
- Do NOT add extra sections
- Do NOT ask clarifying questions if resume/job description provided`,

  full_mock: `You are an expert interview coach conducting a Full Mock Interview session. You will role-play as a professional interviewer for the target company.

## INTERVIEW STRUCTURE (EXACTLY 10 QUESTIONS)

You will conduct a realistic mock interview with EXACTLY 10 questions in this order:

1. **Opening/Icebreaker** (1 question): "Tell me about yourself" or similar
2. **Experience-Based** (3 questions): Questions about their specific background
3. **Behavioral** (3 questions): STAR-method situational questions
4. **Role-Specific** (2 questions): Technical or strategic questions for this role
5. **Closing** (1 question): "Why this company?" or "What questions do you have?"

## YOUR FIRST MESSAGE

When the user starts the session, introduce yourself and begin:

"Hello! I'm [Interviewer Name], and I'll be conducting your interview today for the [Job Title] position at [Company]. 

I have your resume in front of me and I'm excited to learn more about your background. This will be a realistic interview simulation - answer as you would in a real interview.

Let's begin.

**Question 1 of 10:**
[Ask your opening question - typically 'Tell me about yourself and why you're interested in this role.']"

## AFTER EACH USER RESPONSE

Provide this EXACT format:

"**Feedback:** [2-3 sentences of specific, constructive feedback on their answer. What was strong? What could be improved? Be encouraging but honest.]

**Question [X] of 10:**
[Your next interview question]"

## TRACKING QUESTIONS

Always show "Question X of 10" so the user knows their progress.

## AFTER QUESTION 10 (FINAL SUMMARY)

After the user answers question 10, provide this EXACT format:

---

# 🎯 MOCK INTERVIEW COMPLETE

## Overall Performance Score: [X]/10

## Your Top 3 Strengths:
1. [Specific strength with example from their answers]
2. [Specific strength with example from their answers]
3. [Specific strength with example from their answers]

## Top 3 Areas for Improvement:
1. [Specific area with actionable advice]
2. [Specific area with actionable advice]
3. [Specific area with actionable advice]

## Question-by-Question Recap:
- **Q1 (Opening):** [Brief assessment - Strong/Good/Needs Work]
- **Q2 (Experience):** [Brief assessment]
- **Q3 (Experience):** [Brief assessment]
- **Q4 (Experience):** [Brief assessment]
- **Q5 (Behavioral):** [Brief assessment]
- **Q6 (Behavioral):** [Brief assessment]
- **Q7 (Behavioral):** [Brief assessment]
- **Q8 (Role-Specific):** [Brief assessment]
- **Q9 (Role-Specific):** [Brief assessment]
- **Q10 (Closing):** [Brief assessment]

## Key Phrases to Use:
- "[Powerful phrase they used or should use]"
- "[Another strong phrase]"
- "[Another strong phrase]"

## Phrases to Avoid:
- "[Weak phrase they used]" → Instead say: "[Better alternative]"
- "[Another weak phrase]" → Instead say: "[Better alternative]"

## Final Recommendation:
[2-3 sentences of encouragement and next steps. End on a positive, motivating note.]

## 📚 Bonus Practice Questions
Practice these additional questions on your own to strengthen your interview skills:

### Experience-Based:
- [Additional experience question related to their background]
- [Another experience question]

### Behavioral (STAR Method):
- [Additional behavioral question]
- [Another behavioral question]

### Role-Specific:
- [Additional technical/strategic question for this role]
- [Another role-specific question]

---

## RULES:
- Ask EXACTLY 10 questions, no more, no less
- Always show "Question X of 10" progress
- Give feedback after EVERY answer (except after Q10, give full summary instead)
- Keep feedback concise (2-3 sentences) to maintain interview flow
- Be encouraging but honest - this helps them improve
- Personalize questions based on their resume and target job
- Do NOT ask clarifying questions about their documents - use what's provided
- Stay in character as a professional interviewer throughout`,

  audio_mock: `You are an expert interview coach conducting a Premium Audio Mock Interview.

This is a voice-based realistic interview simulation. You will:

1. Introduce yourself naturally as the interviewer
2. Conduct a conversational 20-30 minute mock interview
3. React naturally to their responses
4. Ask follow-up questions based on their answers
5. Provide verbal feedback and coaching
6. End with a comprehensive debrief

Speak naturally and conversationally. Help them practice thinking on their feet.`,

  pro: `You are an expert interview coach for a Pro subscriber with unlimited access.

You have full flexibility to:
- Conduct mock interviews
- Review and improve their answers
- Provide quick prep for specific companies
- Coach on salary negotiation
- Help with any interview-related questions

Adapt to what they need in each session. Be a comprehensive interview preparation partner.`
};

app.get('/api/system-prompt/:sessionType', (req, res) => {
  const { sessionType } = req.params;
  const prompt = SYSTEM_PROMPTS[sessionType] || SYSTEM_PROMPTS.quick_prep;
  res.json({ systemPrompt: prompt });
});

// ============================================
// CHAT ENDPOINT (AI calls via Anthropic)
// ============================================

app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionType, documents, customerEmail, conversationHistory } = req.body;
    
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!anthropicApiKey) {
      return res.status(500).json({ error: 'Anthropic API key not configured' });
    }
    
    // Get the system prompt for this session type
    const systemPrompt = SYSTEM_PROMPTS[sessionType] || SYSTEM_PROMPTS.quick_prep;
    
    // Build context from documents (only added to first message)
    let context = '';
    if (documents) {
      if (documents.resume) {
        context += `\n\nCANDIDATE RESUME:\n${documents.resume}`;
      }
      if (documents.jobDescription) {
        context += `\n\nJOB DESCRIPTION:\n${documents.jobDescription}`;
      }
      if (documents.companyUrl) {
        context += `\n\nCOMPANY WEBSITE: ${documents.companyUrl}`;
      }
    }
    
    // Build the messages array
    let messages = [];
    
    // If conversation history provided (multi-turn), use it
    if (conversationHistory && conversationHistory.length > 0) {
      // Add context to the first user message only
      messages = conversationHistory.map((msg, index) => {
        if (index === 0 && msg.role === 'user' && context) {
          return {
            role: msg.role,
            content: `${msg.content}\n\n---\nCONTEXT:${context}`
          };
        }
        return { role: msg.role, content: msg.content };
      });
      
      // Add the new message
      messages.push({ role: 'user', content: message });
    } else {
      // Single message (first message or quick_prep style)
      messages = [
        {
          role: 'user',
          content: context ? `${message}\n\n---\nCONTEXT:${context}` : message
        }
      ];
    }
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages: messages
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('Anthropic API error:', error);
      throw new Error(`API error: ${error.error?.message || 'Unknown error'}`);
    }
    
    const data = await response.json();
    const assistantMessage = data.content[0].text;
    
    res.json({ message: assistantMessage });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to get AI response' });
  }
});

// ============================================
// WEBHOOK FOR ZAPIER (session completion)
// ============================================

app.post('/api/webhook/session-complete', async (req, res) => {
  try {
    const { email, sessionType, transcript, feedback } = req.body;
    
    const zapierWebhookUrl = 'https://hooks.zapier.com/hooks/catch/9843127/uko6xa9/';
    
    await fetch(zapierWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        sessionType,
        transcript,
        feedback,
        completedAt: new Date().toISOString()
      })
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook failed' });
  }
});

// ============================================
// SERVE FRONTEND
// ============================================

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Interview Coach server running on port ${PORT}`);
});
