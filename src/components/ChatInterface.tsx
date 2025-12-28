import { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { SessionType, SESSION_CONFIGS, DocumentInputs } from '@/types/session';
import { sendAIMessage } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { CompleteSessionButton } from './CompleteSessionButton';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
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
}

export function ChatInterface({ sessionType, isActive, sessionId, documents, onInterviewComplete, onCompleteSession, isCompletingSession, isSessionCompleted, isContentReady }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInterviewComplete, setIsInterviewComplete] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const config = SESSION_CONFIGS[sessionType];
  const { toast } = useToast();

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

  // Initialize the session with AI
  useEffect(() => {
    if (isActive && !isInitialized && sessionId) {
      initializeSession();
    }
  }, [isActive, isInitialized, sessionId]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

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
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <Bot className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-heading font-semibold text-foreground">
              {config.name} Session
            </h3>
            <p className="text-sm text-muted-foreground">AI Interview Coach</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!isInitialized && isLoading && (
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
      <form onSubmit={handleSubmit} className="p-4 border-t border-border bg-card">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your response..."
            className="min-h-[50px] max-h-[150px] resize-none"
            disabled={isLoading || !isInitialized}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading || !isInitialized}
            className="h-[50px] w-[50px]"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </form>
    </div>
  );
}
