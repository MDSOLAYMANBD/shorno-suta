
-- Fix push_subscriptions: restrict SELECT to staff only
DROP POLICY IF EXISTS "Anyone can read subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Staff can read all subscriptions" ON public.push_subscriptions;

CREATE POLICY "Staff can read all subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (has_any_role((select auth.uid())));
