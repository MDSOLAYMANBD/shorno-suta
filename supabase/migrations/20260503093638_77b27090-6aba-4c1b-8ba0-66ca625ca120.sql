-- Correct Steadfast orders that were stored with the bogus 'success' status
-- (left over from before normalization). Reset to 'in_review' so the next
-- status sync / webhook will populate the real Steadfast delivery_status.
UPDATE public.orders
SET courier_status = 'in_review',
    courier_provider = 'steadfast'
WHERE courier_status = 'success'
  AND courier_consignment_id IS NOT NULL;