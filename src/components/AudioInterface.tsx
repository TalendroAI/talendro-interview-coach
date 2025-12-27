import { useState, useCallback, useRef, useEffect } from 'react';
import { useConversation } from '@elevenlabs/react';
import { MicOff, Volume2, PhoneOff, Loader2, Lightbulb, RefreshCw, Video, VideoOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import sarahHeadshot from '@/assets/sarah-headshot.jpg';

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
}

// Replace with your ElevenLabs agent ID
const ELEVENLABS_AGENT_ID = 'agent_1901kb0ray8kfph9x9bh4w97bbe4';

// Helper function to convert image URL to base64
const imageToBase64 = async (imageUrl: string): Promise<string> => {
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // Remove the data:image/xxx;base64, prefix
      const base64Data = base64.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export function AudioInterface({ 
  isActive, 
  sessionId, 
  documents, 
  isDocumentsSaved = false,
  onInterviewStarted,
  onInterviewComplete 
}: AudioInterfaceProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [connectionDropped, setConnectionDropped] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [enableLipSync, setEnableLipSync] = useState(false);
  const [lipSyncVideoUrl, setLipSyncVideoUrl] = useState<string | null>(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [sarahImageBase64, setSarahImageBase64] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Track if user intentionally ended the session
  const userEndedSession = useRef(false);
  // Track if interview has started (to distinguish intentional end vs drop)
  const interviewStarted = useRef(false);
  // Video element ref for lip-sync playback
  const videoRef = useRef<HTMLVideoElement>(null);

  // Pre-load Sarah's image as base64 for D-ID
  useEffect(() => {
    if (enableLipSync && !sarahImageBase64) {
      imageToBase64(sarahHeadshot)
        .then(base64 => {
          setSarahImageBase64(base64);
          console.log('Sarah image converted to base64, length:', base64.length);
        })
        .catch(err => {
          console.error('Failed to convert Sarah image to base64:', err);
        });
    }
  }, [enableLipSync, sarahImageBase64]);

  // Keep a rolling transcript so we can resume after reconnect (ElevenLabs sessions don't persist across reconnects)
  const transcriptRef = useRef<Array<{ role: 'user' | 'assistant'; text: string; ts: number }>>([]);

  const appendTranscriptTurn = useCallback((role: 'user' | 'assistant', text: unknown) => {
    const clean = typeof text === 'string' ? text.trim() : '';
    if (!clean) return;

    const last = transcriptRef.current[transcriptRef.current.length - 1];
    if (last && last.role === role && last.text === clean) return;

    transcriptRef.current.push({ role, text: clean, ts: Date.now() });

    // Prevent unbounded growth
    if (transcriptRef.current.length > 60) {
      transcriptRef.current = transcriptRef.current.slice(-60);
    }
  }, []);

  const conversation = useConversation({
    onConnect: () => {
      console.log('Connected to ElevenLabs agent');
      setIsConnecting(false);
      setIsReconnecting(false);
      setConnectionDropped(false);

      const wasAlreadyStarted = interviewStarted.current;
      interviewStarted.current = true;

      toast({
        title: 'Connected!',
        description: wasAlreadyStarted
          ? 'Reconnected — continuing your interview.'
          : 'Your voice interview has started.',
      });

      if (!wasAlreadyStarted) {
        onInterviewStarted?.();
      }
    },
    onDisconnect: () => {
      console.log('Disconnected from ElevenLabs agent');
      setIsConnecting(false);
      setIsReconnecting(false);
      
      // Only complete the interview if user intentionally ended it
      if (userEndedSession.current) {
        userEndedSession.current = false;
        interviewStarted.current = false;
        onInterviewComplete?.();
      } else if (interviewStarted.current) {
        // Unexpected disconnect - show reconnect option
        setConnectionDropped(true);
        toast({
          variant: 'destructive',
          title: 'Connection Lost',
          description: 'Sarah got disconnected. Click "Reconnect" to continue your interview.',
        });
      }
    },
    onMessage: (message) => {
      console.log('Message from agent:', message);

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
        }
      } catch (e) {
        console.warn('Failed to parse transcript message:', e);
      }
    },
    onError: (error) => {
      console.error('Conversation error:', error);
      toast({
        variant: 'destructive',
        title: 'Connection Error',
        description: 'Failed to connect to voice agent. Please try again.',
      });
      setIsConnecting(false);
      setIsReconnecting(false);
    },
  });

  const startConversation = useCallback(async () => {
    console.log('Begin Interview clicked - starting conversation...');
    console.log('isDocumentsSaved:', isDocumentsSaved);
    console.log('documents:', documents);

    // Fresh interview run
    transcriptRef.current = [];
    interviewStarted.current = false;
    userEndedSession.current = false;
    setConnectionDropped(false);

    setIsConnecting(true);

    try {
      // Request microphone permission
      console.log('Requesting microphone permission...');
      await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Microphone permission granted');

      // Get signed URL from backend function (more reliable than WebRTC token in some browsers)
      console.log('Fetching signed URL...');
      const { data, error } = await supabase.functions.invoke('elevenlabs-conversation-token', {
        body: { agentId: ELEVENLABS_AGENT_ID, mode: 'signed_url' },
      });

      console.log('Signed URL response:', { data, error });

      const signedUrl = (data as any)?.signedUrl;

      if (error || !signedUrl) {
        throw new Error(error?.message || 'No signed URL received');
      }

      // Build context from documents (sent as contextual update once connected)
      const contextParts: string[] = [];
      if (documents?.resume) contextParts.push(`Candidate Resume:\n${documents.resume}`);
      if (documents?.jobDescription) contextParts.push(`Job Description:\n${documents.jobDescription}`);
      if (documents?.companyUrl) contextParts.push(`Company URL: ${documents.companyUrl}`);

      console.log('Starting ElevenLabs session (signed URL)...');

      await conversation.startSession({ signedUrl });

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
      toast({
        variant: 'destructive',
        title: 'Connection Failed',
        description: error instanceof Error ? error.message : 'Could not start voice interview. Please check your microphone permissions.',
      });
      setIsConnecting(false);
    }
  }, [conversation, documents, isDocumentsSaved, toast]);

  const stopConversation = useCallback(async () => {
    userEndedSession.current = true;
    await conversation.endSession();
  }, [conversation]);

  const reconnect = useCallback(async () => {
    setIsReconnecting(true);
    setConnectionDropped(false);
    
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const { data, error } = await supabase.functions.invoke('elevenlabs-conversation-token', {
        body: { agentId: ELEVENLABS_AGENT_ID, mode: 'signed_url' },
      });

      const signedUrl = (data as any)?.signedUrl;
      if (error || !signedUrl) {
        throw new Error(error?.message || 'No signed URL received');
      }

      await conversation.startSession({ signedUrl });

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

      const lastSarahMessage = [...transcriptRef.current]
        .reverse()
        .find((t) => t.role === 'assistant')?.text;

      // Prompt Sarah to resume from where we left off
      setTimeout(() => {
        if (conversation.status === 'connected') {
          conversation.sendUserMessage(
            lastSarahMessage
              ? `We just reconnected after a brief connection issue. Do NOT restart the interview. Continue from where we left off. Your last message was: "${lastSarahMessage}". If you were waiting for my answer, ask me to continue my answer from there; otherwise ask the next interview question.`
              : 'We just reconnected after a brief connection issue. Please continue the interview from where we left off (do not restart).'
          );
        }
      }, 800);

    } catch (error) {
      console.error('Reconnection failed:', error);
      toast({
        variant: 'destructive',
        title: 'Reconnection Failed',
        description: 'Could not reconnect. Please try again.',
      });
      setConnectionDropped(true);
      setIsReconnecting(false);
    }
  }, [conversation, documents, toast]);

  const toggleMute = useCallback(() => {
    setIsMuted(!isMuted);
    // Note: The ElevenLabs SDK handles audio input internally
    // For actual muting, you may need to track the media stream
  }, [isMuted]);

  if (!isActive) return null;

  const isConnected = conversation.status === 'connected';
  const isSpeaking = conversation.isSpeaking;
  const canStartInterview = isDocumentsSaved;

  // Connection dropped - show reconnect UI
  if (connectionDropped && !isConnected && !isConnecting) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-tal-soft">
        <div className="max-w-md w-full text-center animate-slide-up">
          <div className="relative mb-8">
            <div className="h-40 w-40 mx-auto rounded-full flex items-center justify-center bg-destructive/10 border-4 border-destructive/30">
              <img 
                src={sarahHeadshot} 
                alt="Sarah - Your AI Interview Coach" 
                className="h-full w-full object-cover rounded-full opacity-60"
              />
            </div>
          </div>

          <h2 className="font-heading text-2xl font-bold text-foreground mb-2">
            Connection Lost
          </h2>
          <p className="text-muted-foreground mb-8">
            Sarah got disconnected unexpectedly. Don't worry — you can reconnect and continue your interview.
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
              onClick={() => {
                setConnectionDropped(false);
                interviewStarted.current = false;
                onInterviewComplete?.();
              }}
            >
              End Interview
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

          {/* Lip Sync Toggle (Experimental) */}
          <div className="mb-6 p-4 bg-secondary/10 rounded-lg border border-secondary/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {enableLipSync ? (
                  <Video className="h-5 w-5 text-secondary" />
                ) : (
                  <VideoOff className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <Label htmlFor="lip-sync-toggle" className="font-semibold text-foreground cursor-pointer">
                    AI Lip Sync (Beta)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Animates Sarah's greeting. Real-time sync not yet available.
                  </p>
                </div>
              </div>
              <Switch
                id="lip-sync-toggle"
                checked={enableLipSync}
                onCheckedChange={setEnableLipSync}
              />
            </div>
            {enableLipSync && (
              <p className="text-xs text-muted-foreground mt-2 ml-8">
                ⚠️ D-ID generates video from audio files, so there's a delay. This demo shows the greeting animation.
              </p>
            )}
          </div>

          {/* Tips Section - Moved above button */}
          <div className="mb-8 p-4 bg-card rounded-lg border border-border">
            <div className="flex items-start gap-2 mb-3">
              <Lightbulb className="h-5 w-5 text-secondary flex-shrink-0 mt-0.5" />
              <h3 className="font-heading font-semibold text-tal-navy">Tips for audio interviews:</h3>
            </div>
            <ul className="text-sm text-tal-gray font-sans space-y-2 ml-7">
              <li>• Speak clearly and at a natural pace</li>
              <li>• Use a quiet environment for best results</li>
              <li>• Wait for Sarah to finish before responding</li>
              <li>• Structure your answers using STAR method</li>
              <li>• This is a completely natural conversation — you may ask Sarah to repeat herself, slow down, speed up, rephrase, clarify, etc.</li>
            </ul>
          </div>

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
        {/* Voice Visualization with Sarah's Headshot or D-ID Video */}
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
              <>
                {/* Show D-ID video when lip-sync is enabled and video is available */}
                {enableLipSync && lipSyncVideoUrl && isSpeaking ? (
                  <video
                    ref={videoRef}
                    src={lipSyncVideoUrl}
                    autoPlay
                    playsInline
                    muted={false}
                    className="h-full w-full object-cover"
                    onEnded={() => setLipSyncVideoUrl(null)}
                  />
                ) : (
                  <img 
                    src={sarahHeadshot} 
                    alt="Sarah - Your AI Interview Coach" 
                    className={cn(
                      "h-full w-full object-cover transition-transform duration-300",
                      isSpeaking && "scale-105"
                    )}
                  />
                )}
                {/* Loading overlay when generating D-ID video */}
                {enableLipSync && isGeneratingVideo && (
                  <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-full">
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  </div>
                )}
              </>
            ) : (
              <Volume2 className="h-16 w-16 text-muted-foreground" />
            )}
          </div>
          
          {/* Ripple effect when speaking */}
          {isConnected && isSpeaking && !lipSyncVideoUrl && (
            <>
              <div className="absolute inset-0 h-40 w-40 mx-auto rounded-full bg-session-audio/20 animate-ping" />
              <div className="absolute inset-0 h-40 w-40 mx-auto rounded-full bg-session-audio/10 animate-ping animation-delay-200" />
            </>
          )}

          {/* Lip-sync indicator badge */}
          {enableLipSync && isConnected && (
            <div className="absolute -top-2 -right-2 bg-secondary text-secondary-foreground px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
              <Video className="h-3 w-3" />
              {isGeneratingVideo ? 'Generating...' : 'Lip Sync'}
            </div>
          )}
        </div>

        <h2 className="font-heading text-2xl font-bold text-foreground mb-2">
          {isConnecting 
            ? 'Connecting to Sarah...' 
            : isSpeaking
              ? 'Sarah is speaking...'
              : 'Listening to your response...'}
        </h2>
        
        <p className="text-muted-foreground mb-8">
          {isConnecting
            ? 'Setting up your voice connection...'
            : isSpeaking
              ? 'Wait for Sarah to finish before responding'
              : 'Speak naturally — Sarah is listening'}
        </p>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          <Button
            variant={isMuted ? 'destructive' : 'outline'}
            size="icon"
            className="h-14 w-14 rounded-full"
            onClick={toggleMute}
          >
            <MicOff className="h-6 w-6" />
          </Button>
          
          <Button
            variant="destructive"
            size="icon"
            className="h-14 w-14 rounded-full"
            onClick={stopConversation}
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
        </div>

        <p className="text-sm text-muted-foreground mt-6">
          {isMuted ? 'Microphone muted' : 'Microphone active'}
        </p>
      </div>
    </div>
  );
}
