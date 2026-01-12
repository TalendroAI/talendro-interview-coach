-- Address linter: replace overly permissive service-role policies (USING/WITH CHECK true)

-- coaching_sessions
DROP POLICY IF EXISTS "Service role can insert sessions" ON public.coaching_sessions;
CREATE POLICY "Service role can insert sessions"
ON public.coaching_sessions
FOR INSERT
TO service_role
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can update sessions" ON public.coaching_sessions;
CREATE POLICY "Service role can update sessions"
ON public.coaching_sessions
FOR UPDATE
TO service_role
USING (auth.role() = 'service_role');

-- chat_messages
DROP POLICY IF EXISTS "Service role can insert chat messages" ON public.chat_messages;
CREATE POLICY "Service role can insert chat messages"
ON public.chat_messages
FOR INSERT
TO service_role
WITH CHECK (auth.role() = 'service_role');

-- discount_code_usage
DROP POLICY IF EXISTS "Service role can manage usage" ON public.discount_code_usage;
CREATE POLICY "Service role can manage usage"
ON public.discount_code_usage
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- error_logs
DROP POLICY IF EXISTS "Service role can insert error logs" ON public.error_logs;
CREATE POLICY "Service role can insert error logs"
ON public.error_logs
FOR INSERT
TO service_role
WITH CHECK (auth.role() = 'service_role');

-- profiles
DROP POLICY IF EXISTS "Service role can insert profiles" ON public.profiles;
CREATE POLICY "Service role can insert profiles"
ON public.profiles
FOR INSERT
TO service_role
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can update profiles" ON public.profiles;
CREATE POLICY "Service role can update profiles"
ON public.profiles
FOR UPDATE
TO service_role
USING (auth.role() = 'service_role');

-- session_results
DROP POLICY IF EXISTS "Service role can manage session results" ON public.session_results;
CREATE POLICY "Service role can manage session results"
ON public.session_results
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
