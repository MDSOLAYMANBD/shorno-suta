
-- Remove overly permissive SELECT policies on customers table
DROP POLICY IF EXISTS "Allow authenticated users" ON public.customers;
DROP POLICY IF EXISTS "Admin can view customers" ON public.customers;
