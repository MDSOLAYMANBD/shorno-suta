
-- Remove overly broad "Staff can read" policies on sensitive salary/financial tables
-- Admin access is preserved via existing "Admin can manage" ALL policies

DROP POLICY IF EXISTS "Staff can read acc_persons" ON public.acc_persons;
DROP POLICY IF EXISTS "Staff can read acc_salary_records" ON public.acc_salary_records;
DROP POLICY IF EXISTS "Staff can read acc_transactions" ON public.acc_transactions;
