
-- 1. Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 2. Orders table - new columns
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS order_origin text NOT NULL DEFAULT 'website',
  ADD COLUMN IF NOT EXISTS courier_consignment_id text,
  ADD COLUMN IF NOT EXISTS courier_status text,
  ADD COLUMN IF NOT EXISTS courier_entry_date timestamptz;

-- 3. Products table - new columns
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS video_file_url text,
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text;

-- 4. Store settings table
CREATE TABLE IF NOT EXISTS public.store_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read store settings"
  ON public.store_settings FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert store settings"
  ON public.store_settings FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update store settings"
  ON public.store_settings FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete store settings"
  ON public.store_settings FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public can read marketing settings"
  ON public.store_settings FOR SELECT
  USING (key IN ('gtm_id', 'facebook_pixel_id'));

-- 5. Abandoned checkouts table
CREATE TABLE IF NOT EXISTS public.abandoned_checkouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL DEFAULT '',
  customer_phone text NOT NULL DEFAULT '',
  customer_address text,
  cart_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'abandoned',
  created_at timestamptz NOT NULL DEFAULT now(),
  recovered_at timestamptz
);

ALTER TABLE public.abandoned_checkouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert abandoned checkouts"
  ON public.abandoned_checkouts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can read abandoned checkouts"
  ON public.abandoned_checkouts FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update abandoned checkouts"
  ON public.abandoned_checkouts FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete abandoned checkouts"
  ON public.abandoned_checkouts FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can update own abandoned checkout"
  ON public.abandoned_checkouts FOR UPDATE
  USING (true);

-- 6. Product videos storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('product-videos', 'product-videos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view product videos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-videos');

CREATE POLICY "Admins can upload product videos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'product-videos' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update product videos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'product-videos' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete product videos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'product-videos' AND has_role(auth.uid(), 'admin'::app_role));

-- 7. Updated_at trigger for store_settings
CREATE TRIGGER update_store_settings_updated_at
  BEFORE UPDATE ON public.store_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
