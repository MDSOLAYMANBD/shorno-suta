
-- 1. Update return_pending logic: remove 'exchange' from auto-flag list
CREATE OR REPLACE FUNCTION public.handle_return_pending_flag()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.return_received_at IS NOT NULL THEN
    NEW.return_pending := false;
  ELSIF NEW.status IN ('delivery_failed', 'paid_return') THEN
    NEW.return_pending := true;
  ELSE
    NEW.return_pending := false;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. New trigger: when an exchange is created/linked, flag the NEW order
CREATE OR REPLACE FUNCTION public.handle_exchange_return_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.new_order_id IS NOT NULL THEN
    UPDATE public.orders
    SET return_pending = true
    WHERE id = NEW.new_order_id
      AND return_received_at IS NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_exchange_return_pending ON public.order_exchanges;
CREATE TRIGGER trg_exchange_return_pending
AFTER INSERT OR UPDATE OF new_order_id ON public.order_exchanges
FOR EACH ROW
EXECUTE FUNCTION public.handle_exchange_return_pending();

-- 3. Backfill: clear flag on originals, set on new exchange orders
UPDATE public.orders
SET return_pending = false
WHERE id IN (SELECT order_id FROM public.order_exchanges WHERE new_order_id IS NOT NULL)
  AND return_received_at IS NULL
  AND status NOT IN ('delivery_failed', 'paid_return');

UPDATE public.orders
SET return_pending = true
WHERE id IN (SELECT new_order_id FROM public.order_exchanges WHERE new_order_id IS NOT NULL)
  AND return_received_at IS NULL;
