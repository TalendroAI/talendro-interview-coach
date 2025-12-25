import { useState } from 'react';
import { Mic, MicOff, Volume2, Phone, PhoneOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AudioInterfaceProps {
  isActive: boolean;
}

export function AudioInterface({ isActive }: AudioInterfaceProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleConnect = () => {
    setIsConnected(true);
    // In full implementation, this will connect to ElevenLabs
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setIsMuted(false);
  };

  if (!isActive) return null;

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
            {isConnected ? (
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
          {isConnected ? 'Interview in Progress' : 'Premium Audio Interview'}
        </h2>
        
        <p className="text-muted-foreground mb-8">
          {isConnected
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
              onClick={handleConnect}
              className="gap-2"
            >
              <Phone className="h-5 w-5" />
              Start Voice Interview
            </Button>
          ) : (
            <>
              <Button
                variant={isMuted ? 'destructive' : 'outline'}
                size="icon"
                className="h-14 w-14 rounded-full"
                onClick={() => setIsMuted(!isMuted)}
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
                onClick={handleDisconnect}
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
