-- Fix addon items that were saved with wrong prices
-- Update order_items where item_type='addon' and price doesn't match addon_config.price
UPDATE public.order_items oi
SET price = (p.addon_config::jsonb->>'price')::numeric
FROM public.products p
WHERE oi.item_type = 'addon'
  AND oi.parent_product_id IS NOT NULL
  AND p.id = oi.parent_product_id
  AND p.addon_config IS NOT NULL
  AND (p.addon_config::jsonb->>'price') IS NOT NULL
  AND (p.addon_config::jsonb->>'price')::numeric > 0
  AND oi.price != (p.addon_config::jsonb->>'price')::numeric;

-- Also fix addon items matched by product_id (for cases where parent_product_id = product_id)
UPDATE public.order_items oi
SET price = (p.addon_config::jsonb->>'price')::numeric
FROM public.products p
WHERE oi.item_type = 'addon'
  AND oi.parent_product_id IS NULL
  AND p.id = oi.product_id
  AND p.addon_config IS NOT NULL
  AND (p.addon_config::jsonb->>'price') IS NOT NULL
  AND (p.addon_config::jsonb->>'price')::numeric > 0
  AND oi.price != (p.addon_config::jsonb->>'price')::numeric;

-- Also fix items identified by product_name prefix '[অ্যাড-অন]' that don't have item_type set
UPDATE public.order_items oi
SET price = (p.addon_config::jsonb->>'price')::numeric,
    item_type = 'addon'
FROM public.products p
WHERE oi.product_name LIKE '[অ্যাড-অন]%'
  AND oi.item_type = 'normal'
  AND p.id = COALESCE(oi.parent_product_id, oi.product_id)
  AND p.addon_config IS NOT NULL
  AND (p.addon_config::jsonb->>'price') IS NOT NULL
  AND (p.addon_config::jsonb->>'price')::numeric > 0
  AND oi.price != (p.addon_config::jsonb->>'price')::numeric;

-- Recalculate subtotal and total for affected orders
-- We need to recalculate based on all order_items for orders that had addon items
WITH order_recalc AS (
  SELECT 
    o.id,
    o.delivery_charge,
    o.discount_note,
    COALESCE(SUM(oi.price * oi.quantity), 0) AS new_subtotal
  FROM public.orders o
  JOIN public.order_items oi ON oi.order_id = o.id
  WHERE o.id IN (
    SELECT DISTINCT order_id FROM public.order_items 
    WHERE item_type = 'addon' OR product_name LIKE '[অ্যাড-অন]%'
  )
  AND o.deleted_at IS NULL
  GROUP BY o.id, o.delivery_charge, o.discount_note
)
UPDATE public.orders o
SET subtotal = r.new_subtotal,
    total = r.new_subtotal 
      - COALESCE(
          CASE 
            WHEN r.discount_note ~ '\(-৳(\d+)\)' 
            THEN (regexp_match(r.discount_note, '\(-৳(\d+)\)'))[1]::numeric 
            ELSE 0 
          END, 0)
      + r.delivery_charge
FROM order_recalc r
WHERE o.id = r.id
  AND o.subtotal != r.new_subtotal;