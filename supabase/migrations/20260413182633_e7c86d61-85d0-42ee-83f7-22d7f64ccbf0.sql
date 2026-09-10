-- Direct targeted fix: update ALL addon items to match their product's addon_config price
DO $$
DECLARE
  r RECORD;
  addon_price_val numeric;
  affected_order_ids uuid[];
BEGIN
  affected_order_ids := ARRAY[]::uuid[];
  
  FOR r IN
    SELECT oi.id, oi.order_id, oi.price as current_price, oi.product_id,
           p.addon_config
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.item_type = 'addon'
      AND p.addon_config IS NOT NULL
  LOOP
    addon_price_val := (r.addon_config->>'price')::numeric;
    IF addon_price_val IS NOT NULL AND addon_price_val > 0 AND addon_price_val != r.current_price THEN
      UPDATE order_items SET price = addon_price_val WHERE id = r.id;
      IF NOT (r.order_id = ANY(affected_order_ids)) THEN
        affected_order_ids := array_append(affected_order_ids, r.order_id);
      END IF;
    END IF;
  END LOOP;

  -- Recalculate totals for affected orders
  UPDATE orders o
  SET subtotal = sub.correct_subtotal,
      total = sub.correct_subtotal 
             - COALESCE(CASE 
                 WHEN o.discount_note IS NOT NULL AND o.discount_note != '' 
                 THEN (regexp_match(o.discount_note, '(\d+)'))[1]::numeric 
                 ELSE 0 
               END, 0)
             + CASE WHEN o.free_shipping THEN 0 ELSE COALESCE(o.delivery_charge, 0) END
  FROM (
    SELECT oi.order_id, SUM(oi.price * oi.quantity) as correct_subtotal
    FROM order_items oi
    WHERE oi.order_id = ANY(affected_order_ids)
    GROUP BY oi.order_id
  ) sub
  WHERE o.id = sub.order_id;
END;
$$;