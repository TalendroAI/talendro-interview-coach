import { useState, useCallback } from 'react';
import { useConversation } from '@elevenlabs/react';
import { MicOff, Volume2, PhoneOff, Loader2, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import sandraHeadshot from '@/assets/sandra-headshot.jpg';

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
  const { toast } = useToast();

  const conversation = useConversation({
    onConnect: () => {
      console.log('Connected to ElevenLabs agent');
      toast({
        title: 'Connected!',
        description: 'Your voice interview has started.',
      });
      onInterviewStarted?.();
    },
    onDisconnect: () => {
      console.log('Disconnected from ElevenLabs agent');
      setIsConnecting(false);
      onInterviewComplete?.();
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
  const canStartInterview = isDocumentsSaved;

  // Pre-interview welcome screen (brand-standard layout)
  if (!isConnected && !isConnecting) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-hero">
        <div className="max-w-2xl w-full animate-slide-up">
          {/* Title */}
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-extrabold text-foreground flex items-center justify-center gap-3">
              <span className="text-4xl">🎙️</span>
              Premium Audio Mock Interview
            </h1>
          </div>

          {/* Sandra's Headshot */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <img 
                src={sandraHeadshot} 
                alt="Sandra - Your AI Interview Coach" 
                className="h-40 w-40 rounded-full object-cover border-4 border-primary shadow-lg"
              />
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-semibold">
                Sandra
              </div>
            </div>
          </div>

          {/* Tips Section - Moved above button */}
          <div className="mb-8 p-4 bg-accent/50 rounded-lg border border-accent">
            <div className="flex items-start gap-2 mb-3">
              <Lightbulb className="h-5 w-5 text-secondary flex-shrink-0 mt-0.5" />
              <h3 className="font-semibold text-accent-foreground">Tips for audio interviews:</h3>
            </div>
            <ul className="text-sm text-accent-foreground/80 space-y-2 ml-7">
              <li>• Speak clearly and at a natural pace</li>
              <li>• Use a quiet environment for best results</li>
              <li>• Wait for Sandra to finish before responding</li>
              <li>• Structure your answers using STAR method</li>
              <li>• This is a completely natural conversation — you may ask Sandra to repeat herself, slow down, speed up, rephrase, clarify, etc.</li>
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
        {/* Voice Visualization with Sandra's Headshot */}
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
                src={sandraHeadshot} 
                alt="Sandra - Your AI Interview Coach" 
                className="h-full w-full object-cover"
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
        </div>

        <h2 className="font-heading text-2xl font-bold text-foreground mb-2">
          {isConnecting 
            ? 'Connecting to Sandra...' 
            : isSpeaking
              ? 'Sandra is speaking...'
              : 'Listening to your response...'}
        </h2>
        
        <p className="text-muted-foreground mb-8">
          {isConnecting
            ? 'Setting up your voice connection...'
            : isSpeaking
              ? 'Wait for Sandra to finish before responding'
              : 'Speak naturally — Sandra is listening'}
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
