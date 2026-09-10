-- Delete March 14 transactions (Bangladesh timezone UTC+6)
DELETE FROM acc_transactions WHERE created_at >= '2026-03-14T00:00:00+06:00' AND created_at < '2026-03-15T00:00:00+06:00';

-- Recalculate balances based on remaining transactions (March 15+)
UPDATE acc_accounts SET balance = 3550 WHERE type = 'sale';
UPDATE acc_accounts SET balance = -500 WHERE type = 'cash';