-- Hide cost_price (profit margin) from anonymous storefront users.
-- Authenticated admins/staff retain access via existing RLS policies + column grants.
REVOKE SELECT (cost_price) ON public.products FROM anon;