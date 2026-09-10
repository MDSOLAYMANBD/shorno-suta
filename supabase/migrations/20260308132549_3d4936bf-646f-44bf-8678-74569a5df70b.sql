
CREATE OR REPLACE FUNCTION public.get_public_giveaway_entries()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.gift_number DESC), '[]'::json)
  FROM (
    SELECT
      ge.id,
      ge.gift_number,
      ge.customer_name,
      ge.profile_link,
      ge.profile_screenshot,
      ge.packaging_image,
      ge.product_name,
      ge.created_at,
      ge.order_id,
      CASE WHEN ge.order_id IS NOT NULL THEN (
        SELECT json_build_object(
          'total', o.total,
          'order_items', COALESCE((
            SELECT json_agg(json_build_object(
              'product_id', oi.product_id,
              'product_name', oi.product_name,
              'price', oi.price,
              'products', CASE WHEN p.id IS NOT NULL THEN json_build_object('slug', p.slug, 'images', p.images, 'name', p.name) ELSE NULL END
            ))
            FROM order_items oi
            LEFT JOIN products p ON p.id = oi.product_id
            WHERE oi.order_id = o.id
          ), '[]'::json)
        )
        FROM orders o
        WHERE o.id = ge.order_id
      ) ELSE NULL END AS orders
    FROM giveaway_entries ge
  ) t;
$$;
