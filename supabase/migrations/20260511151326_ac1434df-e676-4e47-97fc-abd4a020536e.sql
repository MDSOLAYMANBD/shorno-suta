-- Restore table-level privileges that were accidentally revoked during cost_price lockdown.
-- cost_price column remains GRANT-revoked; access only via get_product_cost_prices() RPC.

DO $$
DECLARE
  col record;
BEGIN
  FOR col IN
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name <> 'cost_price'
  LOOP
    EXECUTE format('GRANT SELECT (%I) ON public.products TO anon, authenticated', col.column_name);
  END LOOP;
END $$;

-- Authenticated users / staff need write access (RLS still gates rows)
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Re-confirm cost_price stays locked
REVOKE ALL (cost_price) ON public.products FROM anon, authenticated, public;