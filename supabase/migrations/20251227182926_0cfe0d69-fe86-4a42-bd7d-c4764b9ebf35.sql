-- Remove the overly permissive policy that allows public access
DROP POLICY IF EXISTS "Service role can manage session results" ON public.session_results;

-- The existing "Users can view their own session results" policy already has proper auth checks:
-- USING (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM coaching_sessions cs WHERE cs.id = session_results.session_id AND cs.profile_id = auth.uid()))

-- Service role bypasses RLS, so edge functions can still manage session_results
-- Regular users can only view results for sessions they own