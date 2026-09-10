UPDATE acc_transactions t
SET created_at = o.created_at
FROM orders o
WHERE o.id::text = t.reference_id
  AND t.reference_type = 'order'
  AND t.type = 'sale'
  AND DATE(t.created_at) <> DATE(o.created_at);