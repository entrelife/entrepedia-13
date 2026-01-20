CREATE OR REPLACE FUNCTION public.validate_session(p_session_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.user_sessions
  WHERE session_token = p_session_token
    AND is_active = true
    AND expires_at > now();
  
  RETURN v_user_id;
END;
$$;