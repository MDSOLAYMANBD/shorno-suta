ALTER TABLE public.products ADD COLUMN IF NOT EXISTS suggested_product_ids uuid[] NOT NULL DEFAULT '{}';
