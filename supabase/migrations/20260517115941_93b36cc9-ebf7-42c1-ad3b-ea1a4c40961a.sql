
-- Restrict accounting tables SELECT to admin-only

DROP POLICY IF EXISTS "Staff can read acc_accounts" ON public.acc_accounts;
CREATE POLICY "Admin can read acc_accounts" ON public.acc_accounts FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Staff can read acc_off_days" ON public.acc_off_days;
CREATE POLICY "Admin can read acc_off_days" ON public.acc_off_days FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Staff can read acc_production_payments" ON public.acc_production_payments;
CREATE POLICY "Admin can read acc_production_payments" ON public.acc_production_payments FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Staff can read acc_unit_custom_expenses" ON public.acc_unit_custom_expenses;
CREATE POLICY "Admin can read acc_unit_custom_expenses" ON public.acc_unit_custom_expenses FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Staff can read acc_unit_fixed_expenses" ON public.acc_unit_fixed_expenses;
CREATE POLICY "Admin can read acc_unit_fixed_expenses" ON public.acc_unit_fixed_expenses FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Staff can read acc_unit_materials" ON public.acc_unit_materials;
CREATE POLICY "Admin can read acc_unit_materials" ON public.acc_unit_materials FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Staff can read acc_units" ON public.acc_units;
CREATE POLICY "Admin can read acc_units" ON public.acc_units FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Staff can read acc_work_orders" ON public.acc_work_orders;
CREATE POLICY "Admin can read acc_work_orders" ON public.acc_work_orders FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix acc_activity_logs (currently misnamed "Admins full access" but uses has_any_role)
DROP POLICY IF EXISTS "Admins full access to acc_activity_logs" ON public.acc_activity_logs;
CREATE POLICY "Admin full access to acc_activity_logs" ON public.acc_activity_logs FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
