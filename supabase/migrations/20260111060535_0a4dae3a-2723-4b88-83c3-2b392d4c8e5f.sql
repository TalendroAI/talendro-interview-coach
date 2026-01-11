-- Add new columns to profiles table for Pro subscription tracking
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS pro_subscription_start timestamp with time zone,
ADD COLUMN IF NOT EXISTS pro_cancel_at_period_end boolean DEFAULT false;