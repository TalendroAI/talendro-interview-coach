import { useState, useEffect, useCallback } from 'react';
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

  // Fetch profile by user_id first, then fallback to email
  const fetchProfile = useCallback(async (user: User) => {
    // Try to find profile by user_id first
    let { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    // If no profile found by user_id, try by email
    if (!profile && user.email) {
      const { data: emailProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', user.email)
        .maybeSingle();

      if (emailProfile) {
        profile = emailProfile;
        
        // Link the profile to this user_id if not already linked
        if (!emailProfile.user_id) {
          await supabase
            .from('profiles')
            .update({ user_id: user.id, updated_at: new Date().toISOString() })
            .eq('id', emailProfile.id);
        }
      }
    }

    return profile as ClientProfile | null;
  }, []);

  useEffect(() => {
    // Set up auth state change listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const profile = await fetchProfile(session.user);

          setState({
            user: session.user,
            session,
            profile,
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
        const profile = await fetchProfile(session.user);

        setState({
          user: session.user,
          session,
          profile,
          isLoading: false,
          isProSubscriber: profile?.is_pro_subscriber || false,
        });
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          full_name: fullName,
        },
      },
    });
    return { data, error };
  };

  const signInWithOtp = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (!state.user) return;
    
    const profile = await fetchProfile(state.user);

    setState(prev => ({
      ...prev,
      profile,
      isProSubscriber: profile?.is_pro_subscriber || false,
    }));
  };

  return { 
    ...state, 
    signIn, 
    signUp, 
    signInWithOtp,
    signOut, 
    refreshProfile,
  };
}
