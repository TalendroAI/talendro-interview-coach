import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type ErrorType = 'session' | 'discount' | 'general';

export interface ErrorContext {
  page?: string;
  action?: string;
  sessionType?: string;
  additionalInfo?: Record<string, unknown>;
}

export interface ErrorReport {
  errorType: ErrorType;
  errorCode?: string;
  errorMessage: string;
  userEmail?: string;
  sessionId?: string;
  context?: ErrorContext;
}

export interface ErrorResolution {
  success: boolean;
  resolved: boolean;
  resolution?: string;
  errorLogId?: string;
}

/**
 * Reports an error to the AI-powered resolution system.
 * The system will:
 * 1. Log the error
 * 2. Attempt AI resolution
 * 3. Email the user with a resolution
 * 4. Notify admin with a copy
 */
export async function reportError(error: ErrorReport): Promise<ErrorResolution | null> {
  try {
    console.log('[errorHandler] Reporting error:', error);

    const { data, error: invokeError } = await supabase.functions.invoke('resolve-error', {
      body: error
    });

    if (invokeError) {
      console.error('[errorHandler] Failed to invoke resolve-error:', invokeError);
      // Don't show a toast here - we don't want to confuse the user with meta-errors
      return null;
    }

    // If we got a resolution, show it to the user immediately
    if (data?.resolution) {
      toast({
        title: "We're on it!",
        description: data.resolution,
        duration: 10000, // Give them time to read it
      });
    }

    return data as ErrorResolution;
  } catch (err) {
    console.error('[errorHandler] Error reporting error:', err);
    return null;
  }
}

/**
 * Wraps an async function with automatic error reporting.
 * Use this for critical user-facing operations.
 */
export function withErrorReporting<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  errorType: ErrorType,
  getContext: () => { userEmail?: string; sessionId?: string; context?: ErrorContext }
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      const { userEmail, sessionId, context } = getContext();
      
      await reportError({
        errorType,
        errorCode: error instanceof Error ? error.name : 'unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
        userEmail,
        sessionId,
        context
      });

      throw error; // Re-throw so the calling code can handle it too
    }
  }) as T;
}

/**
 * Helper to report session errors
 */
export async function reportSessionError(
  errorMessage: string,
  errorCode: string,
  userEmail?: string,
  sessionId?: string,
  context?: ErrorContext
): Promise<ErrorResolution | null> {
  return reportError({
    errorType: 'session',
    errorCode,
    errorMessage,
    userEmail,
    sessionId,
    context
  });
}

/**
 * Helper to report discount code errors
 */
export async function reportDiscountError(
  errorMessage: string,
  errorCode: string,
  userEmail?: string,
  context?: ErrorContext
): Promise<ErrorResolution | null> {
  return reportError({
    errorType: 'discount',
    errorCode,
    errorMessage,
    userEmail,
    context
  });
}

/**
 * Helper to report general errors
 */
export async function reportGeneralError(
  errorMessage: string,
  errorCode?: string,
  userEmail?: string,
  context?: ErrorContext
): Promise<ErrorResolution | null> {
  return reportError({
    errorType: 'general',
    errorCode,
    errorMessage,
    userEmail,
    context
  });
}
