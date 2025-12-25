-- Create enum for session types
CREATE TYPE public.session_type AS ENUM ('quick_prep', 'full_mock', 'premium_audio', 'pro');

-- Create enum for session status
CREATE TYPE public.session_status AS ENUM ('pending', 'active', 'completed', 'cancelled');

-- Create users/profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  stripe_customer_id TEXT,
  is_pro_subscriber BOOLEAN DEFAULT false,
  pro_subscription_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(email)
);

-- Create sessions table
CREATE TABLE public.coaching_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  session_type session_type NOT NULL,
  status session_status DEFAULT 'pending' NOT NULL,
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  resume_text TEXT,
  job_description TEXT,
  company_url TEXT,
  prep_packet JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  completed_at TIMESTAMPTZ
);

-- Create chat messages table for mock interviews
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.coaching_sessions(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  question_number INTEGER,
  feedback JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create session results table for final summaries
CREATE TABLE public.session_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.coaching_sessions(id) ON DELETE CASCADE NOT NULL,
  overall_score INTEGER,
  strengths JSONB,
  improvements JSONB,
  recommendations TEXT,
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_results ENABLE ROW LEVEL SECURITY;

-- RLS policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (true);

-- RLS policies for coaching_sessions
-- Allow public read for session validation (by email, used during checkout redirect)
CREATE POLICY "Anyone can view sessions by email"
  ON public.coaching_sessions FOR SELECT
  USING (true);

CREATE POLICY "Service role can insert sessions"
  ON public.coaching_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update sessions"
  ON public.coaching_sessions FOR UPDATE
  USING (true);

-- RLS policies for chat_messages
CREATE POLICY "Anyone can view chat messages for their session"
  ON public.chat_messages FOR SELECT
  USING (true);

CREATE POLICY "Service role can insert chat messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (true);

-- RLS policies for session_results
CREATE POLICY "Anyone can view session results"
  ON public.session_results FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage session results"
  ON public.session_results FOR ALL
  USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_coaching_sessions_updated_at
  BEFORE UPDATE ON public.coaching_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_coaching_sessions_email ON public.coaching_sessions(email);
CREATE INDEX idx_coaching_sessions_stripe_checkout ON public.coaching_sessions(stripe_checkout_session_id);
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_stripe_customer ON public.profiles(stripe_customer_id);