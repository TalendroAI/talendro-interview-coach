const express = require('express');
const cors = require('cors');
const path = require('path');
const { google } = require('googleapis');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

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

  full_mock: `You are an expert interview coach conducting a Full Mock Interview session.

This is a realistic interview simulation. You will:

1. Start by briefly reviewing the role and setting expectations
2. Conduct a 20-30 minute mock interview with realistic questions
3. Ask one question at a time and wait for responses
4. Provide real-time feedback after each answer
5. Cover behavioral, technical, and situational questions
6. End with comprehensive feedback on:
   - Overall performance
   - Strongest moments
   - Areas for improvement
   - Specific phrases or habits to adjust
   - Final recommendations

Be encouraging but honest. Your goal is to prepare them for real interviews.`,

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
    const { message, sessionType, documents, customerEmail } = req.body;
    
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!anthropicApiKey) {
      return res.status(500).json({ error: 'Anthropic API key not configured' });
    }
    
    // Get the system prompt for this session type
    const systemPrompt = SYSTEM_PROMPTS[sessionType] || SYSTEM_PROMPTS.quick_prep;
    
    // Build context from documents
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
    const messages = [
      {
        role: 'user',
        content: context ? `${message}\n\n---\nCONTEXT:${context}` : message
      }
    ];
    
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
