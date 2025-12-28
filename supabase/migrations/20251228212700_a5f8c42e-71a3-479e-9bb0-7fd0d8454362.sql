-- Fix session_results RLS warning by scoping the allow policy to authenticated users
-- and explicitly denying anon SELECT.

ALTER TABLE public.session_results ENABLE ROW LEVEL SECURITY;

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
      AND cs.profile_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Anon cannot view session results" ON public.session_results;

CREATE POLICY "Anon cannot view session results"
ON public.session_results
FOR SELECT
TO anon
USING (false);
