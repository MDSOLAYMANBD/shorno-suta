-- Add attempts column to otp_codes for brute-force protection
ALTER TABLE public.otp_codes ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;