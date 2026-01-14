import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { DocumentSidebar } from '@/components/DocumentSidebar';
import { WelcomeMessage } from '@/components/WelcomeMessage';
import { ChatInterface } from '@/components/ChatInterface';
import { AudioInterface } from '@/components/AudioInterface';
import { QuickPrepContent } from '@/components/QuickPrepContent';
import { SessionCompletedDialog } from '@/components/SessionCompletedDialog';
import { SessionResultsView } from '@/components/results/SessionResultsView';
import { PausedSessionNotification } from '@/components/PausedSessionNotification';
import { PausedSessionConflictDialog } from '@/components/PausedSessionConflictDialog';
import { PrepPacketGeneratingOverlay } from '@/components/PrepPacketGeneratingOverlay';
import { useSessionParams } from '@/hooks/useSessionParams';
import { useClientAuth } from '@/hooks/useClientAuth';
import { DocumentInputs, SessionType } from '@/types/session';
import { useToast } from '@/hooks/use-toast';
import { verifyPayment } from '@/services/api';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle } from 'lucide-react';
import { ProInterviewType } from '@/components/ProInterviewTypeSelector';
import { Button } from '@/components/ui/button';
import confetti from 'canvas-confetti';

interface PausedSession {
  id: string;
  session_type: string;
  paused_at: string;
  current_question_number: number | null;
}

export default function InterviewCoach() {
  const { sessionType, userEmail, preSelectedInterviewType } = useSessionParams();
  const { isProSubscriber, profile, user, isLoading: isAuthLoading } = useClientAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const checkoutSessionId = searchParams.get('checkout_session_id');
  const sessionIdParam = searchParams.get('session_id');

  // Allow session links that only contain session_id (no session_type)
  const [sessionTypeOverride, setSessionTypeOverride] = useState<SessionType | null>(null);
  const resolvedSessionType = sessionTypeOverride ?? sessionType;
  
  const [documents, setDocuments] = useState<DocumentInputs>({
    firstName: '',
    resume: '',
    jobDescription: '',
    companyUrl: '',
  });
  const [isSessionStarted, setIsSessionStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isPaymentVerified, setIsPaymentVerified] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [sessionEmail, setSessionEmail] = useState<string | undefined>(); // Email associated with current session
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
  const [isGeneratingPrepPacket, setIsGeneratingPrepPacket] = useState(false);
  
  // Completed session dialog state
  const [showCompletedDialog, setShowCompletedDialog] = useState(false);
  const [completedSessionResults, setCompletedSessionResults] = useState<any>(null);
  const [resultsReport, setResultsReport] = useState<any>(null);
  const [isSessionCompleted, setIsSessionCompleted] = useState(false);

  // Completion confetti (fire once per session)
  const completionConfettiFired = useRef(false);

  useEffect(() => {
    completionConfettiFired.current = false;
  }, [sessionId]);

  useEffect(() => {
    if (!isSessionCompleted) return;
    if (completionConfettiFired.current) return;
    completionConfettiFired.current = true;

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    confetti({ particleCount: 140, spread: 75, startVelocity: 45, origin: { y: 0.65 }, colors });
    confetti({ particleCount: 80, spread: 110, startVelocity: 55, origin: { y: 0.6 }, colors });

    // Auto-redirect Pro subscribers to dashboard after session completion
    if (isProSubscriber) {
      const redirectTimer = setTimeout(() => {
        toast({
          title: 'Redirecting to Dashboard',
          description: 'Your results have been emailed to you.',
        });
        navigate('/dashboard');
      }, 2500); // 2.5 seconds to see confetti and success message
      return () => clearTimeout(redirectTimer);
    }
  }, [isSessionCompleted, isProSubscriber, navigate, toast]);

  // Scroll to top when results are shown (results render without a route change)
  useEffect(() => {
    if (!isSessionCompleted || !resultsReport) return;

    const doScroll = () => {
      // Window scroll
      try {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      } catch {
        window.scrollTo(0, 0);
      }

      // App scroll containers
      const candidates: Array<Element | null> = [
        document.documentElement,
        document.body,
        document.querySelector('main'),
        document.getElementById('main-scroll-container'),
        document.getElementById('chat-messages-container'),
      ];

      for (const el of candidates) {
        if (!el || !(el instanceof HTMLElement)) continue;
        try {
          el.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        } catch {
          el.scrollTop = 0;
          el.scrollLeft = 0;
        }
      }
    };

    requestAnimationFrame(doScroll);
    setTimeout(doScroll, 50);
  }, [isSessionCompleted, resultsReport]);
  
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
    onEnd?: () => void;
  }>({});
  const [isEndingInterview, setIsEndingInterview] = useState(false);

  // Pro interview type selection state - initialize from URL parameter if available
  const [selectedProInterviewType, setSelectedProInterviewType] = useState<ProInterviewType | null>(
    preSelectedInterviewType as ProInterviewType | null
  );

  // Determine the effective session type for Pro subscribers
  const effectiveSessionType = resolvedSessionType === 'pro' ? selectedProInterviewType : resolvedSessionType;

  // Scroll to top on page load
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  // Check if documents are ready
  const isResumeComplete = documents.resume.trim().length > 50;
  const isJobComplete = documents.jobDescription.trim().length > 50;
  const isDocumentsReady = isResumeComplete && isJobComplete && isDocumentsSaved;

  // Derive email - prefer purchase email (URL param), fallback to logged-in email
  const derivedEmail = userEmail || user?.email;

  // Check for paused sessions before starting new one
  // Only returns paused sessions of the SAME type as what user is trying to start
  const checkForPausedSessions = async (): Promise<PausedSession | null> => {
    if (!derivedEmail) return null;
    
    // Determine what session type we're trying to start
    const targetSessionType = effectiveSessionType || resolvedSessionType;
    if (!targetSessionType) return null;
    
    try {
      const { data, error } = await supabase.functions.invoke('audio-session', {
        body: {
          action: 'get_paused_sessions',
          email: derivedEmail,
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

  const scheduleScrollToChatStart = () => {
    const doScroll = () => {
      // Some views use the page scroller, others use nested containers.
      // Scroll everything we might be using.
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
      document.body.scrollTo({ top: 0, behavior: 'smooth' });

      const mainScroll = document.getElementById('main-scroll-container');
      mainScroll?.scrollTo({ top: 0, behavior: 'smooth' });

      const chatMessages = document.getElementById('chat-messages-container');
      chatMessages?.scrollTo({ top: 0, behavior: 'auto' });

      const chatTop = document.getElementById('chat-session-top');
      chatTop?.scrollIntoView({ block: 'start' });
    };

    requestAnimationFrame(doScroll);
    setTimeout(doScroll, 250);
    // Audio mode mounts after state flips; give it a little extra time.
    setTimeout(doScroll, 700);
  };

  const handleSaveDocuments = async () => {
    if (isResumeComplete && isJobComplete) {
      // CRITICAL: Never check for paused sessions if this is a NEW PURCHASE.
      // A new checkout_session_id = user paid for a new session = always start fresh.
      // Also skip if we already have a sessionId from the checkout flow.
      const isNewPurchase = Boolean(checkoutSessionId);
      const hasExistingSession = Boolean(sessionId);
      
      if (!isNewPurchase && !hasExistingSession) {
        // Only check for paused session conflicts when NOT a new purchase
        // and we don't have a session yet
        const pausedSession = await checkForPausedSessions();

        if (pausedSession) {
          setConflictPausedSession(pausedSession);
          setShowConflictDialog(true);
          setPendingSaveAction(true);
          return;
        }
      }

      proceedWithSaveDocuments();
      // For Pro users who haven't selected an interview type yet, 
      // let DocumentSidebar handle scrolling to Step 6.
      // Only scroll to top for non-Pro sessions or when Pro has selected a type.
      if (resolvedSessionType !== 'pro' || selectedProInterviewType) {
        scheduleScrollToChatStart();
      }
    }
  };

  const proceedWithSaveDocuments = async () => {
    setIsDocumentsSaved(true);

    // Persist documents for resume links (backend function uses service role; safe for anon sessions)
    // Use sessionEmail (from purchase) as source of truth, fallback to derivedEmail
    const emailForSession = sessionEmail || derivedEmail;
    if (sessionId && emailForSession) {
      try {
        const { error } = await supabase.functions.invoke('audio-session', {
          body: {
            action: 'save_documents',
            sessionId,
            email: emailForSession,
            firstName: documents.firstName,
            resume: documents.resume,
            jobDescription: documents.jobDescription,
            companyUrl: documents.companyUrl,
          },
        });

        if (error) {
          console.error('Error saving documents to session:', error);
        }
      } catch (err) {
        console.error('Exception saving documents to session:', err);
      }
    }
    
    // For Pro users, wait until they select an interview type
    if (resolvedSessionType === 'pro' && !selectedProInterviewType) {
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
      scheduleScrollToChatStart();
      
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
    } else if (isPaymentVerified && activeSessionType === 'premium_audio' && sessionId) {
      // For Audio Mock: Show full-screen overlay while generating prep packet
      setIsGeneratingPrepPacket(true);
      setContentError(null);
      
      try {
        // Generate prep packet using the Quick Prep prompt (same value as Quick Prep customers get)
        const { data, error } = await supabase.functions.invoke('ai-coach', {
          body: {
            session_id: sessionId,
            session_type: 'quick_prep', // Use quick_prep to get the prep packet format
            resume: documents.resume,
            job_description: documents.jobDescription,
            company_url: documents.companyUrl,
            is_initial: true,
            generate_prep_only: true // Flag to indicate we just want the prep packet saved
          }
        });
        
        if (error) {
          console.error('Failed to generate prep packet for Audio Mock:', error);
          // Don't block - continue to interview even if prep packet fails
        } else {
          console.log('Prep packet generated for Audio Mock session');
        }
      } catch (err) {
        console.error('Error generating prep packet for Audio Mock:', err);
        // Don't block the interview - prep packet is a bonus, not a blocker
      } finally {
        setIsGeneratingPrepPacket(false);
      }
      
      // Now transition to the audio interview
      setIsSessionStarted(true);
      scheduleScrollToChatStart();
      toast({
        title: 'Prep packet ready!',
        description: 'Click "Begin Interview" when you\'re ready to start with Sarah.',
      });
    } else if (isPaymentVerified && activeSessionType) {
      // For other session types (full_mock, pro), transition to session view
      setIsSessionStarted(true);
      scheduleScrollToChatStart();
      toast({
        title: 'Documents saved!',
        description: 'Your personalized coaching session has begun.',
      });
    }
  };

  // Handle abandon and start new session
  const handleAbandonAndStartNew = async (abandonedSessionId: string) => {
    if (!derivedEmail) {
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
          email: derivedEmail,
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
    if (!derivedEmail) {
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
          email: derivedEmail,
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

  // Direct session link from purchase emails (?session_id=...)
  useEffect(() => {
    if (!sessionIdParam || !userEmail) return;

    // If resuming from pause link, let the resume flow handle it
    const resumeSessionId = searchParams.get('resume_session');
    if (resumeSessionId) return;

    const loadSessionFromLink = async () => {
      setIsVerifying(true);

      try {
        const { data, error } = await supabase.functions.invoke('audio-session', {
          body: {
            action: 'get_session',
            sessionId: sessionIdParam,
            email: userEmail,
          },
        });

        if (error) throw error;
        if (!data?.ok || !data?.session) {
          throw new Error(data?.error || 'Session not found');
        }

        const s = data.session as {
          id: string;
          sessionType: SessionType;
          status: string;
          documents?: { resume?: string; jobDescription?: string; companyUrl?: string };
        };

        setSessionId(s.id);
        setSessionEmail(userEmail || undefined); // Use the email from URL param that was used to load session
        setSessionTypeOverride(s.sessionType);

        const docs = s.documents ?? {};
        setDocuments({
          firstName: (docs as any).firstName || '',
          resume: docs.resume || '',
          jobDescription: docs.jobDescription || '',
          companyUrl: docs.companyUrl || '',
        });

        // If there are already docs saved on this session, don't force the user to re-save them
        const hasAnyDocs = Boolean(
          (docs.resume && docs.resume.trim().length > 0) ||
            (docs.jobDescription && docs.jobDescription.trim().length > 0) ||
            (docs.companyUrl && docs.companyUrl.trim().length > 0)
        );
        setIsDocumentsSaved(hasAnyDocs);

        setIsPaymentVerified(s.status === 'active' || s.status === 'pending');
      } catch (err) {
        console.error('Error loading session from link:', err);
        toast({
          variant: 'destructive',
          title: 'Session link invalid',
          description: 'We couldn’t load that session. Please use your latest purchase email link.',
        });
      } finally {
        setIsVerifying(false);
      }
    };

    loadSessionFromLink();
  }, [sessionIdParam, userEmail]);

  // Check for resume link from email (resume_session param)
  useEffect(() => {
    const resumeSessionId = searchParams.get('resume_session');
    const resumeEmail = searchParams.get('email');
    
    if (!resumeSessionId || !resumeEmail) return;

    // User clicked resume link from email - auto-resume the session
    const autoResume = async () => {
      setIsVerifying(true);

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
          // Resume successful - hydrate docs first, then show the resumed interview UI
          await handleResumePausedSession(resumeSessionId, data.sessionType, resumeEmail);
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
  }, [searchParams, navigate]);

  // Verify payment on page load - Pro subscribers get auto-verified
  useEffect(() => {
    const checkPayment = async () => {
      // Skip if resuming from email link or using a direct session_id link
      const resumeSessionId = searchParams.get('resume_session');
      if (resumeSessionId || sessionIdParam) {
        return; // Handled by the other useEffects
      }
      
      // Wait for auth to finish loading before checking Pro status
      if (isAuthLoading) {
        return;
      }

      // Derive the email to use - prefer logged-in user's email, fallback to URL param
      const emailToUse = user?.email || userEmail;
      
      if (!resolvedSessionType || !emailToUse) {
        setIsVerifying(false);
        return;
      }

      // Check if user is a Pro subscriber (from local auth state or profile)
      // This avoids needing to call the backend for Pro status verification
      const isProFromProfile = isProSubscriber || profile?.is_pro_subscriber === true;
      
      // For Pro subscribers accessing session_type=pro, auto-verify without calling verify-payment
      if (isProFromProfile && resolvedSessionType === 'pro') {
        console.log('[InterviewCoach] Pro subscriber detected, auto-verifying session');
        
        // Determine the effective session type from URL or default to quick_prep
        const effectiveType = preSelectedInterviewType || 'quick_prep';
        
        try {
          // Create a new session for the Pro subscriber
          const result = await verifyPayment(
            undefined,
            emailToUse,
            effectiveType // Pass the actual interview type, not 'pro'
          );

          if (result.verified && result.session) {
            setIsPaymentVerified(true);
            setSessionId(result.session.id);
            setSessionEmail(result.session.email || emailToUse || undefined);
            toast({
              title: 'Pro Session Ready',
              description: 'Your unlimited session is ready to begin.',
            });
          } else if (result.session_limit_reached) {
            // Session limit reached for this type
            toast({
              title: 'Session Limit Reached',
              description: result.message || 'You\'ve reached your session limit for this month.',
              variant: 'destructive',
            });
          } else if (result.session_status === 'completed') {
            setCompletedSessionResults(result.session_results);
            setShowCompletedDialog(true);
          } else {
            // Fallback - still show as verified for Pro users
            setIsPaymentVerified(true);
            toast({
              title: 'Pro Session Ready',
              description: 'Your session is ready to begin.',
            });
          }
        } catch (error) {
          console.error('Pro session verification error:', error);
          // Even on error, trust the local Pro status
          setIsPaymentVerified(true);
          toast({
            title: 'Pro Session Ready',
            description: 'Your session is ready to begin.',
          });
        } finally {
          setIsVerifying(false);
        }
        return;
      }

      // Standard payment verification for non-Pro or checkout sessions
      try {
        const result = await verifyPayment(
          checkoutSessionId || undefined,
          emailToUse,
          resolvedSessionType
        );

        if (result.verified && result.session) {
          setIsPaymentVerified(true);
          setSessionId(result.session.id);
          setSessionEmail(result.session.email || emailToUse || undefined);
          toast({
            title: 'Payment verified!',
            description: 'Your session is ready to begin.',
          });
        } else if (result.is_pro) {
          // Backend confirmed Pro status
          setIsPaymentVerified(true);
          if (result.session) {
            setSessionId(result.session.id);
            setSessionEmail(result.session.email || emailToUse || undefined);
          }
          toast({
            title: 'Pro Session Ready',
            description: 'Your unlimited session is ready to begin.',
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
  }, [resolvedSessionType, userEmail, searchParams, isAuthLoading, isProSubscriber, profile, user, preSelectedInterviewType]);

  // Callback when mock interview is complete
  const handleMockInterviewComplete = (messages: any[]) => {
    setMockInterviewMessages(messages);
    setIsMockInterviewComplete(true);
  };

  // Audio interview completion state for passing transcript to results
  const [audioInterviewData, setAudioInterviewData] = useState<{
    transcript: string;
    prepPacket: string | null;
  } | null>(null);

  // Callback when audio interview is complete with results data
  const handleAudioSessionComplete = (resultsData: { transcript: string; prepPacket: string | null }) => {
    setAudioInterviewData(resultsData);
    setIsAudioInterviewComplete(true);
    // Trigger the results flow immediately
    handleAudioResultsFlow(resultsData);
  };

  // Handle audio results flow - send email and show results screen
  const handleAudioResultsFlow = async (resultsData: { transcript: string; prepPacket: string | null }) => {
    setIsLoading(true);
    
    try {
      // Combine prep packet + transcript
      let contentToSend = '';
      if (resultsData.prepPacket) {
        contentToSend = resultsData.prepPacket + '\n\n---\n\n# Audio Interview Transcript\n\n' + resultsData.transcript;
      } else {
        contentToSend = '# Audio Interview Transcript\n\n' + resultsData.transcript;
      }

      const { data, error } = await supabase.functions.invoke('send-results', {
        body: {
          session_id: sessionId,
          email: sessionEmail || userEmail || derivedEmail, // Use session's email to match DB record
          session_type: 'premium_audio',
          prep_content: contentToSend,
          results: null,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to send results');
      }

      // Show the same deliverable on-screen that we email
      if (data?.report) {
        setResultsReport(data.report);
      }
      if (data?.session_results) {
        setCompletedSessionResults(data.session_results);
      }

      // Increment Pro session count for premium_audio
      if (isProSubscriber && derivedEmail) {
        try {
          await supabase.functions.invoke('pro-session', {
            body: {
              action: 'increment_session_count',
              email: derivedEmail,
              session_type: 'premium_audio',
            },
          });
          console.log('[InterviewCoach] Pro session count incremented for: premium_audio');
        } catch (incErr) {
          console.error('[InterviewCoach] Failed to increment session count:', incErr);
          // Don't fail the whole flow if increment fails
        }
      }

      toast({
        title: 'Results sent!',
        description: 'Your full report is shown here and has been emailed to you.',
      });

      setIsSessionCompleted(true);
    } catch (err) {
      console.error('Error sending audio results:', err);
      toast({
        title: 'Error sending results',
        description: err instanceof Error ? err.message : 'Failed to send your results.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
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
    const completionType =
      effectiveSessionType ??
      ((resumingSessionType as SessionType | null) ?? resolvedSessionType);

    if (!completionType) {
      toast({
        title: 'Session type required',
        description: 'Please access this page with a valid session type parameter.',
        variant: 'destructive',
      });
      return;
    }

    // For quick_prep, we need the content ready
    if (completionType === 'quick_prep' && !quickPrepContent) {
      toast({
        title: 'Content not ready',
        description: 'Please wait for your prep materials to finish generating.',
        variant: 'destructive',
      });
      return;
    }

    // For full_mock, we need the interview to be complete
    if (completionType === 'full_mock' && !isMockInterviewComplete) {
      toast({
        title: 'Interview not complete',
        description: 'Please complete all interview questions before getting your results.',
        variant: 'destructive',
      });
      return;
    }

    // For premium_audio, we need the interview to be complete
    if (completionType === 'premium_audio' && !isAudioInterviewComplete) {
      toast({
        title: 'Interview not complete',
        description: 'Please finish the audio interview before getting your results.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      // Prepare the content to send based on session type
      let contentToSend = '';
      let resultsToSend: any = null;

      if (completionType === 'quick_prep') {
        contentToSend = quickPrepContent || '';
      } else if (completionType === 'full_mock') {
        // Fetch the baseline prep packet and combine with transcript
        const prepPacket = await fetchPrepPacket();

        const transcriptContent = mockInterviewMessages
          .map(m => `**${m.role === 'user' ? 'Your Answer' : 'Sarah (Coach)'}:**\n${m.content}`)
          .join('\n\n---\n\n');

        if (prepPacket) {
          contentToSend = prepPacket + '\n\n---\n\n# Mock Interview Transcript\n\n' + transcriptContent;
        } else {
          contentToSend = '# Mock Interview Transcript\n\n' + transcriptContent;
        }

        // Keep lightweight extraction for backwards compatibility; send-results now generates the full report.
        const lastAssistantMessage = mockInterviewMessages
          .filter(m => m.role === 'assistant')
          .pop();

        if (lastAssistantMessage) {
          const content = lastAssistantMessage.content;
          const scoreMatch = content.match(/(?:Overall\s*(?:Performance\s*)?Score[:\s]*)?(\d+)\s*(?:\/\s*100|out of 100)/i);
          const overallScore = scoreMatch ? parseInt(scoreMatch[1], 10) : null;
          resultsToSend = overallScore ? { overall_score: overallScore } : null;
        }
      } else if (completionType === 'premium_audio') {
        // Audio flow typically sends results automatically from AudioInterface; keep a fallback.
        const prepPacket = await fetchPrepPacket();
        contentToSend = prepPacket || '';
      }

      const { data, error } = await supabase.functions.invoke('send-results', {
        body: {
          session_id: sessionId,
          email: sessionEmail || userEmail || derivedEmail, // Use session's email to match DB record
          session_type: completionType,
          prep_content: contentToSend,
          results: resultsToSend,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to send results');
      }

      // Show the SAME deliverable on-screen that we email
      if (data?.report) {
        setResultsReport(data.report);
      }
      if (data?.session_results) {
        setCompletedSessionResults(data.session_results);
      }

      // Increment Pro session count for all session types (track usage for analytics)
      if (isProSubscriber && derivedEmail) {
        try {
          await supabase.functions.invoke('pro-session', {
            body: {
              action: 'increment_session_count',
              email: derivedEmail,
              session_type: completionType,
            },
          });
          console.log('[InterviewCoach] Pro session count incremented for:', completionType);
        } catch (incErr) {
          console.error('[InterviewCoach] Failed to increment session count:', incErr);
          // Don't fail the whole flow if increment fails
        }
      }

      toast({
        title: 'Results sent!',
        description: 'Your full report is shown here and has been emailed to you.',
      });

      setIsSessionCompleted(true);
    } catch (err) {
      console.error('Error sending results:', err);
      toast({
        title: 'Error sending results',
        description: err instanceof Error ? err.message : 'Failed to send your results. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle resume from paused session
  const handleResumePausedSession = async (pausedSessionId: string, pausedSessionType: string, emailOverride?: string) => {
    const emailForLookup = emailOverride ?? userEmail ?? searchParams.get('email') ?? undefined;

    if (!emailForLookup) {
      toast({
        variant: 'destructive',
        title: 'Resume Failed',
        description: 'Email not found in the resume link.',
      });
      return;
    }

    // Fetch documents FIRST (so we don't render a blank, locked form)
    try {
      const { data, error } = await supabase.functions.invoke('audio-session', {
        body: {
          action: 'get_session',
          sessionId: pausedSessionId,
          email: emailForLookup,
        },
      });

      if (error) throw error;
      if (!data?.ok || !data?.session?.documents) {
        throw new Error('Session documents not found');
      }

      const docs = data.session.documents as {
        firstName?: string;
        resume?: string;
        jobDescription?: string;
        companyUrl?: string;
      };

      setDocuments({
        firstName: docs.firstName || '',
        resume: docs.resume || '',
        jobDescription: docs.jobDescription || '',
        companyUrl: docs.companyUrl || '',
      });

      const hasAnyDocs = Boolean(
        (docs.firstName && docs.firstName.trim().length > 0) ||
          (docs.resume && docs.resume.trim().length > 0) ||
          (docs.jobDescription && docs.jobDescription.trim().length > 0) ||
          (docs.companyUrl && docs.companyUrl.trim().length > 0)
      );
      setIsDocumentsSaved(hasAnyDocs);

      // Now switch UI into resumed-session mode
      setSessionId(pausedSessionId);
      setSessionEmail(emailForLookup); // Store session email for result delivery
      setResumeFromPause(true);
      setResumingSessionType(pausedSessionType);
      setSessionTypeOverride(pausedSessionType as SessionType);
      setIsPaymentVerified(true);
      setIsSessionStarted(true);

      toast({
        title: 'Resuming Session',
        description: 'Loading your saved progress...',
      });
    } catch (err) {
      console.error('Error resuming session (hydration):', err);
      toast({
        variant: 'destructive',
        title: 'Resume Failed',
        description: 'Could not load your saved documents for this session.',
      });
    }
  };

  const handleAbandonSession = (abandonedSessionId: string) => {
    // Just clear local state if this was the current session
    if (abandonedSessionId === sessionId) {
      setSessionId(undefined);
      setIsSessionStarted(false);
      setResumeFromPause(false);
    }
  };

  // Handle Pro interview type selection - triggers session start with atomic limit check
  const handleProInterviewTypeSelect = async (type: ProInterviewType) => {
    setSelectedProInterviewType(type);
    
    // If documents are saved and payment verified, start the session
    if (isDocumentsSaved && isPaymentVerified && sessionId && derivedEmail) {
      // For limited session types (not quick_prep), use atomic check-and-increment
      if (type !== 'quick_prep') {
        try {
          // Atomically check limits AND increment in one transaction to prevent race conditions
          const { data, error } = await supabase.functions.invoke('pro-session', {
            body: { 
              action: 'start_session', 
              email: derivedEmail, 
              session_type: type 
            },
          });

          if (error) {
            toast({
              variant: 'destructive',
              title: 'Session Error',
              description: error.message || 'Failed to start session',
            });
            return;
          }

          if (!data?.allowed) {
            toast({
              variant: 'destructive',
              title: 'Session Limit Reached',
              description: data?.message || `You've used all your ${type === 'full_mock' ? 'Mock Interview' : 'Audio Mock'} sessions this month.`,
            });
            return;
          }

          console.log('[Pro Session] Atomic start successful:', data);
        } catch (err) {
          console.error('[Pro Session] Atomic start error:', err);
          toast({
            variant: 'destructive',
            title: 'Session Error',
            description: 'Failed to verify session limits. Please try again.',
          });
          return;
        }
      }

      // Scroll to top AFTER limit check passes
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      if (type === 'quick_prep') {
        // Generate Quick Prep content (unlimited, no atomic check needed)
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
        // For Mock or Audio, session was already atomically started above
        setIsSessionStarted(true);
        toast({
          title: 'Session Started!',
          description: type === 'premium_audio' 
            ? 'Click "Begin Interview" when you\'re ready to start.'
            : 'Your personalized coaching session has begun.',
        });
      }
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
      }[resolvedSessionType || ''] || 'coaching session';
      
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
              Your results were sent to <span className="font-semibold text-foreground">{derivedEmail}</span>.
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
          sessionType={resolvedSessionType} 
          userEmail={derivedEmail}
          isPaymentVerified={isPaymentVerified}
          isReady={isDocumentsReady}
          onStartSession={handleStartSession}
        />
      );
    }

    // Use effectiveSessionType for Pro users
    const activeType = effectiveSessionType || resumingSessionType;

    if (isSessionCompleted && resultsReport) {
      const sessionName = {
        quick_prep: 'Quick Prep',
        full_mock: 'Full Mock Interview',
        premium_audio: 'Premium Audio Mock',
        pro: 'Pro Session',
      }[(activeType as string) || ''] || 'coaching session';

      return (
        <SessionResultsView
          sessionLabel={sessionName}
          email={derivedEmail || ''}
          prepPacket={resultsReport?.prepPacket || null}
          transcript={resultsReport?.transcript || null}
          analysisMarkdown={resultsReport?.analysisMarkdown || null}
          isProSubscriber={isProSubscriber}
        />
      );
    }

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
          companyUrl={documents.companyUrl}
        />
      );
    }

    if (activeType === 'premium_audio') {
      console.log('[InterviewCoach] Rendering AudioInterface with resumeFromPause:', resumeFromPause, 'sessionId:', sessionId, 'isAudioInterviewComplete:', isAudioInterviewComplete);

      // If the audio interview is complete, show a completion state instead of AudioInterface
      // This prevents returning to the "Begin Interview" screen after ending the call
      if (isAudioInterviewComplete) {
        // Show "Processing results" while waiting, or error state if something went wrong
        if (isLoading) {
          return (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
                <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Preparing Your Results</h3>
                <p className="text-gray-500 mb-4">Generating your performance analysis...</p>
                <div className="space-y-2 text-left bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="w-5 h-5" />
                    <span className="text-sm">Interview transcript captured</span>
                  </div>
                  <div className="flex items-center gap-2 text-blue-600">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm">Analyzing your responses...</span>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        // If not loading but no results yet, show a "Results Sent" state
        return (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Interview Complete!</h3>
              <p className="text-gray-500 mb-4">Your results have been emailed to <span className="font-medium text-gray-900">{derivedEmail}</span></p>
              <p className="text-sm text-gray-400">Check your inbox for your full performance analysis and interview transcript.</p>
              <Button
                onClick={() => navigate('/')}
                className="mt-6 w-full"
              >
                Return to Home
              </Button>
            </div>
          </div>
        );
      }

      return (
        <AudioInterface 
          isActive={isSessionStarted} 
          sessionId={sessionId}
          documents={documents}
          isDocumentsSaved={isDocumentsSaved}
          resumeFromPause={resumeFromPause}
          onInterviewStarted={() => setIsAudioInterviewStarted(true)}
          onInterviewComplete={() => setIsAudioInterviewComplete(true)}
          onSessionComplete={handleAudioSessionComplete}
          userEmail={derivedEmail}
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
        userEmail={derivedEmail}
        resumeFromPause={resumeFromPause}
        onHeaderPauseStateChange={(state) => setHeaderPauseState(state)}
        onRegisterPauseHandlers={(handlers) => setPauseHandlers(handlers)}
      />
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header 
        sessionType={resolvedSessionType}
        showPauseButton={headerPauseState.showButton}
        isPaused={headerPauseState.isPaused}
        isPausing={headerPauseState.isPausing}
        isResuming={headerPauseState.isResuming}
        onPause={pauseHandlers.onPause}
        onResume={pauseHandlers.onResume}
        showEndButton={headerPauseState.showButton && effectiveSessionType === 'full_mock'}
        isEnding={isEndingInterview}
        onEndInterview={() => {
          setIsEndingInterview(true);
          pauseHandlers.onEnd?.();
          setIsEndingInterview(false);
        }}
      />
      
      <div id="main-scroll-container" className="flex-1 flex flex-col lg:flex-row overflow-y-auto">
        {/* Sidebar - hide when showing completed state */}
        {!showCompletedDialog && !isSessionCompleted && (
          <DocumentSidebar
            documents={documents}
            onDocumentsChange={setDocuments}
            onStartSession={handleStartSession}
            isLoading={isLoading || isGeneratingContent}
            sessionType={resolvedSessionType}
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
          {/* Paused Sessions - always show as a small, non-blocking notification */}
          {derivedEmail && !isSessionStarted && !isVerifying && !showCompletedDialog && (
            <div className="p-4 pb-0">
              <PausedSessionNotification userEmail={derivedEmail} />
            </div>
          )}
          
          {renderMainContent()}
        </main>
      </div>

      {/* Prep Packet Generation Overlay for Audio Mock */}
      <PrepPacketGeneratingOverlay 
        isActive={isGeneratingPrepPacket}
        companyUrl={documents.companyUrl}
      />

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
