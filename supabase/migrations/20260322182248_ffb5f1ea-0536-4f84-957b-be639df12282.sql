ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS allow_pre_order boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.get_product_preorder_counts()
RETURNS TABLE(product_id uuid, total_preordered bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    oi.product_id,
    SUM(oi.quantity)::bigint AS total_preordered
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE oi.product_id IS NOT NULL
    AND o.is_pre_order = true
    AND o.deleted_at IS NULL
    AND COALESCE(o.status, 'pending') NOT IN ('cancelled', 'delivery_failed', 'paid_return')
  GROUP BY oi.product_id
  ORDER BY total_preordered DESC;
$$;