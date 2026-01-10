import { useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import sarahHeadshot from '@/assets/sarah-headshot.jpg';

interface ProgressStep {
  label: string;
  description: string;
  minPercent: number;
  maxPercent: number;
}

interface PrepPacketGeneratingOverlayProps {
  isActive: boolean;
  companyUrl?: string;
}

export function PrepPacketGeneratingOverlay({
  isActive,
  companyUrl,
}: PrepPacketGeneratingOverlayProps) {
  const [progress, setProgress] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Extract company name from URL
  const extractCompanyName = (url: string): string => {
    if (!url) return 'your target company';
    try {
      const domain = url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      const name = domain.split('.')[0];
      return name.charAt(0).toUpperCase() + name.slice(1);
    } catch {
      return 'your target company';
    }
  };

  const companyName = extractCompanyName(companyUrl || '');

  const steps: ProgressStep[] = [
    {
      label: 'Reading Your Resume',
      description: 'Sarah is reviewing your experience and skills...',
      minPercent: 0,
      maxPercent: 15,
    },
    {
      label: 'Analyzing Job Requirements',
      description: 'Matching your background to the role...',
      minPercent: 15,
      maxPercent: 35,
    },
    {
      label: `Researching ${companyName}`,
      description: `Gathering insights about ${companyName}'s culture...`,
      minPercent: 35,
      maxPercent: 55,
    },
    {
      label: 'Preparing Personalized Questions',
      description: 'Creating interview questions tailored to you...',
      minPercent: 55,
      maxPercent: 80,
    },
    {
      label: 'Finalizing Your Prep Packet',
      description: 'Almost ready to begin your interview...',
      minPercent: 80,
      maxPercent: 95,
    },
  ];

  useEffect(() => {
    if (!isActive) {
      setProgress(0);
      setCurrentStepIndex(0);
      return;
    }

    const estimatedDuration = 30; // 30 seconds for prep packet generation
    const intervalMs = 100;
    const totalIntervals = (estimatedDuration * 1000) / intervalMs;
    let currentInterval = 0;

    const interval = setInterval(() => {
      currentInterval++;
      
      // Calculate current progress - max at 92% until complete
      const rawProgress = (currentInterval / totalIntervals) * 92;
      
      // Add slight randomness for natural feel
      const jitter = Math.random() * 1.5 - 0.75;
      const adjustedProgress = Math.min(92, Math.max(0, rawProgress + jitter * 0.3));
      
      setProgress(adjustedProgress);
      
      // Determine current step based on progress
      const stepIndex = steps.findIndex(
        (step, idx) =>
          adjustedProgress >= step.minPercent &&
          (idx === steps.length - 1 || adjustedProgress < steps[idx + 1].minPercent)
      );
      if (stepIndex !== -1 && stepIndex !== currentStepIndex) {
        setCurrentStepIndex(stepIndex);
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isActive]);

  // When generation completes, jump to 100%
  useEffect(() => {
    if (!isActive && progress > 0) {
      setProgress(100);
      setCurrentStepIndex(steps.length - 1);
    }
  }, [isActive, progress]);

  if (!isActive) return null;

  const currentStep = steps[currentStepIndex];

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg mx-auto">
        {/* Main Card */}
        <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
          {/* Header with Sarah's Photo */}
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 border-b border-border px-8 py-8 text-center">
            <div className="relative inline-block mb-4">
              <Avatar className="h-24 w-24 ring-4 ring-primary/20 shadow-xl">
                <AvatarImage src={sarahHeadshot} alt="Sarah" />
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                  S
                </AvatarFallback>
              </Avatar>
              {/* Animated pulse ring */}
              <div className="absolute inset-0 rounded-full ring-4 ring-primary/30 animate-ping opacity-30" />
            </div>
            <h2 className="font-heading text-2xl font-bold text-foreground mb-2">
              Preparing your interview...
            </h2>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Sarah is reviewing your materials and preparing personalized questions. This takes about 30 seconds.
            </p>
          </div>

          {/* Progress Section */}
          <div className="px-8 py-6">
            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">
                  {currentStep.label}
                </span>
                <span className="text-sm font-bold text-primary">
                  {Math.round(progress)}%
                </span>
              </div>
              <div className="relative">
                <Progress 
                  value={progress} 
                  className="h-2.5 bg-muted"
                />
              </div>
            </div>

            {/* Current Step Description */}
            <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
              <p className="text-foreground text-center font-medium">
                <span className="inline-block animate-pulse">
                  {currentStep.description}
                </span>
              </p>
            </div>

            {/* Steps List */}
            <div className="mt-6 space-y-2">
              {steps.map((step, idx) => {
                const isCompleted = progress >= step.maxPercent;
                const isCurrent = idx === currentStepIndex;
                
                return (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-center gap-3 p-2.5 rounded-lg transition-all duration-300",
                      isCompleted && "bg-green-50 dark:bg-green-950/20",
                      isCurrent && !isCompleted && "bg-primary/5"
                    )}
                  >
                    <div
                      className={cn(
                        "flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300",
                        isCompleted
                          ? "bg-green-500 text-white"
                          : isCurrent
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {isCompleted ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-sm transition-colors duration-300",
                        isCompleted
                          ? "text-green-700 dark:text-green-400 font-medium"
                          : isCurrent
                          ? "text-foreground font-medium"
                          : "text-muted-foreground"
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="bg-muted/30 border-t border-border px-8 py-4">
            <p className="text-center text-sm text-muted-foreground">
              ✨ You'll receive a complete prep packet with your results after the interview
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
