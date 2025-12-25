import { Save } from 'lucide-react';
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
}: DocumentSidebarProps) {
  const config = sessionType ? SESSION_CONFIGS[sessionType] : null;

  const isResumeComplete = documents.resume.trim().length > 50;
  const isJobComplete = documents.jobDescription.trim().length > 50;
  const isCompanyComplete = documents.companyUrl.trim().length > 5;
  const allComplete = isResumeComplete && isJobComplete;

  const canStart = allComplete && isPaymentVerified && !isSessionStarted && sessionType;

  const handleSaveDocuments = () => {
    if (onSaveDocuments) {
      onSaveDocuments();
    }
  };

  return (
    <aside className="w-full lg:w-[380px] bg-background border-r border-border flex flex-col h-full">
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
            <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
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
            className="min-h-[120px] resize-none border-border bg-background"
            disabled={isSessionStarted}
          />
          <div className="flex items-center gap-1.5 text-xs">
            <span className={cn(
              "h-2 w-2 rounded-full",
              isResumeComplete ? "bg-primary" : "bg-muted-foreground"
            )} />
            <span className="text-muted-foreground">
              {isResumeComplete ? 'Provided' : 'Not provided'}
            </span>
          </div>
        </div>

        {/* 2. Job Description Section */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
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
            className="min-h-[120px] resize-none border-border bg-background"
            disabled={isSessionStarted}
          />
          <div className="flex items-center gap-1.5 text-xs">
            <span className={cn(
              "h-2 w-2 rounded-full",
              isJobComplete ? "bg-primary" : "bg-muted-foreground"
            )} />
            <span className="text-muted-foreground">
              {isJobComplete ? 'Provided' : 'Not provided'}
            </span>
          </div>
        </div>

        {/* 3. Company URL Section */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
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
            className="border-border bg-background"
            disabled={isSessionStarted}
          />
          <div className="flex items-center gap-1.5 text-xs">
            <span className={cn(
              "h-2 w-2 rounded-full",
              isCompanyComplete ? "bg-primary" : "bg-muted-foreground"
            )} />
            <span className="text-muted-foreground">
              {isCompanyComplete ? 'Provided' : 'Not provided'}
            </span>
          </div>
        </div>

        {/* 4. Save Documents Button */}
        <div className="flex items-start gap-2">
          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold mt-1">
            4
          </span>
          <Button
            size="lg"
            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm hover:shadow-md transition-all"
            onClick={handleSaveDocuments}
            disabled={!allComplete || isSessionStarted}
          >
            <Save className="h-4 w-4 mr-2" />
            Save Documents & Prepare
          </Button>
        </div>
      </div>

      {/* YOUR SESSION Section */}
      <div className="border-t border-border">
        <div className="p-5 border-b border-border">
          <h2 className="font-extrabold text-sm uppercase tracking-wide text-foreground">
            Your Session
          </h2>
        </div>
        
        <div className="p-5 space-y-4">
          <div className="p-3 rounded-lg border border-border bg-background">
            <span className="text-primary font-semibold">
              {config?.name || 'Select a Session'}
            </span>
          </div>

          {/* 5. Start/Complete Session Button */}
          <div className="flex items-start gap-2">
            <span className="flex items-center justify-center h-6 w-6 rounded-full bg-destructive text-destructive-foreground text-xs font-bold mt-1">
              5
            </span>
            <Button
              variant={isSessionStarted ? "destructive" : "default"}
              size="lg"
              className={cn(
                "flex-1 font-semibold shadow-sm hover:shadow-md transition-all",
                !isSessionStarted && "bg-primary hover:bg-primary/90"
              )}
              onClick={onStartSession}
              disabled={!canStart || isLoading}
            >
              {isLoading ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Starting...
                </>
              ) : isSessionStarted ? (
                <>Complete Session</>
              ) : !isPaymentVerified ? (
                <>Payment Required</>
              ) : (
                <>Start {config?.name || 'Session'}</>
              )}
            </Button>
          </div>

          {!isPaymentVerified && !isSessionStarted && (
            <p className="text-xs text-destructive text-center font-medium">
              Please complete your purchase to start
            </p>
          )}
          
          {isPaymentVerified && !allComplete && !isSessionStarted && (
            <p className="text-xs text-muted-foreground text-center">
              Please complete all required fields
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}