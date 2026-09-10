
ALTER TABLE public.acc_persons DROP CONSTRAINT IF EXISTS acc_persons_type_check;
ALTER TABLE public.acc_persons ADD CONSTRAINT acc_persons_type_check
  CHECK (type = ANY (ARRAY['employee'::text, 'salaried_production'::text, 'production_staff'::text, 'party'::text, 'supplier'::text, 'sales_party'::text, 'loan_kisti'::text]));

ALTER TABLE public.acc_loans ADD COLUMN IF NOT EXISTS tracking_start_date date;
UPDATE public.acc_loans SET tracking_start_date = start_date WHERE tracking_start_date IS NULL;
