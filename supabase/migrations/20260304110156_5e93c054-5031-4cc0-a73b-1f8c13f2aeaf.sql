
-- Drop old create_visitor_chat_session (returns uuid, need to change to text)
DROP FUNCTION IF EXISTS public.create_visitor_chat_session(text, text);

-- Recreate with text return type
CREATE OR REPLACE FUNCTION public.create_visitor_chat_session(p_name text, p_phone text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _session_id uuid;
  _token text;
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
  IF trim(p_phone) !~ '^01[3-9]\d{8}$' THEN
    RAISE EXCEPTION 'Invalid phone format';
  END IF;

  _token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO public.chat_sessions (visitor_name, visitor_phone, session_token)
  VALUES (trim(p_name), trim(p_phone), _token)
  RETURNING id INTO _session_id;

  RETURN _session_id::text || '::' || _token;
END;
$function$;

-- Drop all overloads of send_visitor_chat_message
DROP FUNCTION IF EXISTS public.send_visitor_chat_message(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.send_visitor_chat_message(uuid, text, text, text, text);

-- Recreate with session_token parameter
CREATE OR REPLACE FUNCTION public.send_visitor_chat_message(
  p_session_id uuid, 
  p_sender_name text, 
  p_message text, 
  p_visitor_phone text DEFAULT NULL, 
  p_image_url text DEFAULT NULL,
  p_session_token text DEFAULT NULL
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()) THEN
    NULL;
  ELSE
    IF p_session_token IS NULL OR trim(p_session_token) = '' THEN
      RAISE EXCEPTION 'Session token required';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.chat_sessions
      WHERE id = p_session_id AND session_token = p_session_token
    ) THEN
      RAISE EXCEPTION 'Invalid session';
    END IF;
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

-- Drop and recreate get_visitor_chat_messages with token param
DROP FUNCTION IF EXISTS public.get_visitor_chat_messages(uuid, text);

CREATE OR REPLACE FUNCTION public.get_visitor_chat_messages(
  p_session_id uuid, 
  p_visitor_phone text DEFAULT NULL,
  p_session_token text DEFAULT NULL
)
 RETURNS SETOF chat_messages
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()) THEN
    RETURN QUERY SELECT m.* FROM public.chat_messages m WHERE m.session_id = p_session_id ORDER BY m.created_at ASC;
    RETURN;
  END IF;

  IF p_session_token IS NULL OR trim(p_session_token) = '' THEN
    RAISE EXCEPTION 'Session token required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.chat_sessions WHERE id = p_session_id AND session_token = p_session_token) THEN
    RAISE EXCEPTION 'Invalid session';
  END IF;

  RETURN QUERY SELECT m.* FROM public.chat_messages m WHERE m.session_id = p_session_id ORDER BY m.created_at ASC;
END;
$function$;

-- Drop and recreate update_visitor_chat_activity with token param
DROP FUNCTION IF EXISTS public.update_visitor_chat_activity(uuid, integer, text);

CREATE OR REPLACE FUNCTION public.update_visitor_chat_activity(
  p_session_id uuid, 
  p_unread_count integer, 
  p_visitor_phone text DEFAULT NULL,
  p_session_token text DEFAULT NULL
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()) THEN
    NULL;
  ELSE
    IF p_session_token IS NULL OR trim(p_session_token) = '' THEN
      RAISE EXCEPTION 'Session token required';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.chat_sessions WHERE id = p_session_id AND session_token = p_session_token) THEN
      RAISE EXCEPTION 'Invalid session';
    END IF;
  END IF;

  UPDATE public.chat_sessions SET last_message_at = now(), unread_count = p_unread_count WHERE id = p_session_id;
END;
$function$;
