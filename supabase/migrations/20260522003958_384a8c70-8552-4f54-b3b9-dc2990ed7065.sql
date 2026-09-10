ALTER TABLE public.acc_loans
  ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES public.acc_units(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS loan_type text NOT NULL DEFAULT 'bank',
  ADD COLUMN IF NOT EXISTS lender_name text,
  ADD COLUMN IF NOT EXISTS deposit_account_id uuid REFERENCES public.acc_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_acc_loans_unit_id ON public.acc_loans(unit_id);