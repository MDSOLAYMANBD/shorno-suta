-- Remove overly-permissive avatar storage policies that lack path ownership checks
-- The correctly-scoped "Customers can update own avatar" and "Customers can upload own avatar" policies remain

DROP POLICY IF EXISTS "Authenticated users can update own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;