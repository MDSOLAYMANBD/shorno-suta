-- 1. Column for chosen dispatch date
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS scheduled_dispatch_date date;

-- 2. Partial index for fast "today's scheduled" lookups
CREATE INDEX IF NOT EXISTS idx_orders_scheduled_dispatch_date
  ON public.orders (scheduled_dispatch_date)
  WHERE status = 'scheduled' AND deleted_at IS NULL;

-- 3. Protect 'scheduled' from courier-status auto-mapping + clear date when leaving
CREATE OR REPLACE FUNCTION public.sync_order_status_from_courier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  mapped text;
BEGIN
  IF NEW.courier_status IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.courier_status IS NOT DISTINCT FROM OLD.courier_status THEN
    RETURN NEW;
  END IF;

  -- Never override manual flows (incl. scheduled dispatch awaiting send-out)
  IF OLD.status IN ('office_sell', 'paid_return', 'scheduled') THEN
    RETURN NEW;
  END IF;

  mapped := public.map_courier_to_order_status(NEW.courier_status);
  IF mapped IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM mapped THEN
    NEW.status := mapped;
  END IF;

  RETURN NEW;
END;
$function$;

-- 4. Auto-clear scheduled_dispatch_date when status changes away from 'scheduled'
CREATE OR REPLACE FUNCTION public.clear_scheduled_dispatch_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND OLD.status = 'scheduled'
     AND NEW.status <> 'scheduled' THEN
    NEW.scheduled_dispatch_date := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_scheduled_dispatch ON public.orders;
CREATE TRIGGER trg_clear_scheduled_dispatch
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_scheduled_dispatch_on_status_change();