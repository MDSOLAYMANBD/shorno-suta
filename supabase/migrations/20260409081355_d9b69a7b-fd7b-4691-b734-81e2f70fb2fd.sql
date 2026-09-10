
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS bump_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bump_discount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS addon_config jsonb;
