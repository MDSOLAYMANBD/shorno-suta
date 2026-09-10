ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS return_pending boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS return_received_at timestamptz,
  ADD COLUMN IF NOT EXISTS return_received_by uuid;

CREATE INDEX IF NOT EXISTS idx_orders_return_pending
  ON public.orders (created_at DESC)
  WHERE return_pending = true AND return_received_at IS NULL;

CREATE OR REPLACE FUNCTION public.handle_return_pending_flag()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('delivery_failed', 'exchange') THEN
      IF NEW.return_received_at IS NULL THEN
        NEW.return_pending := true;
      END IF;
    ELSE
      -- Status moved away from a return-causing state: clear pending flag
      IF OLD.status IN ('delivery_failed', 'exchange') THEN
        NEW.return_pending := false;
      END IF;
    END IF;
  END IF;

  -- If admin marked received, clear pending
  IF NEW.return_received_at IS NOT NULL THEN
    NEW.return_pending := false;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_return_pending ON public.orders;
CREATE TRIGGER trg_handle_return_pending
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_return_pending_flag();