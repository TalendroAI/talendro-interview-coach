-- Fix 1: welcome_emails_sent table - Remove overly permissive policy and add proper restrictive policies
-- This table should ONLY be accessible by service role (for webhook operations) and admins

-- Drop the dangerously permissive policy that allows anyone to read customer emails
DROP POLICY IF EXISTS "Service role can manage welcome emails" ON public.welcome_emails_sent;

-- Create proper restrictive policies
-- Only service role can insert/update (for webhook operations)
CREATE POLICY "Service role can manage welcome emails"
ON public.welcome_emails_sent
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Only admins can SELECT (for admin dashboard oversight)
CREATE POLICY "Admins can view welcome emails"
ON public.welcome_emails_sent
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Explicitly deny anonymous access
CREATE POLICY "Anon cannot access welcome emails"
ON public.welcome_emails_sent
FOR ALL
USING (false)
WITH CHECK (false);

-- Fix 2: coaching_sessions table - Strengthen the user access policy
-- The current policy allows access by email OR profile_id, which is risky
-- Change to require authenticated user AND (profile_id match OR email match)

-- Drop the existing user policy
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.coaching_sessions;

-- Create a stronger policy that requires authentication AND ownership verification
CREATE POLICY "Users can view their own sessions"
ON public.coaching_sessions
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    auth.uid() = profile_id OR 
    lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  )
);

-- Fix 3: chat_messages - Update user policy to require authentication first
DROP POLICY IF EXISTS "Users can view their own session messages" ON public.chat_messages;

CREATE POLICY "Users can view their own session messages"
ON public.chat_messages
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM coaching_sessions cs
    WHERE cs.id = chat_messages.session_id 
    AND (
      cs.profile_id = auth.uid() OR 
      lower(cs.email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
    )
  )
);

-- Fix 4: session_results - Update user policy to require authentication first  
DROP POLICY IF EXISTS "Users can view their own session results" ON public.session_results;

CREATE POLICY "Users can view their own session results"
ON public.session_results
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM coaching_sessions cs
    WHERE cs.id = session_results.session_id 
    AND (
      cs.profile_id = auth.uid() OR 
      lower(cs.email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
    )
  )
);

-- Fix 5: profiles - Add admin view capability for admin dashboard
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));