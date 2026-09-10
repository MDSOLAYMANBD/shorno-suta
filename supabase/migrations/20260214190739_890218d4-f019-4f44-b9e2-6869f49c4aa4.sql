
-- Party/Supplier entries table
CREATE TABLE public.acc_party_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.acc_persons(id) ON DELETE CASCADE,
  memo_number text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  product_name text NOT NULL,
  quantity integer,
  rate numeric,
  total numeric NOT NULL DEFAULT 0,
  is_submission boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.acc_party_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read acc_party_entries" ON public.acc_party_entries
  FOR SELECT USING (has_any_role(auth.uid()));

CREATE POLICY "Admin can manage acc_party_entries" ON public.acc_party_entries
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Production Staff entries table
CREATE TABLE public.acc_production_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.acc_persons(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  product_name text NOT NULL,
  quantity integer,
  pricing numeric,
  total numeric NOT NULL DEFAULT 0,
  is_submission boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.acc_production_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read acc_production_entries" ON public.acc_production_entries
  FOR SELECT USING (has_any_role(auth.uid()));

CREATE POLICY "Admin can manage acc_production_entries" ON public.acc_production_entries
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
