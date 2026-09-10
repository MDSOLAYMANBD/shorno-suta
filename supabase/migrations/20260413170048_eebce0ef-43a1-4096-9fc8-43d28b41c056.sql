
-- Fix addon items saved with parent product price
UPDATE order_items oi
SET price = (p.addon_config->>'price')::numeric
FROM products p
WHERE oi.product_id = p.id
  AND p.addon_config IS NOT NULL
  AND (p.addon_config->>'price')::numeric > 0
  AND (
    oi.product_name LIKE '[অ্যাড-অন]%'
    OR (
      oi.product_name = COALESCE(p.addon_config->>'name_bn', '')
      AND oi.price = p.price
      AND oi.price != (p.addon_config->>'price')::numeric
    )
  )
  AND oi.price != (p.addon_config->>'price')::numeric;

-- Recalculate subtotal/total for affected orders (no coupon discount)
UPDATE orders o
SET subtotal = sub.correct_subtotal,
    total = sub.correct_subtotal + CASE WHEN o.free_shipping THEN 0 ELSE COALESCE(o.delivery_charge, 0) END
FROM (
  SELECT oi.order_id, SUM(oi.price * oi.quantity) as correct_subtotal
  FROM order_items oi
  GROUP BY oi.order_id
) sub
WHERE o.id = sub.order_id
  AND o.subtotal != sub.correct_subtotal
  AND (o.discount_note IS NULL OR o.discount_note = '');
