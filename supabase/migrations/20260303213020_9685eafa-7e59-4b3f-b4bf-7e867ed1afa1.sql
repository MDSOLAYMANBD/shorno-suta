
-- Update trigger function to use anon key (verify_jwt is false for this function)
CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://gdwvktufhsbrblzzeiir.supabase.co/functions/v1/send-push-notification',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdkd3ZrdHVmaHNicmJsenplaWlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MjkzMTgsImV4cCI6MjA4NjIwNTMxOH0.l-Q9GkJgmK-oKGz6wolftLHNSJA2CkeBTZ9DbpYB3RU"}'::jsonb,
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
$$;
