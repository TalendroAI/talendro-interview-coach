-- Add DELETE policy for admins on coaching_sessions
CREATE POLICY "Admins can delete sessions"
ON public.coaching_sessions
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Also add DELETE policy for related tables that admins may need to clean up
CREATE POLICY "Admins can delete chat messages"
ON public.chat_messages
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete session results"
ON public.session_results
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete error logs"
ON public.error_logs
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));