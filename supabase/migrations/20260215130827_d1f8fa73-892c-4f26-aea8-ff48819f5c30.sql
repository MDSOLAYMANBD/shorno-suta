
-- orders: order_manager can read
CREATE POLICY "Order managers can read orders"
ON public.orders FOR SELECT
USING (has_role(auth.uid(), 'order_manager'));

-- orders: order_manager can update
CREATE POLICY "Order managers can update orders"
ON public.orders FOR UPDATE
USING (has_role(auth.uid(), 'order_manager'));

-- order_items: order_manager can read
CREATE POLICY "Order managers can read order items"
ON public.order_items FOR SELECT
USING (has_role(auth.uid(), 'order_manager'));

-- order_items: order_manager can update
CREATE POLICY "Order managers can update order items"
ON public.order_items FOR UPDATE
USING (has_role(auth.uid(), 'order_manager'));

-- customers: order_manager can read
CREATE POLICY "Order managers can read customers"
ON public.customers FOR SELECT
USING (has_role(auth.uid(), 'order_manager'));

-- abandoned_checkouts: order_manager can read
CREATE POLICY "Order managers can read abandoned checkouts"
ON public.abandoned_checkouts FOR SELECT
USING (has_role(auth.uid(), 'order_manager'));

-- abandoned_checkouts: order_manager can update
CREATE POLICY "Order managers can update abandoned checkouts"
ON public.abandoned_checkouts FOR UPDATE
USING (has_role(auth.uid(), 'order_manager'));
