
CREATE OR REPLACE FUNCTION public.get_customer_showcase()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_count int;
  repeat_count int;
  top_list jsonb;
BEGIN
  SELECT count(*) INTO total_count FROM public.customers;
  SELECT count(*) INTO repeat_count FROM public.customers WHERE COALESCE(total_orders, 0) > 1;
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO top_list FROM (
    SELECT
      COALESCE(NULLIF(trim(name), ''), 'Customer') AS name,
      COALESCE(NULLIF(trim(address), ''), '') AS address,
      COALESCE(total_orders, 0) AS total_orders
    FROM public.customers
    WHERE COALESCE(total_orders, 0) > 0
    ORDER BY total_orders DESC NULLS LAST, last_order_date DESC NULLS LAST
    LIMIT 100
  ) t;
  RETURN jsonb_build_object(
    'total', total_count,
    'repeat', repeat_count,
    'top', top_list
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_customer_showcase() TO anon, authenticated;
