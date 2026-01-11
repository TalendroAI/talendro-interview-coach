import { useEffect, useState } from 'react';
import { Zap, MessageSquare, Mic, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

export type ProInterviewType = 'quick_prep' | 'full_mock' | 'premium_audio';

interface ProInterviewTypeSelectorProps {
  selectedType: ProInterviewType | null;
  onSelect: (type: ProInterviewType) => void;
  disabled?: boolean;
  userEmail?: string;
}

interface RemainingSessionsData {
  quick_prep: { used: number; limit: number | null; remaining: number | null };
  full_mock: { used: number; limit: number; remaining: number };
  premium_audio: { used: number; limit: number; remaining: number };
}

interface RemainingSessions {
  is_pro: boolean;
  remaining: RemainingSessionsData | null;
  next_reset: string | null;
}

export function ProInterviewTypeSelector({
  selectedType,
  onSelect,
  disabled = false,
  userEmail,
}: ProInterviewTypeSelectorProps) {
  const [remainingSessions, setRemainingSessions] = useState<RemainingSessions | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (userEmail) {
      fetchRemainingSessions();
    }
  }, [userEmail]);

  const fetchRemainingSessions = async () => {
    if (!userEmail) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('pro-session', {
        body: { action: 'get_remaining_sessions', email: userEmail },
      });

      if (error) {
        console.error('Error fetching remaining sessions:', error);
        return;
      }

      setRemainingSessions(data);
    } catch (err) {
      console.error('Error fetching remaining sessions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getSessionInfo = (type: ProInterviewType): { remaining: number | null; limit: number | null; isUnlimited: boolean; isDisabled: boolean; resetDate: string | null } => {
    if (!remainingSessions?.remaining) {
      return { remaining: null, limit: null, isUnlimited: type === 'quick_prep', isDisabled: false, resetDate: null };
    }

    const data = remainingSessions.remaining[type];
    
    if (type === 'quick_prep') {
      return { remaining: null, limit: null, isUnlimited: true, isDisabled: false, resetDate: null };
    }

    return {
      remaining: data.remaining,
      limit: data.limit,
      isUnlimited: false,
      isDisabled: data.remaining === 0,
      resetDate: remainingSessions.next_reset,
    };
  };

  const formatResetDate = (isoDate: string | null): string => {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const INTERVIEW_OPTIONS: { type: ProInterviewType; label: string; description: string; icon: React.ReactNode }[] = [
    {
      type: 'quick_prep',
      label: 'Quick Prep',
      description: 'AI-generated prep packet with tailored questions & answers',
      icon: <Zap className="h-5 w-5" />,
    },
    {
      type: 'full_mock',
      label: 'Mock Interview',
      description: 'Text-based 10-question mock with real-time feedback',
      icon: <MessageSquare className="h-5 w-5" />,
    },
    {
      type: 'premium_audio',
      label: 'Audio Mock',
      description: 'Voice conversation with Sarah, our AI interviewer',
      icon: <Mic className="h-5 w-5" />,
    },
  ];

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-3">
        As a Pro subscriber, choose your interview experience:
      </p>
      
      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Loading session info...</span>
        </div>
      )}
      
      <div className="grid gap-2">
        {INTERVIEW_OPTIONS.map((option) => {
          const sessionInfo = getSessionInfo(option.type);
          const isOptionDisabled = disabled || sessionInfo.isDisabled;
          
          return (
            <button
              key={option.type}
              type="button"
              onClick={() => !isOptionDisabled && onSelect(option.type)}
              disabled={isOptionDisabled}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
                "hover:border-primary/50 hover:bg-primary/5",
                selectedType === option.type
                  ? "border-primary bg-primary/10 ring-1 ring-primary/20"
                  : "border-border bg-background",
                isOptionDisabled && "opacity-50 cursor-not-allowed hover:border-border hover:bg-background"
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center h-10 w-10 rounded-lg flex-shrink-0",
                  selectedType === option.type
                    ? "bg-primary text-primary-foreground"
                    : isOptionDisabled
                      ? "bg-muted text-muted-foreground"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {option.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={cn(
                    "font-semibold text-sm",
                    selectedType === option.type ? "text-primary" : "text-foreground"
                  )}>
                    {option.label}
                  </p>
                  {/* Session usage badge */}
                  {remainingSessions?.is_pro && (
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                      sessionInfo.isUnlimited
                        ? "bg-secondary/20 text-secondary"
                        : sessionInfo.remaining === 0
                          ? "bg-destructive/20 text-destructive"
                          : sessionInfo.remaining && sessionInfo.remaining <= 2
                            ? "bg-warning/20 text-warning"
                            : "bg-primary/20 text-primary"
                    )}>
                      {sessionInfo.isUnlimited 
                        ? "Unlimited" 
                        : sessionInfo.remaining === 0
                          ? `0 of ${sessionInfo.limit} left`
                          : `${sessionInfo.remaining} of ${sessionInfo.limit} left`
                      }
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {sessionInfo.isDisabled && sessionInfo.resetDate
                    ? option.type === 'full_mock'
                      ? `You've used all 6 Mock Interview sessions this month. Resets ${formatResetDate(sessionInfo.resetDate)}.`
                      : `You've used both Audio Mock sessions this month. Resets ${formatResetDate(sessionInfo.resetDate)}.`
                    : option.description
                  }
                </p>
              </div>
              <div
                className={cn(
                  "h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                  selectedType === option.type
                    ? "border-primary bg-primary"
                    : "border-muted-foreground"
                )}
              >
                {selectedType === option.type && (
                  <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
