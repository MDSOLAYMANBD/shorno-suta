
-- 1. Revoke cost_price column SELECT from authenticated (any logged-in customer)
REVOKE SELECT (cost_price) ON public.products FROM authenticated;
REVOKE SELECT (cost_price) ON public.products FROM anon;

-- 2. Provide a staff-only RPC to fetch cost_price values for products (used in admin UI)
CREATE OR REPLACE FUNCTION public.get_product_cost_prices(p_ids uuid[])
RETURNS TABLE (id uuid, cost_price numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'order_manager'::app_role)) THEN
    RAISE EXCEPTION 'access denied';
  END IF;

  RETURN QUERY
  SELECT p.id, p.cost_price
  FROM public.products p
  WHERE p.id = ANY(p_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.get_product_cost_prices(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_product_cost_prices(uuid[]) TO authenticated;

-- 3. Staff-only RPC to update cost_price (admin inline edit + product editor)
CREATE OR REPLACE FUNCTION public.update_product_cost_price(p_id uuid, p_cost_price numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'access denied';
  END IF;

  UPDATE public.products SET cost_price = p_cost_price WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_product_cost_price(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_product_cost_price(uuid, numeric) TO authenticated;
