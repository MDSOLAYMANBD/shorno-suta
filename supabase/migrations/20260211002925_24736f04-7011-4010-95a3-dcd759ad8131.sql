
CREATE POLICY "Admins can update order items"
  ON public.order_items FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete order items"
  ON public.order_items FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));
