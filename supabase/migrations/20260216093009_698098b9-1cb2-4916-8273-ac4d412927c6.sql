
-- Function to handle stock deduction when order status changes to 'confirmed'
CREATE OR REPLACE FUNCTION public.handle_order_confirmed_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item RECORD;
  current_variant jsonb;
  size_data jsonb;
  current_size_stock int;
BEGIN
  -- Only fire when status changes TO 'confirmed' and was NOT 'confirmed' before
  IF NEW.status = 'confirmed' AND (OLD.status IS DISTINCT FROM 'confirmed') THEN
    FOR item IN
      SELECT product_id, quantity, size
      FROM public.order_items
      WHERE order_id = NEW.id AND product_id IS NOT NULL
    LOOP
      -- Deduct main stock
      UPDATE public.products
      SET stock = GREATEST(0, stock - item.quantity)
      WHERE id = item.product_id;

      -- Deduct size-specific stock if size is provided
      IF item.size IS NOT NULL AND item.size <> '' THEN
        SELECT variant_images INTO current_variant
        FROM public.products
        WHERE id = item.product_id;

        IF current_variant IS NOT NULL
           AND current_variant -> 'size_data' -> item.size IS NOT NULL THEN
          current_size_stock := COALESCE(
            (current_variant -> 'size_data' -> item.size ->> 'stock')::int, 0
          );

          size_data := current_variant -> 'size_data';
          size_data := jsonb_set(
            size_data,
            ARRAY[item.size, 'stock'],
            to_jsonb(GREATEST(0, current_size_stock - item.quantity))
          );

          UPDATE public.products
          SET variant_images = jsonb_set(current_variant, '{size_data}', size_data)
          WHERE id = item.product_id;
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on orders table
CREATE TRIGGER trg_order_confirmed_stock
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_order_confirmed_stock();
