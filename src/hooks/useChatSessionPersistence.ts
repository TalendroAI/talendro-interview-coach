import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface HistoryEntry {
  id: string;
  role: string;
  content: string;
  created_at: string;
  question_number: number | null;
}

/**
 * Hook to persist text-based chat session messages to the database in real-time
 * and fetch full history on resume.
 */
export function useChatSessionPersistence(sessionId?: string, userEmail?: string) {
  const pendingRef = useRef<Promise<void> | null>(null);
  const questionCountRef = useRef(0);

  /**
   * Append a single message to the database.
   */
  const appendMessage = useCallback(async (message: Message) => {
    if (!sessionId || !userEmail) {
      console.warn('[chat-session] Missing sessionId or email for appendMessage');
      return;
    }

    // Track question count for assistant messages with "?"
    if (message.role === 'assistant' && message.content.includes('?')) {
      questionCountRef.current += 1;
    }

    // Serialize to avoid race conditions
    const prev = pendingRef.current ?? Promise.resolve();
    const task = prev.then(async () => {
      try {
        const { error } = await supabase.functions.invoke('audio-session', {
          body: {
            action: 'append_turn',
            sessionId,
            email: userEmail,
            role: message.role,
            content: message.content,
            questionNumber: message.role === 'assistant' && message.content.includes('?') 
              ? questionCountRef.current 
              : null,
          },
        });

        if (error) {
          console.error('[chat-session] appendMessage error:', error);
        }
      } catch (err) {
        console.error('[chat-session] appendMessage exception:', err);
      }
    });

    pendingRef.current = task;
    await task;
  }, [sessionId, userEmail]);

  /**
   * Fetch the FULL conversation history from the database.
   */
  const getHistory = useCallback(async (): Promise<Message[]> => {
    if (!sessionId || !userEmail) {
      console.warn('[chat-session] Missing sessionId or email for getHistory');
      return [];
    }

    try {
      const { data, error } = await supabase.functions.invoke('audio-session', {
        body: {
          action: 'get_history',
          sessionId,
          email: userEmail,
        },
      });

      if (error) {
        console.error('[chat-session] getHistory error:', error);
        return [];
      }

      const entries = (data?.messages as HistoryEntry[]) ?? [];
      
      // Update question count from history
      const assistantWithQuestions = entries.filter(
        e => e.role === 'assistant' && e.content.includes('?')
      );
      questionCountRef.current = assistantWithQuestions.length;

      return entries.map(e => ({
        id: e.id,
        role: e.role as 'user' | 'assistant',
        content: e.content,
        timestamp: new Date(e.created_at),
      }));
    } catch (err) {
      console.error('[chat-session] getHistory exception:', err);
      return [];
    }
  }, [sessionId, userEmail]);

  /**
   * Pause the current session - saves state to database.
   */
  const pauseSession = useCallback(async () => {
    if (!sessionId || !userEmail) {
      console.warn('[chat-session] Missing sessionId or email for pauseSession');
      return false;
    }

    try {
      const { error } = await supabase.functions.invoke('audio-session', {
        body: {
          action: 'pause_session',
          sessionId,
          email: userEmail,
          questionNumber: questionCountRef.current,
        },
      });

      if (error) {
        console.error('[chat-session] pauseSession error:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('[chat-session] pauseSession exception:', err);
      return false;
    }
  }, [sessionId, userEmail]);

  /**
   * Resume a paused session - fetches history and clears paused state.
   */
  const resumeSession = useCallback(async (): Promise<{ messages: Message[]; expired?: boolean } | null> => {
    if (!sessionId || !userEmail) {
      console.warn('[chat-session] Missing sessionId or email for resumeSession');
      return null;
    }

    try {
      const { data, error } = await supabase.functions.invoke('audio-session', {
        body: {
          action: 'resume_session',
          sessionId,
          email: userEmail,
        },
      });

      if (error) {
        console.error('[chat-session] resumeSession error:', error);
        return null;
      }

      if (data?.expired) {
        return { messages: [], expired: true };
      }

      const entries = (data?.messages as HistoryEntry[]) ?? [];
      
      // Update question count from history
      const assistantWithQuestions = entries.filter(
        e => e.role === 'assistant' && e.content.includes('?')
      );
      questionCountRef.current = assistantWithQuestions.length;

      return {
        messages: entries.map(e => ({
          id: e.id,
          role: e.role as 'user' | 'assistant',
          content: e.content,
          timestamp: new Date(e.created_at),
        })),
      };
    } catch (err) {
      console.error('[chat-session] resumeSession exception:', err);
      return null;
    }
  }, [sessionId, userEmail]);

  return { 
    appendMessage, 
    getHistory, 
    pauseSession, 
    resumeSession,
    getQuestionCount: () => questionCountRef.current,
  };
}