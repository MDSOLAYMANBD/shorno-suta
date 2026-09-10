
-- Add settings JSONB column to acc_units
ALTER TABLE public.acc_units ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Create acc_unit_materials table
CREATE TABLE public.acc_unit_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.acc_units(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  quantity numeric DEFAULT 0,
  unit_price numeric DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  description text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.acc_unit_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage acc_unit_materials" ON public.acc_unit_materials
  FOR ALL TO public
  USING (has_role((SELECT auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));

CREATE POLICY "Staff can read acc_unit_materials" ON public.acc_unit_materials
  FOR SELECT TO public
  USING (has_role((SELECT auth.uid()), 'admin'::app_role) OR has_any_role((SELECT auth.uid())));

-- Create acc_unit_fixed_expenses table
CREATE TABLE public.acc_unit_fixed_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.acc_units(id) ON DELETE CASCADE,
  category text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  month integer NOT NULL,
  year integer NOT NULL,
  description text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.acc_unit_fixed_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage acc_unit_fixed_expenses" ON public.acc_unit_fixed_expenses
  FOR ALL TO public
  USING (has_role((SELECT auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));

CREATE POLICY "Staff can read acc_unit_fixed_expenses" ON public.acc_unit_fixed_expenses
  FOR SELECT TO public
  USING (has_role((SELECT auth.uid()), 'admin'::app_role) OR has_any_role((SELECT auth.uid())));
