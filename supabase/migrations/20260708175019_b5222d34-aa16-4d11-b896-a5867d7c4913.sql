
-- Drop any prior permissive public SELECT policies on chat media buckets
DROP POLICY IF EXISTS "Anyone can view chat images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view chat images" ON storage.objects;
DROP POLICY IF EXISTS "Public read chat images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view chat voice" ON storage.objects;
DROP POLICY IF EXISTS "Public can view chat voice" ON storage.objects;
DROP POLICY IF EXISTS "Public read chat voice" ON storage.objects;
DROP POLICY IF EXISTS "chat_images_public_read" ON storage.objects;
DROP POLICY IF EXISTS "chat_voice_public_read" ON storage.objects;

-- Session-scoped SELECT: requester must know the session_token embedded in the path
-- Path structure: {session_id}/{session_token}/filename
CREATE POLICY "Session-scoped read chat images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat-images'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (storage.foldername(name))[2] IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.chat_sessions cs
    WHERE cs.id::text = (storage.foldername(name))[1]
      AND cs.session_token = (storage.foldername(name))[2]
  )
);

CREATE POLICY "Session-scoped read chat voice"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat-voice'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (storage.foldername(name))[2] IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.chat_sessions cs
    WHERE cs.id::text = (storage.foldername(name))[1]
      AND cs.session_token = (storage.foldername(name))[2]
  )
);

-- Staff can read all chat media (needed for admin panel and admin-uploaded paths)
CREATE POLICY "Staff can read chat images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-images' AND public.has_any_role(auth.uid()));

CREATE POLICY "Staff can read chat voice"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-voice' AND public.has_any_role(auth.uid()));
