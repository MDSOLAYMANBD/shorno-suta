ALTER TABLE public.products
ALTER COLUMN allow_pre_order SET DEFAULT true;

UPDATE public.products
SET allow_pre_order = true
WHERE stock <= 0
  AND COALESCE(allow_pre_order, false) = false;