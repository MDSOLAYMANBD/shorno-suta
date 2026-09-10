INSERT INTO public.acc_unit_materials (unit_id, item_name, quantity, unit_price, total, date, description, created_at)
SELECT 
  t.unit_id,
  COALESCE(NULLIF(TRIM(REPLACE(t.description, '[ম্যাটেরিয়াল ক্রয়]', '')), ''), 'ম্যাটেরিয়াল') AS item_name,
  1,
  t.amount,
  t.amount,
  (t.created_at AT TIME ZONE 'Asia/Dhaka')::date,
  NULLIF(TRIM(REPLACE(t.description, '[ম্যাটেরিয়াল ক্রয়]', '')), ''),
  t.created_at
FROM public.acc_transactions t
WHERE t.description ILIKE '%[ম্যাটেরিয়াল ক্রয়]%'
  AND t.unit_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.acc_unit_materials m
    WHERE m.unit_id = t.unit_id
      AND m.date = (t.created_at AT TIME ZONE 'Asia/Dhaka')::date
      AND m.total = t.amount
      AND COALESCE(m.item_name,'') = COALESCE(NULLIF(TRIM(REPLACE(t.description, '[ম্যাটেরিয়াল ক্রয়]', '')), ''), 'ম্যাটেরিয়াল')
  );