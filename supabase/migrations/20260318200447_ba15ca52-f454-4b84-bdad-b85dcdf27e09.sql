-- Add banner columns to categories
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS banner_image_url text DEFAULT NULL;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS banner_tagline text DEFAULT NULL;

-- Create category-banners storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('category-banners', 'category-banners', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public read category banners" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'category-banners');

-- Allow authenticated users to manage
CREATE POLICY "Auth users manage category banners" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'category-banners')
  WITH CHECK (bucket_id = 'category-banners');