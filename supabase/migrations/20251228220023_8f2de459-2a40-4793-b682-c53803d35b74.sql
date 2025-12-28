-- Fix policies that incorrectly target {public} role (includes anon)
-- These should only allow service_role, not anon

-- 1. chat_messages: Fix service role insert policy
DROP POLICY IF EXISTS "Service role can insert chat messages" ON public.chat_messages;
CREATE POLICY "Service role can insert chat messages"
ON public.chat_messages
FOR INSERT
TO service_role
WITH CHECK (true);

-- 2. coaching_sessions: Fix service role policies
DROP POLICY IF EXISTS "Service role can insert sessions" ON public.coaching_sessions;
CREATE POLICY "Service role can insert sessions"
ON public.coaching_sessions
FOR INSERT
TO service_role
WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can update sessions" ON public.coaching_sessions;
CREATE POLICY "Service role can update sessions"
ON public.coaching_sessions
FOR UPDATE
TO service_role
USING (true);

-- 3. discount_code_usage: Fix service role policy
DROP POLICY IF EXISTS "Service role can manage usage" ON public.discount_code_usage;
CREATE POLICY "Service role can manage usage"
ON public.discount_code_usage
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 4. error_logs: Fix service role insert policy
DROP POLICY IF EXISTS "Service role can insert error logs" ON public.error_logs;
CREATE POLICY "Service role can insert error logs"
ON public.error_logs
FOR INSERT
TO service_role
WITH CHECK (true);

-- 5. profiles: Fix service role insert policy
DROP POLICY IF EXISTS "Service role can insert profiles" ON public.profiles;
CREATE POLICY "Service role can insert profiles"
ON public.profiles
FOR INSERT
TO service_role
WITH CHECK (true);

-- 6. session_results: Add service role policy for inserts (edge functions need this)
CREATE POLICY "Service role can manage session results"
ON public.session_results
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);