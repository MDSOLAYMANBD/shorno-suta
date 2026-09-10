-- Fix SD-005477: update sale entry from 1450 to 1300 (after discount)
UPDATE acc_transactions SET amount = 1300 WHERE id = '344a4f3e-1654-4b9f-83c8-4e545e6eea95';

-- Adjust cash/sale account balance: reduce by 150
UPDATE acc_accounts SET balance = balance - 150 WHERE id = '0c788629-b021-4296-90aa-39c0b3667058';