
-- Fix get_visitor_chat_messages: add phone verification
CREATE OR REPLACE FUNCTION public.get_visitor_chat_messages(
  p_session_id uuid,
  p_visitor_phone text DEFAULT NULL
)
RETURNS SETOF public.chat_messages
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.* FROM public.chat_messages m
  JOIN public.chat_sessions s ON m.session_id = s.id
  WHERE m.session_id = p_session_id
    AND (
      -- If phone provided, verify ownership
      (p_visitor_phone IS NOT NULL AND s.visitor_phone = p_visitor_phone)
      -- If caller is authenticated staff, allow access
      OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
    )
  ORDER BY m.created_at ASC;
$$;

-- Fix send_visitor_chat_message: add phone verification
CREATE OR REPLACE FUNCTION public.send_visitor_chat_message(
  p_session_id uuid,
  p_sender_name text,
  p_message text,
  p_visitor_phone text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Verify session ownership (visitor by phone, or staff by role)
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
    p_sender_name,
    p_message
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Fix update_visitor_chat_activity: add phone verification
CREATE OR REPLACE FUNCTION public.update_visitor_chat_activity(
  p_session_id uuid,
  p_unread_count integer,
  p_visitor_phone text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify ownership
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
