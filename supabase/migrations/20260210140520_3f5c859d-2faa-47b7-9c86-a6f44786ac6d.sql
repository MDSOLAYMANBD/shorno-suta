-- Add explicit default-deny policy for anon users on orders table
CREATE POLICY "Deny anon access to orders"
  ON public.orders
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false);

-- Add explicit default-deny policy for anon users on order_items table
CREATE POLICY "Deny anon access to order_items"
  ON public.order_items
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false);