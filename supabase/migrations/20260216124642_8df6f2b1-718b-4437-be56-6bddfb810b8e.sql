-- Fix overly permissive INSERT policy on site_visits
-- Replace WITH CHECK (true) with basic validation
DROP POLICY IF EXISTS "Anyone can insert visits" ON public.site_visits;

CREATE POLICY "Anyone can insert visits with valid data"
  ON public.site_visits
  FOR INSERT
  TO public
  WITH CHECK (
    session_id IS NOT NULL AND
    length(session_id) > 0 AND
    length(session_id) <= 200
  );