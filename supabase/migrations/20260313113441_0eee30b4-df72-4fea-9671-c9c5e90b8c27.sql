-- RPC for customers to see available coupon codes (no sensitive details)
CREATE OR REPLACE FUNCTION public.get_available_coupons()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'code', c.code,
    'discount_type', c.discount_type,
    'discount_value', c.discount_value,
    'min_order_amount', c.min_order_amount,
    'max_discount_amount', c.max_discount_amount,
    'expires_at', c.expires_at
  )), '[]'::jsonb)
  FROM public.coupons c
  WHERE c.is_active = true
    AND (c.expires_at IS NULL OR c.expires_at > now())
    AND (c.max_uses IS NULL OR c.used_count < c.max_uses);
$$;