CREATE POLICY "Staff can upload chat images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-images'
  AND (storage.foldername(name))[2] = 'admin'
  AND public.has_any_role(auth.uid())
);