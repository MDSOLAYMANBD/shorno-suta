ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_alt_phone TEXT,
  ADD COLUMN IF NOT EXISTS courier_note TEXT;

INSERT INTO public.store_settings (key, value)
VALUES ('courier_default_note', '')
ON CONFLICT (key) DO NOTHING;