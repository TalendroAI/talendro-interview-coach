import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, User, Bot, Loader2, Pause, Play, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { SessionType, SESSION_CONFIGS, DocumentInputs } from '@/types/session';
import { sendAIMessage } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { CompleteSessionButton } from './CompleteSessionButton';
import { useChatSessionPersistence } from '@/hooks/useChatSessionPersistence';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface HeaderPauseState {
  showButton: boolean;
  isPaused: boolean;
  isPausing: boolean;
  isResuming: boolean;
}

interface ChatInterfaceProps {
  sessionType: SessionType;
  isActive: boolean;
  sessionId?: string;
  documents: DocumentInputs;
  onInterviewComplete?: (messages: Message[]) => void;
  onCompleteSession: () => void;
  isCompletingSession: boolean;
  isSessionCompleted: boolean;
  isContentReady: boolean;
  userEmail?: string;
  resumeFromPause?: boolean;
  onPauseStateChange?: (isPaused: boolean) => void;
  onHeaderPauseStateChange?: (state: HeaderPauseState) => void;
  onRegisterPauseHandlers?: (handlers: { onPause?: () => void; onResume?: () => void }) => void;
}

export function ChatInterface({ 
  sessionType, 
  isActive, 
  sessionId, 
  documents, 
  onInterviewComplete, 
  onCompleteSession, 
  isCompletingSession, 
  isSessionCompleted, 
  isContentReady,
  userEmail,
  resumeFromPause = false,
  onPauseStateChange,
  onHeaderPauseStateChange,
  onRegisterPauseHandlers,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInterviewComplete, setIsInterviewComplete] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const config = SESSION_CONFIGS[sessionType];
  const { toast } = useToast();
  
  // Real-time persistence hook
  const { appendMessage, pauseSession, resumeSession, getHistory } = useChatSessionPersistence(sessionId, userEmail);

  // Check if the interview is complete by looking for the completion marker
  const checkInterviewComplete = (content: string) => {
    const completionMarkers = ['## INTERVIEW COMPLETE', '**INTERVIEW COMPLETE**', 'INTERVIEW COMPLETE'];
    return completionMarkers.some(marker => content.toUpperCase().includes(marker.toUpperCase()));
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle resume from pause
  useEffect(() => {
    if (resumeFromPause && isActive && sessionId && !isInitialized) {
      handleResumeFromPause();
    }
  }, [resumeFromPause, isActive, sessionId, isInitialized]);

  // Initialize the session with AI
  useEffect(() => {
    if (isActive && !isInitialized && sessionId && !resumeFromPause) {
      initializeSession();
    }
  }, [isActive, isInitialized, sessionId, resumeFromPause]);

  // Update header pause state whenever relevant state changes
  useEffect(() => {
    const showButton = isInitialized && !isInterviewComplete && !isSessionCompleted;
    onHeaderPauseStateChange?.({
      showButton,
      isPaused,
      isPausing,
      isResuming,
    });
  }, [isInitialized, isInterviewComplete, isSessionCompleted, isPaused, isPausing, isResuming, onHeaderPauseStateChange]);

  const handleResumeFromPause = async () => {
    setIsResuming(true);
    try {
      const result = await resumeSession();
      
      if (!result) {
        throw new Error('Failed to resume session');
      }
      
      if (result.expired) {
        toast({
          variant: 'destructive',
          title: 'Session Expired',
          description: 'Your paused session has expired. Please start a new session.',
        });
        return;
      }
      
      // Restore messages from database
      if (result.messages.length > 0) {
        setMessages(result.messages);
        setIsInitialized(true);
        
        // Check if interview was already complete
        const lastAssistant = result.messages.filter(m => m.role === 'assistant').pop();
        if (lastAssistant && checkInterviewComplete(lastAssistant.content)) {
          setIsInterviewComplete(true);
          onInterviewComplete?.(result.messages);
        } else {
          // Send a resume message to Claude to continue
          await sendResumeMessage(result.messages);
        }
        
        toast({
          title: 'Session Resumed',
          description: 'Welcome back! Continuing from where you left off.',
        });
      } else {
        // No history found, start fresh
        initializeSession();
      }
    } catch (err) {
      console.error('Error resuming session:', err);
      toast({
        variant: 'destructive',
        title: 'Resume Failed',
        description: 'Could not resume your session. Starting fresh.',
      });
      initializeSession();
    } finally {
      setIsResuming(false);
    }
  };

  const sendResumeMessage = async (previousMessages: Message[]) => {
    setIsLoading(true);
    try {
      // Build context from previous messages
      const historyContext = previousMessages
        .map(m => `${m.role === 'user' ? 'Candidate' : 'Interviewer'}: ${m.content}`)
        .join('\n\n');
      
      const resumePrompt = `[SYSTEM: The candidate has returned from a pause. Here is the conversation so far:\n\n${historyContext}\n\nContinue the interview naturally. Say something like "Welcome back! Let's continue where we left off." and then proceed with the next question or follow up on their last answer.]`;
      
      const response = await sendAIMessage(
        sessionId,
        sessionType,
        resumePrompt,
        documents.resume,
        documents.jobDescription,
        documents.companyUrl,
        false
      );

      const resumeMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, resumeMessage]);
      await appendMessage(resumeMessage);
    } catch (error) {
      console.error('Error sending resume message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const initializeSession = async () => {
    setIsLoading(true);
    try {
      const response = await sendAIMessage(
        sessionId,
        sessionType,
        undefined,
        documents.resume,
        documents.jobDescription,
        documents.companyUrl,
        true
      );

      const initialMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };
      setMessages([initialMessage]);
      setIsInitialized(true);
      
      // Persist initial message
      await appendMessage(initialMessage);
    } catch (error) {
      console.error('Error initializing session:', error);
      toast({
        title: 'Error',
        description: 'Failed to start the coaching session. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePauseInterview = useCallback(async () => {
    setIsPausing(true);
    try {
      const success = await pauseSession();
      
      if (success) {
        setIsPaused(true);
        onPauseStateChange?.(true);
        toast({
          title: 'Interview Paused',
          description: 'Your progress is saved. You can resume within 24 hours.',
        });
      } else {
        throw new Error('Failed to pause session');
      }
    } catch (err) {
      console.error('Error pausing interview:', err);
      toast({
        variant: 'destructive',
        title: 'Pause Failed',
        description: 'Could not pause the interview. Please try again.',
      });
    } finally {
      setIsPausing(false);
    }
  }, [pauseSession, toast, onPauseStateChange]);

  const handleResumeInterview = useCallback(async () => {
    setIsResuming(true);
    try {
      const result = await resumeSession();
      
      if (!result) {
        throw new Error('Failed to resume session');
      }
      
      if (result.expired) {
        toast({
          variant: 'destructive',
          title: 'Session Expired',
          description: 'Your paused session has expired (24 hour limit).',
        });
        return;
      }
      
      setIsPaused(false);
      onPauseStateChange?.(false);
      
      // Send a resume message to continue naturally
      await sendResumeMessage(messages);
      
      toast({
        title: 'Interview Resumed',
        description: 'Let\'s continue where we left off.',
      });
    } catch (err) {
      console.error('Error resuming interview:', err);
      toast({
        variant: 'destructive',
        title: 'Resume Failed',
        description: 'Could not resume the interview. Please try again.',
      });
    } finally {
      setIsResuming(false);
    }
  }, [resumeSession, messages, toast, onPauseStateChange]);

  // Register pause/resume handlers with parent for Header component
  useEffect(() => {
    onRegisterPauseHandlers?.({
      onPause: handlePauseInterview,
      onResume: handleResumeInterview,
    });
  }, [onRegisterPauseHandlers, handlePauseInterview, handleResumeInterview]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || isPaused) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    // Persist user message immediately
    await appendMessage(userMessage);

    try {
      const response = await sendAIMessage(
        sessionId,
        sessionType,
        userMessage.content
      );

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };
      
      const updatedMessages = [...messages, userMessage, assistantMessage];
      setMessages(updatedMessages);
      
      // Persist assistant message
      await appendMessage(assistantMessage);
      
      // Check if interview is complete
      if (checkInterviewComplete(response) && !isInterviewComplete) {
        setIsInterviewComplete(true);
        onInterviewComplete?.(updatedMessages);
        toast({
          title: 'Interview Complete!',
          description: 'Click "Complete Session & Get Results" to receive your detailed report.',
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to get a response. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (!isActive) return null;

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Chat Header */}
      <div className="p-4 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-foreground">
                {config.name} Session
              </h3>
              <p className="text-sm text-muted-foreground">
                {isPaused ? (
                  <span className="text-warning font-medium">Interview Paused</span>
                ) : (
                  'AI Interview Coach'
                )}
              </p>
            </div>
          </div>
          
        </div>
      </div>

      {/* Paused Overlay */}
      {isPaused && (
        <div className="bg-warning/10 border-b border-warning/30 p-4 text-center">
          <p className="text-warning font-medium">
            Interview is paused. Your progress is saved for 24 hours.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Click "Resume Interview" when you're ready to continue.
          </p>
        </div>
      )}

      {/* Resuming State */}
      {isResuming && !isInitialized && (
        <div className="flex-1 flex items-center justify-center py-8">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Resuming your interview session...</p>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className={cn(
        "flex-1 overflow-y-auto px-4 py-2 space-y-3",
        isPaused && "opacity-75"
      )}>
        {!isInitialized && isLoading && !isResuming && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Preparing your personalized coaching session...</p>
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={message.id}
            className={cn(
              "flex gap-3 animate-slide-up",
              message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
            )}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div
              className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-gradient-to-br from-primary to-secondary text-primary-foreground'
              )}
            >
              {message.role === 'user' ? (
                <User className="h-4 w-4" />
              ) : (
                <Bot className="h-4 w-4" />
              )}
            </div>
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-3",
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-tr-md'
                  : 'bg-muted text-foreground rounded-tl-md'
              )}
            >
              <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
              <p
                className={cn(
                  "text-xs mt-2 opacity-70",
                  message.role === 'user' ? 'text-right' : 'text-left'
                )}
              >
                {message.timestamp.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        ))}
        
        {isLoading && isInitialized && (
          <div className="flex gap-3 animate-fade-in">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="bg-muted rounded-2xl rounded-tl-md px-4 py-3">
              <div className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        {/* Complete Session Button at end of messages */}
        {isInterviewComplete && (
          <div className="flex justify-center py-6">
            <CompleteSessionButton
              onClick={onCompleteSession}
              isLoading={isCompletingSession}
              isDisabled={!isContentReady}
              isCompleted={isSessionCompleted}
              className="min-w-[280px]"
            />
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-border bg-card">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isPaused ? "Interview paused - click Resume to continue" : "Type or dictate your response..."}
              className="min-h-[50px] max-h-[120px] resize-none pr-10"
              disabled={isLoading || !isInitialized || isPaused}
            />
            <Mic className="absolute right-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading || !isInitialized || isPaused}
            className="h-[50px] w-[50px]"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5 text-center flex items-center justify-center gap-1">
          <Mic className="h-3 w-3" /> Use keyboard dictation or type • Enter to send
        </p>
      </form>
    </div>
  );
}