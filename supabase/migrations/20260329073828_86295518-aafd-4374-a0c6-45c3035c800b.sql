
-- Backfill missing sale entries for office_sell orders (source=cash, unpaid)
INSERT INTO acc_transactions (account_id, type, amount, description, reference_id, reference_type, source)
SELECT 
  '0c788629-b021-4296-90aa-39c0b3667058',
  'sale',
  o.subtotal,
  'অফিস সেল #' || o.order_number || ' — অটো এন্ট্রি (ব্যাকফিল)',
  o.id::text,
  'order',
  'cash'
FROM orders o
LEFT JOIN acc_transactions t ON t.reference_id = o.id::text AND t.reference_type = 'order' AND t.type = 'sale'
WHERE o.status = 'office_sell' AND o.deleted_at IS NULL AND t.id IS NULL AND o.subtotal > 0;

-- Update sale account balance with total of backfilled entries
UPDATE acc_accounts 
SET balance = balance + (
  SELECT COALESCE(SUM(o.subtotal), 0)
  FROM orders o
  LEFT JOIN acc_transactions t ON t.reference_id = o.id::text AND t.reference_type = 'order' AND t.type = 'sale'
  WHERE o.status = 'office_sell' AND o.deleted_at IS NULL AND t.id IS NULL AND o.subtotal > 0
)
WHERE id = '0c788629-b021-4296-90aa-39c0b3667058';
