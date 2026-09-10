
-- Add snapshot columns for upsell items
ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS upsell_image text,
ADD COLUMN IF NOT EXISTS upsell_parent_name text;

-- Backfill upsell_parent_name from parent_product_id -> products.name
UPDATE public.order_items oi
SET upsell_parent_name = p.name
FROM public.products p
WHERE oi.parent_product_id = p.id
  AND oi.parent_product_id IS NOT NULL
  AND oi.item_type IN ('addon', 'bump')
  AND oi.upsell_parent_name IS NULL;
