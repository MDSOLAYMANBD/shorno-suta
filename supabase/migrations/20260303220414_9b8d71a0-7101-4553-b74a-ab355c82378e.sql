
-- Fix get_visitor_chat_messages: require phone for unauthenticated callers
CREATE OR REPLACE FUNCTION public.get_visitor_chat_messages(p_session_id uuid, p_visitor_phone text DEFAULT NULL::text)
 RETURNS SETOF chat_messages
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  -- Require phone verification for unauthenticated users
  IF auth.uid() IS NULL AND (p_visitor_phone IS NULL OR trim(p_visitor_phone) = '') THEN
    RAISE EXCEPTION 'Phone verification required';
  END IF;

  RETURN QUERY
  SELECT m.* FROM public.chat_messages m
  JOIN public.chat_sessions s ON m.session_id = s.id
  WHERE m.session_id = p_session_id
    AND (
      (p_visitor_phone IS NOT NULL AND s.visitor_phone = p_visitor_phone)
      OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
    )
  ORDER BY m.created_at ASC;
END;
$$;

-- Fix send_visitor_chat_message (4-param version): require phone for unauthenticated callers
CREATE OR REPLACE FUNCTION public.send_visitor_chat_message(p_session_id uuid, p_sender_name text, p_message text, p_visitor_phone text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Require phone for unauthenticated users
  IF auth.uid() IS NULL AND (p_visitor_phone IS NULL OR trim(p_visitor_phone) = '') THEN
    RAISE EXCEPTION 'Phone verification required';
  END IF;

  IF p_message IS NULL OR trim(p_message) = '' THEN
    RAISE EXCEPTION 'Message is required';
  END IF;
  IF length(trim(p_message)) > 5000 THEN
    RAISE EXCEPTION 'Message too long';
  END IF;
  IF length(trim(p_sender_name)) > 200 THEN
    RAISE EXCEPTION 'Name too long';
  END IF;

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

  INSERT INTO public.chat_messages (session_id, sender_type, sender_name, message)
  VALUES (
    p_session_id,
    CASE WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()) THEN 'staff' ELSE 'visitor' END,
    left(trim(p_sender_name), 200),
    left(trim(p_message), 5000)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Fix send_visitor_chat_message (5-param version with image): require phone for unauthenticated callers
CREATE OR REPLACE FUNCTION public.send_visitor_chat_message(p_session_id uuid, p_sender_name text, p_message text, p_visitor_phone text DEFAULT NULL::text, p_image_url text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Require phone for unauthenticated users
  IF auth.uid() IS NULL AND (p_visitor_phone IS NULL OR trim(p_visitor_phone) = '') THEN
    RAISE EXCEPTION 'Phone verification required';
  END IF;

  IF (p_message IS NULL OR trim(p_message) = '') AND (p_image_url IS NULL OR trim(p_image_url) = '') THEN
    RAISE EXCEPTION 'Message or image is required';
  END IF;
  IF p_message IS NOT NULL AND length(trim(p_message)) > 5000 THEN
    RAISE EXCEPTION 'Message too long';
  END IF;
  IF length(trim(p_sender_name)) > 200 THEN
    RAISE EXCEPTION 'Name too long';
  END IF;

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
$$;

-- Fix update_visitor_chat_activity: require phone for unauthenticated callers
CREATE OR REPLACE FUNCTION public.update_visitor_chat_activity(p_session_id uuid, p_unread_count integer, p_visitor_phone text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  -- Require phone for unauthenticated users
  IF auth.uid() IS NULL AND (p_visitor_phone IS NULL OR trim(p_visitor_phone) = '') THEN
    RAISE EXCEPTION 'Phone verification required';
  END IF;

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

  UPDATE public.chat_sessions
  SET last_message_at = now(), unread_count = p_unread_count
  WHERE id = p_session_id;
END;
$$;
