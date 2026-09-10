-- 1. Allow visitor to insert calls only via initiate_voice_call RPC (no change here),
--    but ensure visitor can SELECT their own call rows for state polling. Keep existing
--    staff policies. Add a permissive read policy guarded by session existence is
--    handled via the SECURITY DEFINER `get_call_state` already; nothing extra needed.

-- 2. Atomic accept RPC — used by staff to claim a ringing/waiting call.
CREATE OR REPLACE FUNCTION public.accept_voice_call(
  p_call_id uuid,
  p_callee_signal jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_any_role(auth.uid()) THEN
    RAISE EXCEPTION 'Staff role required';
  END IF;

  UPDATE public.chat_calls
  SET status = 'accepted',
      accepted_at = now(),
      accepted_by = auth.uid(),
      callee_signal = COALESCE(p_callee_signal, callee_signal)
  WHERE id = p_call_id
    AND status IN ('ringing', 'waiting');

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- 3. Helper to mark a ringing call as waiting (when current staff is busy).
CREATE OR REPLACE FUNCTION public.mark_call_waiting(p_call_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_any_role(auth.uid()) THEN
    RAISE EXCEPTION 'Staff role required';
  END IF;
  UPDATE public.chat_calls
  SET status = 'waiting'
  WHERE id = p_call_id AND status = 'ringing';
END;
$$;

-- 4. Helper to write a call event into chat_messages (visible inside the chat thread).
--    Uses sender_type 'ai' (already styled gracefully) with metadata.type='call_event'
--    so the existing widgets/admin chat can render a special card. sender_name is fixed.
CREATE OR REPLACE FUNCTION public.log_call_event(
  p_session_id uuid,
  p_call_id uuid,
  p_event text,
  p_message text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_meta jsonb;
BEGIN
  v_meta := COALESCE(p_metadata, '{}'::jsonb)
            || jsonb_build_object('type', 'call_event', 'event', p_event, 'call_id', p_call_id);

  INSERT INTO public.chat_messages (session_id, sender_type, sender_name, message, metadata)
  VALUES (p_session_id, 'ai', '📞 Call Log', LEFT(COALESCE(p_message, ''), 500), v_meta)
  RETURNING id INTO v_id;

  UPDATE public.chat_sessions SET last_message_at = now() WHERE id = p_session_id;
  RETURN v_id;
END;
$$;

-- 5. End call by admin (counterpart to end_call_visitor) with duration calc.
CREATE OR REPLACE FUNCTION public.end_call_admin(p_call_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_started timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_any_role(auth.uid()) THEN
    RAISE EXCEPTION 'Staff role required';
  END IF;
  SELECT accepted_at INTO v_started FROM public.chat_calls WHERE id = p_call_id;
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

-- 6. Reject call by admin.
CREATE OR REPLACE FUNCTION public.reject_voice_call(p_call_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_any_role(auth.uid()) THEN
    RAISE EXCEPTION 'Staff role required';
  END IF;
  UPDATE public.chat_calls
  SET status = 'rejected',
      ended_at = now()
  WHERE id = p_call_id AND status IN ('ringing', 'waiting');
END;
$$;