-- Fix session history visibility for authenticated users by allowing access via auth email

-- coaching_sessions: replace profile_id-only SELECT policy with profile_id OR email match
DROP POLICY IF EXISTS "Users can view their own sessions by profile" ON public.coaching_sessions;

CREATE POLICY "Users can view their own sessions" 
ON public.coaching_sessions
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    auth.uid() = profile_id
    OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

-- chat_messages: allow reading messages for sessions owned by user (profile_id OR email)
DROP POLICY IF EXISTS "Users can view their own session messages" ON public.chat_messages;

CREATE POLICY "Users can view their own session messages"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.coaching_sessions cs
    WHERE cs.id = chat_messages.session_id
      AND (
        cs.profile_id = auth.uid()
        OR lower(cs.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
);

-- session_results: allow reading results for sessions owned by user (profile_id OR email)
DROP POLICY IF EXISTS "Users can view their own session results" ON public.session_results;

CREATE POLICY "Users can view their own session results"
ON public.session_results
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.coaching_sessions cs
    WHERE cs.id = session_results.session_id
      AND (
        cs.profile_id = auth.uid()
        OR lower(cs.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
);
