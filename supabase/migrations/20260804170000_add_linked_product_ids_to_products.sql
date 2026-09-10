ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS linked_product_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

COMMENT ON COLUMN public.products.linked_product_ids IS
  'Other product ids that represent the same design in a different color — cross-linked symmetrically so any member shows the others as color-variant swatches on the storefront.';
