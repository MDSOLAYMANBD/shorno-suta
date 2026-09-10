-- Fix: customer_reviews INSERT policy to prevent spoofed attribution
DROP POLICY IF EXISTS "Anyone can submit reviews with validation" ON public.customer_reviews;
CREATE POLICY "Anyone can submit reviews with validation" ON public.customer_reviews
FOR INSERT TO public
WITH CHECK (
  (customer_name IS NOT NULL)
  AND (length(TRIM(BOTH FROM customer_name)) > 0)
  AND (length(TRIM(BOTH FROM customer_name)) <= 200)
  AND ((customer_location IS NULL) OR (length(TRIM(BOTH FROM customer_location)) <= 200))
  AND ((review_text IS NULL) OR (length(TRIM(BOTH FROM review_text)) <= 2000))
  AND (rating >= 1) AND (rating <= 5)
  AND (status = 'pending'::text)
  AND (customer_user_id IS NULL OR customer_user_id = auth.uid())
);

-- Fix: Restrict public coupon SELECT to only validate specific codes via RPC
-- Create a validation function instead of exposing all coupons
CREATE OR REPLACE FUNCTION public.validate_coupon_code(_code text, _subtotal numeric)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _coupon record;
  _discount numeric;
BEGIN
  IF _code IS NULL OR trim(_code) = '' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'কুপন কোড দিন');
  END IF;

  SELECT * INTO _coupon FROM public.coupons
  WHERE code = upper(trim(_code)) AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'কুপন কোডটি সঠিক নয়');
  END IF;

  IF _coupon.expires_at IS NOT NULL AND _coupon.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'কুপনের মেয়াদ শেষ হয়ে গেছে');
  END IF;

  IF _coupon.max_uses IS NOT NULL AND _coupon.used_count >= _coupon.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'error', 'কুপনটি সর্বোচ্চ ব্যবহারসীমায় পৌঁছেছে');
  END IF;

  IF _subtotal < _coupon.min_order_amount THEN
    RETURN jsonb_build_object('valid', false, 'error', '৳' || _coupon.min_order_amount::text || ' এর বেশি অর্ডারে প্রযোজ্য');
  END IF;

  -- Calculate discount
  IF _coupon.discount_type = 'percentage' THEN
    _discount := round((_subtotal * _coupon.discount_value / 100), 2);
    IF _coupon.max_discount_amount IS NOT NULL AND _discount > _coupon.max_discount_amount THEN
      _discount := _coupon.max_discount_amount;
    END IF;
  ELSE
    _discount := _coupon.discount_value;
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'code', _coupon.code,
    'discount', _discount,
    'discount_type', _coupon.discount_type,
    'discount_value', _coupon.discount_value
  );
END;
$$;

-- Update coupons SELECT policy: only staff can read all coupons, public cannot
DROP POLICY IF EXISTS "Anyone can read coupons" ON public.coupons;
CREATE POLICY "Staff can read all coupons" ON public.coupons
FOR SELECT TO public
USING (
  has_role((SELECT auth.uid()), 'admin'::app_role)
  OR has_role((SELECT auth.uid()), 'order_manager'::app_role)
);