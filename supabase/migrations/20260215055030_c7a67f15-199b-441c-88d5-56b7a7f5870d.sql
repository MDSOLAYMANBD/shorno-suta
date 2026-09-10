ALTER TABLE acc_transactions DROP CONSTRAINT acc_transactions_type_check;
ALTER TABLE acc_transactions ADD CONSTRAINT acc_transactions_type_check 
  CHECK (type = ANY (ARRAY['sale','salary','production_payment','party_payment','courier_withdrawal','expense','adjustment','deposit','advance']));