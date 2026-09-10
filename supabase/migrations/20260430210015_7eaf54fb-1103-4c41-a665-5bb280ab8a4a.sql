
-- Tighten chat-voice bucket: enforce size limit + audio mime types + path-based session validation
UPDATE storage.buckets
SET file_size_limit = 5242880,  -- 5 MB max
    allowed_mime_types = ARRAY['audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav']
WHERE id = 'chat-voice';

-- Replace permissive INSERT policy with one that requires path[1] to match an existing chat session
DROP POLICY IF EXISTS "Anyone can upload chat voice" ON storage.objects;

CREATE POLICY "Visitors can upload chat voice to valid session"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'chat-voice'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.chat_sessions cs
    WHERE cs.id::text = (storage.foldername(name))[1]
  )
);
