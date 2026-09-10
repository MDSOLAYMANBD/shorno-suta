
ALTER TABLE public.acc_transactions DROP CONSTRAINT IF EXISTS acc_transactions_type_check;
ALTER TABLE public.acc_transactions ADD CONSTRAINT acc_transactions_type_check CHECK (type IN ('sale', 'salary', 'production_payment', 'party_payment', 'courier_withdrawal', 'expense', 'adjustment', 'deposit', 'advance', 'bonus'));
