-- Add pause/resume fields to coaching_sessions
ALTER TABLE public.coaching_sessions
ADD COLUMN IF NOT EXISTS paused_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS current_question_number integer DEFAULT 0;

-- Add index for finding paused sessions
CREATE INDEX IF NOT EXISTS idx_coaching_sessions_paused 
ON public.coaching_sessions (email, status) 
WHERE status = 'active' AND paused_at IS NOT NULL;