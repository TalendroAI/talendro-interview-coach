-- Remove the public access policy that exposes discount codes
DROP POLICY IF EXISTS "Anyone can view active discount codes" ON public.discount_codes;

-- Add a policy for service role to validate codes (used by edge functions)
CREATE POLICY "Service role can read discount codes"
  ON public.discount_codes
  FOR SELECT
  USING (true);

-- Note: The existing admin policy remains for admin management
-- Validation happens server-side via validate-discount edge function