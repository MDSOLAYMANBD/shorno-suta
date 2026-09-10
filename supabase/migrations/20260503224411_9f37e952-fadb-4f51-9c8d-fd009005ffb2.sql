-- Function to recompute a single customer's stats by phone (handles +88/88 variants)
CREATE OR REPLACE FUNCTION public.recompute_customer_stats(p_phone text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  clean_phone text;
  v_phones text[];
  v_total int;
  v_delivered int;
  v_spent numeric;
  v_last timestamptz;
BEGIN
  IF p_phone IS NULL OR trim(p_phone) = '' THEN
    RETURN;
  END IF;

  clean_phone := regexp_replace(regexp_replace(p_phone, '[\s-]', '', 'g'), '^\+?88', '');
  IF clean_phone = '' THEN RETURN; END IF;

  v_phones := ARRAY[clean_phone, '+88' || clean_phone, '88' || clean_phone];

  SELECT
    COUNT(*) FILTER (WHERE status NOT IN ('cancelled')),
    COUNT(*) FILTER (WHERE status IN ('delivered', 'office_sell')),
    COALESCE(SUM(total) FILTER (WHERE status IN ('delivered', 'office_sell')), 0),
    MAX(created_at)
  INTO v_total, v_delivered, v_spent, v_last
  FROM public.orders
  WHERE customer_phone = ANY(v_phones)
    AND deleted_at IS NULL;

  -- Update existing customer rows that match any variant
  UPDATE public.customers
  SET total_orders = v_total,
      delivered_orders = v_delivered,
      total_spent = v_spent,
      last_order_date = COALESCE(v_last, last_order_date),
      updated_at = now()
  WHERE phone = ANY(v_phones);
END;
$$;

-- Trigger function: sync loyalty stats when order status / phone changes
CREATE OR REPLACE FUNCTION public.sync_customer_loyalty_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.recompute_customer_stats(NEW.customer_phone);
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.total IS DISTINCT FROM OLD.total
       OR NEW.customer_phone IS DISTINCT FROM OLD.customer_phone
       OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
      PERFORM public.recompute_customer_stats(NEW.customer_phone);
      IF NEW.customer_phone IS DISTINCT FROM OLD.customer_phone AND OLD.customer_phone IS NOT NULL THEN
        PERFORM public.recompute_customer_stats(OLD.customer_phone);
      END IF;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_customer_stats(OLD.customer_phone);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_customer_loyalty_stats ON public.orders;
CREATE TRIGGER trg_sync_customer_loyalty_stats
AFTER INSERT OR UPDATE OR DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.sync_customer_loyalty_stats();

-- Backfill: recompute stats for every customer
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN SELECT DISTINCT phone FROM public.customers WHERE phone IS NOT NULL AND phone <> '' LOOP
    PERFORM public.recompute_customer_stats(c.phone);
  END LOOP;
END $$;

-- Seed default loyalty tiers config (only if not already set)
INSERT INTO public.store_settings (key, value)
VALUES (
  'loyalty_tiers',
  '[
    {"key":"repeat","label":"রিপিট কাস্টমার","shortLabel":"রিপিট","emoji":"🔁","minDelivered":2,"color":"blue"},
    {"key":"star","label":"স্টার কাস্টমার","shortLabel":"স্টার","emoji":"⭐","minDelivered":5,"color":"yellow"},
    {"key":"vip","label":"ভিআইপি কাস্টমার","shortLabel":"ভিআইপি","emoji":"👑","minDelivered":10,"color":"purple"}
  ]'::text
)
ON CONFLICT (key) DO NOTHING;