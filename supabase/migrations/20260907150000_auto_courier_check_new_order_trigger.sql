-- Shared secret for trusted internal calls to bd-courier-check (the
-- orders_auto_courier_check_trigger below), since this project doesn't have
-- app.settings.service_role_key configured via current_setting. Admin-only
-- readable via store_settings' existing RLS (not in its public-key allowlist).
insert into store_settings (key, value)
values ('internal_trigger_secret', encode(gen_random_bytes(24), 'hex'))
on conflict (key) do nothing;

CREATE OR REPLACE FUNCTION public.auto_courier_check_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  supabase_url text;
  trigger_secret text;
BEGIN
  IF NEW.customer_phone IS NULL OR NEW.customer_phone = '' THEN
    RETURN NEW;
  END IF;

  supabase_url := 'https://gdwvktufhsbrblzzeiir.supabase.co';

  SELECT value INTO trigger_secret FROM public.store_settings WHERE key = 'internal_trigger_secret';
  IF trigger_secret IS NULL THEN
    RETURN NEW;
  END IF;

  -- Fires once per new order (never a bulk scan) and the edge function itself
  -- skips the paid lookup if this phone was already checked before.
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/bd-courier-check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || trigger_secret
    ),
    body := jsonb_build_object('phone', NEW.customer_phone)
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Auto courier-check trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_auto_courier_check_trigger ON public.orders;
CREATE TRIGGER orders_auto_courier_check_trigger
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_courier_check_new_order();
