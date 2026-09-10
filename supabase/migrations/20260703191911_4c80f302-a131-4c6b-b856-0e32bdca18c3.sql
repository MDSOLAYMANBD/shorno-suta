CREATE OR REPLACE FUNCTION public.get_category_order_count(p_product_ids uuid[])
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(count(*), 0)::bigint
  FROM public.order_items
  WHERE product_id = ANY(p_product_ids);
$$;

GRANT EXECUTE ON FUNCTION public.get_category_order_count(uuid[]) TO anon, authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;