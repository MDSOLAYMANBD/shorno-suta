
-- Backfill: Insert missing sale transactions for office_sell/delivered orders
INSERT INTO acc_transactions (account_id, type, amount, description, reference_id, reference_type)
SELECT 
  '0c788629-b021-4296-90aa-39c0b3667058',
  'sale',
  o.subtotal,
  'অফিস সেল — ব্যাকফিল এন্ট্রি',
  o.id::text,
  'order'
FROM orders o
LEFT JOIN acc_transactions tx ON tx.reference_id = o.id::text AND tx.type = 'sale' AND tx.reference_type = 'order'
WHERE o.status IN ('office_sell', 'delivered')
  AND o.deleted_at IS NULL
  AND tx.id IS NULL
  AND o.subtotal > 0;

-- Fix: Update mismatched sale transaction amounts to match orders.subtotal
UPDATE acc_transactions tx
SET amount = o.subtotal
FROM orders o
WHERE tx.reference_id = o.id::text
  AND tx.type = 'sale'
  AND tx.reference_type = 'order'
  AND o.status IN ('office_sell', 'delivered')
  AND o.deleted_at IS NULL
  AND tx.amount != o.subtotal;

-- Recalculate sale account balance from all sale transactions
UPDATE acc_accounts
SET balance = (
  SELECT COALESCE(SUM(amount), 0)
  FROM acc_transactions
  WHERE account_id = '0c788629-b021-4296-90aa-39c0b3667058'
    AND type = 'sale'
) - (
  SELECT COALESCE(SUM(amount), 0)
  FROM acc_transactions
  WHERE account_id = '0c788629-b021-4296-90aa-39c0b3667058'
    AND type != 'sale'
)
WHERE id = '0c788629-b021-4296-90aa-39c0b3667058';
