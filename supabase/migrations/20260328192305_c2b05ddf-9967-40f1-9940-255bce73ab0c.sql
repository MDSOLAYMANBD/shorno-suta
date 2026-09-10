
-- Backfill order numbers into legacy sale transaction descriptions
UPDATE acc_transactions t
SET description = 
  CASE 
    WHEN t.source = 'bank' THEN 'অনলাইন পেমেন্ট #' || o.order_number || ' — অটো এন্ট্রি'
    ELSE 'অফিস সেল #' || o.order_number || ' — অটো এন্ট্রি'
  END
FROM orders o
WHERE t.type = 'sale'
  AND t.reference_type = 'order'
  AND t.reference_id = o.id::text
  AND t.description NOT LIKE '%#SD-%';
