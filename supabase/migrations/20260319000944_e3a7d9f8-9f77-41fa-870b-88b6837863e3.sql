-- Create hero-banners storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('hero-banners', 'hero-banners', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public read hero-banners" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'hero-banners');

-- Allow authenticated users to upload
CREATE POLICY "Auth upload hero-banners" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'hero-banners');

-- Allow authenticated users to delete
CREATE POLICY "Auth delete hero-banners" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'hero-banners');