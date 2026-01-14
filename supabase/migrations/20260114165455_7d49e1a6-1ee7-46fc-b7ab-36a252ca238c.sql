-- Revoke all execute privileges from the get_secret_from_vault function
-- This prevents any user from accessing vault secrets directly
REVOKE ALL ON FUNCTION public.get_secret_from_vault(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_secret_from_vault(TEXT) FROM authenticated;
REVOKE ALL ON FUNCTION public.get_secret_from_vault(TEXT) FROM anon;

-- Only grant execute to service_role (used by edge functions with service key)
GRANT EXECUTE ON FUNCTION public.get_secret_from_vault(TEXT) TO service_role;