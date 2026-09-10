
-- Add admin UPDATE policy for customer_profiles
CREATE POLICY "Admins can update customer profiles"
ON public.customer_profiles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add admin DELETE policy for customer_profiles
CREATE POLICY "Admins can delete customer profiles"
ON public.customer_profiles
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));
