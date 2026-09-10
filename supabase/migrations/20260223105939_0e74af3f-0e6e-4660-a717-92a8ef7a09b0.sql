
-- Fix: Add input length validation to chat RPC functions

-- 1. Recreate create_visitor_chat_session with length limits
CREATE OR REPLACE FUNCTION public.create_visitor_chat_session(p_name text, p_phone text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _session_id uuid;
BEGIN
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Name is required';
  END IF;
  IF p_phone IS NULL OR trim(p_phone) = '' THEN
    RAISE EXCEPTION 'Phone is required';
  END IF;
  IF length(trim(p_name)) > 200 THEN
    RAISE EXCEPTION 'Name too long';
  END IF;
  IF length(trim(p_phone)) > 20 THEN
    RAISE EXCEPTION 'Phone too long';
  END IF;

  INSERT INTO public.chat_sessions (visitor_name, visitor_phone)
  VALUES (trim(p_name), trim(p_phone))
  RETURNING id INTO _session_id;

  RETURN _session_id;
END;
$function$;

-- 2. Recreate send_visitor_chat_message with length limits
CREATE OR REPLACE FUNCTION public.send_visitor_chat_message(p_session_id uuid, p_sender_name text, p_message text, p_visitor_phone text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  -- Length validation
  IF p_message IS NULL OR trim(p_message) = '' THEN
    RAISE EXCEPTION 'Message is required';
  END IF;
  IF length(trim(p_message)) > 5000 THEN
    RAISE EXCEPTION 'Message too long';
  END IF;
  IF length(trim(p_sender_name)) > 200 THEN
    RAISE EXCEPTION 'Name too long';
  END IF;

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
    left(trim(p_sender_name), 200),
    left(trim(p_message), 5000)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;
