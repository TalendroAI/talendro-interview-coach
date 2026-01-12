-- Fix RLS policies: Make user and admin SELECT policies PERMISSIVE (OR logic)
-- so that either admins OR session owners can view data

-- coaching_sessions: Fix SELECT policies to be PERMISSIVE
DROP POLICY IF EXISTS "Admins can view all sessions" ON public.coaching_sessions;
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.coaching_sessions;

CREATE POLICY "Admins can view all sessions" 
ON public.coaching_sessions
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own sessions" 
ON public.coaching_sessions
FOR SELECT
TO authenticated
USING (
  auth.uid() = profile_id
  OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

-- chat_messages: Add admin access and make policies PERMISSIVE
DROP POLICY IF EXISTS "Users can view their own session messages" ON public.chat_messages;

CREATE POLICY "Admins can view all chat messages"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

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

-- session_results: Add admin access and make policies PERMISSIVE
DROP POLICY IF EXISTS "Users can view their own session results" ON public.session_results;

CREATE POLICY "Admins can view all session results"
ON public.session_results
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

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