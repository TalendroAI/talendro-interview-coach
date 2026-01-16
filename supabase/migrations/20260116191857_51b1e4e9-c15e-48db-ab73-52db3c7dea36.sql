-- Drop existing foreign key constraints and recreate with ON DELETE CASCADE
-- This allows sessions to be deleted along with their related records

-- 1. error_logs -> coaching_sessions
ALTER TABLE public.error_logs 
DROP CONSTRAINT IF EXISTS error_logs_session_id_fkey;

ALTER TABLE public.error_logs
ADD CONSTRAINT error_logs_session_id_fkey 
FOREIGN KEY (session_id) REFERENCES public.coaching_sessions(id) 
ON DELETE CASCADE;

-- 2. chat_messages -> coaching_sessions
ALTER TABLE public.chat_messages 
DROP CONSTRAINT IF EXISTS chat_messages_session_id_fkey;

ALTER TABLE public.chat_messages
ADD CONSTRAINT chat_messages_session_id_fkey 
FOREIGN KEY (session_id) REFERENCES public.coaching_sessions(id) 
ON DELETE CASCADE;

-- 3. session_results -> coaching_sessions
ALTER TABLE public.session_results 
DROP CONSTRAINT IF EXISTS session_results_session_id_fkey;

ALTER TABLE public.session_results
ADD CONSTRAINT session_results_session_id_fkey 
FOREIGN KEY (session_id) REFERENCES public.coaching_sessions(id) 
ON DELETE CASCADE;

-- 4. discount_code_usage -> coaching_sessions
ALTER TABLE public.discount_code_usage 
DROP CONSTRAINT IF EXISTS discount_code_usage_session_id_fkey;

ALTER TABLE public.discount_code_usage
ADD CONSTRAINT discount_code_usage_session_id_fkey 
FOREIGN KEY (session_id) REFERENCES public.coaching_sessions(id) 
ON DELETE CASCADE;