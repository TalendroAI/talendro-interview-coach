-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Anyone can view chat messages for their session" ON public.chat_messages;

-- Create a restrictive policy that only allows authenticated users to view messages for their sessions
CREATE POLICY "Users can view chat messages for their sessions"
ON public.chat_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.coaching_sessions cs
    WHERE cs.id = chat_messages.session_id
    AND cs.profile_id = auth.uid()
  )
);