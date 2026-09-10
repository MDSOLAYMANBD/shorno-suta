
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

  -- CASE 1: Stock DEDUCTION
  IF NOT old_in_deduct AND new_in_deduct THEN
    FOR item IN
      SELECT oi.product_id, oi.quantity, oi.size
      FROM public.order_items oi
      WHERE oi.order_id = NEW.id AND oi.product_id IS NOT NULL
    LOOP
      UPDATE public.products
      SET stock = GREATEST(0, stock - item.quantity)
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
              to_jsonb(GREATEST(0, current_size_stock - item.quantity))
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
