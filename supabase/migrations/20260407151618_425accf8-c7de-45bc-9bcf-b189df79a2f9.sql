-- Fix mismatched source for the কাপর transaction where account_id points to bank but source says 'cash'
UPDATE acc_transactions SET source = 'bank' WHERE id = 'ffc8b65d-b9cb-4928-88f5-4dbba23b52e3';

-- Also fix the reverse case: account_id=cash but source='bank'
UPDATE acc_transactions SET source = 'cash'
WHERE account_id = '266fdf05-43ef-4dc6-8660-842a958df62e'
  AND source = 'bank'
  AND type IN ('expense')
  AND description NOT LIKE '%ট্রান্সফার%';