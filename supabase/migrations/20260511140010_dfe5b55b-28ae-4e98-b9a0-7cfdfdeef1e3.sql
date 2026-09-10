ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS clearance_price numeric,
  ADD COLUMN IF NOT EXISTS clearance_active boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_products_clearance_active ON public.products(clearance_active) WHERE clearance_active = true;