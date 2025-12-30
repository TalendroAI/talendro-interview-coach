import { useEffect, useRef } from 'react';
import { Send, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

interface CompleteSessionButtonProps {
  onClick: () => void;
  isLoading: boolean;
  isDisabled: boolean;
  isCompleted: boolean;
  className?: string;
}

export function CompleteSessionButton({
  onClick,
  isLoading,
  isDisabled,
  isCompleted,
  className,
}: CompleteSessionButtonProps) {
  const hasTriggeredConfetti = useRef(false);

  // Fire confetti when session completes successfully
  useEffect(() => {
    if (isCompleted && !hasTriggeredConfetti.current) {
      hasTriggeredConfetti.current = true;
      
      // Fire confetti celebration from both sides
      const duration = 2500;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 4,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.6 },
          colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
        });
        confetti({
          particleCount: 4,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.6 },
          colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      
      frame();
    }
  }, [isCompleted]);

  return (
    <Button
      size="lg"
      className={cn(
        "font-semibold shadow-md transition-all",
        isCompleted
          ? "bg-secondary hover:bg-secondary/90 text-secondary-foreground cursor-default"
          : isDisabled
            ? "bg-muted text-muted-foreground cursor-not-allowed"
            : "bg-primary hover:bg-primary/90 text-primary-foreground hover:shadow-lg",
        className
      )}
      onClick={onClick}
      disabled={isDisabled || isLoading || isCompleted}
    >
      {isLoading ? (
        <>
          <span className="animate-spin mr-2">⏳</span>
          Sending Results...
        </>
      ) : isCompleted ? (
        <>
          <Check className="h-5 w-5 mr-2" />
          Results Sent!
        </>
      ) : (
        <>
          <Send className="h-5 w-5 mr-2" />
          Complete Session & Get Results
        </>
      )}
    </Button>
  );
}
