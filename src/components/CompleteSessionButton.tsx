import { Send, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
