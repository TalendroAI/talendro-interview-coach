import { useEffect, useRef } from 'react';
import { Save, Send, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { DocumentInputs, SessionType, SESSION_CONFIGS } from '@/types/session';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';
import { ProInterviewTypeSelector, ProInterviewType } from './ProInterviewTypeSelector';

interface DocumentSidebarProps {
  documents: DocumentInputs;
  onDocumentsChange: (documents: DocumentInputs) => void;
  onStartSession: () => void;
  isLoading: boolean;
  sessionType: SessionType | null;
  isSessionStarted: boolean;
  isPaymentVerified?: boolean;
  onSaveDocuments?: () => void;
  isDocumentsSaved?: boolean;
  isContentReady?: boolean;
  isSessionCompleted?: boolean;
  // Pro-specific props
  selectedProInterviewType?: ProInterviewType | null;
  onProInterviewTypeSelect?: (type: ProInterviewType) => void;
}

export function DocumentSidebar({
  documents,
  onDocumentsChange,
  onStartSession,
  isLoading,
  sessionType,
  isSessionStarted,
  isPaymentVerified = false,
  onSaveDocuments,
  isDocumentsSaved = false,
  isContentReady = false,
  isSessionCompleted = false,
  selectedProInterviewType,
  onProInterviewTypeSelect,
}: DocumentSidebarProps) {
  const config = sessionType ? SESSION_CONFIGS[sessionType] : null;
  const isPro = sessionType === 'pro';
  const isAudio = sessionType === 'premium_audio';
  const totalSteps = isPro ? 7 : (isAudio ? 6 : 5);

  const isFirstNameComplete = documents.firstName.trim().length >= 1;
  const isResumeComplete = documents.resume.trim().length > 50;
  const isJobComplete = documents.jobDescription.trim().length > 50;
  const isCompanyComplete = documents.companyUrl.trim().length > 5;
  // For audio sessions, firstName is required
  const allFieldsComplete = isResumeComplete && isJobComplete && isCompanyComplete && (isAudio ? isFirstNameComplete : true);
  const isProTypeSelected = isPro ? !!selectedProInterviewType : true;

  const canSaveDocuments = allFieldsComplete && !isDocumentsSaved;
  const canCompleteSession = isContentReady && sessionType && isProTypeSelected;

  // Calculate progress percentage
  const completedSteps = [
    ...(isAudio ? [isFirstNameComplete] : []),
    isResumeComplete,
    isJobComplete,
    isCompanyComplete,
    isDocumentsSaved,
    ...(isPro ? [isProTypeSelected && isDocumentsSaved] : []),
    isContentReady
  ].filter(Boolean).length;
  const progressPercentage = (completedSteps / totalSteps) * 100;
  const hasTriggeredConfetti = useRef(false);

  // Trigger confetti when all steps are complete
  useEffect(() => {
    if (completedSteps === 5 && !hasTriggeredConfetti.current) {
      hasTriggeredConfetti.current = true;
      
      // Fire confetti from both sides
      const duration = 2000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.6 },
          colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
        });
        confetti({
          particleCount: 3,
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
    } else if (completedSteps < 5) {
      hasTriggeredConfetti.current = false;
    }
  }, [completedSteps]);

  const handleSaveDocuments = () => {
    if (onSaveDocuments) {
      onSaveDocuments();
    }
  };

  return (
    <aside className="w-full lg:w-[380px] bg-soft border-r border-border flex flex-col h-full">
      {/* YOUR DOCUMENTS Section with Progress */}
      <div className="p-5 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-extrabold text-sm uppercase tracking-wide text-foreground">
            Your Documents
          </h2>
          <span className="text-xs font-medium text-muted-foreground">
            {completedSteps}/{totalSteps} complete
          </span>
        </div>
        <div className="space-y-1">
          <Progress 
            value={progressPercentage} 
            className="h-2 bg-muted"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* First Name Section - Only for Audio Mock */}
        {isAudio && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={cn(
                "flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold transition-all duration-300",
                isFirstNameComplete 
                  ? "bg-secondary text-secondary-foreground scale-110 shadow-sm" 
                  : "bg-primary text-primary-foreground"
              )}>
                {isFirstNameComplete ? <Check className="h-3.5 w-3.5" /> : "1"}
              </span>
              <Label htmlFor="firstName" className="font-semibold text-foreground">
                First/Preferred Name <span className="text-destructive">*</span>
              </Label>
            </div>
            <Input
              id="firstName"
              type="text"
              placeholder="What should Sarah call you?"
              value={documents.firstName}
              onChange={(e) => onDocumentsChange({ ...documents, firstName: e.target.value })}
              className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary"
              disabled={isSessionStarted}
            />
            <div className="flex items-center gap-1.5 text-xs">
              <span className={cn(
                "h-2 w-2 rounded-full",
                isFirstNameComplete ? "bg-secondary" : "bg-background/30"
              )} />
              <span className="text-muted-foreground">
                {isFirstNameComplete ? 'Provided' : 'Required for personalized greeting'}
              </span>
            </div>
          </div>
        )}

        {/* Resume Section */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={cn(
              "flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold transition-all duration-300",
              isResumeComplete 
                ? "bg-secondary text-secondary-foreground scale-110 shadow-sm" 
                : "bg-primary text-primary-foreground"
            )}>
              {isResumeComplete ? <Check className="h-3.5 w-3.5" /> : (isAudio ? "2" : "1")}
            </span>
            <Label htmlFor="resume" className="font-semibold text-foreground">
              Résumé
            </Label>
          </div>
          <Textarea
            id="resume"
            placeholder="Paste your résumé text here..."
            value={documents.resume}
            onChange={(e) => onDocumentsChange({ ...documents, resume: e.target.value })}
            className="min-h-[120px] resize-none border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary"
            disabled={isSessionStarted}
          />
          <div className="flex items-center gap-1.5 text-xs">
            <span className={cn(
              "h-2 w-2 rounded-full",
              isResumeComplete ? "bg-secondary" : "bg-background/30"
            )} />
            <span className="text-muted-foreground">
              {isResumeComplete ? 'Provided' : 'Not provided'}
            </span>
          </div>
        </div>

        {/* Job Description Section */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={cn(
              "flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold transition-all duration-300",
              isJobComplete 
                ? "bg-secondary text-secondary-foreground scale-110 shadow-sm" 
                : "bg-primary text-primary-foreground"
            )}>
              {isJobComplete ? <Check className="h-3.5 w-3.5" /> : (isAudio ? "3" : "2")}
            </span>
            <Label htmlFor="jobDescription" className="font-semibold text-foreground">
              Job Description
            </Label>
          </div>
          <Textarea
            id="jobDescription"
            placeholder="Paste the job description text here..."
            value={documents.jobDescription}
            onChange={(e) => onDocumentsChange({ ...documents, jobDescription: e.target.value })}
            className="min-h-[120px] resize-none border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary"
            disabled={isSessionStarted}
          />
          <div className="flex items-center gap-1.5 text-xs">
            <span className={cn(
              "h-2 w-2 rounded-full",
              isJobComplete ? "bg-secondary" : "bg-background/30"
            )} />
            <span className="text-muted-foreground">
              {isJobComplete ? 'Provided' : 'Not provided'}
            </span>
          </div>
        </div>

        {/* Company URL Section */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={cn(
              "flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold transition-all duration-300",
              isCompanyComplete 
                ? "bg-secondary text-secondary-foreground scale-110 shadow-sm" 
                : "bg-primary text-primary-foreground"
            )}>
              {isCompanyComplete ? <Check className="h-3.5 w-3.5" /> : (isAudio ? "4" : "3")}
            </span>
            <Label htmlFor="companyUrl" className="font-semibold text-foreground">
              Company Website URL
            </Label>
          </div>
          <Input
            id="companyUrl"
            type="url"
            placeholder="https://company.com"
            value={documents.companyUrl}
            onChange={(e) => onDocumentsChange({ ...documents, companyUrl: e.target.value })}
            className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary"
            disabled={isSessionStarted}
          />
          <div className="flex items-center gap-1.5 text-xs">
            <span className={cn(
              "h-2 w-2 rounded-full",
              isCompanyComplete ? "bg-secondary" : "bg-background/30"
            )} />
            <span className="text-muted-foreground">
              {isCompanyComplete ? 'Provided' : 'Not provided'}
            </span>
          </div>
        </div>

        {/* Save Documents Button */}
        <div className="flex items-start gap-2">
          <span className={cn(
            "flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold mt-1 transition-all duration-300",
            isDocumentsSaved 
              ? "bg-secondary text-secondary-foreground scale-110 shadow-sm" 
              : "bg-primary text-primary-foreground"
          )}>
            {isDocumentsSaved ? <Check className="h-3.5 w-3.5" /> : (isAudio ? "5" : "4")}
          </span>
          <Button
            size="default"
            className="flex-1 px-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm hover:shadow-md transition-all disabled:bg-muted disabled:text-muted-foreground"
            onClick={handleSaveDocuments}
            disabled={!canSaveDocuments}
          >
            <Save className="h-4 w-4 mr-2" />
            Save Documents & Proceed
          </Button>
        </div>

        {/* Pro Interview Type Selector (Pro only) */}
        {isPro && isDocumentsSaved && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={cn(
                "flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold transition-all duration-300",
                selectedProInterviewType 
                  ? "bg-secondary text-secondary-foreground scale-110 shadow-sm" 
                  : "bg-primary text-primary-foreground"
              )}>
                {selectedProInterviewType ? <Check className="h-3.5 w-3.5" /> : "6"}
              </span>
              <Label className="font-semibold text-foreground">
                Select Interview Type
              </Label>
            </div>
            <div className="ml-8">
              <ProInterviewTypeSelector
                selectedType={selectedProInterviewType ?? null}
                onSelect={onProInterviewTypeSelect ?? (() => {})}
                disabled={isSessionStarted}
              />
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border p-5">
        <div className="flex items-start gap-2">
          <span className={cn(
            "flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold mt-1 transition-all duration-300",
            isSessionCompleted
              ? "bg-secondary text-secondary-foreground scale-110 shadow-sm"
              : isContentReady 
                ? "bg-secondary text-secondary-foreground scale-110 shadow-sm" 
                : "bg-muted text-muted-foreground"
          )}>
            {isSessionCompleted ? <Check className="h-3.5 w-3.5" /> : isContentReady ? <Check className="h-3.5 w-3.5" /> : (isPro ? "7" : (isAudio ? "6" : "5"))}
          </span>
          <Button
            size="default"
            className={cn(
              "flex-1 px-3 font-semibold shadow-sm transition-all",
              isSessionCompleted
                ? "bg-secondary hover:bg-secondary/90 text-secondary-foreground cursor-default"
                : canCompleteSession
                  ? "bg-primary hover:bg-primary/90 text-primary-foreground hover:shadow-md"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
            onClick={onStartSession}
            disabled={!canCompleteSession || isLoading || isSessionCompleted}
          >
            {isLoading ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Sending Results...
              </>
            ) : isSessionCompleted ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Results Sent!
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Complete Session & Get Results
              </>
            )}
          </Button>
        </div>

        {!isPaymentVerified && !isSessionStarted && (
          <p className="text-xs text-destructive text-center font-medium mt-4">
            Please complete your purchase to start
          </p>
        )}
        
        {isSessionStarted && !canCompleteSession && sessionType === 'full_mock' && (
          <p className="text-xs text-muted-foreground text-center mt-4">
            Complete all interview questions to unlock your results
          </p>
        )}
        
        {isSessionStarted && !canCompleteSession && sessionType === 'premium_audio' && (
          <p className="text-xs text-muted-foreground text-center mt-4">
            Complete your voice interview to unlock your results
          </p>
        )}
      </div>
    </aside>
  );
}