
CREATE TABLE public.acc_unit_custom_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.acc_units(id) ON DELETE CASCADE,
  module_name text NOT NULL,
  item_name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  description text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.acc_unit_custom_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage acc_unit_custom_expenses" ON public.acc_unit_custom_expenses
  FOR ALL TO public
  USING (has_role((SELECT auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));

CREATE POLICY "Staff can read acc_unit_custom_expenses" ON public.acc_unit_custom_expenses
  FOR SELECT TO public
  USING (has_role((SELECT auth.uid()), 'admin'::app_role) OR has_any_role((SELECT auth.uid())));
