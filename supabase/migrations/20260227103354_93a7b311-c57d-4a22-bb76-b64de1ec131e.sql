
-- 1. Add image_url column to chat_messages
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS image_url text;

-- 2. Create chat-images storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage RLS: anyone can upload to chat-images
CREATE POLICY "Anyone can upload chat images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'chat-images');

-- 4. Storage RLS: anyone can read chat images
CREATE POLICY "Anyone can read chat images"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-images');

-- 5. Update send_visitor_chat_message RPC to support image_url
CREATE OR REPLACE FUNCTION public.send_visitor_chat_message(
  p_session_id uuid,
  p_sender_name text,
  p_message text,
  p_visitor_phone text DEFAULT NULL,
  p_image_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  -- Length validation
  IF (p_message IS NULL OR trim(p_message) = '') AND (p_image_url IS NULL OR trim(p_image_url) = '') THEN
    RAISE EXCEPTION 'Message or image is required';
  END IF;
  IF p_message IS NOT NULL AND length(trim(p_message)) > 5000 THEN
    RAISE EXCEPTION 'Message too long';
  END IF;
  IF length(trim(p_sender_name)) > 200 THEN
    RAISE EXCEPTION 'Name too long';
  END IF;

  -- Verify session ownership
  IF p_visitor_phone IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.chat_sessions
      WHERE id = p_session_id AND visitor_phone = p_visitor_phone
    ) THEN
      RAISE EXCEPTION 'Invalid session';
    END IF;
  ELSIF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.chat_messages (session_id, sender_type, sender_name, message, image_url)
  VALUES (
    p_session_id,
    CASE WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()) THEN 'staff' ELSE 'visitor' END,
    left(trim(p_sender_name), 200),
    left(trim(COALESCE(p_message, '')), 5000),
    p_image_url
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;
