ALTER TABLE courier_payments 
ADD COLUMN IF NOT EXISTS receive_method text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS bank_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS cash_amount numeric DEFAULT 0;