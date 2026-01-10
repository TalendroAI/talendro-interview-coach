import { useState, useCallback, useRef, useEffect } from 'react';
import { useConversation } from '@elevenlabs/react';
import { MicOff, Mic, Volume2, PhoneOff, Loader2, Lightbulb, RefreshCw, WifiOff, AlertTriangle, CheckCircle2, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import sarahHeadshot from '@/assets/sarah-headshot.jpg';
import { AudioDeviceSelect } from '@/components/audio/AudioDeviceSelect';
import { useAudioDevices } from '@/components/audio/useAudioDevices';
import { useAudioSessionPersistence } from '@/hooks/useAudioSessionPersistence';

interface AudioInterfaceProps {
  isActive: boolean;
  sessionId?: string;
  documents?: {
    firstName: string;
    resume: string;
    jobDescription: string;
    companyUrl: string;
  };
  isDocumentsSaved?: boolean;
  resumeFromPause?: boolean;
  onInterviewStarted?: () => void;
  onInterviewComplete?: () => void;
  onSessionComplete?: (resultsData: { transcript: string; prepPacket: string | null }) => void;
  userEmail?: string;
}

const ELEVENLABS_AGENT_ID = 'agent_1901kb0ray8kfph9x9bh4w97bbe4';

const VAD_LOW_THRESHOLD = 0.15;
const VAD_WARNING_DURATION = 8000;
const HEARTBEAT_INTERVAL = 5000;
const SILENCE_TIMEOUT = 45000;
const MAX_RECONNECT_ATTEMPTS = 3;
const KEEP_ALIVE_INTERVAL = 10000;
const ANTI_INTERRUPT_VAD_THRESHOLD = 0.3;

type ConnectionQuality = 'excellent' | 'good' | 'poor' | 'disconnected';

// Helper function to detect actual interview questions (not greetings or conversational)
const isInterviewQuestion = (text: string): boolean => {
  if (!text || !text.includes('?')) return false;
  
  // Skip greeting/conversational patterns
  const skipPatterns = [
    /ready to begin/i,
    /shall we (start|begin|continue)/i,
    /are you ready/i,
    /can you hear me/i,
    /is that clear/i,
    /does that make sense/i,
    /any questions before we/i,
    /sound good/i,
    /welcome back/i,
    /would you like me to repeat/i,
    /do you need me to/i,
  ];
  
  for (const pattern of skipPatterns) {
    if (pattern.test(text)) return false;
  }
  
  // Look for numbered question patterns first (most reliable)
  if (/question\s*\d+/i.test(text)) return true;
  
  // Look for question lead-ins that indicate a real interview question
  const questionIndicators = [
    /let's begin|let's start|first question|next question/i,
    /tell me about a time/i,
    /can you (tell|describe|explain|walk|share)/i,
    /what excites you/i,
    /how would you/i,
    /why (do you|did you|are you)/i,
    /describe a situation/i,
    /give me an example/i,
  ];
  
  for (const pattern of questionIndicators) {
    if (pattern.test(text)) return true;
  }
  
  return false;
};

// Helper function to extract the question NUMBER from Sarah's message
// e.g., "Question 2:" returns 2, "Question 5 of 16:" returns 5
const extractQuestionNumber = (text: string): number | null => {
  if (!text) return null;
  
  const match = text.match(/question\s*(\d+)/i);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return null;
};

// Helper function to get the highest question number from transcript
// Falls back to counting interview questions if no numbered questions found
const getHighestQuestionNumber = (transcript: Array<{ role: string; text: string }>): number => {
  let highestNumbered = 0;
  let questionCount = 0;
  
  for (const entry of transcript) {
    if (entry.role === 'assistant') {
      // First try to find explicit question numbers
      const num = extractQuestionNumber(entry.text);
      if (num && num > highestNumbered) {
        highestNumbered = num;
      }
      // Also count interview questions
      if (isInterviewQuestion(entry.text)) {
        questionCount++;
      }
    }
  }
  
  // Use numbered questions if found, otherwise use count
  return highestNumbered > 0 ? highestNumbered : questionCount;
};

// Helper function to extract just the question portion from a message
// Sarah often gives feedback first, then asks a question at the end
const extractQuestionOnly = (text: string): string | null => {
  if (!text) return null;
  
  // Look for common question lead-ins and extract from there
  const questionLeadIns = [
    /(?:let's move to our next question:|next question:|question \d+:|here's (?:the|our) (?:next |first )?question:)\s*(.+\?)/i,
    /(?:can you tell me|tell me about|what|why|how|describe|walk me through|explain|share|have you)[\s\S]*\?/i,
  ];
  
  // Try to find a question lead-in first
  for (const pattern of questionLeadIns) {
    const match = text.match(pattern);
    if (match) {
      // Get the captured group if it exists, otherwise the whole match
      const questionPart = match[1] || match[0];
      return questionPart.trim();
    }
  }
  
  // Fallback: find the last sentence that ends with ?
  const sentences = text.split(/(?<=[.!?])\s+/);
  for (let i = sentences.length - 1; i >= 0; i--) {
    if (sentences[i].trim().endsWith('?')) {
      return sentences[i].trim();
    }
  }
  
  return null;
};

export function AudioInterface({
  isActive,
  sessionId,
  documents,
  isDocumentsSaved = false,
  resumeFromPause = false,
  onInterviewStarted,
  onInterviewComplete,
  onSessionComplete,
  userEmail
}: AudioInterfaceProps) {
  const { toast: toastFn } = useToast();
  
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason?.message || '';
      const stack = reason?.stack || '';
      
      if (message.includes('error_type') || 
          stack.includes('handleErrorEvent') ||
          stack.includes('onMessageCallback')) {
        console.error('Intercepted ElevenLabs SDK crash:', reason);
        event.preventDefault();
        
        toastFn({
          title: 'Minor connection issue',
          description: 'Continuing session...',
        });
        
        return;
      }
    };

    const handleError = (event: ErrorEvent) => {
      const message = event.message || '';
      const stack = event.error?.stack || '';
      
      if (message.includes('error_type') || 
          stack.includes('handleErrorEvent') ||
          stack.includes('onMessageCallback')) {
        console.error('Intercepted ElevenLabs SDK error:', event.error);
        event.preventDefault();
        event.stopPropagation();
        
        toastFn({
          title: 'Minor connection issue',
          description: 'Continuing session...',
        });
        
        return;
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);
    
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, [toastFn]);

  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [connectionDropped, setConnectionDropped] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isSendingResults, setIsSendingResults] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>('disconnected');
  const [showVadWarning, setShowVadWarning] = useState(false);
  const [vadScore, setVadScore] = useState(0);
  const [lastActivityTime, setLastActivityTime] = useState(Date.now());
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [showSilenceWarning, setShowSilenceWarning] = useState(false);
  const [isSessionEnding, setIsSessionEnding] = useState(false);
  const [inputVolume, setInputVolume] = useState(0);
  const [showMicInputWarning, setShowMicInputWarning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  const [isWaitingForGreeting, setIsWaitingForGreeting] = useState(false);
  const toast = toastFn;

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  const {
    inputs: micInputs,
    selectedInputId,
    setSelectedInputId,
    ensurePermissionThenEnumerate,
    isEnumerating,
  } = useAudioDevices();
  
  const { appendTurn, getHistory, logEvent } = useAudioSessionPersistence(sessionId, userEmail);
  
  const micWarningShownRef = useRef(false);
  const userEndedSession = useRef(false);
  const interviewStarted = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vadWarningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceWarningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vadHistoryRef = useRef<number[]>([]);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userIsSpeakingRef = useRef(false);

  const transcriptRef = useRef<Array<{ role: 'user' | 'assistant'; text: string; ts: number }>>([]);
  const lastAssistantTurnRef = useRef<string | null>(null);
  const questionCountRef = useRef(0);
  const isResumingRef = useRef(false);

  const pendingContextRef = useRef<string | null>(null);
  const pendingResumeKickoffRef = useRef<string | null>(null);

  const appendTranscriptTurn = useCallback((role: 'user' | 'assistant', text: unknown) => {
    console.log('[appendTranscriptTurn] Called with role:', role, 'text length:', typeof text === 'string' ? text.length : 0);
    const clean = typeof text === 'string' ? text.trim() : '';
    if (!clean) {
      console.log('[appendTranscriptTurn] SKIPPED - empty text');
      return;
    }

    const last = transcriptRef.current[transcriptRef.current.length - 1];
    if (last && last.role === role && last.text === clean) {
      console.log('[appendTranscriptTurn] SKIPPED - duplicate');
      return;
    }

    transcriptRef.current.push({ role, text: clean, ts: Date.now() });
    setLastActivityTime(Date.now());

    if (transcriptRef.current.length > 200) {
      transcriptRef.current = transcriptRef.current.slice(-200);
    }
    
    console.log('[appendTranscriptTurn] Calling appendTurn to save to database...');
    appendTurn({
      role,
      text: clean,
      questionNumber: role === 'assistant' && isInterviewQuestion(clean) ? questionCountRef.current + 1 : null,
    });
  }, [appendTurn]);

  const cleanup = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (vadWarningTimeoutRef.current) {
      clearTimeout(vadWarningTimeoutRef.current);
      vadWarningTimeoutRef.current = null;
    }
    if (silenceWarningTimeoutRef.current) {
      clearTimeout(silenceWarningTimeoutRef.current);
      silenceWarningTimeoutRef.current = null;
    }
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const fetchPrepPacket = async (): Promise<string | null> => {
    if (!sessionId) return null;
    
    try {
      const { data, error } = await supabase
        .from('coaching_sessions')
        .select('prep_packet')
        .eq('id', sessionId)
        .single();
      
      if (error || !data?.prep_packet) {
        console.log('No prep packet found for session');
        return null;
      }
      
      const packet = data.prep_packet as { content?: string };
      return packet?.content || null;
    } catch (err) {
      console.error('Error fetching prep packet:', err);
      return null;
    }
  };

  const sendAudioResults = useCallback(async () => {
    if (!sessionId || !userEmail) {
      console.error('Cannot send results: missing sessionId or userEmail');
      return;
    }

    setIsSendingResults(true);

    try {
      const prepPacket = await fetchPrepPacket();
      
      const transcriptContent = transcriptRef.current
        .map(t => `**${t.role === 'user' ? 'Your Answer' : 'Sarah (Coach)'}:**\n${t.text}`)
        .join('\n\n---\n\n');
      
      let contentToSend = '';
      if (prepPacket) {
        contentToSend = prepPacket + '\n\n---\n\n# Audio Interview Transcript\n\n' + transcriptContent;
      } else {
        contentToSend = '# Audio Interview Transcript\n\n' + transcriptContent;
      }

      const { data, error } = await supabase.functions.invoke('send-results', {
        body: {
          session_id: sessionId,
          email: userEmail,
          session_type: 'premium_audio',
          prep_content: contentToSend,
          results: null,
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to send results');
      }

      toast({
        title: 'Results sent!',
        description: 'Your interview results have been emailed to you.',
      });
    } catch (err) {
      console.error('Error sending audio results:', err);
      toast({
        title: 'Error sending email',
        description: err instanceof Error ? err.message : 'Failed to send your results.',
        variant: 'destructive',
      });
    } finally {
      setIsSendingResults(false);
    }
  }, [sessionId, userEmail, toast]);

  const handleGracefulEnd = useCallback(async (reason: 'user_ended' | 'connection_lost' | 'timeout' | 'error') => {
    setIsSessionEnding(true);
    cleanup();

    const messages: Record<string, { title: string; description: string }> = {
      user_ended: {
        title: 'Interview Complete',
        description: 'Great job! Preparing your results...',
      },
      connection_lost: {
        title: 'Session Ended',
        description: 'The connection was lost. Preparing your results...',
      },
      timeout: {
        title: 'Session Timed Out',
        description: 'The session ended due to inactivity. Preparing your results...',
      },
      error: {
        title: 'Session Ended Unexpectedly',
        description: 'Something went wrong. Preparing your results...',
      },
    };

    toast(messages[reason]);

    const transcriptContent = transcriptRef.current
      .map(t => `**${t.role === 'user' ? 'Your Answer' : 'Sarah (Coach)'}:**\n${t.text}`)
      .join('\n\n---\n\n');
    
    const prepPacket = await fetchPrepPacket();

    if (onSessionComplete) {
      onSessionComplete({
        transcript: transcriptContent,
        prepPacket,
      });
    }

    setIsSessionEnding(false);
    interviewStarted.current = false;
    onInterviewComplete?.();
  }, [cleanup, toast, onInterviewComplete, onSessionComplete]);

  const startHeartbeat = useCallback((conversationRef: ReturnType<typeof useConversation>) => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }

    heartbeatRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceActivity = now - lastActivityTime;

      if (conversationRef.status !== 'connected') {
        setConnectionQuality('disconnected');
        return;
      }

      if (timeSinceActivity < 10000) {
        setConnectionQuality('excellent');
      } else if (timeSinceActivity < 30000) {
        setConnectionQuality('good');
      } else {
        setConnectionQuality('poor');
      }

      if (timeSinceActivity > SILENCE_TIMEOUT && !showSilenceWarning) {
        setShowSilenceWarning(true);
        toast({
          title: 'Are you still there?',
          description: "Sarah hasn't heard from you in a while. Speak or click the microphone to continue.",
          duration: 10000,
        });
      }
    }, HEARTBEAT_INTERVAL);
  }, [lastActivityTime, showSilenceWarning, toast]);

  const handleVadScore = useCallback((props: { vadScore: number }) => {
    const score = props.vadScore;
    setVadScore(score);
    vadHistoryRef.current.push(score);
    
    if (vadHistoryRef.current.length > 10) {
      vadHistoryRef.current.shift();
    }

    const avgVad = vadHistoryRef.current.reduce((a, b) => a + b, 0) / vadHistoryRef.current.length;

    if (score >= ANTI_INTERRUPT_VAD_THRESHOLD) {
      userIsSpeakingRef.current = true;
    } else if (avgVad < ANTI_INTERRUPT_VAD_THRESHOLD) {
      userIsSpeakingRef.current = false;
    }

    if (avgVad < VAD_LOW_THRESHOLD && !showVadWarning) {
      if (!vadWarningTimeoutRef.current) {
        vadWarningTimeoutRef.current = setTimeout(() => {
          setShowVadWarning(true);
          toast({
            title: 'Microphone Issue Detected',
            description: 'Sarah may have trouble hearing you. Check your microphone or move closer.',
            duration: 8000,
          });
        }, VAD_WARNING_DURATION);
      }
    } else if (avgVad >= VAD_LOW_THRESHOLD) {
      if (vadWarningTimeoutRef.current) {
        clearTimeout(vadWarningTimeoutRef.current);
        vadWarningTimeoutRef.current = null;
      }
      if (showVadWarning) {
        setShowVadWarning(false);
      }
    }
  }, [showVadWarning, toast]);

  const conversation = useConversation({
    micMuted: isMuted,
    onConnect: () => {
      console.log('[AudioInterface] Connected to ElevenLabs agent');
      setIsConnecting(false);
      setIsReconnecting(false);
      setConnectionDropped(false);
      setConnectionQuality('excellent');
      setReconnectAttempts(0);
      setLastActivityTime(Date.now());

      const wasAlreadyStarted = interviewStarted.current;
      interviewStarted.current = true;

      toast({
        title: wasAlreadyStarted ? 'Reconnected!' : 'Connected!',
        description: wasAlreadyStarted
          ? 'Continuing your interview with Sarah.'
          : 'Your voice interview has started. Sarah is ready.',
      });

      if (!wasAlreadyStarted) {
        onInterviewStarted?.();
      }

      startHeartbeat(conversation);
      
      if (keepAliveRef.current) {
        clearInterval(keepAliveRef.current);
      }
      keepAliveRef.current = setInterval(() => {
        try {
          conversation.sendUserActivity();
          console.log('[KeepAlive] Sent activity signal');
        } catch (e) {
          console.warn('[KeepAlive] Failed to send activity:', e);
        }
      }, KEEP_ALIVE_INTERVAL);
      
      if (pendingContextRef.current) {
        console.log('[AudioInterface] Sending pending resume context NOW');
        setTimeout(() => {
          if (pendingContextRef.current) {
            conversation.sendContextualUpdate(pendingContextRef.current);
            console.log('[AudioInterface] Resume context sent successfully');
            pendingContextRef.current = null;
          }
        }, 100);
      }
      // REMOVED: pendingResumeKickoffRef block - was causing duplicate instructions to Sarah
      // The firstMessage (resumeGreeting) already handles the welcome back
    },
    onDisconnect: (details) => {
      console.log('[AudioInterface] Disconnected from ElevenLabs agent', details);
      setIsConnecting(false);
      setIsReconnecting(false);
      setConnectionQuality('disconnected');
      cleanup();

      const paused = isPausedRef.current;

      const disconnectReason = typeof details === 'object' && details !== null
        ? JSON.stringify(details)
        : String(details ?? 'unknown');

      logEvent({
        eventType: 'elevenlabs_disconnect',
        message: `Session disconnected after ${Math.round((Date.now() - lastActivityTime) / 1000)}s since last activity`,
        code: 'disconnect',
        context: {
          details: disconnectReason,
          questionCount: questionCountRef.current,
          transcriptLength: transcriptRef.current.length,
          wasUserEnded: userEndedSession.current,
          isPaused: paused,
        },
      });

      if (userEndedSession.current) {
        userEndedSession.current = false;
        handleGracefulEnd('user_ended');
      } else if (paused) {
        return;
      } else if (interviewStarted.current && !isSessionEnding) {
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          setConnectionDropped(true);
          toast({
            variant: 'destructive',
            title: 'Connection Lost',
            description: `Sarah got disconnected. Click "Reconnect" to continue (${MAX_RECONNECT_ATTEMPTS - reconnectAttempts} attempts remaining).`,
          });
        } else {
          handleGracefulEnd('connection_lost');
        }
      }
    },
    onMessage: (message) => {
      console.log('[AudioInterface] Message from agent:', message);
      setLastActivityTime(Date.now());
      setShowSilenceWarning(false);

      try {
        const msg = message as any;
        
        // ElevenLabs sends messages with { source, role, message } structure
        const source = msg?.source;
        const role = msg?.role;
        const messageText = msg?.message;
        const type = msg?.type;
        
        console.log('[AudioInterface] Parsed message - source:', source, 'role:', role, 'type:', type, 'hasText:', !!messageText);

        // Handle ElevenLabs format: { source: 'user', role: 'user', message: '...' }
        if (source === 'user' && messageText) {
          console.log('[AudioInterface] USER message detected, saving to DB...');
          appendTranscriptTurn('user', messageText);
        }
        
        // Handle ElevenLabs format: { source: 'ai', role: 'agent', message: '...' }
        if (source === 'ai' && messageText) {
          console.log('[AudioInterface] AI message detected, saving to DB...');
          appendTranscriptTurn('assistant', messageText);

          const clean = typeof messageText === 'string' ? messageText.trim() : '';
          if (clean) {
            lastAssistantTurnRef.current = clean;
            // First try to extract explicit question number
            const questionNum = extractQuestionNumber(clean);
            if (questionNum && questionNum > questionCountRef.current) {
              questionCountRef.current = questionNum;
              console.log('[AudioInterface] Updated question count from number to:', questionNum);
            } else if (isInterviewQuestion(clean)) {
              // Fall back to counting interview questions
              questionCountRef.current += 1;
              console.log('[AudioInterface] Updated question count by increment to:', questionCountRef.current);
            }
          }
        }

        // Legacy format fallback
        if (type === 'user_transcript') {
          const text = msg?.user_transcription_event?.user_transcript ?? msg?.user_transcript ?? msg?.text;
          if (text) appendTranscriptTurn('user', text);
        }

        if (type === 'agent_response') {
          const text = msg?.agent_response_event?.agent_response ?? msg?.agent_response ?? msg?.text;
          if (text) {
            appendTranscriptTurn('assistant', text);
            const clean = typeof text === 'string' ? text.trim() : '';
            if (clean) {
              lastAssistantTurnRef.current = clean;
              // First try to extract explicit question number
              const questionNum = extractQuestionNumber(clean);
              if (questionNum && questionNum > questionCountRef.current) {
                questionCountRef.current = questionNum;
              } else if (isInterviewQuestion(clean)) {
                // Fall back to counting interview questions
                questionCountRef.current += 1;
              }
            }
          }
        }

        if (type === 'agent_response_correction') {
          const correctedText = msg?.agent_response_correction_event?.corrected_agent_response ?? msg?.corrected_agent_response;
          if (correctedText) {
            const lastIdx = transcriptRef.current.length - 1;
            if (lastIdx >= 0 && transcriptRef.current[lastIdx].role === 'assistant') {
              transcriptRef.current[lastIdx].text = correctedText;
            }
            if (typeof correctedText === 'string') {
              lastAssistantTurnRef.current = correctedText.trim();
            }
          }
        }
      } catch (e) {
        console.warn('[AudioInterface] Failed to parse transcript message:', e);
      }
    },
    onError: (error) => {
      try {
        console.error('[AudioInterface] Conversation error (raw):', error);
        
        setConnectionQuality('poor');
        
        let errorMessage = 'Unknown error';
        let errorCode: string | null = null;
        let errorType: string | null = null;
        
        if (error) {
          if (typeof error === 'string') {
            errorMessage = error;
          } else if (typeof error === 'object') {
            const errObj = error as Record<string, any>;
            errorMessage = String(errObj.message ?? errObj.error ?? errObj.reason ?? 'Unknown error');
            errorCode = errObj.code ? String(errObj.code) : null;
            errorType = errObj.error_type ? String(errObj.error_type) : null;
          }
        }
        
        logEvent({
          eventType: 'elevenlabs_error',
          message: errorMessage,
          code: errorCode,
          context: {
            errorType,
            errorRaw: JSON.stringify(error ?? 'null'),
            questionCount: questionCountRef.current,
            transcriptLength: transcriptRef.current.length,
            connectionStatus: conversation.status,
          },
        });
        
        let userMessage = 'Voice connection issue. Please try again.';
        const lowerMessage = errorMessage.toLowerCase();
        
        if (lowerMessage.includes('microphone') || lowerMessage.includes('permission')) {
          userMessage = 'Microphone access denied. Please enable microphone permissions.';
        } else if (lowerMessage.includes('network') || lowerMessage.includes('connection')) {
          userMessage = 'Network connection issue. Check your internet connection.';
        } else if (lowerMessage.includes('timeout')) {
          userMessage = 'Connection timed out. Please try again.';
        } else if (lowerMessage.includes('token') || lowerMessage.includes('auth')) {
          userMessage = 'Authentication error. Please refresh and try again.';
        }

        toast({
          variant: 'destructive',
          title: 'Connection Error',
          description: userMessage,
        });
      } catch (handlerError) {
        console.error('[AudioInterface] Error handler crashed:', handlerError);
        
        toast({
          variant: 'destructive',
          title: 'Connection Error',
          description: 'An unexpected error occurred. Please refresh and try again.',
        });
      } finally {
        setIsConnecting(false);
        setIsReconnecting(false);
      }
    },
    onVadScore: handleVadScore,
  });

  useEffect(() => {
    if (conversation.status !== 'connected') return;
    
    const antiInterruptInterval = setInterval(() => {
      if (userIsSpeakingRef.current) {
        try {
          conversation.sendUserActivity();
        } catch (e) {
          // Ignore errors
        }
      }
    }, 500);
    
    return () => clearInterval(antiInterruptInterval);
  }, [conversation.status, conversation]);

  const stopConversation = useCallback(async () => {
    userEndedSession.current = true;
    setIsSessionEnding(true);

    toast({
      title: 'Ending Interview',
      description: 'Wrapping up your session with Sarah...',
    });

    await conversation.endSession();
  }, [conversation, toast]);

  const reconnect = useCallback(
    async (options?: { mode?: 'initial' | 'resume' }) => {
      const mode: 'initial' | 'resume' = options?.mode === 'initial' ? 'initial' : 'resume';
      const isInitial = mode === 'initial';

      console.log('[AudioInterface] reconnect called with mode:', mode, 'resumeFromPause prop:', resumeFromPause);

      if (isInitial) {
        transcriptRef.current = [];
        vadHistoryRef.current = [];
        questionCountRef.current = 0;
        lastAssistantTurnRef.current = null;
        micWarningShownRef.current = false;
        interviewStarted.current = false;
        userEndedSession.current = false;
        setConnectionDropped(false);
        setReconnectAttempts(0);
        setShowVadWarning(false);
        setShowMicInputWarning(false);
        setShowSilenceWarning(false);
        setIsConnecting(true);
        setIsReconnecting(false);
        setIsWaitingForGreeting(true);
        isResumingRef.current = false;
        pendingContextRef.current = null;
        pendingResumeKickoffRef.current = null;
      } else {
        setIsReconnecting(true);
        setConnectionDropped(false);
        setReconnectAttempts((prev) => prev + 1);
        setIsWaitingForGreeting(true);
        isResumingRef.current = true;
      }

      try {
        console.log('[reconnect] Requesting microphone...');
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: selectedInputId ? { deviceId: { exact: selectedInputId } } : true,
        });
        mediaStreamRef.current = stream;
        console.log('[reconnect] Microphone ready');

        let dbHistory: Awaited<ReturnType<typeof getHistory>> = [];
        if (!isInitial) {
          console.log('[reconnect] Fetching DB history for resume...');
          dbHistory = await getHistory();
          console.log('[reconnect] Got', dbHistory.length, 'history entries from DB');

          if (dbHistory.length > 0) {
            transcriptRef.current = dbHistory.map((h) => ({
              role: h.role === 'user' ? ('user' as const) : ('assistant' as const),
              text: h.content,
              ts: new Date(h.created_at).getTime(),
            }));

            const assistantMessages = dbHistory.filter((h) => h.role === 'assistant');
            if (assistantMessages.length > 0) {
              const lastAssistant = assistantMessages[assistantMessages.length - 1];
              lastAssistantTurnRef.current = lastAssistant.content;
              // Use actual question numbers from Sarah's messages instead of counting
              questionCountRef.current = getHighestQuestionNumber(transcriptRef.current);
              console.log('[reconnect] Restored question count from actual numbers:', questionCountRef.current);
            }
          }
        }

        const { data, error } = await supabase.functions.invoke('elevenlabs-conversation-token', {
          body: { agentId: ELEVENLABS_AGENT_ID, mode: 'token' },
        });

        const token = (data as any)?.token;
        if (error || !token) {
          throw new Error(error?.message || 'No token received');
        }

        const firstName = documents?.firstName?.trim();
        const nameForGreeting = firstName || 'there';
        const questionsSoFar = questionCountRef.current;
        const nextQuestion = questionsSoFar + 1;

        const firstTimeGreeting = `Hi ${nameForGreeting}, I'm Sarah, your interview coach today. I've reviewed your materials and I'm ready to put you through a realistic mock interview. Process-wise, I'll ask one question at a time and give you a short pause to think before you answer—just like a real interview. After you respond, I'll take a quick beat to assess your answer, then I'll share feedback and a stronger version of how you could say it. We'll cover 16 questions across different categories. If you need me to repeat anything, just ask. Ready to begin?`;

        const lastSarahMessage = transcriptRef.current
          .filter(t => t.role === 'assistant' && isInterviewQuestion(t.text))
          .pop()?.text || null;
        
        // Extract ONLY the question part, not the feedback
        const lastSarahQuestion = lastSarahMessage ? extractQuestionOnly(lastSarahMessage) : null;

        const lastTranscriptEntry = transcriptRef.current[transcriptRef.current.length - 1];
        const didUserAnswerLast = lastTranscriptEntry?.role === 'user';

        const completedQuestions = didUserAnswerLast ? questionsSoFar : Math.max(questionsSoFar - 1, 0);
        const resumeQuestionNumber = didUserAnswerLast ? completedQuestions + 1 : Math.max(questionsSoFar, 1);

        const safeQuestionText =
          !didUserAnswerLast && lastSarahQuestion
            ? (lastSarahQuestion.length > 300
              ? lastSarahQuestion.substring(0, 300) + '...'
              : lastSarahQuestion)
            : null;

        const nameSuffix = firstName ? `, ${firstName}` : '';
        const resumeGreeting = `Welcome back${nameSuffix}! We completed ${completedQuestions} questions before pausing. Now continuing with question ${resumeQuestionNumber}: ${safeQuestionText || 'the next question'}`;

        // NOTE: resumeGreeting is used as firstMessage - no need for separate kickoff

        const contextParts: string[] = [];

        // TRUNCATE documents to reduce processing time
        if (documents?.resume) {
          const truncatedResume = documents.resume.length > 1500 
            ? documents.resume.substring(0, 1500) + '...[truncated]'
            : documents.resume;
          contextParts.push(`Resume:\n${truncatedResume}`);
        }
        if (documents?.jobDescription) {
          const truncatedJD = documents.jobDescription.length > 1000
            ? documents.jobDescription.substring(0, 1000) + '...[truncated]'
            : documents.jobDescription;
          contextParts.push(`Job:\n${truncatedJD}`);
        }
        if (documents?.companyUrl) contextParts.push(`Company: ${documents.companyUrl}`);

        // For resume: only send last 4 turns + simple status (not full transcript)
        if (!isInitial && transcriptRef.current.length > 0) {
          const lastFewTurns = transcriptRef.current.slice(-4);
          const recentContext = lastFewTurns
            .map(t => `${t.role === 'user' ? 'USER' : 'SARAH'}: ${t.text.substring(0, 200)}`)
            .join('\n');

          const lastQuestionMessage = transcriptRef.current
            .filter(t => t.role === 'assistant' && isInterviewQuestion(t.text))
            .pop()?.text || null;
          
          // Extract ONLY the question, not the feedback
          const lastQuestion = lastQuestionMessage ? extractQuestionOnly(lastQuestionMessage) : null;
          
          const lastEntry = transcriptRef.current[transcriptRef.current.length - 1];
          const userAnsweredLast = lastEntry?.role === 'user';
          
          const resumeContext = `RESUMED SESSION - Question ${questionsSoFar} asked. ${userAnsweredLast ? 'User answered. Ask next question.' : 'User did NOT answer. Repeat question.'}\n\nLast question: "${lastQuestion?.substring(0, 300) || 'N/A'}"\n\nRecent:\n${recentContext}`;

          contextParts.push(resumeContext);
          console.log('[reconnect] Built SLIM resume context');
        }

        contextParts.push(`End of interview: tell user results sent to email.`);

        if (contextParts.length > 0) {
          pendingContextRef.current = contextParts.join('\n---\n');
          console.log('[reconnect] Context size:', pendingContextRef.current.length, 'chars');
        }

        console.log('[reconnect] Starting ElevenLabs session with greeting:', isInitial ? 'initial' : 'resume');

        await conversation.startSession({
          conversationToken: token,
          connectionType: 'webrtc',
          inputDeviceId: selectedInputId || undefined,
          overrides: {
            agent: {
              firstMessage: isInitial ? firstTimeGreeting : resumeGreeting,
            },
          },
        });

        if (!isInitial) {
          logEvent({
            eventType: 'session_reconnected',
            message: `Reconnected with ${transcriptRef.current.length} history turns`,
            context: { questionCount: questionsSoFar, historyLength: transcriptRef.current.length },
          });
        }
      } catch (error) {
        console.error(isInitial ? '[reconnect] Connection failed:' : '[reconnect] Reconnection failed:', error);

        toast({
          variant: 'destructive',
          title: isInitial ? 'Connection Failed' : 'Reconnection Failed',
          description: isInitial ? 'Could not start the interview. Please try again.' : 'Could not reconnect. Please try again.',
        });

        if (!isInitial && reconnectAttempts >= MAX_RECONNECT_ATTEMPTS - 1) {
          handleGracefulEnd('connection_lost');
        } else if (!isInitial) {
          setConnectionDropped(true);
          setIsReconnecting(false);
        } else {
          cleanup();
          setIsConnecting(false);
        }
      } finally {
        isResumingRef.current = false;
      }
    },
    [conversation, documents, toast, reconnectAttempts, handleGracefulEnd, selectedInputId, getHistory, logEvent, cleanup, resumeFromPause]
  );

  const toggleMute = useCallback(() => {
    setIsMuted(!isMuted);
    toast({
      title: isMuted ? 'Microphone Unmuted' : 'Microphone Muted',
      description: isMuted ? 'Sarah can hear you now.' : "Sarah can't hear you. Click again to unmute.",
      duration: 2000,
    });
  }, [isMuted, toast]);

  const pauseInterview = useCallback(async () => {
    if (!sessionId || !userEmail) {
      toast({ variant: 'destructive', title: 'Cannot Pause', description: 'Session information is missing.' });
      return;
    }

    isPausedRef.current = true;
    setIsPaused(true);
    setConnectionDropped(false);

    try {
      await conversation.endSession();
    } catch (disconnectError) {
      console.warn('[pauseInterview] ElevenLabs disconnect error (non-fatal):', disconnectError);
    }

    try {
      const appUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
      
      // Calculate COMPLETED questions (questions the user actually answered)
      // If last transcript entry is from Sarah, user hasn't answered yet
      const lastEntry = transcriptRef.current[transcriptRef.current.length - 1];
      const userAnsweredLast = lastEntry?.role === 'user';
      const completedQuestions = userAnsweredLast ? questionCountRef.current : Math.max(questionCountRef.current - 1, 0);
      
      console.log('[pauseInterview] Questions asked:', questionCountRef.current, 'Completed:', completedQuestions, 'User answered last:', userAnsweredLast);
      
      const { error } = await supabase.functions.invoke('audio-session', {
        body: { action: 'pause_session', sessionId, email: userEmail, questionNumber: completedQuestions, app_url: appUrl },
      });

      if (error) console.error('[pauseInterview] Failed to save pause state:', error);

      toast({ title: 'Interview Paused', description: 'Your progress is saved. You can resume within 24 hours.' });
      logEvent({ eventType: 'session_paused', message: `Paused at question ${completedQuestions} (asked: ${questionCountRef.current})`, context: { questionCount: completedQuestions, questionsAsked: questionCountRef.current } });
    } catch (error) {
      console.error('[pauseInterview] Failed to save pause state:', error);
      toast({ title: 'Interview Paused', description: 'Your session is paused locally.', variant: 'default' });
    }
  }, [sessionId, userEmail, conversation, toast, logEvent]);
  const resumeInterview = useCallback(async () => {
    if (!sessionId || !userEmail) {
      toast({ variant: 'destructive', title: 'Cannot Resume', description: 'Session information is missing.' });
      return;
    }

    // IMMEDIATELY set waiting state so UI shows "Sarah is preparing..." right away
    setIsWaitingForGreeting(true);
    setIsReconnecting(true);
    isResumingRef.current = true;
    
    // CRITICAL: Clear all local state before loading from database
    transcriptRef.current = [];
    questionCountRef.current = 0;
    lastAssistantTurnRef.current = null;

    try {
      console.log('[resumeInterview] Calling resume_session endpoint for session:', sessionId);
      
      const { data, error } = await supabase.functions.invoke('audio-session', {
        body: { action: 'resume_session', sessionId, email: userEmail },
      });

      if (error) throw new Error(error.message || 'Failed to resume session');

      if (data?.expired) {
        toast({ variant: 'destructive', title: 'Session Expired', description: 'This session has expired. Please start a new session.' });
        setIsPaused(false);
        setIsReconnecting(false);
        isResumingRef.current = false;
        return;
      }

      const messages = data?.messages || [];
      console.log('[resumeInterview] Got', messages.length, 'messages from DB');
      
      if (messages.length > 0) {
        transcriptRef.current = messages.map((m: any) => ({
          role: m.role === 'user' ? 'user' as const : 'assistant' as const,
          text: m.content,
          ts: new Date(m.created_at).getTime(),
        }));
        
        const assistantMessages = messages.filter((m: any) => m.role === 'assistant');
        if (assistantMessages.length > 0) {
          lastAssistantTurnRef.current = assistantMessages[assistantMessages.length - 1].content;
          // Use actual question numbers from Sarah's messages instead of counting
          questionCountRef.current = getHighestQuestionNumber(transcriptRef.current);
        }
        console.log('[resumeInterview] Loaded from DB - transcript entries:', transcriptRef.current.length, 'questionCount:', questionCountRef.current);
      }

      setIsPaused(false);
      isPausedRef.current = false;
      await reconnect({ mode: 'resume' });
      
    } catch (error) {
      console.error('[resumeInterview] Failed:', error);
      toast({ variant: 'destructive', title: 'Resume Failed', description: error instanceof Error ? error.message : 'Could not resume.' });
      setIsReconnecting(false);
      isResumingRef.current = false;
    }
  }, [sessionId, userEmail, toast, reconnect]);

  const signalActivity = useCallback(() => {
    setLastActivityTime(Date.now());
    setShowSilenceWarning(false);
    try { conversation.sendUserActivity(); } catch (e) { /* ignore */ }
  }, [conversation]);

  useEffect(() => {
    if (conversation.status !== 'connected') {
      setInputVolume(0);
      setShowMicInputWarning(false);
      micWarningShownRef.current = false;
      return;
    }

    let lowSince = Date.now();

    const id = window.setInterval(() => {
      try {
        const vol = conversation.getInputVolume?.() ?? 0;
        setInputVolume(vol);

        const shouldCheck = !conversation.isSpeaking && !isMuted;
        if (!shouldCheck) {
          lowSince = Date.now();
          setShowMicInputWarning(false);
          micWarningShownRef.current = false;
          return;
        }

        const looksLikeNoAudio = vol < 0.02 && vadScore < VAD_LOW_THRESHOLD;
        if (!looksLikeNoAudio) {
          lowSince = Date.now();
          setShowMicInputWarning(false);
          micWarningShownRef.current = false;
          return;
        }

        if (Date.now() - lowSince > 3500) {
          setShowMicInputWarning(true);
          if (!micWarningShownRef.current) {
            micWarningShownRef.current = true;
            toast({ variant: 'destructive', title: "Sarah can't hear your microphone", description: 'Select the right microphone.', duration: 7000 });
          }
        }
      } catch { /* ignore */ }
    }, 250);

    return () => window.clearInterval(id);
  }, [conversation, conversation.status, conversation.isSpeaking, isMuted, toast, vadScore]);

  // Clear the "waiting for greeting" state once Sarah starts speaking
  useEffect(() => {
    if (conversation.isSpeaking && isWaitingForGreeting) {
      setIsWaitingForGreeting(false);
    }
  }, [conversation.isSpeaking, isWaitingForGreeting]);

  if (!isActive) return null;

  const isConnected = conversation.status === 'connected';
  const isSpeaking = conversation.isSpeaking;
  const canStartInterview = isDocumentsSaved;

  const ConnectionIndicator = () => {
    if (isPaused && !isConnected) return <div className="flex items-center gap-2 text-sm text-amber-600"><Pause className="w-4 h-4" />Paused</div>;
    if (isReconnecting) return <div className="flex items-center gap-2 text-sm text-blue-600"><Loader2 className="w-4 h-4 animate-spin" />Reconnecting...</div>;
    if (!isConnected) return null;
    return (
      <div className="flex items-center gap-2 text-sm">
        <div className={cn('w-2 h-2 rounded-full', connectionQuality === 'excellent' && 'bg-green-500', connectionQuality === 'good' && 'bg-yellow-500', connectionQuality === 'poor' && 'bg-red-500')} />
        <span className="text-gray-600">{connectionQuality === 'excellent' ? 'Excellent' : connectionQuality === 'good' ? 'Good' : 'Poor'} connection</span>
        {showVadWarning && <span className="text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Mic issue</span>}
      </div>
    );
  };

  if (isSessionEnding) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center"><span className="text-2xl">📊</span></div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Wrapping Up Your Interview</h3>
              <p className="text-sm text-gray-500">Preparing your results...</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-600"><CheckCircle2 className="w-5 h-5" />Interview transcript captured</div>
            <div className="flex items-center gap-2 text-green-600"><CheckCircle2 className="w-5 h-5" />Performance analysis complete</div>
            <div className="flex items-center gap-2 text-blue-600"><Loader2 className="w-5 h-5 animate-spin" />Sending results to your email...</div>
          </div>
        </div>
      </div>
    );
  }

  if (isPaused && !isConnected && !isConnecting && !isReconnecting) {
    // Calculate completed questions for display
    const lastEntry = transcriptRef.current[transcriptRef.current.length - 1];
    const userAnsweredLast = lastEntry?.role === 'user';
    const displayCompletedQuestions = userAnsweredLast ? questionCountRef.current : Math.max(questionCountRef.current - 1, 0);
    
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4"><Pause className="w-8 h-8 text-amber-600" /></div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Interview Paused</h3>
          <p className="text-gray-500 mb-2">Your progress is saved. Click below to continue.</p>
          <p className="text-sm text-blue-600 font-medium mb-4">👆 Click "Resume Interview" to reconnect with Sarah</p>
          <div className="bg-gray-50 rounded-lg p-3 mb-6"><p className="text-sm text-gray-600">Questions completed: {displayCompletedQuestions} of 16</p></div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={resumeInterview} disabled={isReconnecting} className="gap-2 w-full sm:w-auto bg-blue-600 hover:bg-blue-700"><Play className="w-4 h-4" />Resume Interview</Button>
            <Button variant="outline" onClick={() => handleGracefulEnd('user_ended')} className="gap-2 w-full sm:w-auto"><PhoneOff className="w-4 h-4" />End & Get Results</Button>
          </div>
        </div>
      </div>
    );
  }

  if (connectionDropped && !isConnected && !isConnecting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4"><WifiOff className="w-8 h-8 text-red-600" /></div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Connection Lost</h3>
          <p className="text-gray-500 mb-2">Sarah got disconnected. Your transcript is saved.</p>
          <p className="text-sm text-gray-400 mb-6">{MAX_RECONNECT_ATTEMPTS - reconnectAttempts} attempts remaining</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => reconnect()} disabled={isReconnecting} className="gap-2">{isReconnecting ? <><Loader2 className="w-4 h-4 animate-spin" />Reconnecting...</> : <><RefreshCw className="w-4 h-4" />Reconnect</>}</Button>
            <Button variant="outline" onClick={() => handleGracefulEnd('connection_lost')}>End & Get Results</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!isConnected && !isConnecting && !isReconnecting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-lg w-full">
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 text-2xl font-semibold text-gray-900 mb-2"><span>🎙️</span><span>Premium Audio Mock Interview</span></div>
          </div>
          <div className="flex justify-center mb-6">
            <div className="relative">
              <img src={sarahHeadshot} alt="Sarah" className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg" />
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-white px-3 py-1 rounded-full shadow text-sm font-medium">Sarah</div>
            </div>
          </div>
          <div className="mb-6">
            <AudioDeviceSelect devices={micInputs} value={selectedInputId} onValueChange={setSelectedInputId} onRefresh={ensurePermissionThenEnumerate} isRefreshing={isEnumerating} />
          </div>
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-blue-700 font-medium mb-2"><Lightbulb className="w-4 h-4" />Tips for a great interview:</div>
            <ul className="text-sm text-blue-600 space-y-1">
              <li>• Use headphones for best audio quality</li>
              <li>• Speak clearly and at a natural pace</li>
              <li>• Use a quiet environment for best results</li>
              <li>• Wait for Sarah to finish before responding</li>
              <li>• Structure your answers using the STAR method</li>
              <li>• Ask Sarah to repeat or clarify anytime</li>
            </ul>
          </div>
          <div className="flex justify-center">
            <Button size="lg" onClick={() => reconnect({ mode: resumeFromPause ? 'resume' : 'initial' })} disabled={!canStartInterview || isConnecting || isReconnecting} className="gap-2 text-lg px-8 py-6">
              {resumeFromPause ? 'Resume Interview' : 'Begin Interview'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        <div className="relative w-32 h-32 mx-auto mb-6">
          <div className={cn('w-full h-full rounded-full flex items-center justify-center transition-all duration-300', isConnecting && 'bg-blue-100', isConnected && !isSpeaking && 'bg-green-100', isConnected && isSpeaking && 'bg-blue-100 scale-110')}>
            {isConnecting ? <Loader2 className="w-12 h-12 text-blue-500 animate-spin" /> : isConnected ? <img src={sarahHeadshot} alt="Sarah" className={cn('w-24 h-24 rounded-full object-cover transition-transform duration-300', isSpeaking && 'scale-110')} /> : <Volume2 className="w-12 h-12 text-gray-400" />}
          </div>
          {isConnected && isSpeaking && <><div className="absolute inset-0 rounded-full border-4 border-blue-400 animate-ping opacity-20" /><div className="absolute inset-0 rounded-full border-2 border-blue-300 animate-pulse opacity-40" /></>}
          {isConnected && !isSpeaking && <div className="absolute -bottom-2 left-1/2 -translate-x-1/2"><div className="h-2 rounded-full bg-green-500 transition-all duration-100" style={{ width: `${Math.max(vadScore * 100, 10)}px` }} /></div>}
        </div>

        <h3 className="text-lg font-semibold text-gray-900 mb-1">{isConnecting ? 'Connecting to Sarah...' : isSpeaking ? 'Sarah is speaking...' : isSendingResults ? 'Sending your results...' : isWaitingForGreeting ? 'Sarah is preparing...' : showVadWarning ? 'Having trouble hearing you...' : 'Listening to your response...'}</h3>
        <p className="text-sm text-gray-500 mb-6">{isConnecting ? 'Setting up your voice connection...' : isSpeaking ? 'Listen carefully to the question' : isSendingResults ? 'Please wait while we email your results' : isWaitingForGreeting ? 'One moment while Sarah gets ready...' : showVadWarning ? 'Check your microphone or speak louder' : "Speak naturally when you're ready to respond"}</p>

        {showSilenceWarning && isConnected && <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4"><div className="flex items-center justify-center gap-2 text-amber-700"><AlertTriangle className="w-4 h-4" />Sarah hasn't heard from you.<Button size="sm" variant="outline" onClick={signalActivity} className="ml-2">I'm still here</Button></div></div>}

        {isConnected && (
          <div className="flex items-center justify-center gap-4">
            <Button size="lg" variant={isMuted ? 'destructive' : 'outline'} onClick={toggleMute} className="w-14 h-14 rounded-full p-0">{isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}</Button>
            <Button size="lg" variant="outline" onClick={pauseInterview} className="w-14 h-14 rounded-full p-0" title="Pause"><Pause className="w-6 h-6" /></Button>
            <Button size="lg" variant="destructive" onClick={stopConversation} disabled={isSendingResults} className="w-14 h-14 rounded-full p-0">{isSendingResults ? <Loader2 className="w-6 h-6 animate-spin" /> : <PhoneOff className="w-6 h-6" />}</Button>
          </div>
        )}
        
        {isPaused && !isConnected && !isReconnecting && (
          <div className="mt-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3"><div className="flex items-center justify-center gap-2 text-amber-700"><Pause className="w-4 h-4" />Interview Paused</div></div>
            <Button onClick={resumeInterview} disabled={isReconnecting} className="gap-2"><Play className="w-4 h-4" />Resume Interview</Button>
          </div>
        )}

        {isConnected && <div className="mt-4 flex justify-center"><ConnectionIndicator /></div>}
      </div>
    </div>
  );
}
