DROP POLICY IF EXISTS "Staff can delete sale transactions" ON public.acc_transactions;
CREATE POLICY "Staff can delete sale transactions"
ON public.acc_transactions
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'order_manager'::app_role) AND type = 'sale')
);