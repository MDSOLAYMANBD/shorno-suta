
-- Work Orders master table
CREATE TABLE public.acc_work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid REFERENCES public.acc_units(id) ON DELETE CASCADE NOT NULL,
  order_number text NOT NULL,
  product_name text NOT NULL,
  total_quantity integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Work Order entries (who sewed how many pieces)
CREATE TABLE public.acc_work_order_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid REFERENCES public.acc_work_orders(id) ON DELETE CASCADE NOT NULL,
  person_id uuid REFERENCES public.acc_persons(id) ON DELETE CASCADE NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for acc_work_orders
ALTER TABLE public.acc_work_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage acc_work_orders"
  ON public.acc_work_orders FOR ALL
  USING (has_role((SELECT auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));

CREATE POLICY "Staff can read acc_work_orders"
  ON public.acc_work_orders FOR SELECT
  USING (has_role((SELECT auth.uid()), 'admin'::app_role) OR has_any_role((SELECT auth.uid())));

-- RLS for acc_work_order_entries
ALTER TABLE public.acc_work_order_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage acc_work_order_entries"
  ON public.acc_work_order_entries FOR ALL
  USING (has_role((SELECT auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));

CREATE POLICY "Staff can read acc_work_order_entries"
  ON public.acc_work_order_entries FOR SELECT
  USING (has_role((SELECT auth.uid()), 'admin'::app_role) OR has_any_role((SELECT auth.uid())));
