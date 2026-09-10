CREATE OR REPLACE FUNCTION public.map_courier_to_order_status(_courier_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE lower(coalesce(_courier_status, ''))
    WHEN 'delivered' THEN 'delivered'
    WHEN 'delivered_approval_pending' THEN 'delivered'
    WHEN 'partial_delivered' THEN 'exchange'
    WHEN 'partial_delivered_approval_pending' THEN 'exchange'
    WHEN 'cancelled' THEN 'delivery_failed'
    WHEN 'cancelled_approval_pending' THEN 'delivery_failed'
    WHEN 'unknown' THEN 'delivery_failed'
    WHEN 'unknown_approval_pending' THEN 'delivery_failed'
    WHEN 'pickup_cancelled' THEN 'delivery_failed'
    WHEN 'pickup_failed' THEN 'shipped'
    WHEN 'pickup_requested' THEN 'shipped'
    WHEN 'pending' THEN 'shipped'
    WHEN 'in_review' THEN 'shipped'
    WHEN 'hold' THEN 'shipped'
    ELSE NULL
  END;
$function$;