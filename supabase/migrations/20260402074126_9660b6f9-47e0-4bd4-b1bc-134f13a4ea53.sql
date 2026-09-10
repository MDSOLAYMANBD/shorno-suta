
-- Fix 1: Revoke cost_price column access from anonymous users
-- This prevents public/anonymous visitors from reading internal cost data
REVOKE SELECT (cost_price) ON public.products FROM anon;

-- Fix 2: Restrict notification_logs SELECT to admin only (was has_any_role)
DROP POLICY IF EXISTS "Staff can read notification logs" ON public.notification_logs;
CREATE POLICY "Admin can read notification logs"
  ON public.notification_logs
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
