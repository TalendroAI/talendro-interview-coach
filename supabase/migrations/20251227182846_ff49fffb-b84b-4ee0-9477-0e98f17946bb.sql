-- Remove the overly permissive policy just created
DROP POLICY IF EXISTS "Service role can read discount codes" ON public.discount_codes;

-- Discount codes should only be readable by admins
-- The validate-discount edge function uses service role which bypasses RLS
-- This ensures no public exposure of discount codes