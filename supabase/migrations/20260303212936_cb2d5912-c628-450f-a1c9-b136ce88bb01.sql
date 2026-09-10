
-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create trigger function that calls send-push-notification edge function
CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  supabase_url text;
  service_role_key text;
BEGIN
  -- Read secrets from vault or use environment
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);

  -- Fallback to hardcoded project URL if setting not available
  IF supabase_url IS NULL OR supabase_url = '' THEN
    supabase_url := 'https://gdwvktufhsbrblzzeiir.supabase.co';
  END IF;

  -- Use net.http_post to call the edge function asynchronously
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_role_key, '')
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
  -- Don't block order creation if notification fails
  RAISE WARNING 'Push notification trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Create trigger on orders table
DROP TRIGGER IF EXISTS orders_push_notification_trigger ON public.orders;
CREATE TRIGGER orders_push_notification_trigger
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_order();
