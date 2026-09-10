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
      COALESCE(NULLIF(trim(c.name), ''), 'Customer') AS name,
      COALESCE(NULLIF(trim(c.address), ''), '') AS address,
      COALESCE(c.total_orders, 0) AS total_orders,
      COALESCE(c.delivered_orders, 0) AS delivered_orders,
      COALESCE(c.total_spent, 0) AS total_spent,
      (
        SELECT cp.avatar_url
        FROM public.customer_profiles cp
        WHERE regexp_replace(regexp_replace(COALESCE(cp.phone,''), '[\s-]', '', 'g'), '^\+?88', '')
            = regexp_replace(regexp_replace(COALESCE(c.phone,''), '[\s-]', '', 'g'), '^\+?88', '')
          AND cp.avatar_url IS NOT NULL
          AND trim(cp.avatar_url) <> ''
        LIMIT 1
      ) AS avatar_url
    FROM public.customers c
    WHERE COALESCE(c.total_orders, 0) > 0
    ORDER BY c.total_orders DESC NULLS LAST, c.last_order_date DESC NULLS LAST
    LIMIT 100
  ) t;
  RETURN jsonb_build_object(
    'total', total_count,
    'repeat', repeat_count,
    'top', top_list
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_customers_recent(p_repeat_only boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO result FROM (
    SELECT
      COALESCE(NULLIF(trim(c.name), ''), 'Customer') AS name,
      COALESCE(NULLIF(trim(c.address), ''), '') AS address,
      COALESCE(c.total_orders, 0) AS total_orders,
      COALESCE(c.delivered_orders, 0) AS delivered_orders,
      COALESCE(c.total_spent, 0) AS total_spent,
      COALESCE(c.last_order_date, c.created_at) AS created_at,
      (
        SELECT cp.avatar_url
        FROM public.customer_profiles cp
        WHERE regexp_replace(regexp_replace(COALESCE(cp.phone,''), '[\s-]', '', 'g'), '^\+?88', '')
            = regexp_replace(regexp_replace(COALESCE(c.phone,''), '[\s-]', '', 'g'), '^\+?88', '')
          AND cp.avatar_url IS NOT NULL
          AND trim(cp.avatar_url) <> ''
        LIMIT 1
      ) AS avatar_url
    FROM public.customers c
    WHERE (NOT p_repeat_only) OR COALESCE(c.total_orders, 0) > 1
    ORDER BY COALESCE(c.last_order_date, c.created_at) DESC NULLS LAST
    LIMIT 2000
  ) t;
  RETURN result;
END;
$$;
