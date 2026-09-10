UPDATE public.orders
SET delivery_charge = 130,
    total = total + 10
WHERE order_number = 'SD-010683'
  AND delivery_area = 'dhaka_outside'
  AND delivery_charge = 120;