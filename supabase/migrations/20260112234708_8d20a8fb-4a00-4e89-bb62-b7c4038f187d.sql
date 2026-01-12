-- Add column to track quick prep session usage (unlimited but tracked)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS pro_quick_prep_sessions_used INTEGER NOT NULL DEFAULT 0;