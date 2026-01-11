import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

interface ClientProfile {
  id: string;
  email: string;
  full_name: string | null;
  is_pro_subscriber: boolean | null;
  pro_subscription_end: string | null;
  pro_subscription_start: string | null;
  pro_cancel_at_period_end: boolean | null;
  pro_mock_sessions_used: number;
  pro_audio_sessions_used: number;
  pro_session_reset_date: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

interface ClientAuthState {
  user: User | null;
  session: Session | null;
  profile: ClientProfile | null;
  isLoading: boolean;
  isProSubscriber: boolean;
}

export function useClientAuth() {
  const [state, setState] = useState<ClientAuthState>({
    user: null,
    session: null,
    profile: null,
    isLoading: true,
    isProSubscriber: false,
  });

  useEffect(() => {
    // Set up auth state change listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          // Fetch profile data
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', session.user.id)
            .maybeSingle();

          setState({
            user: session.user,
            session,
            profile: profile as ClientProfile | null,
            isLoading: false,
            isProSubscriber: profile?.is_pro_subscriber || false,
          });
        } else {
          setState({
            user: null,
            session: null,
            profile: null,
            isLoading: false,
            isProSubscriber: false,
          });
        }
      }
    );

    // Then check current session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .maybeSingle();

        setState({
          user: session.user,
          session,
          profile: profile as ClientProfile | null,
          isLoading: false,
          isProSubscriber: profile?.is_pro_subscriber || false,
        });
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: fullName,
        },
      },
    });
    return { data, error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (!state.user) return;
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', state.user.id)
      .maybeSingle();

    setState(prev => ({
      ...prev,
      profile: profile as ClientProfile | null,
      isProSubscriber: profile?.is_pro_subscriber || false,
    }));
  };

  return { 
    ...state, 
    signIn, 
    signUp, 
    signOut, 
    refreshProfile,
  };
}
