-- Create table to store password reset OTPs
CREATE TABLE public.password_reset_otps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mobile_number TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '10 minutes'),
  is_used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.password_reset_otps ENABLE ROW LEVEL SECURITY;

-- Create index for faster lookups
CREATE INDEX idx_password_reset_otps_mobile ON public.password_reset_otps(mobile_number);
CREATE INDEX idx_password_reset_otps_expires ON public.password_reset_otps(expires_at);

-- Policy: Only allow service role to access (edge function uses service role)
CREATE POLICY "Service role only"
ON public.password_reset_otps
FOR ALL
USING (false)
WITH CHECK (false);

-- Cleanup function to delete expired OTPs
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS void AS $$
BEGIN
  DELETE FROM public.password_reset_otps 
  WHERE expires_at < now() OR is_used = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;