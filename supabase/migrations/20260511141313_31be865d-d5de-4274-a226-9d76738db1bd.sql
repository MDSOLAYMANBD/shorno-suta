UPDATE public.store_settings s
SET value = src.value, updated_at = now()
FROM (
  SELECT 'delivery_charge_inside_dhaka' AS key, (SELECT value FROM public.store_settings WHERE key='shipping_dhaka_inside') AS value
  UNION ALL SELECT 'delivery_charge_dhaka_suburb', (SELECT value FROM public.store_settings WHERE key='shipping_dhaka_suburb')
  UNION ALL SELECT 'delivery_charge_outside_dhaka', (SELECT value FROM public.store_settings WHERE key='shipping_dhaka_outside')
) src
WHERE s.key = src.key AND src.value IS NOT NULL;