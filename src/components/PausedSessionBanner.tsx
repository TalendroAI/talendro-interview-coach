import { useState, useEffect } from 'react';
import { AlertCircle, Clock, Play, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PausedSession {
  id: string;
  session_type: string;
  paused_at: string;
  current_question_number: number;
  created_at: string;
}

interface PausedSessionBannerProps {
  userEmail: string;
  onResume: (sessionId: string, sessionType: string) => void;
  onAbandon: (sessionId: string) => void;
}

const SESSION_TYPE_LABELS: Record<string, string> = {
  quick_prep: 'Quick Prep',
  full_mock: 'Mock Interview',
  premium_audio: 'Audio Mock Interview',
  pro: 'Pro Session',
};

export function PausedSessionBanner({ userEmail, onResume, onAbandon }: PausedSessionBannerProps) {
  const [pausedSessions, setPausedSessions] = useState<PausedSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [abandoningId, setAbandoningId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchPausedSessions = async () => {
      if (!userEmail) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('audio-session', {
          body: {
            action: 'get_paused_sessions',
            email: userEmail,
          },
        });

        if (error) {
          console.error('Error fetching paused sessions:', error);
          return;
        }

        setPausedSessions(data?.sessions ?? []);
      } catch (err) {
        console.error('Failed to fetch paused sessions:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPausedSessions();
  }, [userEmail]);

  const getTimeAgo = (pausedAt: string): string => {
    const pausedTime = new Date(pausedAt).getTime();
    const now = Date.now();
    const diffMs = now - pausedTime;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    }
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  };

  const getExpiresIn = (pausedAt: string): string => {
    const pausedTime = new Date(pausedAt).getTime();
    const expiresAt = pausedTime + 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();
    const remainingMs = expiresAt - now;
    const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
    const remainingMins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

    if (remainingHours > 0) {
      return `${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
    }
    return `${remainingMins} minute${remainingMins !== 1 ? 's' : ''}`;
  };

  const handleAbandon = async (sessionId: string) => {
    setAbandoningId(sessionId);
    try {
      // Mark session as cancelled
      const { error } = await supabase
        .from('coaching_sessions')
        .update({ status: 'cancelled', paused_at: null })
        .eq('id', sessionId);

      if (error) throw error;

      setPausedSessions((prev) => prev.filter((s) => s.id !== sessionId));
      onAbandon(sessionId);
      
      toast({
        title: 'Session Abandoned',
        description: 'You can start a new session now.',
      });
    } catch (err) {
      console.error('Failed to abandon session:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to abandon session. Please try again.',
      });
    } finally {
      setAbandoningId(null);
    }
  };

  if (isLoading || pausedSessions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {pausedSessions.map((session) => (
        <Card 
          key={session.id} 
          className="border-warning/50 bg-warning/5 animate-fade-in"
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-warning/20 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-warning" />
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-heading font-semibold text-foreground">
                  Paused {SESSION_TYPE_LABELS[session.session_type] || session.session_type}
                </h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground mt-1">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Paused {getTimeAgo(session.paused_at)}
                  </span>
                  <span>•</span>
                  <span>Question {session.current_question_number || 0}</span>
                  <span>•</span>
                  <span className="text-warning font-medium">
                    Expires in {getExpiresIn(session.paused_at)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAbandon(session.id)}
                  disabled={abandoningId === session.id}
                  className="text-destructive hover:bg-destructive/10"
                >
                  <X className="h-4 w-4 mr-1" />
                  Abandon
                </Button>
                <Button
                  size="sm"
                  onClick={() => onResume(session.id, session.session_type)}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Play className="h-4 w-4 mr-1" />
                  Resume
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}