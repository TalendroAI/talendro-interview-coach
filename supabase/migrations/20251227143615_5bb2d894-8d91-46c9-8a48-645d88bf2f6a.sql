-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Anyone can view sessions by email" ON public.coaching_sessions;

-- Create a more restrictive policy that only allows access via authenticated profile
-- Unauthenticated session access will go through edge functions with service role
CREATE POLICY "Users can view their own sessions by profile"
ON public.coaching_sessions
FOR SELECT
USING (auth.uid() = profile_id);