-- Create discount_codes table
CREATE TABLE public.discount_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  discount_percent INTEGER NOT NULL CHECK (discount_percent >= 1 AND discount_percent <= 100),
  description TEXT,
  valid_from TIMESTAMP WITH TIME ZONE DEFAULT now(),
  valid_until TIMESTAMP WITH TIME ZONE,
  max_uses INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  applicable_products TEXT[] DEFAULT ARRAY['quick_prep', 'full_mock', 'premium_audio', 'pro'],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create discount_code_usage table to track who used what
CREATE TABLE public.discount_code_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code_id UUID NOT NULL REFERENCES public.discount_codes(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  session_id UUID REFERENCES public.coaching_sessions(id),
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(code_id, email)
);

-- Enable RLS
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_code_usage ENABLE ROW LEVEL SECURITY;

-- Policies for discount_codes (public read for active codes)
CREATE POLICY "Anyone can view active discount codes"
ON public.discount_codes
FOR SELECT
USING (is_active = true);

-- Policies for discount_code_usage (service role only)
CREATE POLICY "Service role can manage usage"
ON public.discount_code_usage
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_discount_codes_code ON public.discount_codes(code);
CREATE INDEX idx_discount_code_usage_email ON public.discount_code_usage(email);

-- Insert example code for testing
INSERT INTO public.discount_codes (code, discount_percent, description, valid_until, applicable_products)
VALUES ('C325', 25, 'C3 Church Member 25% Discount', '2025-02-28 23:59:59+00', ARRAY['quick_prep', 'full_mock', 'premium_audio', 'pro']);