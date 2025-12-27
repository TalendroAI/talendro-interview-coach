-- Add explicit policies requiring authentication for SELECT operations
-- This blocks anonymous public access while maintaining existing user access patterns

-- profiles: Add explicit auth requirement (policy already checks auth.uid() = user_id, but add clarity)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" 
  ON public.profiles 
  FOR SELECT 
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- coaching_sessions: Already has proper policies, just ensuring no anonymous access
-- Existing policies already check auth.uid() = profile_id or admin role

-- session_results: Add explicit auth requirement
DROP POLICY IF EXISTS "Users can view their own session results" ON public.session_results;
CREATE POLICY "Users can view their own session results" 
  ON public.session_results 
  FOR SELECT 
  USING (
    auth.uid() IS NOT NULL AND 
    EXISTS (
      SELECT 1 FROM coaching_sessions cs 
      WHERE cs.id = session_results.session_id 
      AND cs.profile_id = auth.uid()
    )
  );

-- chat_messages: Add explicit auth requirement
DROP POLICY IF EXISTS "Users can view chat messages for their sessions" ON public.chat_messages;
CREATE POLICY "Users can view chat messages for their sessions" 
  ON public.chat_messages 
  FOR SELECT 
  USING (
    auth.uid() IS NOT NULL AND 
    EXISTS (
      SELECT 1 FROM coaching_sessions cs 
      WHERE cs.id = chat_messages.session_id 
      AND cs.profile_id = auth.uid()
    )
  );

-- error_logs: Add explicit auth requirement for admins only
DROP POLICY IF EXISTS "Admins can view all error logs" ON public.error_logs;
CREATE POLICY "Admins can view all error logs" 
  ON public.error_logs 
  FOR SELECT 
  USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'));

-- discount_code_usage: Add admin-only SELECT policy
CREATE POLICY "Admins can view discount usage" 
  ON public.discount_code_usage 
  FOR SELECT 
  USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'));

-- user_roles: Add explicit auth requirement
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" 
  ON public.user_roles 
  FOR SELECT 
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);