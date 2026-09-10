ALTER TABLE public.chat_sessions
ALTER COLUMN session_token SET DEFAULT encode(extensions.gen_random_bytes(32), 'hex');

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

  _token := encode(extensions.gen_random_bytes(32), 'hex');

  INSERT INTO public.chat_sessions (visitor_name, visitor_phone, session_token)
  VALUES (trim(p_name), trim(p_phone), _token)
  RETURNING id INTO _session_id;

  RETURN _session_id::text || '::' || _token;
END;
$function$;