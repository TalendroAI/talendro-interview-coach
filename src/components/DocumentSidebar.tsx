import { Save, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DocumentInputs, SessionType, SESSION_CONFIGS } from '@/types/session';
import { cn } from '@/lib/utils';

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
}: DocumentSidebarProps) {
  const config = sessionType ? SESSION_CONFIGS[sessionType] : null;

  const isResumeComplete = documents.resume.trim().length > 50;
  const isJobComplete = documents.jobDescription.trim().length > 50;
  const isCompanyComplete = documents.companyUrl.trim().length > 5;
  const allFieldsComplete = isResumeComplete && isJobComplete && isCompanyComplete;

  const canSaveDocuments = allFieldsComplete && !isDocumentsSaved;
  const canCompleteSession = isContentReady && sessionType;

  const handleSaveDocuments = () => {
    if (onSaveDocuments) {
      onSaveDocuments();
    }
  };

  return (
    <aside className="w-full lg:w-[380px] bg-soft border-r border-border flex flex-col h-full">
      {/* YOUR DOCUMENTS Section */}
      <div className="p-5 border-b border-border">
        <h2 className="font-extrabold text-sm uppercase tracking-wide text-foreground">
          Your Documents
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* 1. Resume Section */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={cn(
              "flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold transition-all duration-300",
              isResumeComplete 
                ? "bg-secondary text-secondary-foreground scale-110 shadow-sm" 
                : "bg-primary text-primary-foreground"
            )}>
              1
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

        {/* 2. Job Description Section */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={cn(
              "flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold transition-all duration-300",
              isJobComplete 
                ? "bg-secondary text-secondary-foreground scale-110 shadow-sm" 
                : "bg-primary text-primary-foreground"
            )}>
              2
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

        {/* 3. Company URL Section */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={cn(
              "flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold transition-all duration-300",
              isCompanyComplete 
                ? "bg-secondary text-secondary-foreground scale-110 shadow-sm" 
                : "bg-primary text-primary-foreground"
            )}>
              3
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

        {/* 4. Save Documents Button */}
        <div className="flex items-start gap-2">
          <span className={cn(
            "flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold mt-1 transition-all duration-300",
            isDocumentsSaved 
              ? "bg-secondary text-secondary-foreground scale-110 shadow-sm" 
              : "bg-primary text-primary-foreground"
          )}>
            4
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
      </div>

      <div className="border-t border-border p-5">
        <div className="flex items-start gap-2">
          <span className={cn(
            "flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold mt-1 transition-all duration-300",
            isContentReady 
              ? "bg-secondary text-secondary-foreground scale-110 shadow-sm" 
              : "bg-primary text-primary-foreground"
          )}>
            5
          </span>
          <Button
            size="default"
            className="flex-1 px-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm hover:shadow-md transition-all disabled:bg-muted disabled:text-muted-foreground"
            onClick={onStartSession}
            disabled={!canCompleteSession || isLoading}
          >
            {isLoading ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Sending Results...
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