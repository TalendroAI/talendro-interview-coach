import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Header } from '@/components/Header';
import { DocumentSidebar } from '@/components/DocumentSidebar';
import { WelcomeMessage } from '@/components/WelcomeMessage';
import { ChatInterface } from '@/components/ChatInterface';
import { AudioInterface } from '@/components/AudioInterface';
import { QuickPrepContent } from '@/components/QuickPrepContent';
import { SessionCompletedDialog } from '@/components/SessionCompletedDialog';
import { useSessionParams } from '@/hooks/useSessionParams';
import { DocumentInputs } from '@/types/session';
import { useToast } from '@/hooks/use-toast';
import { verifyPayment } from '@/services/api';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
export default function InterviewCoach() {
  const { sessionType, userEmail } = useSessionParams();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const [documents, setDocuments] = useState<DocumentInputs>({
    resume: '',
    jobDescription: '',
    companyUrl: '',
  });
  const [isSessionStarted, setIsSessionStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isPaymentVerified, setIsPaymentVerified] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [isDocumentsSaved, setIsDocumentsSaved] = useState(false);
  
  // Quick Prep content state
  const [quickPrepContent, setQuickPrepContent] = useState<string | null>(null);
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  
  // Completed session dialog state
  const [showCompletedDialog, setShowCompletedDialog] = useState(false);
  const [completedSessionResults, setCompletedSessionResults] = useState<any>(null);

  // Check if documents are ready
  const isResumeComplete = documents.resume.trim().length > 50;
  const isJobComplete = documents.jobDescription.trim().length > 50;
  const isDocumentsReady = isResumeComplete && isJobComplete && isDocumentsSaved;

  const handleSaveDocuments = async () => {
    if (isResumeComplete && isJobComplete) {
      setIsDocumentsSaved(true);
      
      // For quick_prep, generate content immediately
      if (isPaymentVerified && sessionType === 'quick_prep' && sessionId) {
        setIsGeneratingContent(true);
        setContentError(null);
        setIsSessionStarted(true);
        
        try {
          const { data, error } = await supabase.functions.invoke('ai-coach', {
            body: {
              session_id: sessionId,
              session_type: sessionType,
              resume: documents.resume,
              job_description: documents.jobDescription,
              company_url: documents.companyUrl,
              is_initial: true
            }
          });
          
          if (error) {
            throw new Error(error.message || 'Failed to generate content');
          }
          
          if (data?.message) {
            setQuickPrepContent(data.message);
          } else {
            throw new Error('No content received from AI');
          }
        } catch (err) {
          console.error('Error generating Quick Prep content:', err);
          setContentError(err instanceof Error ? err.message : 'Failed to generate content');
        } finally {
          setIsGeneratingContent(false);
        }
      } else if (isPaymentVerified && sessionType) {
        // For other session types, just start the session
        setIsLoading(true);
        setTimeout(() => {
          setIsSessionStarted(true);
          setIsLoading(false);
          toast({
            title: 'Session started!',
            description: 'Your personalized coaching session has begun.',
          });
        }, 500);
      }
    }
  };

  // Verify payment on page load
  useEffect(() => {
    const checkPayment = async () => {
      const checkoutSessionId = searchParams.get('checkout_session_id');
      
      if (!sessionType || !userEmail) {
        setIsVerifying(false);
        return;
      }

      try {
        const result = await verifyPayment(
          checkoutSessionId || undefined,
          userEmail,
          sessionType
        );

        if (result.verified && result.session) {
          setIsPaymentVerified(true);
          setSessionId(result.session.id);
          toast({
            title: 'Payment verified!',
            description: 'Your session is ready to begin.',
          });
        } else if (result.session_status === 'completed') {
          // Session was already completed - show the dialog
          setCompletedSessionResults(result.session_results);
          setShowCompletedDialog(true);
        } else {
          toast({
            title: 'Payment not found',
            description: 'Please complete your purchase to access this session.',
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('Payment verification error:', error);
        toast({
          title: 'Verification error',
          description: 'Could not verify your payment. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsVerifying(false);
      }
    };

    checkPayment();
  }, [sessionType, userEmail, searchParams]);

  const handleStartSession = async () => {
    if (!sessionType) {
      toast({
        title: 'Session type required',
        description: 'Please access this page with a valid session type parameter.',
        variant: 'destructive',
      });
      return;
    }

    if (!isPaymentVerified) {
      toast({
        title: 'Payment required',
        description: 'Please complete your purchase to start a session.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    
    // Start the session
    setTimeout(() => {
      setIsSessionStarted(true);
      setIsLoading(false);
      toast({
        title: 'Session started!',
        description: 'Your personalized coaching session has begun.',
      });
    }, 500);
  };

  const renderMainContent = () => {
    if (isVerifying) {
      return (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <h2 className="font-heading text-xl font-semibold text-foreground mb-2">
              Verifying your session...
            </h2>
            <p className="text-muted-foreground">
              Please wait while we confirm your payment.
            </p>
          </div>
        </div>
      );
    }

    if (!isSessionStarted) {
      return (
        <WelcomeMessage 
          sessionType={sessionType} 
          userEmail={userEmail}
          isPaymentVerified={isPaymentVerified}
          isReady={isDocumentsReady}
          onStartSession={handleStartSession}
        />
      );
    }

    // For quick_prep, show the generated content
    if (sessionType === 'quick_prep') {
      return (
        <QuickPrepContent 
          content={quickPrepContent}
          isLoading={isGeneratingContent}
          error={contentError}
        />
      );
    }

    if (sessionType === 'premium_audio') {
      return (
        <AudioInterface 
          isActive={isSessionStarted} 
          sessionId={sessionId}
          documents={documents}
        />
      );
    }

    return (
      <ChatInterface 
        sessionType={sessionType!} 
        isActive={isSessionStarted}
        sessionId={sessionId}
        documents={documents}
      />
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header sessionType={sessionType} />
      
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Sidebar */}
        <DocumentSidebar
          documents={documents}
          onDocumentsChange={setDocuments}
          onStartSession={handleStartSession}
          isLoading={isLoading}
          sessionType={sessionType}
          isSessionStarted={isSessionStarted}
          isPaymentVerified={isPaymentVerified}
          onSaveDocuments={handleSaveDocuments}
          isDocumentsSaved={isDocumentsSaved}
        />
        
        {/* Main Content */}
        <main className="flex-1 flex flex-col bg-gradient-subtle">
          {renderMainContent()}
        </main>
      </div>

      {/* Completed Session Dialog */}
      <SessionCompletedDialog
        isOpen={showCompletedDialog}
        onClose={() => setShowCompletedDialog(false)}
        sessionType={sessionType || ''}
        userEmail={userEmail || ''}
        sessionResults={completedSessionResults}
      />
    </div>
  );
}
