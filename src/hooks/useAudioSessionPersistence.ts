import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Turn {
  role: 'user' | 'assistant';
  text: string;
  questionNumber?: number | null;
}

interface HistoryEntry {
  id: string;
  role: string;
  content: string;
  created_at: string;
  question_number: number | null;
}

interface LogEventParams {
  eventType: string;
  message: string;
  code?: string | null;
  context?: Record<string, unknown> | null;
}

/**
 * Hook to persist audio session turns to the database in real-time
 * and fetch full history on reconnect.
 */
export function useAudioSessionPersistence(sessionId?: string, userEmail?: string) {
  const pendingRef = useRef<Promise<void> | null>(null);

  /**
   * Append a single turn (user or assistant) to the database.
   * Deduplicates by checking content against recent entries.
   */
  const appendTurn = useCallback(async (turn: Turn) => {
    if (!sessionId || !userEmail) {
      console.warn('[audio-session] Missing sessionId or email for appendTurn');
      return;
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
            role: turn.role,
            content: turn.text,
            questionNumber: turn.questionNumber ?? null,
          },
        });

        if (error) {
          console.error('[audio-session] appendTurn error:', error);
        }
      } catch (err) {
        console.error('[audio-session] appendTurn exception:', err);
      }
    });

    pendingRef.current = task;
    await task;
  }, [sessionId, userEmail]);

  /**
   * Fetch the FULL conversation history from the database.
   * Returns an array of { role, content, question_number } objects.
   */
  const getHistory = useCallback(async (): Promise<HistoryEntry[]> => {
    if (!sessionId || !userEmail) {
      console.warn('[audio-session] Missing sessionId or email for getHistory');
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
        console.error('[audio-session] getHistory error:', error);
        return [];
      }

      return (data?.messages as HistoryEntry[]) ?? [];
    } catch (err) {
      console.error('[audio-session] getHistory exception:', err);
      return [];
    }
  }, [sessionId, userEmail]);

  /**
   * Log an event (disconnect, error, etc.) for diagnostics.
   */
  const logEvent = useCallback(async (params: LogEventParams) => {
    if (!sessionId || !userEmail) {
      console.warn('[audio-session] Missing sessionId or email for logEvent');
      return;
    }

    try {
      await supabase.functions.invoke('audio-session', {
        body: {
          action: 'log_event',
          sessionId,
          email: userEmail,
          eventType: params.eventType,
          message: params.message,
          code: params.code ?? null,
          context: params.context ?? null,
        },
      });
    } catch (err) {
      console.error('[audio-session] logEvent exception:', err);
    }
  }, [sessionId, userEmail]);

  return { appendTurn, getHistory, logEvent };
}
