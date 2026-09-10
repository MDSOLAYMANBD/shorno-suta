-- 1. initiate_voice_call: clean up ALL stuck open calls for this session (ringing/waiting/accepted)
CREATE OR REPLACE FUNCTION public.initiate_voice_call(
  p_session_id uuid,
  p_session_token text,
  p_caller_name text,
  p_caller_phone text,
  p_offer jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_session_token IS NULL OR trim(p_session_token) = '' THEN
    RAISE EXCEPTION 'Session token required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_sessions
    WHERE id = p_session_id AND session_token = p_session_token
  ) THEN
    RAISE EXCEPTION 'Invalid session';
  END IF;

  -- Clean up any stuck open calls for this session so we don't accumulate ghosts
  UPDATE public.chat_calls
  SET status = 'missed',
      ended_at = COALESCE(ended_at, now())
  WHERE session_id = p_session_id
    AND status IN ('ringing', 'waiting', 'accepted');

  INSERT INTO public.chat_calls (
    session_id, caller_name, caller_phone, status, caller_signal,
    caller_ice, callee_ice, callee_signal
  ) VALUES (
    p_session_id,
    COALESCE(left(trim(p_caller_name), 200), ''),
    COALESCE(left(trim(p_caller_phone), 20), ''),
    'ringing',
    COALESCE(p_offer, '{}'::jsonb),
    '[]'::jsonb,
    '[]'::jsonb,
    '{}'::jsonb
  )
  RETURNING id INTO v_id;

  INSERT INTO public.admin_notifications (type, title, message, link, reference_id)
  VALUES (
    'voice_call',
    '📞 ইনকামিং ভয়েস কল',
    COALESCE(NULLIF(trim(p_caller_name), ''), 'একজন ভিজিটর') || ' কল করছেন',
    '/admin/live-chat',
    v_id::text
  );

  RETURN v_id;
END;
$$;

-- 2. end_call_visitor: also accept 'waiting' status
CREATE OR REPLACE FUNCTION public.end_call_visitor(
  p_call_id uuid,
  p_session_token text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id uuid;
  v_started timestamptz;
BEGIN
  SELECT session_id, accepted_at INTO v_session_id, v_started FROM public.chat_calls WHERE id = p_call_id;
  IF v_session_id IS NULL THEN RETURN; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.chat_sessions WHERE id = v_session_id AND session_token = p_session_token
  ) THEN
    RAISE EXCEPTION 'Invalid session';
  END IF;

  UPDATE public.chat_calls
  SET status = 'ended',
      ended_at = now(),
      duration_seconds = CASE
        WHEN v_started IS NOT NULL THEN EXTRACT(EPOCH FROM (now() - v_started))::int
        ELSE 0
      END
  WHERE id = p_call_id AND status IN ('ringing', 'waiting', 'accepted');
END;
$$;

-- 3. Bulk close any stale open calls older than 10 minutes that are stuck (one-time cleanup)
UPDATE public.chat_calls
SET status = 'missed',
    ended_at = COALESCE(ended_at, now())
WHERE status IN ('ringing', 'waiting')
  AND initiated_at < now() - interval '10 minutes';