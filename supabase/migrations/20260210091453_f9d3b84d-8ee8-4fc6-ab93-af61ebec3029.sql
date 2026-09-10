-- Drop the overly permissive INSERT policy on abandoned_checkouts
DROP POLICY IF EXISTS "Anyone can insert abandoned checkouts" ON public.abandoned_checkouts;

-- Replace with a restrictive policy that blocks direct client inserts
-- (inserts now go through the save-abandoned-checkout edge function using service role)
CREATE POLICY "Only service role can insert abandoned checkouts"
  ON public.abandoned_checkouts
  FOR INSERT
  WITH CHECK (false);