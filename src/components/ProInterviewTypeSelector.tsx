import { Zap, MessageSquare, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ProInterviewType = 'quick_prep' | 'full_mock' | 'premium_audio';

interface ProInterviewTypeSelectorProps {
  selectedType: ProInterviewType | null;
  onSelect: (type: ProInterviewType) => void;
  disabled?: boolean;
}

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

export function ProInterviewTypeSelector({
  selectedType,
  onSelect,
  disabled = false,
}: ProInterviewTypeSelectorProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-3">
        As a Pro subscriber, choose your interview experience:
      </p>
      <div className="grid gap-2">
        {INTERVIEW_OPTIONS.map((option) => (
          <button
            key={option.type}
            type="button"
            onClick={() => !disabled && onSelect(option.type)}
            disabled={disabled}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
              "hover:border-primary/50 hover:bg-primary/5",
              selectedType === option.type
                ? "border-primary bg-primary/10 ring-1 ring-primary/20"
                : "border-border bg-background",
              disabled && "opacity-50 cursor-not-allowed hover:border-border hover:bg-background"
            )}
          >
            <div
              className={cn(
                "flex items-center justify-center h-10 w-10 rounded-lg",
                selectedType === option.type
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {option.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn(
                "font-semibold text-sm",
                selectedType === option.type ? "text-primary" : "text-foreground"
              )}>
                {option.label}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {option.description}
              </p>
            </div>
            <div
              className={cn(
                "h-4 w-4 rounded-full border-2 flex items-center justify-center",
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
        ))}
      </div>
    </div>
  );
}
