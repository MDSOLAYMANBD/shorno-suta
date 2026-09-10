
-- Delete old test transactions before 2026-03-14
DELETE FROM acc_transactions WHERE created_at < '2026-03-14T00:00:00+06:00';

-- Recalculate Sale Account balance: sum of remaining sales = 5250
UPDATE acc_accounts SET balance = 5250 WHERE type = 'sale';

-- Recalculate Cash Account balance: deposit(500) - salary(64500) - courier_withdrawal(1000) - expense(70) = -65070
UPDATE acc_accounts SET balance = -65070 WHERE type = 'cash';
