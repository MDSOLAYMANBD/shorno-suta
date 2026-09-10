
-- Create avatars storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Allow authenticated users to upload avatars
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- Allow authenticated users to update their own avatars
CREATE POLICY "Authenticated users can update own avatars"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- Allow public read access to avatars
CREATE POLICY "Public can read avatars"
ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars');

-- Allow authenticated users to delete their own avatars
CREATE POLICY "Authenticated users can delete own avatars"
ON storage.objects
FOR DELETE
USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');
