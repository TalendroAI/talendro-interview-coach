-- Update the atomic_check_and_increment_session function to use correct limits (6 for full_mock, 2 for premium_audio)
CREATE OR REPLACE FUNCTION public.atomic_check_and_increment_session(p_email text, p_session_type text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_profile RECORD;
  v_limit INTEGER;
  v_used INTEGER;
  v_remaining INTEGER;
  v_update_field TEXT;
  v_needs_reset BOOLEAN := FALSE;
  v_reset_date TIMESTAMPTZ;
  v_next_reset TIMESTAMPTZ;
BEGIN
  -- Quick prep is unlimited, no need to check/increment
  IF p_session_type = 'quick_prep' THEN
    RETURN jsonb_build_object(
      'allowed', TRUE,
      'remaining', NULL,
      'limit', NULL,
      'message', 'Quick prep is unlimited'
    );
  END IF;

  -- Set limits based on session type (matching PRO_LIMITS in edge function)
  IF p_session_type = 'full_mock' THEN
    v_limit := 6;  -- Fixed: was incorrectly set to 8
    v_update_field := 'pro_mock_sessions_used';
  ELSIF p_session_type = 'premium_audio' THEN
    v_limit := 2;  -- Fixed: was incorrectly set to 4
    v_update_field := 'pro_audio_sessions_used';
  ELSE
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'error', 'Invalid session type'
    );
  END IF;

  -- Lock the row for update to prevent race conditions
  SELECT * INTO v_profile
  FROM profiles
  WHERE LOWER(email) = LOWER(p_email)
  FOR UPDATE;

  -- Check if profile exists and has Pro subscription
  IF v_profile IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'error', 'Profile not found'
    );
  END IF;

  IF NOT COALESCE(v_profile.is_pro_subscriber, FALSE) THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'error', 'No active Pro subscription',
      'remaining', 0
    );
  END IF;

  -- Check if we need to reset counters (30 days from reset date)
  IF v_profile.pro_session_reset_date IS NULL OR 
     v_profile.pro_session_reset_date < (NOW() - INTERVAL '30 days') THEN
    v_needs_reset := TRUE;
  END IF;

  -- Handle reset if needed
  IF v_needs_reset THEN
    UPDATE profiles
    SET 
      pro_mock_sessions_used = 0,
      pro_audio_sessions_used = 0,
      pro_session_reset_date = NOW(),
      updated_at = NOW()
    WHERE id = v_profile.id;
    
    -- After reset, set used to 0
    v_used := 0;
    v_reset_date := NOW();
  ELSE
    v_reset_date := v_profile.pro_session_reset_date;
    IF p_session_type = 'full_mock' THEN
      v_used := COALESCE(v_profile.pro_mock_sessions_used, 0);
    ELSE
      v_used := COALESCE(v_profile.pro_audio_sessions_used, 0);
    END IF;
  END IF;

  v_remaining := GREATEST(0, v_limit - v_used);
  v_next_reset := v_reset_date + INTERVAL '30 days';

  -- Check if allowed
  IF v_remaining <= 0 THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'remaining', 0,
      'limit', v_limit,
      'used', v_used,
      'next_reset', v_next_reset,
      'message', format('You''ve used all %s sessions this month. Resets on %s.', 
                        v_limit, to_char(v_next_reset, 'Mon DD, YYYY'))
    );
  END IF;

  -- Atomically increment the count
  IF p_session_type = 'full_mock' THEN
    UPDATE profiles
    SET 
      pro_mock_sessions_used = COALESCE(pro_mock_sessions_used, 0) + 1,
      updated_at = NOW()
    WHERE id = v_profile.id;
  ELSE
    UPDATE profiles
    SET 
      pro_audio_sessions_used = COALESCE(pro_audio_sessions_used, 0) + 1,
      updated_at = NOW()
    WHERE id = v_profile.id;
  END IF;

  -- Return success with updated remaining count
  RETURN jsonb_build_object(
    'allowed', TRUE,
    'remaining', v_remaining - 1,  -- Subtract 1 because we just used one
    'limit', v_limit,
    'used', v_used + 1,
    'next_reset', v_next_reset,
    'reset_occurred', v_needs_reset
  );
END;
$function$;