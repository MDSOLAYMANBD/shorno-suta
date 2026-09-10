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
      c.created_at,
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
    ORDER BY c.created_at DESC NULLS LAST
    LIMIT 2000
  ) t;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_customers_recent(boolean) TO anon, authenticated;