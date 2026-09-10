
-- Drop old trigger and function
DROP TRIGGER IF EXISTS trg_order_confirmed_stock ON public.orders;
DROP FUNCTION IF EXISTS public.handle_order_confirmed_stock();

-- Create new comprehensive stock update function
CREATE OR REPLACE FUNCTION public.handle_order_stock_update()
RETURNS TRIGGER AS $$
DECLARE
  item RECORD;
  stock_deduct_statuses text[] := ARRAY['confirmed', 'shipped', 'delivered'];
  stock_return_statuses text[] := ARRAY['delivery_failed', 'paid_return'];
  old_in_deduct boolean;
  new_in_deduct boolean;
  new_in_return boolean;
  current_vi jsonb;
  current_sd jsonb;
  size_key text;
  current_size_stock int;
BEGIN
  -- Only act on status changes
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  old_in_deduct := OLD.status = ANY(stock_deduct_statuses);
  new_in_deduct := NEW.status = ANY(stock_deduct_statuses);
  new_in_return := NEW.status = ANY(stock_return_statuses);

  -- CASE 1: Stock DEDUCTION (entering deduct group from outside)
  IF NOT old_in_deduct AND new_in_deduct THEN
    FOR item IN
      SELECT oi.product_id, oi.quantity, oi.size
      FROM public.order_items oi
      WHERE oi.order_id = NEW.id AND oi.product_id IS NOT NULL
    LOOP
      -- Update main stock
      UPDATE public.products
      SET stock = GREATEST(0, stock - item.quantity)
      WHERE id = item.product_id;

      -- Update size-specific stock if size exists
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

  -- CASE 2: Stock RETURN (from deduct group to return group)
  IF old_in_deduct AND new_in_return THEN
    FOR item IN
      SELECT oi.product_id, oi.quantity, oi.size
      FROM public.order_items oi
      WHERE oi.order_id = NEW.id AND oi.product_id IS NOT NULL
    LOOP
      -- Return main stock
      UPDATE public.products
      SET stock = stock + item.quantity
      WHERE id = item.product_id;

      -- Return size-specific stock if size exists
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create new trigger
CREATE TRIGGER trg_order_stock_update
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_order_stock_update();
