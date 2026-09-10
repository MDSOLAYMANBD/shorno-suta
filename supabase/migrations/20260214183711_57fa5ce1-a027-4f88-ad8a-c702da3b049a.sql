
-- ============================================
-- ACCOUNTING SYSTEM — 10 NEW TABLES + RLS
-- ============================================

-- 1. acc_units — Multiple business units
CREATE TABLE public.acc_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.acc_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read acc_units" ON public.acc_units FOR SELECT USING (has_any_role(auth.uid()));
CREATE POLICY "Admin can manage acc_units" ON public.acc_units FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed default units
INSERT INTO public.acc_units (name) VALUES ('Office'), ('Factory'), ('Print Factory');

-- 2. acc_accounts — Cash, Sale, Expense accounts
CREATE TABLE public.acc_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'cash' CHECK (type IN ('cash','sale','expense')),
  balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.acc_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read acc_accounts" ON public.acc_accounts FOR SELECT USING (has_any_role(auth.uid()));
CREATE POLICY "Admin can manage acc_accounts" ON public.acc_accounts FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed default accounts
INSERT INTO public.acc_accounts (name, type) VALUES ('Cash Account', 'cash'), ('Sale Account', 'sale');

-- 3. acc_persons — Person-wise ledger
CREATE TABLE public.acc_persons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  type text NOT NULL DEFAULT 'employee' CHECK (type IN ('employee','production_staff','party','supplier')),
  unit_id uuid REFERENCES public.acc_units(id) ON DELETE SET NULL,
  joining_date date,
  base_salary numeric DEFAULT 0,
  salary_type text NOT NULL DEFAULT 'monthly' CHECK (salary_type IN ('monthly','manual')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.acc_persons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read acc_persons" ON public.acc_persons FOR SELECT USING (has_any_role(auth.uid()));
CREATE POLICY "Admin can manage acc_persons" ON public.acc_persons FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 4. acc_transactions — All financial transactions
CREATE TABLE public.acc_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.acc_accounts(id) ON DELETE RESTRICT NOT NULL,
  person_id uuid REFERENCES public.acc_persons(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES public.acc_units(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('sale','salary','production_payment','party_payment','courier_withdrawal','expense','adjustment','deposit')),
  amount numeric NOT NULL DEFAULT 0,
  description text DEFAULT '',
  reference_id text,
  reference_type text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.acc_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read acc_transactions" ON public.acc_transactions FOR SELECT USING (has_any_role(auth.uid()));
CREATE POLICY "Admin can manage acc_transactions" ON public.acc_transactions FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 5. acc_attendance — Daily attendance
CREATE TABLE public.acc_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid REFERENCES public.acc_persons(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  check_in timestamptz,
  check_out timestamptz,
  status text NOT NULL DEFAULT 'present' CHECK (status IN ('present','absent','off_day','late')),
  note text,
  marked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(person_id, date)
);
ALTER TABLE public.acc_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read acc_attendance" ON public.acc_attendance FOR SELECT USING (has_any_role(auth.uid()));
CREATE POLICY "Admin can manage acc_attendance" ON public.acc_attendance FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 6. acc_salary_config — Salary configuration
CREATE TABLE public.acc_salary_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid REFERENCES public.acc_persons(id) ON DELETE CASCADE NOT NULL,
  base_salary numeric NOT NULL DEFAULT 0,
  off_days_per_week jsonb NOT NULL DEFAULT '["friday"]'::jsonb,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.acc_salary_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read acc_salary_config" ON public.acc_salary_config FOR SELECT USING (has_any_role(auth.uid()));
CREATE POLICY "Admin can manage acc_salary_config" ON public.acc_salary_config FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 7. acc_off_days — Per-person weekly off days
CREATE TABLE public.acc_off_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid REFERENCES public.acc_persons(id) ON DELETE CASCADE NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(person_id, day_of_week)
);
ALTER TABLE public.acc_off_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read acc_off_days" ON public.acc_off_days FOR SELECT USING (has_any_role(auth.uid()));
CREATE POLICY "Admin can manage acc_off_days" ON public.acc_off_days FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 8. acc_salary_records — Monthly salary records
CREATE TABLE public.acc_salary_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid REFERENCES public.acc_persons(id) ON DELETE CASCADE NOT NULL,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  year integer NOT NULL,
  working_days integer NOT NULL DEFAULT 0,
  present_days integer NOT NULL DEFAULT 0,
  absent_days integer NOT NULL DEFAULT 0,
  off_days integer NOT NULL DEFAULT 0,
  base_salary numeric NOT NULL DEFAULT 0,
  deduction numeric NOT NULL DEFAULT 0,
  final_salary numeric NOT NULL DEFAULT 0,
  is_paid boolean NOT NULL DEFAULT false,
  paid_at timestamptz,
  transaction_id uuid REFERENCES public.acc_transactions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(person_id, month, year)
);
ALTER TABLE public.acc_salary_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read acc_salary_records" ON public.acc_salary_records FOR SELECT USING (has_any_role(auth.uid()));
CREATE POLICY "Admin can manage acc_salary_records" ON public.acc_salary_records FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 9. acc_salary_increments — Salary increment history
CREATE TABLE public.acc_salary_increments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid REFERENCES public.acc_persons(id) ON DELETE CASCADE NOT NULL,
  old_salary numeric NOT NULL DEFAULT 0,
  new_salary numeric NOT NULL DEFAULT 0,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.acc_salary_increments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read acc_salary_increments" ON public.acc_salary_increments FOR SELECT USING (has_any_role(auth.uid()));
CREATE POLICY "Admin can manage acc_salary_increments" ON public.acc_salary_increments FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 10. acc_production_payments — Production staff payments
CREATE TABLE public.acc_production_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid REFERENCES public.acc_persons(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  description text DEFAULT '',
  transaction_id uuid REFERENCES public.acc_transactions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.acc_production_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read acc_production_payments" ON public.acc_production_payments FOR SELECT USING (has_any_role(auth.uid()));
CREATE POLICY "Admin can manage acc_production_payments" ON public.acc_production_payments FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- UPDATE PERMISSIONS FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _role app_role;
  _permissions jsonb;
BEGIN
  SELECT role INTO _role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
  
  IF _role IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  CASE _role
    WHEN 'admin' THEN
      _permissions := '{
        "dashboard": "full", "orders": "full", "products": "full", "categories": "full",
        "customers": "full", "coupons": "full", "landing_pages": "full", "media": "full",
        "sizes_colors": "full", "site_editor": "full", "settings": "full", "employees": "full",
        "live_chat": "full", "accounting": "full"
      }'::jsonb;
    WHEN 'editor' THEN
      _permissions := '{
        "dashboard": "view", "orders": "edit", "products": "edit", "categories": "edit",
        "customers": "view", "coupons": "edit", "landing_pages": "edit", "media": "edit",
        "sizes_colors": "edit", "site_editor": "edit", "settings": "none", "employees": "none",
        "live_chat": "edit", "accounting": "none"
      }'::jsonb;
    WHEN 'order_manager' THEN
      _permissions := '{
        "dashboard": "view", "orders": "edit", "products": "none", "categories": "none",
        "customers": "view", "coupons": "none", "landing_pages": "none", "media": "none",
        "sizes_colors": "none", "site_editor": "none", "settings": "none", "employees": "none",
        "live_chat": "edit", "accounting": "none"
      }'::jsonb;
    WHEN 'product_manager' THEN
      _permissions := '{
        "dashboard": "view", "orders": "none", "products": "edit", "categories": "edit",
        "customers": "none", "coupons": "none", "landing_pages": "none", "media": "edit",
        "sizes_colors": "edit", "site_editor": "none", "settings": "none", "employees": "none",
        "live_chat": "none", "accounting": "none"
      }'::jsonb;
    WHEN 'viewer' THEN
      _permissions := '{
        "dashboard": "view", "orders": "view", "products": "view", "categories": "view",
        "customers": "view", "coupons": "view", "landing_pages": "view", "media": "view",
        "sizes_colors": "view", "site_editor": "view", "settings": "none", "employees": "none",
        "live_chat": "view", "accounting": "none"
      }'::jsonb;
    ELSE
      _permissions := '{}'::jsonb;
  END CASE;

  RETURN jsonb_build_object('role', _role::text, 'permissions', _permissions);
END;
$function$;
