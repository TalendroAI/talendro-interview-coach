import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { DocumentSidebar } from '@/components/DocumentSidebar';
import { WelcomeMessage } from '@/components/WelcomeMessage';
import { ChatInterface } from '@/components/ChatInterface';
import { AudioInterface } from '@/components/AudioInterface';
import { QuickPrepContent } from '@/components/QuickPrepContent';
import { SessionCompletedDialog } from '@/components/SessionCompletedDialog';
import { PausedSessionBanner } from '@/components/PausedSessionBanner';
import { useSessionParams } from '@/hooks/useSessionParams';
import { DocumentInputs } from '@/types/session';
import { useToast } from '@/hooks/use-toast';
import { verifyPayment } from '@/services/api';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export default function InterviewCoach() {
  const { sessionType, userEmail } = useSessionParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
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
  
  // Mock Interview completion state
  const [mockInterviewMessages, setMockInterviewMessages] = useState<any[]>([]);
  const [isMockInterviewComplete, setIsMockInterviewComplete] = useState(false);
  
  // Audio interview state
  const [isAudioInterviewStarted, setIsAudioInterviewStarted] = useState(false);
  const [isAudioInterviewComplete, setIsAudioInterviewComplete] = useState(false);
  
  // Completed session dialog state
  const [showCompletedDialog, setShowCompletedDialog] = useState(false);
  const [completedSessionResults, setCompletedSessionResults] = useState<any>(null);
  const [isSessionCompleted, setIsSessionCompleted] = useState(false);
  
  // Resume from pause state
  const [resumeFromPause, setResumeFromPause] = useState(false);
  const [resumingSessionType, setResumingSessionType] = useState<string | null>(null);

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
        // For other session types, transition to session view (mid-page button handles actual start for audio)
        setIsSessionStarted(true);
        toast({
          title: 'Documents saved!',
          description: sessionType === 'premium_audio' 
            ? 'Click "Begin Interview" when you\'re ready to start.'
            : 'Your personalized coaching session has begun.',
        });
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

  // Callback when mock interview is complete
  const handleMockInterviewComplete = (messages: any[]) => {
    setMockInterviewMessages(messages);
    setIsMockInterviewComplete(true);
  };

  // Helper to fetch prep packet from session
  const fetchPrepPacket = async (): Promise<string | null> => {
    if (!sessionId) return null;
    
    try {
      const { data, error } = await supabase
        .from('coaching_sessions')
        .select('prep_packet')
        .eq('id', sessionId)
        .single();
      
      if (error || !data?.prep_packet) {
        console.log('No prep packet found for session');
        return null;
      }
      
      // prep_packet is stored as { content: string }
      const packet = data.prep_packet as { content?: string };
      return packet?.content || null;
    } catch (err) {
      console.error('Error fetching prep packet:', err);
      return null;
    }
  };

  const handleStartSession = async () => {
    if (!sessionType) {
      toast({
        title: 'Session type required',
        description: 'Please access this page with a valid session type parameter.',
        variant: 'destructive',
      });
      return;
    }

    // For quick_prep, we need the content ready
    if (sessionType === 'quick_prep' && !quickPrepContent) {
      toast({
        title: 'Content not ready',
        description: 'Please wait for your prep materials to finish generating.',
        variant: 'destructive',
      });
      return;
    }

    // For full_mock, we need the interview to be complete
    if (sessionType === 'full_mock' && !isMockInterviewComplete) {
      toast({
        title: 'Interview not complete',
        description: 'Please complete all interview questions before getting your results.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Prepare the content to send based on session type
      let contentToSend = '';
      let resultsToSend = null;

      if (sessionType === 'quick_prep') {
        contentToSend = quickPrepContent || '';
      } else if (sessionType === 'full_mock') {
        // FIXED: Fetch the baseline prep packet and combine with transcript
        const prepPacket = await fetchPrepPacket();
        
        // Build transcript from messages
        const transcriptContent = mockInterviewMessages
          .map(m => `**${m.role === 'user' ? 'Your Answer' : 'Coach'}:**\n${m.content}`)
          .join('\n\n---\n\n');
        
        // Combine prep packet + transcript
        if (prepPacket) {
          contentToSend = prepPacket + '\n\n---\n\n# Mock Interview Transcript\n\n' + transcriptContent;
        } else {
          // Fallback if no prep packet (shouldn't happen after fix)
          contentToSend = '# Mock Interview Transcript\n\n' + transcriptContent;
        }
        
        // Try to extract score from the final message
        const lastAssistantMessage = mockInterviewMessages
          .filter(m => m.role === 'assistant')
          .pop();
        
        if (lastAssistantMessage) {
          const scoreMatch = lastAssistantMessage.content.match(/(\d+)\s*(?:\/\s*100|out of 100)/i);
          if (scoreMatch) {
            resultsToSend = {
              overall_score: parseInt(scoreMatch[1], 10),
            };
          }
        }
      }

      // Send the materials via email
      const { data, error } = await supabase.functions.invoke('send-results', {
        body: {
          session_id: sessionId,
          email: userEmail,
          session_type: sessionType,
          prep_content: contentToSend,
          results: resultsToSend,
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to send results');
      }

      toast({
        title: 'Results sent!',
        description: 'Your interview results have been emailed to you.',
      });
      
      // Mark session as completed
      setIsSessionCompleted(true);
    } catch (err) {
      console.error('Error sending results:', err);
      toast({
        title: 'Error sending email',
        description: err instanceof Error ? err.message : 'Failed to send your results. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle resume from paused session
  const handleResumePausedSession = async (pausedSessionId: string, pausedSessionType: string) => {
    // Set the session to resume
    setSessionId(pausedSessionId);
    setResumeFromPause(true);
    setResumingSessionType(pausedSessionType);
    setIsPaymentVerified(true);
    setIsSessionStarted(true);
    setIsDocumentsSaved(true); // Assume docs were saved before pause
    
    // Fetch documents from the paused session
    try {
      const { data: sessionData } = await supabase
        .from('coaching_sessions')
        .select('resume_text, job_description, company_url')
        .eq('id', pausedSessionId)
        .single();
      
      if (sessionData) {
        setDocuments({
          resume: sessionData.resume_text || '',
          jobDescription: sessionData.job_description || '',
          companyUrl: sessionData.company_url || '',
        });
      }
    } catch (err) {
      console.error('Error fetching paused session documents:', err);
    }
    
    toast({
      title: 'Resuming Session',
      description: 'Loading your saved progress...',
    });
  };

  const handleAbandonSession = (abandonedSessionId: string) => {
    // Just clear local state if this was the current session
    if (abandonedSessionId === sessionId) {
      setSessionId(undefined);
      setIsSessionStarted(false);
      setResumeFromPause(false);
    }
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
    if (sessionType === 'quick_prep' || resumingSessionType === 'quick_prep') {
      return (
        <QuickPrepContent 
          content={quickPrepContent}
          isLoading={isGeneratingContent}
          error={contentError}
          onCompleteSession={handleStartSession}
          isCompletingSession={isLoading}
          isSessionCompleted={isSessionCompleted}
          isContentReady={!!quickPrepContent && !isGeneratingContent}
        />
      );
    }

    if (sessionType === 'premium_audio' || resumingSessionType === 'premium_audio') {
      return (
        <AudioInterface 
          isActive={isSessionStarted} 
          sessionId={sessionId}
          documents={documents}
          isDocumentsSaved={isDocumentsSaved}
          onInterviewStarted={() => setIsAudioInterviewStarted(true)}
          onInterviewComplete={() => setIsAudioInterviewComplete(true)}
          userEmail={userEmail}
        />
      );
    }

    return (
      <ChatInterface 
        sessionType={sessionType || resumingSessionType as any} 
        isActive={isSessionStarted}
        sessionId={sessionId}
        documents={documents}
        onInterviewComplete={handleMockInterviewComplete}
        onCompleteSession={handleStartSession}
        isCompletingSession={isLoading}
        isSessionCompleted={isSessionCompleted}
        isContentReady={isMockInterviewComplete}
        userEmail={userEmail}
        resumeFromPause={resumeFromPause}
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
          isLoading={isLoading || isGeneratingContent}
          sessionType={sessionType}
          isSessionStarted={isSessionStarted}
          isPaymentVerified={isPaymentVerified}
          onSaveDocuments={handleSaveDocuments}
          isDocumentsSaved={isDocumentsSaved}
          isContentReady={
            (sessionType === 'quick_prep' && !!quickPrepContent && !isGeneratingContent) ||
            (sessionType === 'full_mock' && isMockInterviewComplete) ||
            (sessionType === 'premium_audio' && isAudioInterviewComplete)
          }
          isSessionCompleted={isSessionCompleted}
        />
        
        {/* Main Content */}
        <main className="flex-1 flex flex-col bg-gradient-subtle">
          {/* Paused Session Banner */}
          {userEmail && !isSessionStarted && !isVerifying && (
            <div className="p-4 pb-0">
              <PausedSessionBanner
                userEmail={userEmail}
                onResume={handleResumePausedSession}
                onAbandon={handleAbandonSession}
              />
            </div>
          )}
          
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
