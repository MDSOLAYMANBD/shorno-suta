CREATE OR REPLACE FUNCTION public.get_all_product_sales_counts()
RETURNS TABLE(product_id uuid, total_sold bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT oi.product_id, SUM(oi.quantity)::bigint as total_sold
  FROM order_items oi
  WHERE oi.product_id IS NOT NULL
  GROUP BY oi.product_id
  ORDER BY total_sold DESC;
$$;