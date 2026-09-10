CREATE OR REPLACE FUNCTION public.get_today_best_selling_product_ids(p_limit integer DEFAULT 500)
RETURNS TABLE(product_id uuid, total_sold bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT oi.product_id, SUM(COALESCE(oi.quantity, 0))::bigint AS total_sold
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE oi.product_id IS NOT NULL
    AND (o.created_at AT TIME ZONE 'Asia/Dhaka')::date = (now() AT TIME ZONE 'Asia/Dhaka')::date
  GROUP BY oi.product_id
  ORDER BY total_sold DESC, oi.product_id
  LIMIT p_limit;
$function$;

GRANT EXECUTE ON FUNCTION public.get_today_best_selling_product_ids(integer) TO anon;
GRANT EXECUTE ON FUNCTION public.get_today_best_selling_product_ids(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_today_best_selling_product_ids(integer) TO service_role;