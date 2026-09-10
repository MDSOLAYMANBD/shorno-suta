-- Step 1: Add item_type and parent_product_id columns
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS parent_product_id uuid REFERENCES products(id) ON DELETE SET NULL;

-- Step 2: Backfill item_type from existing prefix-based names
UPDATE order_items 
SET item_type = 'addon'
WHERE item_type = 'normal' 
  AND (product_name LIKE '[অ্যাড-অন]%' OR product_name LIKE '[Add-on]%');

UPDATE order_items 
SET item_type = 'bump'
WHERE item_type = 'normal' 
  AND (product_name LIKE '[বাম্প]%' OR product_name LIKE '[Bump]%');

-- Step 3: Fix addon items that lost their prefix but match addon_config name
-- These are items where product_name matches the addon name from the product's addon_config
-- AND the price is wrong (matches main product price instead of addon price)
UPDATE order_items oi
SET item_type = 'addon',
    parent_product_id = p.id,
    price = (p.addon_config->>'price')::numeric
FROM products p
WHERE oi.product_id = p.id
  AND oi.item_type = 'normal'
  AND p.addon_config IS NOT NULL
  AND (p.addon_config->>'price')::numeric > 0
  AND (
    oi.product_name = COALESCE(p.addon_config->>'name_bn', p.addon_config->>'name')
    OR oi.product_name = p.addon_config->>'name'
    OR oi.product_name = p.addon_config->>'name_bn'
  )
  AND oi.price != (p.addon_config->>'price')::numeric;

-- Also set parent_product_id for prefix-detected addons
UPDATE order_items oi
SET parent_product_id = oi.product_id
WHERE oi.item_type = 'addon' AND oi.parent_product_id IS NULL;

-- Step 4: Recalculate subtotal/total for ALL affected orders
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

-- Step 5: Create index for efficient item_type queries
CREATE INDEX IF NOT EXISTS idx_order_items_item_type ON order_items(item_type) WHERE item_type != 'normal';