
-- Add avatar_url to customer_profiles
ALTER TABLE public.customer_profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Add customer_user_id to customer_reviews
ALTER TABLE public.customer_reviews ADD COLUMN IF NOT EXISTS customer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Allow authenticated users to read their own reviews
CREATE POLICY "Customers can read own reviews"
ON public.customer_reviews FOR SELECT
TO authenticated
USING (customer_user_id = auth.uid());

-- RLS policy for avatars bucket upload (customers can upload their own)
CREATE POLICY "Customers can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Customers can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anyone can read avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');
