ALTER TABLE public.acc_salary_records
  ADD COLUMN IF NOT EXISTS bonus_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_note text,
  ADD COLUMN IF NOT EXISTS overtime_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_note text;