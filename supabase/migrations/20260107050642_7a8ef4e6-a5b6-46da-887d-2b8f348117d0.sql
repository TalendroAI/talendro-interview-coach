-- =============================================
-- PROFILES TABLE: Ensure strict user-only access
-- =============================================

-- Drop existing policies to recreate with proper permissions
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "anon_cannot_read_profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;

-- Users can only SELECT their own profile
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can only UPDATE their own profile
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can only DELETE their own profile
CREATE POLICY "Users can delete their own profile"
ON public.profiles
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Explicitly deny anonymous access
CREATE POLICY "Anon cannot access profiles"
ON public.profiles
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- =============================================
-- CHAT_MESSAGES TABLE: Tighten session ownership check
-- =============================================

-- Drop existing policies to recreate
DROP POLICY IF EXISTS "Users can view chat messages for their sessions" ON public.chat_messages;
DROP POLICY IF EXISTS "anon_cannot_read_messages" ON public.chat_messages;

-- Users can only SELECT messages from sessions they own (via profile_id)
CREATE POLICY "Users can view their own session messages"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.coaching_sessions cs
    WHERE cs.id = chat_messages.session_id
    AND cs.profile_id = auth.uid()
  )
);

-- Explicitly deny anonymous access
CREATE POLICY "Anon cannot access chat messages"
ON public.chat_messages
FOR ALL
TO anon
USING (false)
WITH CHECK (false);