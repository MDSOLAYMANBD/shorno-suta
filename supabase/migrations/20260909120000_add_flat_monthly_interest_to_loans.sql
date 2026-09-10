ALTER TABLE public.acc_loans
  ADD COLUMN IF NOT EXISTS interest_type text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS monthly_interest_amount numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.acc_loans.interest_type IS
  '''none'' (existing %-based interest_rate field, currently unused/0 everywhere) or ''monthly_flat'' — a fixed taka amount added to what''s owed for every full month the loan stays unpaid, e.g. borrow now, owe +1500 every month starting one month later, until settled.';
COMMENT ON COLUMN public.acc_loans.monthly_interest_amount IS
  'Flat taka amount accrued per elapsed month when interest_type = ''monthly_flat''. Ignored otherwise.';
