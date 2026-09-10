-- Remove the overly permissive UPDATE policy on abandoned_checkouts
DROP POLICY IF EXISTS "Anyone can update own abandoned checkout" ON public.abandoned_checkouts;