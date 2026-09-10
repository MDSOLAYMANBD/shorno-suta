-- Delete stale sale transaction for cancelled order SD-005987
DELETE FROM acc_transactions WHERE id = 'b360b911-be00-4416-bfd8-4f2e2328062e';

-- Adjust account balance (subtract 850 from current 6870)
UPDATE acc_accounts SET balance = balance - 850 WHERE id = '0c788629-b021-4296-90aa-39c0b3667058';