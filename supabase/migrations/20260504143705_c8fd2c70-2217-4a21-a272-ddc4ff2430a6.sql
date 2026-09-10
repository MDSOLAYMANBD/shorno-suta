-- Upgrade recompute_customer_stats: auto-INSERT customer row if missing,
-- then update stats. This fixes ~1559 phones that have orders but no
-- customer record (so loyalty badge / order history can find them).

CREATE OR REPLACE FUNCTION public.recompute_customer_stats(p_phone text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  clean_phone text;
  v_phones text[];
  v_total int;
  v_delivered int;
  v_spent numeric;
  v_last timestamptz;
  v_name text;
  v_address text;
  v_exists boolean;
BEGIN
  IF p_phone IS NULL OR trim(p_phone) = '' THEN
    RETURN;
  END IF;

  clean_phone := regexp_replace(regexp_replace(p_phone, '[\s-]', '', 'g'), '^\+?88', '');
  IF clean_phone = '' THEN RETURN; END IF;

  v_phones := ARRAY[clean_phone, '+88' || clean_phone, '88' || clean_phone];

  SELECT
    COUNT(*) FILTER (WHERE status NOT IN ('cancelled')),
    COUNT(*) FILTER (WHERE status IN ('delivered', 'office_sell')),
    COALESCE(SUM(total) FILTER (WHERE status IN ('delivered', 'office_sell')), 0),
    MAX(created_at)
  INTO v_total, v_delivered, v_spent, v_last
  FROM public.orders
  WHERE customer_phone = ANY(v_phones)
    AND deleted_at IS NULL;

  -- Skip if there are zero orders for this phone
  IF COALESCE(v_total, 0) = 0 AND COALESCE(v_delivered, 0) = 0 THEN
    -- Still update existing rows to zero in case orders were all deleted
    UPDATE public.customers
    SET total_orders = 0,
        delivered_orders = 0,
        total_spent = 0,
        updated_at = now()
    WHERE phone = ANY(v_phones);
    RETURN;
  END IF;

  -- Check if any matching customer already exists
  SELECT EXISTS (SELECT 1 FROM public.customers WHERE phone = ANY(v_phones))
    INTO v_exists;

  IF NOT v_exists THEN
    -- Pull latest non-empty name + address from orders to seed the new row
    SELECT customer_name, customer_address INTO v_name, v_address
    FROM public.orders
    WHERE customer_phone = ANY(v_phones)
      AND deleted_at IS NULL
      AND COALESCE(NULLIF(trim(customer_name), ''), '') <> ''
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_name IS NULL THEN
      SELECT customer_name, customer_address INTO v_name, v_address
      FROM public.orders
      WHERE customer_phone = ANY(v_phones)
        AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1;
    END IF;

    INSERT INTO public.customers (
      phone, name, address, total_orders, delivered_orders,
      total_spent, last_order_date
    ) VALUES (
      clean_phone,
      COALESCE(NULLIF(trim(v_name), ''), 'Unknown'),
      COALESCE(v_address, ''),
      v_total, v_delivered, v_spent, v_last
    )
    ON CONFLICT (phone) DO UPDATE SET
      total_orders = EXCLUDED.total_orders,
      delivered_orders = EXCLUDED.delivered_orders,
      total_spent = EXCLUDED.total_spent,
      last_order_date = EXCLUDED.last_order_date,
      updated_at = now();
  ELSE
    -- Update all existing customer rows that match any variant
    UPDATE public.customers
    SET total_orders = v_total,
        delivered_orders = v_delivered,
        total_spent = v_spent,
        last_order_date = COALESCE(v_last, last_order_date),
        updated_at = now()
    WHERE phone = ANY(v_phones);
  END IF;
END;
$function$;

-- ============================================================
-- ONE-TIME BACKFILL: create customer rows for phones that have orders
-- but no customers entry under any phone variant.
-- ============================================================
WITH phone_orders AS (
  SELECT
    regexp_replace(regexp_replace(o.customer_phone, '[\s-]', '', 'g'), '^\+?88', '') AS clean_phone,
    o.customer_name,
    o.customer_address,
    o.status,
    o.total,
    o.created_at
  FROM public.orders o
  WHERE o.customer_phone IS NOT NULL
    AND trim(o.customer_phone) <> ''
    AND o.deleted_at IS NULL
),
aggregated AS (
  SELECT
    clean_phone,
    COUNT(*) FILTER (WHERE status NOT IN ('cancelled')) AS total_orders,
    COUNT(*) FILTER (WHERE status IN ('delivered','office_sell')) AS delivered_orders,
    COALESCE(SUM(total) FILTER (WHERE status IN ('delivered','office_sell')), 0) AS total_spent,
    MAX(created_at) AS last_order_date
  FROM phone_orders
  WHERE clean_phone <> ''
  GROUP BY clean_phone
),
latest_info AS (
  SELECT DISTINCT ON (clean_phone)
    clean_phone,
    customer_name,
    customer_address
  FROM phone_orders
  WHERE clean_phone <> ''
    AND COALESCE(NULLIF(trim(customer_name),''),'') <> ''
  ORDER BY clean_phone, created_at DESC
),
to_insert AS (
  SELECT
    a.clean_phone,
    COALESCE(NULLIF(trim(li.customer_name),''),'Unknown') AS name,
    COALESCE(li.customer_address, '') AS address,
    a.total_orders,
    a.delivered_orders,
    a.total_spent,
    a.last_order_date
  FROM aggregated a
  LEFT JOIN latest_info li ON li.clean_phone = a.clean_phone
  WHERE NOT EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.phone = a.clean_phone
       OR c.phone = '+88' || a.clean_phone
       OR c.phone = '88' || a.clean_phone
  )
)
INSERT INTO public.customers (
  phone, name, address, total_orders, delivered_orders, total_spent, last_order_date
)
SELECT clean_phone, name, address, total_orders, delivered_orders, total_spent, last_order_date
FROM to_insert
ON CONFLICT (phone) DO UPDATE SET
  total_orders = EXCLUDED.total_orders,
  delivered_orders = EXCLUDED.delivered_orders,
  total_spent = EXCLUDED.total_spent,
  last_order_date = EXCLUDED.last_order_date,
  updated_at = now();