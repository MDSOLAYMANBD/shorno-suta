
-- Move all courier_withdrawal transactions from Sale Account to Cash Account
UPDATE acc_transactions 
SET account_id = '266fdf05-43ef-4dc6-8660-842a958df62e' 
WHERE type = 'courier_withdrawal' AND account_id = '0c788629-b021-4296-90aa-39c0b3667058';

-- Recalculate Cash Account balance: -106,000 (existing) + 90,000 (withdrawals moved in) = -16,000
UPDATE acc_accounts SET balance = -16000 WHERE id = '266fdf05-43ef-4dc6-8660-842a958df62e';

-- Recalculate Sale Account balance: 96,080 - 90,000 (withdrawals removed) = 6,080
UPDATE acc_accounts SET balance = 6080 WHERE id = '0c788629-b021-4296-90aa-39c0b3667058';
