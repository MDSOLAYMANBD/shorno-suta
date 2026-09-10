CREATE OR REPLACE FUNCTION public.get_all_product_view_counts()
RETURNS TABLE(product_id uuid, total_views bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT product_id, COUNT(*)::bigint AS total_views
  FROM public.visitor_activity
  WHERE activity_type = 'product_view' AND product_id IS NOT NULL
  GROUP BY product_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_product_view_counts() TO anon, authenticated;