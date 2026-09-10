
CREATE TABLE public.courier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL DEFAULT '',
  date timestamptz NOT NULL DEFAULT now(),
  collected_amount numeric NOT NULL DEFAULT 0,
  delivery_bill numeric NOT NULL DEFAULT 0,
  sub_total numeric NOT NULL DEFAULT 0,
  cod_charge numeric NOT NULL DEFAULT 0,
  receivable_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.courier_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage courier_payments" ON public.courier_payments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
