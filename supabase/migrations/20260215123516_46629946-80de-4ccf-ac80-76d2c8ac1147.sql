
CREATE OR REPLACE FUNCTION public.get_best_selling_product_ids(p_limit integer DEFAULT 8)
RETURNS TABLE(product_id uuid, total_sold bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT oi.product_id, SUM(oi.quantity)::bigint as total_sold
  FROM order_items oi
  WHERE oi.product_id IS NOT NULL
  GROUP BY oi.product_id
  ORDER BY total_sold DESC
  LIMIT p_limit;
$$;
