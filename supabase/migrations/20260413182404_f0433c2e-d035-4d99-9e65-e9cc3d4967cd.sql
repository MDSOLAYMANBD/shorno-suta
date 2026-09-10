-- Step 1: Fix addon items where item_type=addon but price is wrong
-- Update price to addon_config price where addon_config.price > 0
UPDATE order_items oi
SET price = (p.addon_config->>'price')::numeric
FROM products p
WHERE oi.product_id = p.id
  AND oi.item_type = 'addon'
  AND p.addon_config IS NOT NULL
  AND (p.addon_config->>'price')::numeric > 0
  AND oi.price != (p.addon_config->>'price')::numeric;

-- Step 2: Items linked to products with addon_config.price=0 should revert to normal
UPDATE order_items oi
SET item_type = 'normal'
FROM products p
WHERE oi.product_id = p.id
  AND oi.item_type = 'addon'
  AND p.addon_config IS NOT NULL
  AND ((p.addon_config->>'price')::numeric = 0 OR (p.addon_config->>'price') IS NULL)
  AND NOT (oi.product_name LIKE '[অ্যাড-অন]%');

-- Step 3: Recalculate subtotal/total for affected orders
UPDATE orders o
SET subtotal = sub.correct_subtotal,
    total = sub.correct_subtotal 
           - COALESCE(CASE 
               WHEN o.discount_note IS NOT NULL AND o.discount_note != '' 
               THEN (regexp_match(o.discount_note, '\(?\-?৳?(\d+)\)?'))[1]::numeric 
               ELSE 0 
             END, 0)
           + CASE WHEN o.free_shipping THEN 0 ELSE COALESCE(o.delivery_charge, 0) END
FROM (
  SELECT oi.order_id, SUM(oi.price * oi.quantity) as correct_subtotal
  FROM order_items oi
  GROUP BY oi.order_id
) sub
WHERE o.id = sub.order_id
  AND o.deleted_at IS NULL
  AND o.subtotal != sub.correct_subtotal;