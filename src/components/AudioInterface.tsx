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
  // Callback with results data for parent to show results screen (like Mock Interview)
  onSessionComplete?: (resultsData: { transcript: string; prepPacket: string | null }) => void;
  userEmail?: string;
}

// Replace with your ElevenLabs agent ID
const ELEVENLABS_AGENT_ID = 'agent_1901kb0ray8kfph9x9bh4w97bbe4';

// Connection quality thresholds
const VAD_LOW_THRESHOLD = 0.15; // Below this = mic probably not picking up voice
const VAD_WARNING_DURATION = 8000; // Show warning after 8s of low VAD
const HEARTBEAT_INTERVAL = 5000; // Check connection health every 5s
const SILENCE_TIMEOUT = 45000; // 45s of no activity triggers warning
const MAX_RECONNECT_ATTEMPTS = 3;
const KEEP_ALIVE_INTERVAL = 10000; // Send keep-alive every 10s
const ANTI_INTERRUPT_VAD_THRESHOLD = 0.3; // Send activity signal when user is speaking above this VAD

type ConnectionQuality = 'excellent' | 'good' | 'poor' | 'disconnected';

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
  
  // CRITICAL: Global error handler to intercept ElevenLabs SDK internal crashes
  // The SDK's handleErrorEvent crashes when reading error_type from malformed errors
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason?.message || '';
      const stack = reason?.stack || '';
      
      // Check if this is the ElevenLabs SDK crash
      if (message.includes('error_type') || 
          stack.includes('handleErrorEvent') ||
          stack.includes('onMessageCallback')) {
        console.error('Intercepted ElevenLabs SDK crash:', reason);
        event.preventDefault(); // Prevent the crash from propagating
        
        // Log for diagnostics
        console.log('SDK crash details:', {
          message,
          stack: stack.substring(0, 500),
          reason: JSON.stringify(reason).substring(0, 500)
        });
        
        // Show non-destructive toast - connection may still be alive
        toastFn({
          title: 'Minor connection issue',
          description: 'Continuing session...',
        });
        
        return; // Don't let this crash the app
      }
    };

    const handleError = (event: ErrorEvent) => {
      const message = event.message || '';
      const stack = event.error?.stack || '';
      
      // Check if this is the ElevenLabs SDK crash
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
  const [vadScore, setVadScore] = useState<number>(0);
  const [lastActivityTime, setLastActivityTime] = useState<number>(Date.now());
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [showSilenceWarning, setShowSilenceWarning] = useState(false);
  const [isSessionEnding, setIsSessionEnding] = useState(false);
  const [inputVolume, setInputVolume] = useState(0);
  const [showMicInputWarning, setShowMicInputWarning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  const toast = toastFn; // Use the toast from the top of the component

  // IMPORTANT: onDisconnect can fire before React state updates land.
  // Use a ref to reliably detect intentional pauses.
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
  
  // Real-time persistence hook
  const { appendTurn, getHistory, logEvent } = useAudioSessionPersistence(sessionId, userEmail);
  
  const micWarningShownRef = useRef(false);

  // Track if user intentionally ended the session
  const userEndedSession = useRef(false);
  // Track if interview has started (to distinguish intentional end vs drop)
  const interviewStarted = useRef(false);
  // Media stream reference for actual muting
  const mediaStreamRef = useRef<MediaStream | null>(null);
  // Heartbeat interval reference
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  // VAD warning timeout reference
  const vadWarningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Silence warning timeout reference
  const silenceWarningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Last VAD scores for averaging
  const vadHistoryRef = useRef<number[]>([]);
  // Keep-alive interval reference
  const keepAliveRef = useRef<NodeJS.Timeout | null>(null);
  // Anti-interrupt: track if user is currently speaking
  const userIsSpeakingRef = useRef(false);

  // Keep a rolling transcript so we can resume after reconnect (ElevenLabs sessions don't persist across reconnects)
  const transcriptRef = useRef<Array<{ role: 'user' | 'assistant'; text: string; ts: number }>>([]);
  const lastAssistantTurnRef = useRef<string | null>(null);
  const questionCountRef = useRef(0);
  // Track if we're resuming from a pause/reconnect
  const isResumingRef = useRef(false);

  const appendTranscriptTurn = useCallback((role: 'user' | 'assistant', text: unknown) => {
    const clean = typeof text === 'string' ? text.trim() : '';
    if (!clean) return;

    const last = transcriptRef.current[transcriptRef.current.length - 1];
    if (last && last.role === role && last.text === clean) return;

    transcriptRef.current.push({ role, text: clean, ts: Date.now() });
    setLastActivityTime(Date.now());

    // Prevent unbounded growth
    if (transcriptRef.current.length > 200) {
      transcriptRef.current = transcriptRef.current.slice(-200);
    }
    
    // Persist turn to database in real-time
    appendTurn({
      role,
      text: clean,
      questionNumber: role === 'assistant' && clean.includes('?') ? questionCountRef.current : null,
    });
  }, [appendTurn]);

  // Cleanup function for intervals and timeouts
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

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  // Helper to fetch prep packet from session
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
      
      // prep_packet is stored as { content: string }
      const packet = data.prep_packet as { content?: string };
      return packet?.content || null;
    } catch (err) {
      console.error('Error fetching prep packet:', err);
      return null;
    }
  };

  // Send results when audio interview ends
  const sendAudioResults = useCallback(async () => {
    if (!sessionId || !userEmail) {
      console.error('Cannot send results: missing sessionId or userEmail');
      return;
    }

    setIsSendingResults(true);

    try {
      // Fetch the prep packet that was generated at session start
      const prepPacket = await fetchPrepPacket();
      
      // Build transcript from our captured turns
      const transcriptContent = transcriptRef.current
        .map(t => `**${t.role === 'user' ? 'Your Answer' : 'Sarah (Coach)'}:**\n${t.text}`)
        .join('\n\n---\n\n');
      
      // Combine prep packet + transcript
      let contentToSend = '';
      if (prepPacket) {
        contentToSend = prepPacket + '\n\n---\n\n# Audio Interview Transcript\n\n' + transcriptContent;
      } else {
        contentToSend = '# Audio Interview Transcript\n\n' + transcriptContent;
      }

      // Send results via the send-results function
      const { data, error } = await supabase.functions.invoke('send-results', {
        body: {
          session_id: sessionId,
          email: userEmail,
          session_type: 'premium_audio',
          prep_content: contentToSend,
          results: null, // Audio doesn't have structured scores
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

  // Graceful session ending with user notification
  const handleGracefulEnd = useCallback(async (reason: 'user_ended' | 'connection_lost' | 'timeout' | 'error') => {
    setIsSessionEnding(true);
    cleanup();

    const messages: Record<typeof reason, { title: string; description: string }> = {
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

    // Build transcript from captured turns
    const transcriptContent = transcriptRef.current
      .map(t => `**${t.role === 'user' ? 'Your Answer' : 'Sarah (Coach)'}:**\n${t.text}`)
      .join('\n\n---\n\n');
    
    // Fetch prep packet
    const prepPacket = await fetchPrepPacket();

    // Pass results to parent so it can show the results screen (like Mock Interview)
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

  // Start heartbeat monitoring
  const startHeartbeat = useCallback((conversationRef: ReturnType<typeof useConversation>) => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }

    heartbeatRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceActivity = now - lastActivityTime;

      // Update connection quality based on activity
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

      // Check for silence timeout
      if (timeSinceActivity > SILENCE_TIMEOUT && !showSilenceWarning) {
        setShowSilenceWarning(true);
        toast({
          title: 'Are you still there?',
          description: 'Sarah hasn\'t heard from you in a while. Speak or click the microphone to continue.',
          duration: 10000,
        });
      }
    }, HEARTBEAT_INTERVAL);
  }, [lastActivityTime, showSilenceWarning, toast]);

  // Handle VAD score updates
  const handleVadScore = useCallback((props: { vadScore: number }) => {
    const score = props.vadScore;
    setVadScore(score);
    vadHistoryRef.current.push(score);
    
    // Keep last 10 scores
    if (vadHistoryRef.current.length > 10) {
      vadHistoryRef.current.shift();
    }

    // Calculate average VAD
    const avgVad = vadHistoryRef.current.reduce((a, b) => a + b, 0) / vadHistoryRef.current.length;

    // Track if user is speaking for anti-interrupt
    if (score >= ANTI_INTERRUPT_VAD_THRESHOLD) {
      userIsSpeakingRef.current = true;
    } else if (avgVad < ANTI_INTERRUPT_VAD_THRESHOLD) {
      userIsSpeakingRef.current = false;
    }

    // If VAD is consistently low, show warning
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
      // Voice detected, clear warning
      if (vadWarningTimeoutRef.current) {
        clearTimeout(vadWarningTimeoutRef.current);
        vadWarningTimeoutRef.current = null;
      }
      if (showVadWarning) {
        setShowVadWarning(false);
      }
    }
  }, [showVadWarning, toast]);

  const conversation = useConversation({ micMuted: isMuted,
    onConnect: () => {
      console.log('Connected to ElevenLabs agent');
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

      // Start heartbeat monitoring
      startHeartbeat(conversation);
      
      // Start keep-alive interval to prevent connection timeout
      if (keepAliveRef.current) {
        clearInterval(keepAliveRef.current);
      }
      keepAliveRef.current = setInterval(() => {
        try {
          // Send periodic activity signal to keep connection alive
          conversation.sendUserActivity();
          console.log('[KeepAlive] Sent activity signal');
        } catch (e) {
          console.warn('[KeepAlive] Failed to send activity:', e);
        }
      }, KEEP_ALIVE_INTERVAL);
    },
    onDisconnect: (details) => {
      console.log('Disconnected from ElevenLabs agent', details);
      setIsConnecting(false);
      setIsReconnecting(false);
      setConnectionQuality('disconnected');
      cleanup();

      const paused = isPausedRef.current;

      // Log disconnect event for diagnostics
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

      // Only complete the interview if user intentionally ended it or paused
      if (userEndedSession.current) {
        userEndedSession.current = false;
        handleGracefulEnd('user_ended');
      } else if (paused) {
        // User paused intentionally - don't show reconnect UI
        return;
      } else if (interviewStarted.current && !isSessionEnding) {
        // Unexpected disconnect - check if we should auto-reconnect
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          setConnectionDropped(true);
          toast({
            variant: 'destructive',
            title: 'Connection Lost',
            description: `Sarah got disconnected. Click "Reconnect" to continue (${MAX_RECONNECT_ATTEMPTS - reconnectAttempts} attempts remaining).`,
          });
        } else {
          // Max reconnects reached, end gracefully
          handleGracefulEnd('connection_lost');
        }
      }
    },
    onMessage: (message) => {
      console.log('Message from agent:', message);
      setLastActivityTime(Date.now());
      setShowSilenceWarning(false);

      // Capture transcript events so we can restore context after reconnect
      try {
        const type = (message as any)?.type;

        if (type === 'user_transcript') {
          const text =
            (message as any)?.user_transcription_event?.user_transcript ??
            (message as any)?.user_transcript ??
            (message as any)?.text;
          appendTranscriptTurn('user', text);
        }

        if (type === 'agent_response') {
          const text =
            (message as any)?.agent_response_event?.agent_response ??
            (message as any)?.agent_response ??
            (message as any)?.text;
          appendTranscriptTurn('assistant', text);

          const clean = typeof text === 'string' ? text.trim() : '';
          if (clean) {
            lastAssistantTurnRef.current = clean;
            // Super light heuristic: count questions by “?”
            if (clean.includes('?')) {
              questionCountRef.current += 1;
            }
          }
        }

        // Handle agent response correction (when user interrupts)
        if (type === 'agent_response_correction') {
          const correctedText =
            (message as any)?.agent_response_correction_event?.corrected_agent_response ??
            (message as any)?.corrected_agent_response;
          if (correctedText) {
            // Update the last assistant message with corrected version
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
        console.warn('Failed to parse transcript message:', e);
      }
    },
    onError: (error) => {
      // CRITICAL: Wrap everything in try-catch to prevent crashes from malformed errors
      try {
        console.error('Conversation error (raw):', error);
        console.log('Error type:', typeof error);
        console.log('Error keys:', error && typeof error === 'object' ? Object.keys(error) : 'not an object');
        
        setConnectionQuality('poor');
        
        // Safely extract error details with extensive null checks
        let errorMessage = 'Unknown error';
        let errorCode: string | null = null;
        let errorType: string | null = null;
        
        if (error) {
          if (typeof error === 'string') {
            errorMessage = error;
          } else if (typeof error === 'object') {
            // Safely access properties
            const errObj = error as Record<string, unknown>;
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
        
        // Determine user-friendly message
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
        // Even the error handler failed - log it and show generic message
        console.error('Error handler crashed:', handlerError);
        console.error('Original error was:', error);
        
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
    // VAD score monitoring for voice detection issues
    onVadScore: handleVadScore,
  });

  // ANTI-INTERRUPT: Send activity signal when user is speaking to prevent agent from cutting them off
  useEffect(() => {
    if (conversation.status !== 'connected') return;
    
    const antiInterruptInterval = setInterval(() => {
      if (userIsSpeakingRef.current) {
        try {
          conversation.sendUserActivity();
          console.log('[AntiInterrupt] User speaking, sent activity signal');
        } catch (e) {
          // Ignore errors
        }
      }
    }, 500); // Check every 500ms
    
    return () => clearInterval(antiInterruptInterval);
  }, [conversation.status, conversation]);

  // Initial connection uses `reconnect({ mode: 'initial' })` (the reconnect path is the stable one).

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

      if (isInitial) {
        // Fresh interview run (use the working reconnect path, but with first-time greeting/context)
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
        isResumingRef.current = false;
      } else {
        setIsReconnecting(true);
        setConnectionDropped(false);
        setReconnectAttempts((prev) => prev + 1);
        isResumingRef.current = true;
      }

      try {
        // Request microphone - keep the stream active for ElevenLabs
        console.log('Requesting microphone for reconnect...');
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: selectedInputId ? { deviceId: { exact: selectedInputId } } : true,
        });
        // Keep stream active - ElevenLabs SDK needs it
        mediaStreamRef.current = stream;
        console.log('Microphone ready for reconnect');

        // Fetch FULL conversation history from database (resume mode only)
        let dbHistory: Awaited<ReturnType<typeof getHistory>> = [];
        if (!isInitial) {
          dbHistory = await getHistory();

          // If we have DB history, use it as the source of truth
          if (dbHistory.length > 0) {
            transcriptRef.current = dbHistory.map((h) => ({
              role: h.role === 'user' ? ('user' as const) : ('assistant' as const),
              text: h.content,
              ts: new Date(h.created_at).getTime(),
            }));

            // Find the last assistant message and update question count
            const assistantMessages = dbHistory.filter((h) => h.role === 'assistant');
            if (assistantMessages.length > 0) {
              const lastAssistant = assistantMessages[assistantMessages.length - 1];
              lastAssistantTurnRef.current = lastAssistant.content;
              // Count questions by counting assistant messages with "?"
              questionCountRef.current = assistantMessages.filter((m) => m.content.includes('?')).length;
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

        const firstTimeGreeting = `Hi ${nameForGreeting}, I'm Sarah, your interview coach today. I've reviewed your materials and I'm ready to put you through a realistic mock interview. We'll cover 16 questions across different categories. Take your time with each answer, and I'll give you feedback as we go. Ready to begin?`;

        // The firstMessage should be what Sarah SAYS, not instructions
        // Keep it natural and short - instructions go in contextual update
        const resumeGreeting = `Welcome back! Let's continue where we left off.`;

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

        // Send context via contextual update (NOT spoken aloud)
        const contextParts: string[] = [];

        if (!isInitial) {
          const lastSarahMessage = lastAssistantTurnRef.current;
          const questionsSoFar = questionCountRef.current;

          // CRITICAL: Resume instructions go here, in the contextual update, NOT in firstMessage
          const resumeInstructions = `CRITICAL CONTEXT: This is a RESUMED interview session, NOT a new one.
Do NOT re-introduce yourself. Do NOT ask the candidate to introduce themselves again.
The candidate has already answered ${questionsSoFar} questions.
${lastSarahMessage ? `Your last message before the pause was: "${lastSarahMessage.substring(0, 300)}${lastSarahMessage.length > 300 ? '...' : ''}"` : ''}
Continue the interview naturally from where you left off. Ask the next question.`;

          contextParts.push(resumeInstructions);
        }

        if (documents?.resume) contextParts.push(`Candidate Resume:\n${documents.resume}`);
        if (documents?.jobDescription) contextParts.push(`Job Description:\n${documents.jobDescription}`);
        if (documents?.companyUrl) contextParts.push(`Company URL: ${documents.companyUrl}`);

        // IMPORTANT: Add closing instruction to remind Sarah about the email
        contextParts.push(`IMPORTANT END-OF-INTERVIEW INSTRUCTION: At the very end of the interview, after giving your verbal summary with the score and top 3 strengths and improvements, always tell the user: "Your complete prep packet with the full transcript and detailed feedback has been sent to your email. Check your inbox for everything we discussed today."`);

        // PAUSE HANDLING INSTRUCTIONS
        contextParts.push(`HANDLING PAUSE REQUESTS: If the candidate says "let's pause", "I need to pause", "pause the interview", "can we take a break", or similar:
- Say "No problem, take all the time you need. Click the Pause button on your screen when you're ready to stop, and Resume when you want to continue."
- Do NOT continue the interview until they explicitly say they're ready to resume
- Do NOT prompt them or ask if they're ready after just a few seconds
- Wait patiently and silently for them to indicate they want to continue`);

        if (!isInitial) {
          const questionsSoFar = questionCountRef.current;

          // Send the FULL transcript, not just last 12 turns
          const fullTranscriptText = transcriptRef.current
            .map((t) => `${t.role === 'user' ? 'Candidate' : 'Sarah'}: ${t.text}`)
            .join('\n\n');

          if (fullTranscriptText) {
            contextParts.push(
              `=== COMPLETE INTERVIEW TRANSCRIPT (${transcriptRef.current.length} turns, ${questionsSoFar} questions asked) ===\n${fullTranscriptText}`
            );
          }
        }

        // Wait for connection to stabilize before sending context
        await new Promise((resolve) => setTimeout(resolve, 500));

        if (contextParts.length > 0) {
          conversation.sendContextualUpdate(
            isInitial ? contextParts.join('\n\n') : contextParts.join('\n\n---\n\n')
          );
        }

        if (!isInitial) {
          const questionsSoFar = questionCountRef.current;

          // Log successful reconnection
          logEvent({
            eventType: 'session_reconnected',
            message: `Successfully reconnected with ${transcriptRef.current.length} history turns`,
            context: {
              questionCount: questionsSoFar,
              historyLength: transcriptRef.current.length,
              dbHistoryLength: dbHistory.length,
            },
          });
        }
      } catch (error) {
        console.error(isInitial ? 'Connection failed:' : 'Reconnection failed:', error);

        if (!isInitial) {
          logEvent({
            eventType: 'reconnect_failed',
            message: error instanceof Error ? error.message : 'Unknown reconnection error',
            context: { attemptNumber: reconnectAttempts + 1 },
          });
        }

        toast({
          variant: 'destructive',
          title: isInitial ? 'Connection Failed' : 'Reconnection Failed',
          description:
            !isInitial && reconnectAttempts >= MAX_RECONNECT_ATTEMPTS - 1
              ? 'Maximum reconnection attempts reached. Your session will end.'
              : isInitial
                ? 'Could not start the interview. Please try again.'
                : 'Could not reconnect. Please try again.',
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
    [
      conversation,
      documents,
      toast,
      reconnectAttempts,
      handleGracefulEnd,
      selectedInputId,
      getHistory,
      logEvent,
      cleanup,
    ]
  );

  // Actual mute toggle (controls ElevenLabs SDK mic via `micMuted`)
  const toggleMute = useCallback(() => {
    if (mediaStreamRef.current) {
      // No-op: ElevenLabs SDK manages its own mic stream.
      // We only request mic permission directly for better UX.
    }
    setIsMuted(!isMuted);
    
    toast({
      title: isMuted ? 'Microphone Unmuted' : 'Microphone Muted',
      description: isMuted ? 'Sarah can hear you now.' : 'Sarah can\'t hear you. Click again to unmute.',
      duration: 2000,
    });
  }, [isMuted, toast]);

  // Pause the interview - saves state and disconnects gracefully
  const pauseInterview = useCallback(async () => {
    if (!sessionId || !userEmail) {
      toast({
        variant: 'destructive',
        title: 'Cannot Pause',
        description: 'Session information is missing.',
      });
      return;
    }

    // CRITICAL: Set pause flags FIRST before any async operations
    // This prevents onDisconnect from treating this as an unexpected disconnect
    isPausedRef.current = true;
    setIsPaused(true);
    setConnectionDropped(false);

    // Disconnect ElevenLabs FIRST (synchronously sets the flag before disconnect fires)
    try {
      await conversation.endSession();
    } catch (disconnectError) {
      console.warn('ElevenLabs disconnect error (non-fatal):', disconnectError);
    }

    // Now save to backend (won't affect disconnect handler)
    try {
      const appUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
      const { error } = await supabase.functions.invoke('audio-session', {
        body: {
          action: 'pause_session',
          sessionId,
          email: userEmail,
          questionNumber: questionCountRef.current,
          app_url: appUrl,
        },
      });

      if (error) {
        console.error('Failed to save pause state:', error);
        // Don't revert pause state - user can still resume from local state
      }

      toast({
        title: 'Interview Paused',
        description: 'Your progress is saved. You can resume within 24 hours.',
      });

      logEvent({
        eventType: 'session_paused',
        message: `Interview paused at question ${questionCountRef.current}`,
        context: {
          questionCount: questionCountRef.current,
          transcriptLength: transcriptRef.current.length,
        },
      });
    } catch (error) {
      console.error('Failed to save pause state:', error);
      // Keep paused state - the disconnect already happened
      toast({
        title: 'Interview Paused',
        description: 'Your session is paused locally. Resume link may not be sent.',
        variant: 'default',
      });
    }
  }, [sessionId, userEmail, conversation, toast, logEvent]);

  // Resume from paused state
  const resumeInterview = useCallback(async () => {
    if (!sessionId || !userEmail) {
      toast({
        variant: 'destructive',
        title: 'Cannot Resume',
        description: 'Session information is missing.',
      });
      return;
    }

    setIsReconnecting(true);
    isResumingRef.current = true;

    try {
      // Call resume endpoint to get full history and check expiration
      const { data, error } = await supabase.functions.invoke('audio-session', {
        body: {
          action: 'resume_session',
          sessionId,
          email: userEmail,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to resume session');
      }

      if (data?.expired) {
        toast({
          variant: 'destructive',
          title: 'Session Expired',
          description: 'This session was paused more than 24 hours ago and has expired. Please start a new session.',
        });
        setIsPaused(false);
        setIsReconnecting(false);
        isResumingRef.current = false;
        return;
      }

      // Restore transcript from database
      const messages = data?.messages || [];
      if (messages.length > 0) {
        transcriptRef.current = messages.map((m: any) => ({
          role: m.role === 'user' ? 'user' as const : 'assistant' as const,
          text: m.content,
          ts: new Date(m.created_at).getTime(),
        }));
        
        const assistantMessages = messages.filter((m: any) => m.role === 'assistant');
        if (assistantMessages.length > 0) {
          lastAssistantTurnRef.current = assistantMessages[assistantMessages.length - 1].content;
          questionCountRef.current = assistantMessages.filter((m: any) => m.content.includes('?')).length;
        }
      }

      // Clear paused state
      setIsPaused(false);
      
      // Use the existing reconnect flow
      await reconnect();
      
    } catch (error) {
      console.error('Failed to resume interview:', error);
      toast({
        variant: 'destructive',
        title: 'Resume Failed',
        description: error instanceof Error ? error.message : 'Could not resume the interview.',
      });
      setIsReconnecting(false);
      isResumingRef.current = false;
    }
  }, [sessionId, userEmail, toast, reconnect]);

  // Signal user activity to prevent interruption
  const signalActivity = useCallback(() => {
    setLastActivityTime(Date.now());
    setShowSilenceWarning(false);
    try {
      conversation.sendUserActivity();
    } catch (e) {
      console.warn('Failed to send user activity:', e);
    }
  }, [conversation]);

  // Lightweight mic diagnostics: if we're "listening" but mic level stays near 0,
  // show a clear warning + meter so users can pick the right device.
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

        // If user is speaking, input volume and VAD should both spike.
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
            toast({
              variant: 'destructive',
              title: 'Sarah can’t hear your microphone',
              description: 'Your mic input looks near-silent. Select the right microphone and try again.',
              duration: 7000,
            });
          }
        }
      } catch {
        // ignore
      }
    }, 250);

    return () => window.clearInterval(id);
  }, [conversation, conversation.status, conversation.isSpeaking, isMuted, toast, vadScore]);

  if (!isActive) return null;

  const isConnected = conversation.status === 'connected';
  const isSpeaking = conversation.isSpeaking;
  const canStartInterview = isDocumentsSaved;

  // Connection quality indicator component
  const ConnectionIndicator = () => (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "h-2 w-2 rounded-full transition-colors",
          connectionQuality === 'excellent' && "bg-primary",
          connectionQuality === 'good' && "bg-secondary",
          connectionQuality === 'poor' && "bg-accent animate-pulse",
          connectionQuality === 'disconnected' && "bg-destructive"
        )}
      />
      <span className="text-sm text-muted-foreground">
        {connectionQuality === 'excellent' && 'Excellent connection'}
        {connectionQuality === 'good' && 'Good connection'}
        {connectionQuality === 'poor' && 'Poor connection'}
        {connectionQuality === 'disconnected' && 'Disconnected'}
      </span>
      {showVadWarning && (
        <span className="text-sm text-destructive flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Mic issue
        </span>
      )}
    </div>
  );

  // Session ending screen
  if (isSessionEnding) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-b from-background to-muted/30">
        <div className="max-w-lg w-full animate-slide-up">
          <div className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
            {/* Header */}
            <div className="bg-primary/5 border-b border-border px-8 py-6">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-xl bg-primary flex items-center justify-center animate-pulse">
                  <span className="text-2xl">📊</span>
                </div>
                <div>
                  <h2 className="font-heading text-xl font-bold text-foreground">
                    Wrapping Up Your Interview
                  </h2>
                  <p className="text-muted-foreground mt-1">
                    Preparing your results...
                  </p>
                </div>
              </div>
            </div>

            {/* Progress */}
            <div className="px-8 py-6 space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="text-foreground">Interview transcript captured</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="text-foreground">Performance analysis complete</span>
              </div>
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-foreground font-medium">Sending results to your email...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }


  // Paused - show a dedicated paused screen (instead of the "Begin Interview" screen)
  if (isPaused && !isConnected && !isConnecting && !isReconnecting) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-tal-soft">
        <div className="max-w-md w-full text-center animate-slide-up">
          <div className="relative mb-8">
            <div className="h-40 w-40 mx-auto rounded-full flex items-center justify-center bg-accent/10 border-4 border-accent/30">
              <Pause className="h-16 w-16 text-muted-foreground" />
            </div>
          </div>

          <h2 className="font-heading text-2xl font-bold text-foreground mb-2">Interview Paused</h2>
          <p className="text-muted-foreground mb-8">Your progress is saved. Click Resume to continue within 24 hours.</p>

          <Button variant="audio" size="lg" onClick={resumeInterview} className="gap-2">
            <Play className="h-5 w-5" />
            Resume Interview
          </Button>
        </div>
      </div>
    );
  }

  // Connection dropped - show reconnect UI
  if (connectionDropped && !isConnected && !isConnecting) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-tal-soft">
        <div className="max-w-md w-full text-center animate-slide-up">
          <div className="relative mb-8">
            <div className="h-40 w-40 mx-auto rounded-full flex items-center justify-center bg-destructive/10 border-4 border-destructive/30">
              <WifiOff className="h-16 w-16 text-destructive/60" />
            </div>
          </div>

          <h2 className="font-heading text-2xl font-bold text-foreground mb-2">
            Connection Lost
          </h2>
          <p className="text-muted-foreground mb-4">
            Sarah got disconnected unexpectedly. Don't worry — your transcript is saved and you can reconnect to continue.
          </p>
          
          <p className="text-sm text-muted-foreground mb-8">
            {MAX_RECONNECT_ATTEMPTS - reconnectAttempts} reconnection {MAX_RECONNECT_ATTEMPTS - reconnectAttempts === 1 ? 'attempt' : 'attempts'} remaining
          </p>

          <div className="flex items-center justify-center gap-4">
            <Button
              variant="audio"
              size="lg"
              onClick={() => reconnect()}
              disabled={isReconnecting}
              className="gap-2"
            >
              {isReconnecting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Reconnecting...
                </>
              ) : (
                <>
                  <RefreshCw className="h-5 w-5" />
                  Reconnect
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => handleGracefulEnd('connection_lost')}
            >
              End & Get Results
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Pre-interview welcome screen (brand-standard layout)
  if (!isConnected && !isConnecting && !isReconnecting) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-tal-soft">
        <div className="max-w-2xl w-full animate-slide-up">
          {/* Title */}
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-primary flex items-center justify-center gap-3">
              <span className="text-4xl">🎙️</span>
              Premium Audio Mock Interview
            </h1>
          </div>

          {/* Sarah's Headshot */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <img 
                src={sarahHeadshot} 
                alt="Sarah - Your AI Interview Coach" 
                className="h-40 w-40 rounded-full object-cover border-4 border-primary shadow-lg"
              />
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-semibold">
                Sarah
              </div>
            </div>
          </div>

          {/* Audio device selection */}
          <div className="mb-6 p-4 bg-card rounded-lg border border-border">
            <AudioDeviceSelect
              devices={micInputs}
              value={selectedInputId}
              onValueChange={setSelectedInputId}
              onRefresh={ensurePermissionThenEnumerate}
              isRefreshing={isEnumerating}
            />
          </div>

          {/* Tips Section - Moved above button */}
          <div className="mb-8 p-4 bg-card rounded-lg border border-border">
            <div className="flex items-start gap-2 mb-3">
              <Lightbulb className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <h3 className="font-heading font-semibold text-foreground">Tips for a great interview:</h3>
            </div>
            <ul className="text-sm text-muted-foreground space-y-2 ml-7">
              <li>• Use headphones for best audio quality</li>
              <li>• Speak clearly and at a natural pace</li>
              <li>• Use a quiet environment for best results</li>
              <li>• Wait for Sarah to finish before responding</li>
              <li>• Structure your answers using the STAR method</li>
              <li>• Ask Sarah to repeat or clarify anytime</li>
            </ul>
          </div>

          {/* Start / Resume Button */}
          <div className="flex justify-center">
            <Button
              variant="audio"
              size="xl"
              onClick={() => (resumeFromPause ? reconnect() : reconnect({ mode: 'initial' }))}
              disabled={!canStartInterview || isConnecting || isReconnecting}
              className="gap-2 text-lg px-8 py-6"
            >
              {resumeFromPause ? 'Resume Interview' : 'Begin Interview'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Active interview or connecting state
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full text-center animate-slide-up">
        {/* Voice Visualization with Sarah's Headshot */}
        <div className="relative mb-8">
          <div
            className={cn(
              "h-40 w-40 mx-auto rounded-full flex items-center justify-center transition-all duration-300 overflow-hidden",
              isConnected
                ? isSpeaking
                  ? "ring-4 ring-session-audio animate-pulse"
                  : "ring-2 ring-primary/50"
                : "bg-muted"
            )}
          >
            {isConnecting ? (
              <Loader2 className="h-16 w-16 text-primary animate-spin" />
            ) : isConnected ? (
              <img 
                src={sarahHeadshot} 
                alt="Sarah - Your AI Interview Coach" 
                className={cn(
                  "h-full w-full object-cover transition-transform duration-300",
                  isSpeaking && "scale-105"
                )}
              />
            ) : (
              <Volume2 className="h-16 w-16 text-muted-foreground" />
            )}
          </div>
          
          {/* Ripple effect when speaking */}
          {isConnected && isSpeaking && (
            <>
              <div className="absolute inset-0 h-40 w-40 mx-auto rounded-full bg-session-audio/20 animate-ping" />
              <div className="absolute inset-0 h-40 w-40 mx-auto rounded-full bg-session-audio/10 animate-ping animation-delay-200" />
            </>
          )}
          
          {/* VAD indicator */}
          {isConnected && !isSpeaking && (
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
              <div 
                className={cn(
                  "h-1 rounded-full transition-all duration-200",
                  showVadWarning ? "bg-destructive w-16" : "bg-primary"
                )}
                style={{ width: `${Math.max(16, vadScore * 80)}px` }}
              />
            </div>
          )}
        </div>

        <h2 className="font-heading text-2xl font-bold text-foreground mb-2">
          {isConnecting 
            ? 'Connecting to Sarah...' 
            : isSpeaking
              ? 'Sarah is speaking...'
              : isSendingResults
                ? 'Sending your results...'
                : showVadWarning
                  ? 'Having trouble hearing you...'
                  : 'Listening to your response...'}
        </h2>
        
        <p className="text-muted-foreground mb-6">
          {isConnecting
            ? 'Setting up your voice connection...'
            : isSpeaking
              ? 'Listen carefully to the question'
              : isSendingResults
                ? 'Please wait while we email your results'
                : showVadWarning
                  ? 'Check your microphone or speak louder'
                  : 'Speak naturally when you\'re ready to respond'}
        </p>

        {/* Silence warning */}
        {showSilenceWarning && isConnected && (
          <div className="mb-4 p-3 bg-accent/10 border border-accent/20 rounded-lg">
            <p className="text-sm text-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              Sarah hasn't heard from you in a while.
              <button
                onClick={signalActivity}
                className="underline font-medium text-foreground/90 hover:text-foreground"
              >
                I'm still here
              </button>
            </p>
          </div>
        )}

        {/* Controls */}
        {isConnected && (
          <div className="flex items-center justify-center gap-4 mb-6">
            <Button
              variant="outline"
              size="lg"
              onClick={toggleMute}
              className={cn(
                "rounded-full h-14 w-14",
                isMuted && "bg-destructive/10 border-destructive text-destructive"
              )}
            >
              {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </Button>
            
            <Button
              variant="outline"
              size="lg"
              onClick={pauseInterview}
              disabled={isSendingResults}
              className="rounded-full h-14 w-14"
              title="Pause Interview"
            >
              <Pause className="h-6 w-6" />
            </Button>
            
            <Button
              variant="destructive"
              size="lg"
              onClick={stopConversation}
              disabled={isSendingResults}
              className="rounded-full h-14 w-14"
            >
              {isSendingResults ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <PhoneOff className="h-6 w-6" />
              )}
            </Button>
          </div>
        )}
        
        {/* Paused state UI */}
        {isPaused && !isConnected && !isReconnecting && (
          <div className="flex flex-col items-center gap-4 mb-6">
            <div className="p-3 bg-accent/10 border border-accent/20 rounded-lg">
              <p className="text-sm text-foreground flex items-center gap-2">
                <Pause className="h-4 w-4" />
                Interview Paused — Your progress is saved
              </p>
            </div>
            <Button
              variant="audio"
              size="lg"
              onClick={resumeInterview}
              className="gap-2"
            >
              <Play className="h-5 w-5" />
              Resume Interview
            </Button>
          </div>
        )}

        {/* Connection status indicator */}
        <div className="mt-4 flex items-center justify-center">
          <ConnectionIndicator />
        </div>
      </div>
    </div>
  );
}
