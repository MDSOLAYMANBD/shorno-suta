-- Allow any staff member to read activity logs for orders
CREATE POLICY "Staff can read order activity_logs"
ON public.activity_logs
FOR SELECT
USING (
  has_any_role(auth.uid()) AND entity_type = 'order'
);

-- Allow order_manager to insert activity_logs
CREATE POLICY "Order managers can insert activity_logs"
ON public.activity_logs
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'order_manager'::app_role) AND auth.uid() = user_id
);