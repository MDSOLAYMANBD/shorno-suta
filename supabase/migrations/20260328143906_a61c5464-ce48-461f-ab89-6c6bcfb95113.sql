-- Drop the ALL policy and create separate policies for better control
-- The ALL policy blocks order_manager from DELETE operations

CREATE POLICY "Staff can delete sale transactions"
ON public.acc_transactions
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'order_manager'::app_role)
);