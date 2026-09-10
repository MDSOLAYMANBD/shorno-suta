-- Add delivered_orders column to customers table
ALTER TABLE customers ADD COLUMN delivered_orders integer NOT NULL DEFAULT 0;

-- Backfill existing data from orders
UPDATE customers c
SET delivered_orders = COALESCE(sub.cnt, 0)
FROM (
  SELECT customer_phone, COUNT(*) as cnt
  FROM orders
  WHERE status IN ('delivered', 'office_sell')
    AND deleted_at IS NULL
  GROUP BY customer_phone
) sub
WHERE c.phone = sub.customer_phone;