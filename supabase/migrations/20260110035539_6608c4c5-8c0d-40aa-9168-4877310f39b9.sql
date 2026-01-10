-- Add Pro subscription session tracking columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS pro_mock_sessions_used integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS pro_audio_sessions_used integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS pro_session_reset_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- Add index for efficient lookup of Pro subscribers
CREATE INDEX IF NOT EXISTS idx_profiles_pro_subscriber ON public.profiles (is_pro_subscriber) WHERE is_pro_subscriber = true;

-- Add index for subscription ID lookups
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_subscription_id ON public.profiles (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

-- Update the service role update policy to ensure it can manage all profile fields
DROP POLICY IF EXISTS "Service role can update profiles" ON public.profiles;
CREATE POLICY "Service role can update profiles"
ON public.profiles
FOR UPDATE
USING (true);

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.pro_mock_sessions_used IS 'Number of Mock Interview sessions used in current billing period';
COMMENT ON COLUMN public.profiles.pro_audio_sessions_used IS 'Number of Audio Mock sessions used in current billing period';
COMMENT ON COLUMN public.profiles.pro_session_reset_date IS 'Date when session counters were last reset (start of billing period)';
COMMENT ON COLUMN public.profiles.stripe_subscription_id IS 'Stripe subscription ID for Pro subscribers';