-- =============================================
-- STEP 1: Merge duplicate inbox conversations
-- =============================================
DO $$
DECLARE
  dup RECORD;
  keep_id uuid;
  del_ids uuid[];
BEGIN
  FOR dup IN
    SELECT customer_phone, platform,
           array_agg(id ORDER BY created_at ASC) AS ids
    FROM inbox_conversations
    WHERE customer_phone IS NOT NULL AND customer_phone != ''
    GROUP BY customer_phone, platform
    HAVING count(*) > 1
  LOOP
    keep_id := dup.ids[1];
    del_ids := dup.ids[2:];

    -- Move messages to the keeper conversation
    UPDATE inbox_messages
    SET conversation_id = keep_id
    WHERE conversation_id = ANY(del_ids);

    -- Update keeper with latest platform_conversation_id if missing
    UPDATE inbox_conversations
    SET platform_conversation_id = COALESCE(
      (SELECT platform_conversation_id FROM inbox_conversations WHERE id = ANY(del_ids) AND platform_conversation_id IS NOT NULL LIMIT 1),
      platform_conversation_id
    ),
    last_message_at = GREATEST(
      last_message_at,
      (SELECT MAX(last_message_at) FROM inbox_conversations WHERE id = ANY(del_ids))
    )
    WHERE id = keep_id;

    -- Delete duplicate conversations
    DELETE FROM inbox_conversations WHERE id = ANY(del_ids);
  END LOOP;
END $$;

-- =============================================
-- STEP 2: Security — giveaway_entries (staff only)
-- =============================================
DROP POLICY IF EXISTS "Public can view giveaway entries" ON giveaway_entries;
DROP POLICY IF EXISTS "Anyone can view giveaway entries" ON giveaway_entries;
DROP POLICY IF EXISTS "Giveaway entries are publicly readable" ON giveaway_entries;

-- Staff-only read policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'giveaway_entries' AND policyname = 'Staff can view giveaway entries'
  ) THEN
    CREATE POLICY "Staff can view giveaway entries"
    ON giveaway_entries FOR SELECT TO authenticated
    USING (public.has_any_role(auth.uid()));
  END IF;
END $$;

-- =============================================
-- STEP 3: Security — chat-images bucket (no anonymous upload)
-- =============================================
DROP POLICY IF EXISTS "Anyone can upload chat images" ON storage.objects;
DROP POLICY IF EXISTS "Chat images are publicly uploadable" ON storage.objects;

-- Only authenticated users can upload to chat-images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can upload chat images'
  ) THEN
    CREATE POLICY "Authenticated users can upload chat images"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'chat-images');
  END IF;
END $$;

-- =============================================
-- STEP 4: Security — review-images bucket ownership
-- =============================================
DROP POLICY IF EXISTS "Anyone can upload review images" ON storage.objects;
DROP POLICY IF EXISTS "Review images are publicly uploadable" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload review images" ON storage.objects;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Auth users can upload review images in own folder'
  ) THEN
    CREATE POLICY "Auth users can upload review images in own folder"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'review-images');
  END IF;
END $$;