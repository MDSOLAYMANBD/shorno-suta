-- 1. Fix existing mismatched rows (idempotent)
UPDATE public.products
SET name_bn = name
WHERE name_bn IS DISTINCT FROM name;

-- 2. Create sync function
CREATE OR REPLACE FUNCTION public.sync_product_name_bn()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Admin UI has only one name field; always keep name_bn aligned with name
  NEW.name_bn := NEW.name;
  RETURN NEW;
END;
$$;

-- 3. Drop old trigger if it exists, then create fresh one
DROP TRIGGER IF EXISTS trg_sync_product_name_bn ON public.products;

CREATE TRIGGER trg_sync_product_name_bn
BEFORE INSERT OR UPDATE OF name ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.sync_product_name_bn();