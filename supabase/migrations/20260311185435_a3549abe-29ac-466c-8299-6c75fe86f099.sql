
-- Add status_note column to orders
ALTER TABLE public.orders ADD COLUMN status_note text;

-- Update the trigger function to include status_note in notification message
CREATE OR REPLACE FUNCTION public.notify_admin_order_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  status_label text;
  msg text;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  CASE NEW.status
    WHEN 'confirmed' THEN status_label := 'কনফার্মড ✅';
    WHEN 'shipped' THEN status_label := 'শিপড 🚚';
    WHEN 'delivered' THEN status_label := 'ডেলিভারড ✔️';
    WHEN 'cancelled' THEN status_label := 'ক্যান্সেলড ❌';
    WHEN 'delivery_failed' THEN status_label := 'ডেলিভারি ফেইলড ⚠️';
    WHEN 'paid_return' THEN status_label := 'পেইড রিটার্ন 🔄';
    WHEN 'office_sell' THEN status_label := 'অফিস সেল 🏢';
    ELSE status_label := NEW.status;
  END CASE;

  msg := COALESCE(NEW.order_number, '') || ' — ' || COALESCE(NEW.customer_name, '');
  
  IF NEW.status_note IS NOT NULL AND NEW.status_note != '' THEN
    msg := msg || E'\n📝 ' || NEW.status_note;
  END IF;

  INSERT INTO public.admin_notifications (type, title, message, link, reference_id)
  VALUES (
    'order_update',
    'অর্ডার ' || status_label,
    msg,
    '/admin/orders',
    NEW.id::text
  );
  RETURN NEW;
END;
$function$;
