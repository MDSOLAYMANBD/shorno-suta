
-- Map raw courier_status -> internal orders.status
CREATE OR REPLACE FUNCTION public.map_courier_to_order_status(_courier_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
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
$$;

-- BEFORE UPDATE trigger: when courier_status moves, sync orders.status
CREATE OR REPLACE FUNCTION public.sync_order_status_from_courier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  mapped text;
BEGIN
  IF NEW.courier_status IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.courier_status IS NOT DISTINCT FROM OLD.courier_status THEN
    RETURN NEW;
  END IF;

  -- Never override manual terminal flows
  IF OLD.status IN ('office_sell', 'paid_return') THEN
    RETURN NEW;
  END IF;

  mapped := public.map_courier_to_order_status(NEW.courier_status);
  IF mapped IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only change if different
  IF NEW.status IS DISTINCT FROM mapped THEN
    NEW.status := mapped;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_status_from_courier ON public.orders;
CREATE TRIGGER trg_sync_status_from_courier
BEFORE UPDATE OF courier_status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_order_status_from_courier();
