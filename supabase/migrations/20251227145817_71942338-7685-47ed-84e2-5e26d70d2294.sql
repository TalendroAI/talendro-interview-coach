-- Drop and recreate the SELECT policy with explicit auth check
DROP POLICY IF EXISTS "Users can view their own sessions by profile" ON public.coaching_sessions;

CREATE POLICY "Users can view their own sessions by profile"
ON public.coaching_sessions
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND auth.uid() = profile_id
);