-- Add deny-all RLS policies for otp_codes table (service_role bypasses RLS)
CREATE POLICY "Deny all select on otp_codes" ON public.otp_codes FOR SELECT TO public, anon, authenticated USING (false);
CREATE POLICY "Deny all insert on otp_codes" ON public.otp_codes FOR INSERT TO public, anon, authenticated WITH CHECK (false);
CREATE POLICY "Deny all update on otp_codes" ON public.otp_codes FOR UPDATE TO public, anon, authenticated USING (false);
CREATE POLICY "Deny all delete on otp_codes" ON public.otp_codes FOR DELETE TO public, anon, authenticated USING (false);