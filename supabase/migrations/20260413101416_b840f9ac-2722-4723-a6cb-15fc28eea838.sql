-- Fix SD-007629: correct the add-on item price from 650 to 100 and recalculate totals
UPDATE public.order_items SET price = 100, product_name = '[অ্যাড-অন] ব্লাউজ পিস'
WHERE id = 'a268805f-36d5-45d5-91d5-e4ea88f0c4c8';

UPDATE public.orders SET subtotal = 750, total = 820
WHERE order_number = 'SD-007629';