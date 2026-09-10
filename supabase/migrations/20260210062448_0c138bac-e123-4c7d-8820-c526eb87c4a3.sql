
-- Remove public INSERT policies on orders and order_items
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can insert order items" ON public.order_items;

-- Add admin-only INSERT policies (public orders now go through edge function with service role)
CREATE POLICY "Admins can insert orders"
ON public.orders
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert order items"
ON public.order_items
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
