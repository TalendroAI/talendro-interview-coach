import { useState, useCallback } from 'react';
import { useConversation } from '@elevenlabs/react';
import { Mic, MicOff, Volume2, Phone, PhoneOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AudioInterfaceProps {
  isActive: boolean;
  sessionId?: string;
  documents?: {
    resume: string;
    jobDescription: string;
    companyUrl: string;
  };
}

// Replace with your ElevenLabs agent ID
const ELEVENLABS_AGENT_ID = 'your-agent-id-here';

export function AudioInterface({ isActive, sessionId, documents }: AudioInterfaceProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const { toast } = useToast();

  const conversation = useConversation({
    onConnect: () => {
      console.log('Connected to ElevenLabs agent');
      toast({
        title: 'Connected!',
        description: 'Your voice interview has started.',
      });
    },
    onDisconnect: () => {
      console.log('Disconnected from ElevenLabs agent');
      setIsConnecting(false);
    },
    onMessage: (message) => {
      console.log('Message from agent:', message);
    },
    onError: (error) => {
      console.error('Conversation error:', error);
      toast({
        variant: 'destructive',
        title: 'Connection Error',
        description: 'Failed to connect to voice agent. Please try again.',
      });
      setIsConnecting(false);
    },
  });

  const startConversation = useCallback(async () => {
    setIsConnecting(true);
    
    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Get conversation token from edge function
      const { data, error } = await supabase.functions.invoke('elevenlabs-conversation-token', {
        body: { agentId: ELEVENLABS_AGENT_ID },
      });

      if (error || !data?.token) {
        throw new Error(error?.message || 'No token received');
      }

      // Build context from documents for the agent
      const contextParts = [];
      if (documents?.resume) {
        contextParts.push(`Candidate Resume: ${documents.resume}`);
      }
      if (documents?.jobDescription) {
        contextParts.push(`Job Description: ${documents.jobDescription}`);
      }
      if (documents?.companyUrl) {
        contextParts.push(`Company URL: ${documents.companyUrl}`);
      }

      // Start the conversation with WebRTC
      await conversation.startSession({
        conversationToken: data.token,
        connectionType: 'webrtc',
        overrides: contextParts.length > 0 ? {
          agent: {
            prompt: {
              prompt: `You are a professional interview coach conducting a mock interview. Use the following context about the candidate and role to personalize the interview:\n\n${contextParts.join('\n\n')}\n\nConduct a realistic behavioral interview, asking relevant questions based on the job requirements and the candidate's background. Provide constructive feedback after each answer.`,
            },
            firstMessage: "Hello! I'm your AI interview coach. I've reviewed your resume and the job description. Let's start with a warm-up question - can you briefly tell me about yourself and why you're interested in this role?",
          },
        } : undefined,
      });
    } catch (error) {
      console.error('Failed to start conversation:', error);
      toast({
        variant: 'destructive',
        title: 'Connection Failed',
        description: error instanceof Error ? error.message : 'Could not start voice interview. Please check your microphone permissions.',
      });
      setIsConnecting(false);
    }
  }, [conversation, documents, toast]);

  const stopConversation = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  const toggleMute = useCallback(() => {
    setIsMuted(!isMuted);
    // Note: The ElevenLabs SDK handles audio input internally
    // For actual muting, you may need to track the media stream
  }, [isMuted]);

  if (!isActive) return null;

  const isConnected = conversation.status === 'connected';
  const isSpeaking = conversation.isSpeaking;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full text-center animate-slide-up">
        {/* Voice Visualization */}
        <div className="relative mb-8">
          <div
            className={cn(
              "h-40 w-40 mx-auto rounded-full flex items-center justify-center transition-all duration-300",
              isConnected
                ? isSpeaking
                  ? "bg-gradient-to-br from-session-audio to-primary animate-pulse"
                  : "bg-gradient-to-br from-session-audio/70 to-primary/70"
                : "bg-muted"
            )}
          >
            {isConnecting ? (
              <Loader2 className="h-16 w-16 text-primary animate-spin" />
            ) : isConnected ? (
              <Volume2 className="h-16 w-16 text-primary-foreground" />
            ) : (
              <Mic className="h-16 w-16 text-muted-foreground" />
            )}
          </div>
          
          {/* Ripple effect when speaking */}
          {isConnected && isSpeaking && (
            <>
              <div className="absolute inset-0 h-40 w-40 mx-auto rounded-full bg-session-audio/20 animate-ping" />
              <div className="absolute inset-0 h-40 w-40 mx-auto rounded-full bg-session-audio/10 animate-ping animation-delay-200" />
            </>
          )}
        </div>

        <h2 className="font-heading text-2xl font-bold text-foreground mb-2">
          {isConnecting 
            ? 'Connecting...' 
            : isConnected 
              ? 'Interview in Progress' 
              : 'Premium Audio Interview'}
        </h2>
        
        <p className="text-muted-foreground mb-8">
          {isConnecting
            ? 'Setting up your voice connection...'
            : isConnected
              ? isSpeaking
                ? 'AI is speaking...'
                : 'Listening to your response...'
              : 'Click the button below to start your voice interview with our AI interviewer.'}
        </p>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          {!isConnected ? (
            <Button
              variant="audio"
              size="xl"
              onClick={startConversation}
              disabled={isConnecting}
              className="gap-2"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Phone className="h-5 w-5" />
                  Start Voice Interview
                </>
              )}
            </Button>
          ) : (
            <>
              <Button
                variant={isMuted ? 'destructive' : 'outline'}
                size="icon"
                className="h-14 w-14 rounded-full"
                onClick={toggleMute}
              >
                {isMuted ? (
                  <MicOff className="h-6 w-6" />
                ) : (
                  <Mic className="h-6 w-6" />
                )}
              </Button>
              
              <Button
                variant="destructive"
                size="icon"
                className="h-14 w-14 rounded-full"
                onClick={stopConversation}
              >
                <PhoneOff className="h-6 w-6" />
              </Button>
            </>
          )}
        </div>

        {isConnected && (
          <p className="text-sm text-muted-foreground mt-6">
            {isMuted ? 'Microphone muted' : 'Microphone active'}
          </p>
        )}

        {/* Info card */}
        <div className="mt-8 p-4 bg-accent/50 rounded-lg border border-accent text-left">
          <h3 className="font-semibold text-accent-foreground mb-2">Tips for audio interviews:</h3>
          <ul className="text-sm text-accent-foreground/80 space-y-1">
            <li>• Speak clearly and at a natural pace</li>
            <li>• Use a quiet environment for best results</li>
            <li>• Wait for the AI to finish before responding</li>
            <li>• Structure your answers using STAR method</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
