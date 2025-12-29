import { useState, useCallback, useRef, useEffect } from 'react';
import { useConversation } from '@elevenlabs/react';
import { MicOff, Mic, Volume2, PhoneOff, Loader2, Lightbulb, RefreshCw, WifiOff, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import sarahHeadshot from '@/assets/sarah-headshot.jpg';
import { AudioDeviceSelect } from '@/components/audio/AudioDeviceSelect';
import { useAudioDevices } from '@/components/audio/useAudioDevices';

interface AudioInterfaceProps {
  isActive: boolean;
  sessionId?: string;
  documents?: {
    resume: string;
    jobDescription: string;
    companyUrl: string;
  };
  isDocumentsSaved?: boolean;
  onInterviewStarted?: () => void;
  onInterviewComplete?: () => void;
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

type ConnectionQuality = 'excellent' | 'good' | 'poor' | 'disconnected';

export function AudioInterface({
  isActive, 
  sessionId, 
  documents, 
  isDocumentsSaved = false,
  onInterviewStarted,
  onInterviewComplete,
  userEmail
}: AudioInterfaceProps) {
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
  const { toast } = useToast();

  const {
    inputs: micInputs,
    selectedInputId,
    setSelectedInputId,
    ensurePermissionThenEnumerate,
    isEnumerating,
  } = useAudioDevices();
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

  // Keep a rolling transcript so we can resume after reconnect (ElevenLabs sessions don't persist across reconnects)
  const transcriptRef = useRef<Array<{ role: 'user' | 'assistant'; text: string; ts: number }>>([]);
  const lastAssistantTurnRef = useRef<string | null>(null);
  const questionCountRef = useRef(0);

  const appendTranscriptTurn = useCallback((role: 'user' | 'assistant', text: unknown) => {
    const clean = typeof text === 'string' ? text.trim() : '';
    if (!clean) return;

    const last = transcriptRef.current[transcriptRef.current.length - 1];
    if (last && last.role === role && last.text === clean) return;

    transcriptRef.current.push({ role, text: clean, ts: Date.now() });
    setLastActivityTime(Date.now());

    // Prevent unbounded growth
    if (transcriptRef.current.length > 60) {
      transcriptRef.current = transcriptRef.current.slice(-60);
    }
  }, []);

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
        description: 'Great job! Sending your results now...',
      },
      connection_lost: {
        title: 'Session Ended',
        description: 'The connection was lost. We\'re sending whatever results we captured.',
      },
      timeout: {
        title: 'Session Timed Out',
        description: 'The session ended due to inactivity. Sending your partial results.',
      },
      error: {
        title: 'Session Ended Unexpectedly',
        description: 'Something went wrong. We\'ll try to send your results.',
      },
    };

    toast(messages[reason]);

    await sendAudioResults();
    setIsSessionEnding(false);
    interviewStarted.current = false;
    onInterviewComplete?.();
  }, [cleanup, sendAudioResults, toast, onInterviewComplete]);

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
    },
    onDisconnect: (details) => {
      console.log('Disconnected from ElevenLabs agent', details);
      setIsConnecting(false);
      setIsReconnecting(false);
      setConnectionQuality('disconnected');
      cleanup();
      
      // Only complete the interview if user intentionally ended it
      if (userEndedSession.current) {
        userEndedSession.current = false;
        handleGracefulEnd('user_ended');
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
      console.error('Conversation error:', error);
      setConnectionQuality('poor');
      
      // Determine error type and show appropriate message
      const errorMessage = error && typeof error === 'object' && 'message' in (error as object)
        ? String((error as { message: string }).message) 
        : 'Unknown error';
      let userMessage = 'Failed to connect to voice agent.';
      
      if (errorMessage.includes('microphone') || errorMessage.includes('permission')) {
        userMessage = 'Microphone access denied. Please enable microphone permissions.';
      } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
        userMessage = 'Network connection issue. Check your internet connection.';
      } else if (errorMessage.includes('timeout')) {
        userMessage = 'Connection timed out. Please try again.';
      }

      toast({
        variant: 'destructive',
        title: 'Connection Error',
        description: userMessage,
      });
      
      setIsConnecting(false);
      setIsReconnecting(false);
    },
    // VAD score monitoring for voice detection issues
    onVadScore: handleVadScore,
  });

  const startConversation = useCallback(async () => {
    console.log('Begin Interview clicked - starting conversation...');
    console.log('isDocumentsSaved:', isDocumentsSaved);
    console.log('documents:', documents);

    // Fresh interview run
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

    try {
      // Request microphone permission (and try to use the selected mic if provided)
      console.log('Requesting microphone permission...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedInputId ? { deviceId: { exact: selectedInputId } } : true,
      });
      stream.getTracks().forEach((track) => track.stop());
      console.log('Microphone permission granted');

      // Get a WebRTC token from the backend function (recommended for best audio quality)
      console.log('Fetching token...');
      const { data, error } = await supabase.functions.invoke('elevenlabs-conversation-token', {
        body: { agentId: ELEVENLABS_AGENT_ID, mode: 'token' },
      });

      console.log('Token response:', { data, error });

      const token = (data as any)?.token;

      if (error || !token) {
        throw new Error(error?.message || 'No token received');
      }

      // Build context from documents (sent as contextual update once connected)
      const contextParts: string[] = [];
      if (documents?.resume) contextParts.push(`Candidate Resume:\n${documents.resume}`);
      if (documents?.jobDescription) contextParts.push(`Job Description:\n${documents.jobDescription}`);
      if (documents?.companyUrl) contextParts.push(`Company URL: ${documents.companyUrl}`);

      console.log('Starting ElevenLabs session (WebRTC)...');

      await conversation.startSession({
        conversationToken: token,
        connectionType: 'webrtc',
        inputDeviceId: selectedInputId || undefined,
      });

      if (contextParts.length > 0) {
        console.log('Sending contextual update with documents:', contextParts.length);
        conversation.sendContextualUpdate(contextParts.join('\n\n'));
      }

      // If the agent doesn't start speaking on its own (no configured first message), nudge it.
      window.setTimeout(() => {
        try {
          if (conversation.status === 'connected' && !conversation.isSpeaking) {
            console.log('No greeting detected; nudging Sarah to greet.');
            conversation.sendUserMessage(
              'Start the interview now. Greet the candidate warmly by saying: "Hello, I\'m Sarah. Thank you for your interest in the opportunity. I\'ll be conducting your interview today." Then ask your first question.'
            );
          }
        } catch (e) {
          console.error('Failed to send greeting nudge:', e);
        }
      }, 900);

      console.log('ElevenLabs session started successfully');
    } catch (error) {
      console.error('Failed to start conversation:', error);
      cleanup();

      let errorMessage = 'Could not start voice interview.';
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.message.includes('permission')) {
          errorMessage = 'Microphone access was denied. Please allow microphone access and try again.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No microphone found. Please connect a microphone and try again.';
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        variant: 'destructive',
        title: 'Connection Failed',
        description: errorMessage,
      });
      setIsConnecting(false);
    }
  }, [conversation, documents, isDocumentsSaved, toast, cleanup, selectedInputId]);

  const stopConversation = useCallback(async () => {
    userEndedSession.current = true;
    setIsSessionEnding(true);

    toast({
      title: 'Ending Interview',
      description: 'Wrapping up your session with Sarah...',
    });

    await conversation.endSession();
  }, [conversation, toast]);

  const reconnect = useCallback(async () => {
    setIsReconnecting(true);
    setConnectionDropped(false);
    setReconnectAttempts((prev) => prev + 1);

    try {
      // Re-request microphone permission (try selected device)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedInputId ? { deviceId: { exact: selectedInputId } } : true,
      });
      stream.getTracks().forEach((track) => track.stop());

      const { data, error } = await supabase.functions.invoke('elevenlabs-conversation-token', {
        body: { agentId: ELEVENLABS_AGENT_ID, mode: 'token' },
      });

      const token = (data as any)?.token;
      if (error || !token) {
        throw new Error(error?.message || 'No token received');
      }

      const lastSarahMessage = lastAssistantTurnRef.current;
      const questionsSoFar = questionCountRef.current;
      const resumeFirstMessage = lastSarahMessage
        ? `We just reconnected after a brief connection issue. Do NOT restart the interview or re-introduce yourself. Continue from where we left off. You have already asked about ${questionsSoFar} questions. Your last message was: "${lastSarahMessage}". If you were waiting for my answer, ask me to continue from there; otherwise ask the next interview question.`
        : `We just reconnected after a brief connection issue. Do NOT restart the interview or re-introduce yourself. Continue from where we left off.`;

      await conversation.startSession({
        conversationToken: token,
        connectionType: 'webrtc',
        inputDeviceId: selectedInputId || undefined,
        overrides: {
          agent: {
            firstMessage: resumeFirstMessage,
          },
        },
      });

      // Restore context (documents + a rolling transcript so Sarah can resume instead of restarting)
      const contextParts: string[] = [];
      if (documents?.resume) contextParts.push(`Candidate Resume:\n${documents.resume}`);
      if (documents?.jobDescription) contextParts.push(`Job Description:\n${documents.jobDescription}`);
      if (documents?.companyUrl) contextParts.push(`Company URL: ${documents.companyUrl}`);

      const recentTurns = transcriptRef.current.slice(-12);
      const transcriptText = recentTurns
        .map((t) => `${t.role === 'user' ? 'Candidate' : 'Sarah'}: ${t.text}`)
        .join('\n');

      if (transcriptText) {
        contextParts.push(`Interview transcript so far (most recent):\n${transcriptText}`);
      }

      if (contextParts.length > 0) {
        conversation.sendContextualUpdate(contextParts.join('\n\n'));
      }

    } catch (error) {
      console.error('Reconnection failed:', error);
      toast({
        variant: 'destructive',
        title: 'Reconnection Failed',
        description:
          reconnectAttempts >= MAX_RECONNECT_ATTEMPTS - 1
            ? 'Maximum reconnection attempts reached. Your session will end.'
            : 'Could not reconnect. Please try again.',
      });

      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS - 1) {
        handleGracefulEnd('connection_lost');
      } else {
        setConnectionDropped(true);
        setIsReconnecting(false);
      }
    }
  }, [conversation, documents, toast, reconnectAttempts, handleGracefulEnd, selectedInputId]);

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
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-tal-soft">
        <div className="max-w-md w-full text-center animate-slide-up">
          <div className="relative mb-8">
            <div className="h-40 w-40 mx-auto rounded-full flex items-center justify-center bg-primary/10 border-4 border-primary/30">
              <Loader2 className="h-16 w-16 text-primary animate-spin" />
            </div>
          </div>

          <h2 className="font-heading text-2xl font-bold text-foreground mb-2">
            Wrapping Up Your Interview
          </h2>
          <p className="text-muted-foreground mb-4">
            Please wait while we prepare and send your results...
          </p>
          
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>Transcript captured</span>
          </div>
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
              onClick={reconnect}
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

          {/* Start Button */}
          <div className="flex justify-center">
            <Button
              variant="audio"
              size="xl"
              onClick={startConversation}
              disabled={!canStartInterview || isConnecting}
              className="gap-2 text-lg px-8 py-6"
            >
              Begin Interview
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
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Sarah hasn't heard from you in a while. 
              <button 
                onClick={signalActivity}
                className="underline font-medium hover:text-yellow-900"
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

        {/* Connection status indicator */}
        <div className="mt-4 flex items-center justify-center">
          <ConnectionIndicator />
        </div>
      </div>
    </div>
  );
}
