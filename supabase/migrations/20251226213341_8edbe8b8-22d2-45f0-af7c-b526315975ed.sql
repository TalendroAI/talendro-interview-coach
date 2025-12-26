-- Create error_logs table to capture all system errors
CREATE TABLE public.error_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  error_type TEXT NOT NULL, -- 'session', 'discount', 'general'
  error_code TEXT,
  error_message TEXT NOT NULL,
  user_email TEXT,
  session_id UUID REFERENCES public.coaching_sessions(id),
  context JSONB, -- Additional context about what user was doing
  ai_resolution_attempted BOOLEAN DEFAULT false,
  ai_resolution_successful BOOLEAN,
  ai_resolution_response TEXT,
  escalated_to_admin BOOLEAN DEFAULT false,
  admin_notified_at TIMESTAMP WITH TIME ZONE,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT
);

-- Enable RLS
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- Admin can see all errors (you'll need to add admin check later)
CREATE POLICY "Service role can manage all error logs"
ON public.error_logs
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for quick lookups
CREATE INDEX idx_error_logs_email ON public.error_logs(user_email);
CREATE INDEX idx_error_logs_type ON public.error_logs(error_type);
CREATE INDEX idx_error_logs_resolved ON public.error_logs(resolved);
CREATE INDEX idx_error_logs_created ON public.error_logs(created_at DESC);