-- Remove public read access to coupons (validation happens server-side in place-order edge function)
DROP POLICY IF EXISTS "Public can read active coupons" ON public.coupons;