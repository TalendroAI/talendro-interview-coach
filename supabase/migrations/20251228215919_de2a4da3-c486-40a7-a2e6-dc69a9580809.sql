-- Block anonymous access to all sensitive tables

-- 1. profiles table
DROP POLICY IF EXISTS "anon_cannot_read_profiles" ON public.profiles;
CREATE POLICY "anon_cannot_read_profiles"
ON public.profiles
FOR SELECT
TO anon
USING (false);

-- 2. coaching_sessions table
DROP POLICY IF EXISTS "anon_cannot_read_sessions" ON public.coaching_sessions;
CREATE POLICY "anon_cannot_read_sessions"
ON public.coaching_sessions
FOR SELECT
TO anon
USING (false);

-- 3. chat_messages table
DROP POLICY IF EXISTS "anon_cannot_read_messages" ON public.chat_messages;
CREATE POLICY "anon_cannot_read_messages"
ON public.chat_messages
FOR SELECT
TO anon
USING (false);

-- 4. error_logs table
DROP POLICY IF EXISTS "anon_cannot_read_errors" ON public.error_logs;
CREATE POLICY "anon_cannot_read_errors"
ON public.error_logs
FOR SELECT
TO anon
USING (false);

-- 5. discount_code_usage table
DROP POLICY IF EXISTS "anon_cannot_read_usage" ON public.discount_code_usage;
CREATE POLICY "anon_cannot_read_usage"
ON public.discount_code_usage
FOR SELECT
TO anon
USING (false);

-- 6. user_roles table
DROP POLICY IF EXISTS "anon_cannot_read_roles" ON public.user_roles;
CREATE POLICY "anon_cannot_read_roles"
ON public.user_roles
FOR SELECT
TO anon
USING (false);

-- 7. discount_codes table
DROP POLICY IF EXISTS "anon_cannot_read_codes" ON public.discount_codes;
CREATE POLICY "anon_cannot_read_codes"
ON public.discount_codes
FOR SELECT
TO anon
USING (false);