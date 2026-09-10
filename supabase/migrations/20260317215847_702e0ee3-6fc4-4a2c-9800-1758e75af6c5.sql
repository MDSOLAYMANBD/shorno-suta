
-- acc_loans table
CREATE TABLE public.acc_loans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  principal_amount NUMERIC NOT NULL DEFAULT 0,
  interest_rate NUMERIC NOT NULL DEFAULT 0,
  total_installments INTEGER NOT NULL DEFAULT 0,
  monthly_installment NUMERIC NOT NULL DEFAULT 0,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.acc_loans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage acc_loans" ON public.acc_loans
  FOR ALL TO public
  USING (has_role((SELECT auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));

-- acc_loan_payments table
CREATE TABLE public.acc_loan_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loan_id UUID NOT NULL REFERENCES public.acc_loans(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_source TEXT NOT NULL DEFAULT 'cash',
  account_id UUID REFERENCES public.acc_accounts(id),
  note TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.acc_loan_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage acc_loan_payments" ON public.acc_loan_payments
  FOR ALL TO public
  USING (has_role((SELECT auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));

-- acc_investments table
CREATE TABLE public.acc_investments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT DEFAULT '',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT NOT NULL DEFAULT 'cash',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.acc_investments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage acc_investments" ON public.acc_investments
  FOR ALL TO public
  USING (has_role((SELECT auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));
