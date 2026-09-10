CREATE OR REPLACE FUNCTION public.get_total_gift_value()
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(o.total), 0)
  FROM public.giveaway_entries ge
  JOIN public.orders o ON o.id = ge.order_id
  WHERE ge.order_id IS NOT NULL;
$$;