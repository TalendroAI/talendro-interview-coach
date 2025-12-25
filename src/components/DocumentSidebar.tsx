import { useState } from 'react';
import { FileText, Briefcase, Building2, ChevronDown, ChevronUp, Check } from 'lucide-react';
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
}

export function DocumentSidebar({
  documents,
  onDocumentsChange,
  onStartSession,
  isLoading,
  sessionType,
  isSessionStarted,
}: DocumentSidebarProps) {
  const [expandedSection, setExpandedSection] = useState<'resume' | 'job' | 'company' | null>('resume');
  
  const config = sessionType ? SESSION_CONFIGS[sessionType] : null;

  const isResumeComplete = documents.resume.trim().length > 50;
  const isJobComplete = documents.jobDescription.trim().length > 50;
  const isCompanyComplete = documents.companyUrl.trim().length > 5;
  const allComplete = isResumeComplete && isJobComplete && isCompanyComplete;

  const toggleSection = (section: 'resume' | 'job' | 'company') => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const getButtonVariant = () => {
    if (!sessionType) return 'default';
    return config?.badgeVariant || 'default';
  };

  return (
    <aside className="w-full lg:w-96 bg-card border-r border-border flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h2 className="font-heading font-semibold text-lg text-foreground">Your Documents</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Provide your materials for personalized coaching
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Resume Section */}
        <div className="rounded-lg border border-border bg-background overflow-hidden">
          <button
            onClick={() => toggleSection('resume')}
            className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-8 w-8 rounded-lg flex items-center justify-center",
                isResumeComplete ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}>
                {isResumeComplete ? <Check className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
              </div>
              <div className="text-left">
                <span className="font-medium text-foreground">Resume</span>
                <p className="text-xs text-muted-foreground">
                  {isResumeComplete ? 'Added' : 'Required'}
                </p>
              </div>
            </div>
            {expandedSection === 'resume' ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          
          {expandedSection === 'resume' && (
            <div className="p-4 pt-0 animate-fade-in">
              <Label htmlFor="resume" className="sr-only">Resume Text</Label>
              <Textarea
                id="resume"
                placeholder="Paste your resume text here..."
                value={documents.resume}
                onChange={(e) => onDocumentsChange({ ...documents, resume: e.target.value })}
                className="min-h-[200px] resize-none"
                disabled={isSessionStarted}
              />
            </div>
          )}
        </div>

        {/* Job Description Section */}
        <div className="rounded-lg border border-border bg-background overflow-hidden">
          <button
            onClick={() => toggleSection('job')}
            className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-8 w-8 rounded-lg flex items-center justify-center",
                isJobComplete ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}>
                {isJobComplete ? <Check className="h-4 w-4" /> : <Briefcase className="h-4 w-4" />}
              </div>
              <div className="text-left">
                <span className="font-medium text-foreground">Job Description</span>
                <p className="text-xs text-muted-foreground">
                  {isJobComplete ? 'Added' : 'Required'}
                </p>
              </div>
            </div>
            {expandedSection === 'job' ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          
          {expandedSection === 'job' && (
            <div className="p-4 pt-0 animate-fade-in">
              <Label htmlFor="jobDescription" className="sr-only">Job Description</Label>
              <Textarea
                id="jobDescription"
                placeholder="Paste the job description here..."
                value={documents.jobDescription}
                onChange={(e) => onDocumentsChange({ ...documents, jobDescription: e.target.value })}
                className="min-h-[200px] resize-none"
                disabled={isSessionStarted}
              />
            </div>
          )}
        </div>

        {/* Company URL Section */}
        <div className="rounded-lg border border-border bg-background overflow-hidden">
          <button
            onClick={() => toggleSection('company')}
            className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-8 w-8 rounded-lg flex items-center justify-center",
                isCompanyComplete ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}>
                {isCompanyComplete ? <Check className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
              </div>
              <div className="text-left">
                <span className="font-medium text-foreground">Company URL</span>
                <p className="text-xs text-muted-foreground">
                  {isCompanyComplete ? 'Added' : 'Optional'}
                </p>
              </div>
            </div>
            {expandedSection === 'company' ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          
          {expandedSection === 'company' && (
            <div className="p-4 pt-0 animate-fade-in">
              <Label htmlFor="companyUrl" className="sr-only">Company Website URL</Label>
              <Input
                id="companyUrl"
                type="url"
                placeholder="https://company.com"
                value={documents.companyUrl}
                onChange={(e) => onDocumentsChange({ ...documents, companyUrl: e.target.value })}
                disabled={isSessionStarted}
              />
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-border bg-muted/30">
        <Button
          variant={getButtonVariant()}
          size="lg"
          className="w-full"
          onClick={onStartSession}
          disabled={!allComplete || isLoading || isSessionStarted || !sessionType}
        >
          {isLoading ? (
            <>
              <span className="animate-spin mr-2">⏳</span>
              Starting...
            </>
          ) : isSessionStarted ? (
            <>Session in Progress</>
          ) : (
            <>Start {config?.name || 'Session'}</>
          )}
        </Button>
        
        {!allComplete && !isSessionStarted && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            Please complete all required fields
          </p>
        )}
      </div>
    </aside>
  );
}
