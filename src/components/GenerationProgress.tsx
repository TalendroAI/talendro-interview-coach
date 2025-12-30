import { useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProgressStep {
  label: string;
  description: string;
  minPercent: number;
  maxPercent: number;
}

interface GenerationProgressProps {
  isActive: boolean;
  companyUrl?: string;
  sessionType?: 'quick_prep' | 'full_mock' | 'premium_audio' | 'pro';
  estimatedDuration?: number; // in seconds
}

export function GenerationProgress({
  isActive,
  companyUrl,
  sessionType = 'quick_prep',
  estimatedDuration = 75, // default 75 seconds
}: GenerationProgressProps) {
  const [progress, setProgress] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Extract company name from URL
  const extractCompanyName = (url: string): string => {
    if (!url) return 'the company';
    try {
      const domain = url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      const name = domain.split('.')[0];
      return name.charAt(0).toUpperCase() + name.slice(1);
    } catch {
      return 'the company';
    }
  };

  const companyName = extractCompanyName(companyUrl || '');

  const steps: ProgressStep[] = [
    {
      label: 'Analyzing Documents',
      description: 'Reading your resume and job description...',
      minPercent: 0,
      maxPercent: 10,
    },
    {
      label: `Researching ${companyName}`,
      description: `Gathering insights about ${companyName}'s culture and values...`,
      minPercent: 10,
      maxPercent: 30,
    },
    {
      label: 'Analyzing Role Requirements',
      description: 'Identifying key skills and qualifications needed...',
      minPercent: 30,
      maxPercent: 50,
    },
    {
      label: 'Building Your Prep Packet',
      description: 'Creating personalized talking points and strategies...',
      minPercent: 50,
      maxPercent: 80,
    },
    {
      label: 'Finalizing Strategy',
      description: 'Polishing your interview preparation materials...',
      minPercent: 80,
      maxPercent: 95,
    },
    {
      label: 'Complete!',
      description: 'Your personalized prep packet is ready!',
      minPercent: 95,
      maxPercent: 100,
    },
  ];

  useEffect(() => {
    if (!isActive) {
      setProgress(0);
      setCurrentStepIndex(0);
      return;
    }

    const intervalMs = 100; // Update every 100ms for smooth animation
    const totalIntervals = (estimatedDuration * 1000) / intervalMs;
    let currentInterval = 0;

    // Calculate step durations proportionally
    const stepDurations = [
      0.1,  // Step 1: 10%
      0.2,  // Step 2: 20%
      0.2,  // Step 3: 20%
      0.3,  // Step 4: 30%
      0.15, // Step 5: 15%
      0.05, // Step 6: 5%
    ];

    const interval = setInterval(() => {
      currentInterval++;
      
      // Calculate current progress percentage
      const rawProgress = (currentInterval / totalIntervals) * 95; // Max out at 95% until complete
      
      // Add some randomness to make it feel more natural
      const jitter = Math.random() * 2 - 1; // -1 to 1
      const adjustedProgress = Math.min(95, Math.max(0, rawProgress + jitter * 0.5));
      
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
  }, [isActive, estimatedDuration]);

  // When content is generated, jump to 100%
  useEffect(() => {
    if (!isActive && progress > 0) {
      setProgress(100);
      setCurrentStepIndex(steps.length - 1);
    }
  }, [isActive]);

  const currentStep = steps[currentStepIndex];

  return (
    <div className="flex-1 flex items-center justify-center p-8 bg-gradient-to-b from-background to-muted/30">
      <div className="w-full max-w-2xl mx-auto">
        {/* Main Card */}
        <div className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-primary/5 border-b border-border px-8 py-6">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-xl bg-primary flex items-center justify-center animate-pulse">
                <span className="text-2xl">⚡</span>
              </div>
              <div>
                <h2 className="font-heading text-2xl font-bold text-foreground">
                  Generating Your Prep Materials
                </h2>
                <p className="text-muted-foreground mt-1">
                  This usually takes 60-90 seconds
                </p>
              </div>
            </div>
          </div>

          {/* Progress Section */}
          <div className="px-8 py-8">
            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
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
                  className="h-3 bg-muted"
                />
                {/* Animated glow effect */}
                <div 
                  className="absolute top-0 left-0 h-3 rounded-full bg-gradient-to-r from-primary to-primary/50 opacity-50 blur-sm transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Current Step Description */}
            <div className="bg-primary/5 rounded-xl p-4 mb-8 border border-primary/10">
              <p className="text-foreground text-center font-medium animate-pulse">
                {currentStep.description}
              </p>
            </div>

            {/* Steps Timeline */}
            <div className="space-y-3">
              {steps.slice(0, -1).map((step, idx) => {
                const isCompleted = progress >= step.maxPercent;
                const isCurrent = idx === currentStepIndex;
                
                return (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-center gap-4 p-3 rounded-lg transition-all duration-300",
                      isCompleted && "bg-green-50 dark:bg-green-950/20",
                      isCurrent && !isCompleted && "bg-primary/5 border border-primary/20"
                    )}
                  >
                    <div
                      className={cn(
                        "flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300",
                        isCompleted
                          ? "bg-green-500 text-white"
                          : isCurrent
                          ? "bg-primary text-primary-foreground animate-pulse"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {isCompleted ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-sm font-medium transition-colors duration-300",
                        isCompleted
                          ? "text-green-700 dark:text-green-400"
                          : isCurrent
                          ? "text-foreground"
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
              💡 <strong>Tip:</strong> Our AI is analyzing your resume, the job description, 
              and company to create personalized interview preparation materials.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
