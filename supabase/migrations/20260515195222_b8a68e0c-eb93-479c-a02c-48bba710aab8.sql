-- Make return_pending fully derived from current status + return_received_at,
-- and rename trigger so it runs AFTER trg_sync_status_from_courier (alphabetical).

CREATE OR REPLACE FUNCTION public.handle_return_pending_flag()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.return_received_at IS NOT NULL THEN
    NEW.return_pending := false;
  ELSIF NEW.status IN ('delivery_failed', 'paid_return', 'exchange') THEN
    NEW.return_pending := true;
  ELSE
    NEW.return_pending := false;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_handle_return_pending ON public.orders;
DROP TRIGGER IF EXISTS trg_zz_handle_return_pending ON public.orders;

CREATE TRIGGER trg_zz_handle_return_pending
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_return_pending_flag();

-- Backfill: clear stuck return_pending on orders no longer in a return state
UPDATE public.orders
SET return_pending = false
WHERE return_pending = true
  AND return_received_at IS NULL
  AND status NOT IN ('delivery_failed', 'paid_return', 'exchange');