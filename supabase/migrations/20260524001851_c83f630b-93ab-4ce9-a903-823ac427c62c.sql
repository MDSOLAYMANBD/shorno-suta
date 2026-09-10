ALTER TABLE public.acc_salary_records
  ADD COLUMN IF NOT EXISTS received_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS received_note text;