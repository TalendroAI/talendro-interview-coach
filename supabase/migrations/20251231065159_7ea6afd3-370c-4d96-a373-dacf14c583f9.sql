-- Create a function to read secrets from Supabase Vault
-- This function must be SECURITY DEFINER to access vault schema
CREATE OR REPLACE FUNCTION public.get_secret_from_vault(secret_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  secret_value TEXT;
BEGIN
  SELECT decrypted_secret INTO secret_value
  FROM vault.decrypted_secrets
  WHERE name = secret_name
  LIMIT 1;
  
  RETURN secret_value;
END;
$$;