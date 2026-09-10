
-- Backfill orders.status using the new mapping function
UPDATE public.orders
SET status = public.map_courier_to_order_status(courier_status)
WHERE courier_consignment_id IS NOT NULL
  AND courier_status IS NOT NULL
  AND status NOT IN ('office_sell', 'paid_return')
  AND public.map_courier_to_order_status(courier_status) IS NOT NULL
  AND status IS DISTINCT FROM public.map_courier_to_order_status(courier_status);
