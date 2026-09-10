-- Update notify_new_order trigger to use PUSH_WEBHOOK_SECRET instead of anon key
CREATE OR REPLACE FUNCTION public.notify_new_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _webhook_secret text;
BEGIN
  -- Read webhook secret from vault or fallback
  SELECT decrypted_secret INTO _webhook_secret
  FROM vault.decrypted_secrets
  WHERE name = 'PUSH_WEBHOOK_SECRET'
  LIMIT 1;

  -- Fallback: skip notification if no secret configured
  IF _webhook_secret IS NULL OR _webhook_secret = '' THEN
    RAISE WARNING 'PUSH_WEBHOOK_SECRET not found in vault, skipping push notification';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://gdwvktufhsbrblzzeiir.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _webhook_secret
    ),
    body := jsonb_build_object(
      'record', jsonb_build_object(
        'id', NEW.id,
        'order_number', NEW.order_number,
        'total', NEW.total,
        'customer_name', NEW.customer_name
      )
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Push notification trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;