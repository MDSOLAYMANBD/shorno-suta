INSERT INTO public.store_settings (key, value) VALUES
  ('shipping_dhaka_inside', '70'),
  ('shipping_dhaka_suburb', '100'),
  ('shipping_dhaka_outside', '130')
ON CONFLICT (key) DO NOTHING;