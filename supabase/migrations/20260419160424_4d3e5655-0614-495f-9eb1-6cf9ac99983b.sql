-- Revoke cost_price column access from public/anon roles to prevent margin data exposure
-- Admin pages use authenticated session so retain access
REVOKE SELECT (cost_price) ON public.products FROM anon;
REVOKE SELECT (cost_price) ON public.products FROM PUBLIC;

-- Authenticated users (admins/order_managers) keep access — explicit grant for clarity
GRANT SELECT (cost_price) ON public.products TO authenticated;