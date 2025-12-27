-- Drop and recreate the SELECT policy with explicit auth check
DROP POLICY IF EXISTS "Users can view their own session results" ON public.session_results;

CREATE POLICY "Users can view their own session results"
ON public.session_results
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.coaching_sessions cs
    WHERE cs.id = session_results.session_id
    AND cs.profile_id = auth.uid()
  )
);