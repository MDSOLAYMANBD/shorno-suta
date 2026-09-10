-- 1. Add is_pre_order column to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_pre_order boolean NOT NULL DEFAULT false;

-- 2. Update stock trigger to allow negative stock (remove GREATEST(0, ...))
CREATE OR REPLACE FUNCTION public.handle_order_stock_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item RECORD;
  stock_deduct_statuses text[] := ARRAY['confirmed', 'shipped', 'delivered', 'office_sell'];
  stock_return_statuses text[] := ARRAY['delivery_failed', 'paid_return'];
  old_in_deduct boolean;
  new_in_deduct boolean;
  new_in_return boolean;
  current_vi jsonb;
  current_sd jsonb;
  size_key text;
  current_size_stock int;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  old_in_deduct := OLD.status = ANY(stock_deduct_statuses);
  new_in_deduct := NEW.status = ANY(stock_deduct_statuses);
  new_in_return := NEW.status = ANY(stock_return_statuses);

  -- CASE 1: Stock DEDUCTION (allow negative stock for pre-orders)
  IF NOT old_in_deduct AND new_in_deduct THEN
    FOR item IN
      SELECT oi.product_id, oi.quantity, oi.size
      FROM public.order_items oi
      WHERE oi.order_id = NEW.id AND oi.product_id IS NOT NULL
    LOOP
      UPDATE public.products
      SET stock = stock - item.quantity
      WHERE id = item.product_id;

      IF item.size IS NOT NULL AND item.size != '' THEN
        SELECT variant_images INTO current_vi
        FROM public.products WHERE id = item.product_id;

        IF current_vi IS NOT NULL AND current_vi ? 'size_data' THEN
          current_sd := current_vi -> 'size_data';
          size_key := item.size;

          IF current_sd ? size_key THEN
            current_size_stock := COALESCE((current_sd -> size_key ->> 'stock')::int, 0);
            current_sd := jsonb_set(
              current_sd,
              ARRAY[size_key, 'stock'],
              to_jsonb(current_size_stock - item.quantity)
            );
            current_vi := jsonb_set(current_vi, ARRAY['size_data'], current_sd);

            UPDATE public.products
            SET variant_images = current_vi
            WHERE id = item.product_id;
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- CASE 2: Stock RETURN
  IF old_in_deduct AND new_in_return THEN
    FOR item IN
      SELECT oi.product_id, oi.quantity, oi.size
      FROM public.order_items oi
      WHERE oi.order_id = NEW.id AND oi.product_id IS NOT NULL
    LOOP
      UPDATE public.products
      SET stock = stock + item.quantity
      WHERE id = item.product_id;

      IF item.size IS NOT NULL AND item.size != '' THEN
        SELECT variant_images INTO current_vi
        FROM public.products WHERE id = item.product_id;

        IF current_vi IS NOT NULL AND current_vi ? 'size_data' THEN
          current_sd := current_vi -> 'size_data';
          size_key := item.size;

          IF current_sd ? size_key THEN
            current_size_stock := COALESCE((current_sd -> size_key ->> 'stock')::int, 0);
            current_sd := jsonb_set(
              current_sd,
              ARRAY[size_key, 'stock'],
              to_jsonb(current_size_stock + item.quantity)
            );
            current_vi := jsonb_set(current_vi, ARRAY['size_data'], current_sd);

            UPDATE public.products
            SET variant_images = current_vi
            WHERE id = item.product_id;
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

-- 3. Notification trigger for pre-orders
CREATE OR REPLACE FUNCTION public.notify_admin_pre_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.is_pre_order = true AND (OLD IS NULL OR OLD.is_pre_order = false) THEN
    INSERT INTO public.admin_notifications (type, title, message, link, reference_id)
    VALUES (
      'order',
      '📦 প্রি-অর্ডার!',
      '৳' || NEW.total::text || ' — ' || COALESCE(NEW.customer_name, '') || ' (' || COALESCE(NEW.order_number, '') || ')',
      '/admin/orders',
      NEW.id::text
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- Create trigger for pre-order notification
DROP TRIGGER IF EXISTS trg_notify_pre_order ON public.orders;
CREATE TRIGGER trg_notify_pre_order
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_pre_order();