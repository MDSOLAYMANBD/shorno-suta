ALTER TABLE acc_accounts DROP CONSTRAINT acc_accounts_type_check;
ALTER TABLE acc_accounts ADD CONSTRAINT acc_accounts_type_check CHECK (type = ANY (ARRAY['cash', 'sale', 'expense', 'bank']));
INSERT INTO acc_accounts (name, type, balance) VALUES ('Bank Account', 'bank', 0);