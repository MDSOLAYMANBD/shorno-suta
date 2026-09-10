
-- Refactor acc_* RLS policies: split FOR ALL into individual action policies
-- to eliminate "Multiple Permissive Policies" warnings (9 tables x 4 actions = 36 warnings)

-- 1. acc_accounts
drop policy if exists "Admin can manage acc_accounts" on public.acc_accounts;
drop policy if exists "Staff can read acc_accounts" on public.acc_accounts;

create policy "Admin can insert acc_accounts" on public.acc_accounts for insert
  with check (has_role((select auth.uid()), 'admin'::app_role));
create policy "Admin can update acc_accounts" on public.acc_accounts for update
  using (has_role((select auth.uid()), 'admin'::app_role))
  with check (has_role((select auth.uid()), 'admin'::app_role));
create policy "Admin can delete acc_accounts" on public.acc_accounts for delete
  using (has_role((select auth.uid()), 'admin'::app_role));
create policy "Staff can read acc_accounts" on public.acc_accounts for select
  using (has_role((select auth.uid()), 'admin'::app_role) or has_any_role((select auth.uid())));

-- 2. acc_attendance
drop policy if exists "Admin can manage acc_attendance" on public.acc_attendance;
drop policy if exists "Staff can read acc_attendance" on public.acc_attendance;

create policy "Admin can insert acc_attendance" on public.acc_attendance for insert
  with check (has_role((select auth.uid()), 'admin'::app_role));
create policy "Admin can update acc_attendance" on public.acc_attendance for update
  using (has_role((select auth.uid()), 'admin'::app_role))
  with check (has_role((select auth.uid()), 'admin'::app_role));
create policy "Admin can delete acc_attendance" on public.acc_attendance for delete
  using (has_role((select auth.uid()), 'admin'::app_role));
create policy "Staff can read acc_attendance" on public.acc_attendance for select
  using (has_role((select auth.uid()), 'admin'::app_role) or has_any_role((select auth.uid())));

-- 3. acc_off_days
drop policy if exists "Admin can manage acc_off_days" on public.acc_off_days;
drop policy if exists "Staff can read acc_off_days" on public.acc_off_days;

create policy "Admin can insert acc_off_days" on public.acc_off_days for insert
  with check (has_role((select auth.uid()), 'admin'::app_role));
create policy "Admin can update acc_off_days" on public.acc_off_days for update
  using (has_role((select auth.uid()), 'admin'::app_role))
  with check (has_role((select auth.uid()), 'admin'::app_role));
create policy "Admin can delete acc_off_days" on public.acc_off_days for delete
  using (has_role((select auth.uid()), 'admin'::app_role));
create policy "Staff can read acc_off_days" on public.acc_off_days for select
  using (has_role((select auth.uid()), 'admin'::app_role) or has_any_role((select auth.uid())));

-- 4. acc_party_entries
drop policy if exists "Admin can manage acc_party_entries" on public.acc_party_entries;
drop policy if exists "Staff can read acc_party_entries" on public.acc_party_entries;

create policy "Admin can insert acc_party_entries" on public.acc_party_entries for insert
  with check (has_role((select auth.uid()), 'admin'::app_role));
create policy "Admin can update acc_party_entries" on public.acc_party_entries for update
  using (has_role((select auth.uid()), 'admin'::app_role))
  with check (has_role((select auth.uid()), 'admin'::app_role));
create policy "Admin can delete acc_party_entries" on public.acc_party_entries for delete
  using (has_role((select auth.uid()), 'admin'::app_role));
create policy "Staff can read acc_party_entries" on public.acc_party_entries for select
  using (has_role((select auth.uid()), 'admin'::app_role) or has_any_role((select auth.uid())));

-- 5. acc_production_entries
drop policy if exists "Admin can manage acc_production_entries" on public.acc_production_entries;
drop policy if exists "Staff can read acc_production_entries" on public.acc_production_entries;

create policy "Admin can insert acc_production_entries" on public.acc_production_entries for insert
  with check (has_role((select auth.uid()), 'admin'::app_role));
create policy "Admin can update acc_production_entries" on public.acc_production_entries for update
  using (has_role((select auth.uid()), 'admin'::app_role))
  with check (has_role((select auth.uid()), 'admin'::app_role));
create policy "Admin can delete acc_production_entries" on public.acc_production_entries for delete
  using (has_role((select auth.uid()), 'admin'::app_role));
create policy "Staff can read acc_production_entries" on public.acc_production_entries for select
  using (has_role((select auth.uid()), 'admin'::app_role) or has_any_role((select auth.uid())));

-- 6. acc_production_payments
drop policy if exists "Admin can manage acc_production_payments" on public.acc_production_payments;
drop policy if exists "Staff can read acc_production_payments" on public.acc_production_payments;

create policy "Admin can insert acc_production_payments" on public.acc_production_payments for insert
  with check (has_role((select auth.uid()), 'admin'::app_role));
create policy "Admin can update acc_production_payments" on public.acc_production_payments for update
  using (has_role((select auth.uid()), 'admin'::app_role))
  with check (has_role((select auth.uid()), 'admin'::app_role));
create policy "Admin can delete acc_production_payments" on public.acc_production_payments for delete
  using (has_role((select auth.uid()), 'admin'::app_role));
create policy "Staff can read acc_production_payments" on public.acc_production_payments for select
  using (has_role((select auth.uid()), 'admin'::app_role) or has_any_role((select auth.uid())));

-- 7. acc_salary_config
drop policy if exists "Admin can manage acc_salary_config" on public.acc_salary_config;
drop policy if exists "Staff can read acc_salary_config" on public.acc_salary_config;

create policy "Admin can insert acc_salary_config" on public.acc_salary_config for insert
  with check (has_role((select auth.uid()), 'admin'::app_role));
create policy "Admin can update acc_salary_config" on public.acc_salary_config for update
  using (has_role((select auth.uid()), 'admin'::app_role))
  with check (has_role((select auth.uid()), 'admin'::app_role));
create policy "Admin can delete acc_salary_config" on public.acc_salary_config for delete
  using (has_role((select auth.uid()), 'admin'::app_role));
create policy "Staff can read acc_salary_config" on public.acc_salary_config for select
  using (has_role((select auth.uid()), 'admin'::app_role) or has_any_role((select auth.uid())));

-- 8. acc_salary_increments
drop policy if exists "Admin can manage acc_salary_increments" on public.acc_salary_increments;
drop policy if exists "Staff can read acc_salary_increments" on public.acc_salary_increments;

create policy "Admin can insert acc_salary_increments" on public.acc_salary_increments for insert
  with check (has_role((select auth.uid()), 'admin'::app_role));
create policy "Admin can update acc_salary_increments" on public.acc_salary_increments for update
  using (has_role((select auth.uid()), 'admin'::app_role))
  with check (has_role((select auth.uid()), 'admin'::app_role));
create policy "Admin can delete acc_salary_increments" on public.acc_salary_increments for delete
  using (has_role((select auth.uid()), 'admin'::app_role));
create policy "Staff can read acc_salary_increments" on public.acc_salary_increments for select
  using (has_role((select auth.uid()), 'admin'::app_role) or has_any_role((select auth.uid())));

-- 9. acc_units
drop policy if exists "Admin can manage acc_units" on public.acc_units;
drop policy if exists "Staff can read acc_units" on public.acc_units;

create policy "Admin can insert acc_units" on public.acc_units for insert
  with check (has_role((select auth.uid()), 'admin'::app_role));
create policy "Admin can update acc_units" on public.acc_units for update
  using (has_role((select auth.uid()), 'admin'::app_role))
  with check (has_role((select auth.uid()), 'admin'::app_role));
create policy "Admin can delete acc_units" on public.acc_units for delete
  using (has_role((select auth.uid()), 'admin'::app_role));
create policy "Staff can read acc_units" on public.acc_units for select
  using (has_role((select auth.uid()), 'admin'::app_role) or has_any_role((select auth.uid())));
