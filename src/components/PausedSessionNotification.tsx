import { useState, useEffect } from 'react';
import { Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface PausedSessionNotificationProps {
  userEmail: string;
}

export function PausedSessionNotification({ userEmail }: PausedSessionNotificationProps) {
  const [pausedCount, setPausedCount] = useState(0);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const fetchPausedCount = async () => {
      if (!userEmail) return;

      try {
        const { data, error } = await supabase.functions.invoke('audio-session', {
          body: {
            action: 'get_paused_sessions',
            email: userEmail,
          },
        });

        if (!error && data?.sessions) {
          setPausedCount(data.sessions.length);
        }
      } catch (err) {
        console.error('Failed to fetch paused sessions count:', err);
      }
    };

    fetchPausedCount();
  }, [userEmail]);

  if (isDismissed || pausedCount === 0) {
    return null;
  }

  return (
    <div className="flex items-center justify-between bg-muted/50 border border-border/50 rounded-lg px-4 py-2 text-sm animate-fade-in">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>
          You have {pausedCount} paused session{pausedCount !== 1 ? 's' : ''} — 
          <button 
            className="text-primary hover:underline ml-1 font-medium"
            onClick={() => {
              // For now, just dismiss and show the banner on next visit
              // Future: navigate to a "My Sessions" page
              setIsDismissed(true);
            }}
          >
            View later
          </button>
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
        onClick={() => setIsDismissed(true)}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
