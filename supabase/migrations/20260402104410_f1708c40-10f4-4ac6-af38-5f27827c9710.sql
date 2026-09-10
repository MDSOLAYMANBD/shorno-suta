
-- Drop overly permissive storage policies for hero-banners
DROP POLICY IF EXISTS "Auth upload hero-banners" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete hero-banners" ON storage.objects;

-- Drop overly permissive storage policy for category-banners
DROP POLICY IF EXISTS "Auth users manage category banners" ON storage.objects;

-- Recreate with admin-only access
CREATE POLICY "Admin upload hero-banners"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'hero-banners' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admin delete hero-banners"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'hero-banners' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admin manage category banners"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'category-banners' AND public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (bucket_id = 'category-banners' AND public.has_role(auth.uid(), 'admin'::public.app_role));
