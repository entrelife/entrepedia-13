-- Create sessions table to store valid session tokens
CREATE TABLE public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  is_active boolean NOT NULL DEFAULT true
);

-- Enable RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Only service role can access sessions (for edge functions)
CREATE POLICY "Service role only for sessions"
ON public.user_sessions FOR ALL
USING (false);

-- Create index for fast token lookups
CREATE INDEX idx_user_sessions_token ON public.user_sessions(session_token) WHERE is_active = true;
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);

-- Function to validate session and get user_id
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