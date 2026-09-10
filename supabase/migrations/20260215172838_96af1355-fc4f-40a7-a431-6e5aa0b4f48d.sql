
-- Add deleted_at column for soft delete
ALTER TABLE public.orders ADD COLUMN deleted_at timestamptz DEFAULT NULL;

-- Add delete policy for admins
CREATE POLICY "Admins can delete orders"
ON public.orders
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));
