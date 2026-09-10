ALTER TABLE public.chat_sessions REPLICA IDENTITY DEFAULT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication p
    JOIN pg_publication_rel pr ON pr.prpubid = p.oid
    WHERE p.pubname = 'supabase_realtime'
      AND pr.prrelid = 'public.chat_sessions'::regclass
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.chat_sessions;
  END IF;

  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_sessions (
    id,
    visitor_name,
    visitor_phone,
    status,
    assigned_to,
    last_message_at,
    unread_count,
    created_at,
    customer_user_id
  );
END $$;

CREATE OR REPLACE FUNCTION public.insert_ai_chat_message(
  p_session_id uuid,
  p_session_token text,
  p_message text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  IF p_session_token IS NULL OR trim(p_session_token) = '' THEN
    RAISE EXCEPTION 'Session token required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.chat_sessions
    WHERE id = p_session_id
      AND session_token = p_session_token
  ) THEN
    RAISE EXCEPTION 'Invalid session';
  END IF;

  INSERT INTO public.chat_messages (session_id, sender_type, sender_name, message, metadata)
  VALUES (
    p_session_id,
    'ai',
    'স্বর্ণ সুতা AI',
    left(coalesce(p_message, ''), 5000),
    coalesce(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  BEGIN
    UPDATE public.chat_sessions
    SET last_message_at = now()
    WHERE id = p_session_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'chat session activity update skipped for %: %', p_session_id, SQLERRM;
  END;

  RETURN v_id;
END;
$function$;