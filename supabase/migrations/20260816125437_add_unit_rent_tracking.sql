-- Audit log of rent rate changes per unit, mirrors acc_salary_increments
CREATE TABLE public.acc_unit_rent_increments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.acc_units(id) ON DELETE CASCADE,
  old_amount numeric NOT NULL DEFAULT 0,
  new_amount numeric NOT NULL DEFAULT 0,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One row per unit per month, mirrors acc_salary_records (simplified: no deduction/bonus/overtime)
CREATE TABLE public.acc_unit_rent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.acc_units(id) ON DELETE CASCADE,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  year integer NOT NULL,
  rent_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  is_paid boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(unit_id, month, year)
);

-- One row per payment event, with an allocations breakdown for exact reversal on delete
CREATE TABLE public.acc_unit_rent_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.acc_units(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  account_id uuid REFERENCES public.acc_accounts(id),
  source text NOT NULL DEFAULT 'cash',
  note text DEFAULT '',
  allocations jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_acc_unit_rent_increments_unit_id ON public.acc_unit_rent_increments(unit_id);
CREATE INDEX idx_acc_unit_rent_records_unit_id ON public.acc_unit_rent_records(unit_id);
CREATE INDEX idx_acc_unit_rent_payments_unit_id ON public.acc_unit_rent_payments(unit_id);

ALTER TABLE public.acc_unit_rent_increments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage acc_unit_rent_increments" ON public.acc_unit_rent_increments
  FOR ALL TO public
  USING (has_role((SELECT auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Staff can read acc_unit_rent_increments" ON public.acc_unit_rent_increments
  FOR SELECT TO public
  USING (has_role((SELECT auth.uid()), 'admin'::app_role) OR has_any_role((SELECT auth.uid())));

ALTER TABLE public.acc_unit_rent_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage acc_unit_rent_records" ON public.acc_unit_rent_records
  FOR ALL TO public
  USING (has_role((SELECT auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Staff can read acc_unit_rent_records" ON public.acc_unit_rent_records
  FOR SELECT TO public
  USING (has_role((SELECT auth.uid()), 'admin'::app_role) OR has_any_role((SELECT auth.uid())));

ALTER TABLE public.acc_unit_rent_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage acc_unit_rent_payments" ON public.acc_unit_rent_payments
  FOR ALL TO public
  USING (has_role((SELECT auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Staff can read acc_unit_rent_payments" ON public.acc_unit_rent_payments
  FOR SELECT TO public
  USING (has_role((SELECT auth.uid()), 'admin'::app_role) OR has_any_role((SELECT auth.uid())));
