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
import { PausedSessionConflictDialog } from '@/components/PausedSessionConflictDialog';
import { useSessionParams } from '@/hooks/useSessionParams';
import { DocumentInputs } from '@/types/session';
import { useToast } from '@/hooks/use-toast';
import { verifyPayment } from '@/services/api';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle } from 'lucide-react';
import { ProInterviewType } from '@/components/ProInterviewTypeSelector';
import { Button } from '@/components/ui/button';

interface PausedSession {
  id: string;
  session_type: string;
  paused_at: string;
  current_question_number: number | null;
}

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
  
  // Paused session conflict dialog state
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflictPausedSession, setConflictPausedSession] = useState<PausedSession | null>(null);
  const [isAbandoning, setIsAbandoning] = useState(false);
  const [pendingSaveAction, setPendingSaveAction] = useState(false);

  // Header pause button state (lifted from ChatInterface)
  const [headerPauseState, setHeaderPauseState] = useState({
    showButton: false,
    isPaused: false,
    isPausing: false,
    isResuming: false,
  });
  const [pauseHandlers, setPauseHandlers] = useState<{
    onPause?: () => void;
    onResume?: () => void;
  }>({});

  // Pro interview type selection state
  const [selectedProInterviewType, setSelectedProInterviewType] = useState<ProInterviewType | null>(null);

  // Determine the effective session type for Pro subscribers
  const effectiveSessionType = sessionType === 'pro' ? selectedProInterviewType : sessionType;

  // Check if documents are ready
  const isResumeComplete = documents.resume.trim().length > 50;
  const isJobComplete = documents.jobDescription.trim().length > 50;
  const isDocumentsReady = isResumeComplete && isJobComplete && isDocumentsSaved;

  // Check for paused sessions before starting new one
  // Only returns paused sessions of the SAME type as what user is trying to start
  const checkForPausedSessions = async (): Promise<PausedSession | null> => {
    if (!userEmail) return null;
    
    // Determine what session type we're trying to start
    const targetSessionType = effectiveSessionType || sessionType;
    if (!targetSessionType) return null;
    
    try {
      const { data, error } = await supabase.functions.invoke('audio-session', {
        body: {
          action: 'get_paused_sessions',
          email: userEmail,
        },
      });
      
      if (error) {
        console.error('Error checking paused sessions:', error);
        return null;
      }
      
      const sessions = (data?.sessions as PausedSession[]) ?? [];
      
      // BUG FIX: Only return conflict if paused session is SAME type as what user is starting
      const sameTypeSession = sessions.find(s => s.session_type === targetSessionType);
      return sameTypeSession || null;
    } catch (err) {
      console.error('Exception checking paused sessions:', err);
      return null;
    }
  };

  const handleSaveDocuments = async () => {
    if (isResumeComplete && isJobComplete) {
      // First check if user has any paused sessions of the SAME type
      const pausedSession = await checkForPausedSessions();
      
      if (pausedSession) {
        // Show conflict dialog only for same session type
        setConflictPausedSession(pausedSession);
        setShowConflictDialog(true);
        setPendingSaveAction(true);
        return; // Don't proceed until user makes a choice
      }
      
      // No conflict (different type or no paused sessions), proceed with saving
      proceedWithSaveDocuments();
    }
  };

  const proceedWithSaveDocuments = async () => {
    setIsDocumentsSaved(true);
    
    // For Pro users, wait until they select an interview type
    if (sessionType === 'pro' && !selectedProInterviewType) {
      toast({
        title: 'Documents saved!',
        description: 'Now select which interview type you\'d like to start.',
      });
      return;
    }
    
    // Use effective session type (for Pro, use selected type)
    const activeSessionType = effectiveSessionType;
    
    // For quick_prep, generate content immediately
    if (isPaymentVerified && activeSessionType === 'quick_prep' && sessionId) {
      setIsGeneratingContent(true);
      setContentError(null);
      setIsSessionStarted(true);
      
      try {
        const { data, error } = await supabase.functions.invoke('ai-coach', {
          body: {
            session_id: sessionId,
            session_type: activeSessionType,
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
    } else if (isPaymentVerified && activeSessionType) {
      // For other session types, transition to session view
      setIsSessionStarted(true);
      toast({
        title: 'Documents saved!',
        description: activeSessionType === 'premium_audio' 
          ? 'Click "Begin Interview" when you\'re ready to start.'
          : 'Your personalized coaching session has begun.',
      });
    }
  };

  // Handle abandon and start new session
  const handleAbandonAndStartNew = async (abandonedSessionId: string) => {
    if (!userEmail) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'User email not found. Please try again.',
      });
      return;
    }
    
    setIsAbandoning(true);
    try {
      // Use edge function to abandon session (bypasses RLS)
      const { data, error } = await supabase.functions.invoke('audio-session', {
        body: {
          action: 'abandon_session',
          sessionId: abandonedSessionId,
          email: userEmail,
        },
      });
      
      if (error || !data?.ok) {
        console.error('Error abandoning session:', error || data);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not abandon the old session. Please try again.',
        });
        return;
      }
      
      // Close dialog and proceed with new session
      setShowConflictDialog(false);
      setConflictPausedSession(null);
      setPendingSaveAction(false);
      
      toast({
        title: 'Previous session abandoned',
        description: 'Starting your new session now.',
      });
      
      // Now proceed with the save
      proceedWithSaveDocuments();
    } catch (err) {
      console.error('Exception abandoning session:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Something went wrong. Please try again.',
      });
    } finally {
      setIsAbandoning(false);
    }
  };

  // Handle resume from conflict dialog
  const handleResumeFromConflict = async (pausedSessionId: string, pausedSessionType: string) => {
    if (!userEmail) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'User email not found. Please try again.',
      });
      return;
    }
    
    // Close dialog first
    setShowConflictDialog(false);
    setConflictPausedSession(null);
    setPendingSaveAction(false);
    
    // Use edge function to resume session (clears paused_at and fetches history)
    try {
      const { data, error } = await supabase.functions.invoke('audio-session', {
        body: {
          action: 'resume_session',
          sessionId: pausedSessionId,
          email: userEmail,
        },
      });
      
      if (error) {
        throw error;
      }
      
      if (data?.expired) {
        toast({
          variant: 'destructive',
          title: 'Session Expired',
          description: 'This session has expired. Paused sessions are only resumable within 24 hours.',
        });
        return;
      }
      
      if (data?.ok) {
        // Trigger the resume flow with session data
        handleResumePausedSession(pausedSessionId, pausedSessionType);
      }
    } catch (err) {
      console.error('Error resuming session:', err);
      toast({
        variant: 'destructive',
        title: 'Resume Failed',
        description: 'Could not resume your session. Please try again.',
      });
    }
  };

  // Check for resume link from email (resume_session param)
  useEffect(() => {
    const resumeSessionId = searchParams.get('resume_session');
    const resumeEmail = searchParams.get('email');
    
    if (resumeSessionId && resumeEmail) {
      // User clicked resume link from email - auto-resume the session
      const autoResume = async () => {
        try {
          const { data, error } = await supabase.functions.invoke('audio-session', {
            body: {
              action: 'resume_session',
              sessionId: resumeSessionId,
              email: resumeEmail,
            },
          });
          
          if (error) {
            throw error;
          }
          
          if (data?.expired) {
            toast({
              variant: 'destructive',
              title: 'Session Expired',
              description: 'This session has expired. Paused sessions are only resumable within 24 hours.',
            });
            // Redirect to home page
            navigate('/');
            return;
          }
          
          if (data?.ok) {
            // Resume successful - trigger the resume flow
            handleResumePausedSession(resumeSessionId, data.sessionType);
          }
        } catch (err) {
          console.error('Error auto-resuming session:', err);
          toast({
            variant: 'destructive',
            title: 'Resume Failed',
            description: 'Could not resume your session. It may have expired.',
          });
        } finally {
          setIsVerifying(false);
        }
      };
      
      autoResume();
      return; // Skip normal payment verification
    }
  }, [searchParams, navigate]);

  // Verify payment on page load
  useEffect(() => {
    const checkPayment = async () => {
      // Skip if resuming from email link
      const resumeSessionId = searchParams.get('resume_session');
      if (resumeSessionId) {
        return; // Handled by the other useEffect
      }
      
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

  // Handle Pro interview type selection - triggers session start
  const handleProInterviewTypeSelect = (type: ProInterviewType) => {
    setSelectedProInterviewType(type);
    
    // If documents are saved and payment verified, start the session
    if (isDocumentsSaved && isPaymentVerified && sessionId) {
      // Use a small delay to let state update
      setTimeout(() => {
        if (type === 'quick_prep') {
          // Generate Quick Prep content
          setIsGeneratingContent(true);
          setContentError(null);
          setIsSessionStarted(true);
          
          supabase.functions.invoke('ai-coach', {
            body: {
              session_id: sessionId,
              session_type: type,
              resume: documents.resume,
              job_description: documents.jobDescription,
              company_url: documents.companyUrl,
              is_initial: true
            }
          }).then(({ data, error }) => {
            if (error) {
              setContentError(error.message || 'Failed to generate content');
            } else if (data?.message) {
              setQuickPrepContent(data.message);
            } else {
              setContentError('No content received from AI');
            }
            setIsGeneratingContent(false);
          }).catch(err => {
            setContentError(err instanceof Error ? err.message : 'Failed to generate content');
            setIsGeneratingContent(false);
          });
        } else {
          // For Mock or Audio, just start the session
          setIsSessionStarted(true);
          toast({
            title: 'Session Started!',
            description: type === 'premium_audio' 
              ? 'Click "Begin Interview" when you\'re ready to start.'
              : 'Your personalized coaching session has begun.',
          });
        }
      }, 100);
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

    // Show completed state if session was already completed (e.g., user clicked old email link)
    if (showCompletedDialog) {
      const sessionName = {
        quick_prep: 'Quick Prep',
        full_mock: 'Full Mock Interview',
        premium_audio: 'Premium Audio Mock',
        pro: 'Pro Session',
      }[sessionType || ''] || 'coaching session';
      
      return (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="bg-green-100 dark:bg-green-900/30 p-4 rounded-full w-fit mx-auto mb-6">
              <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="font-heading text-2xl font-semibold text-foreground mb-3">
              Session Already Completed
            </h2>
            <p className="text-muted-foreground mb-6">
              You've already completed this <span className="font-semibold text-foreground">{sessionName}</span> session. 
              Your results were sent to <span className="font-semibold text-foreground">{userEmail}</span>.
            </p>
            {completedSessionResults?.overall_score && (
              <div className="bg-muted/50 rounded-lg p-4 mb-6">
                <p className="text-sm text-muted-foreground mb-1">Your Score</p>
                <p className="text-4xl font-bold text-primary">
                  {completedSessionResults.overall_score}/100
                </p>
              </div>
            )}
            <div className="space-y-3">
              <Button
                onClick={() => navigate('/')}
                className="w-full"
              >
                Purchase Another Session
              </Button>
              <Button
                onClick={() => navigate('/')}
                variant="outline"
                className="w-full"
              >
                Return to Home
              </Button>
            </div>
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

    // Use effectiveSessionType for Pro users
    const activeType = effectiveSessionType || resumingSessionType;

    // For quick_prep, show the generated content
    if (activeType === 'quick_prep') {
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

    if (activeType === 'premium_audio') {
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
        sessionType={(activeType as 'full_mock' | 'quick_prep' | 'premium_audio' | 'pro') || 'full_mock'} 
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
        onHeaderPauseStateChange={(state) => setHeaderPauseState(state)}
        onRegisterPauseHandlers={(handlers) => setPauseHandlers(handlers)}
      />
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header 
        sessionType={sessionType}
        showPauseButton={headerPauseState.showButton}
        isPaused={headerPauseState.isPaused}
        isPausing={headerPauseState.isPausing}
        isResuming={headerPauseState.isResuming}
        onPause={pauseHandlers.onPause}
        onResume={pauseHandlers.onResume}
      />
      
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Sidebar - hide when showing completed state */}
        {!showCompletedDialog && (
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
              (effectiveSessionType === 'quick_prep' && !!quickPrepContent && !isGeneratingContent) ||
              (effectiveSessionType === 'full_mock' && isMockInterviewComplete) ||
              (effectiveSessionType === 'premium_audio' && isAudioInterviewComplete)
            }
            isSessionCompleted={isSessionCompleted}
            selectedProInterviewType={selectedProInterviewType}
            onProInterviewTypeSelect={handleProInterviewTypeSelect}
          />
        )}
        
        {/* Main Content */}
        <main className="flex-1 flex flex-col bg-gradient-subtle">
          {/* Paused Session Banner - hide when showing completed state */}
          {userEmail && !isSessionStarted && !isVerifying && !showCompletedDialog && (
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

      {/* Paused Session Conflict Dialog */}
      <PausedSessionConflictDialog
        isOpen={showConflictDialog}
        onClose={() => {
          setShowConflictDialog(false);
          setConflictPausedSession(null);
          setPendingSaveAction(false);
        }}
        pausedSession={conflictPausedSession}
        onResume={handleResumeFromConflict}
        onAbandonAndStart={handleAbandonAndStartNew}
        isAbandoning={isAbandoning}
      />
    </div>
  );
}
