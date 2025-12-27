-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Anyone can view session results" ON public.session_results;

-- Create a restrictive policy that only allows authenticated users to view their own results
CREATE POLICY "Users can view their own session results"
ON public.session_results
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.coaching_sessions cs
    WHERE cs.id = session_results.session_id
    AND cs.profile_id = auth.uid()
  )
);