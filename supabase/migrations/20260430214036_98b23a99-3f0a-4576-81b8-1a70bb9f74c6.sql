-- Make get_call_state VOLATILE so each visitor poll reads the latest
-- chat_calls.status / callee_signal instead of a stale STABLE snapshot.
-- Without this, the customer side can keep ringing for several seconds
-- after the admin has already accepted, and sometimes never picks up
-- the answer at all.
CREATE OR REPLACE FUNCTION public.get_call_state(
  p_call_id uuid,
  p_session_token text
)
RETURNS TABLE(
  id uuid, status text, caller_signal jsonb, callee_signal jsonb,
  caller_ice jsonb, callee_ice jsonb, accepted_at timestamptz, ended_at timestamptz
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id uuid;
  v_is_staff boolean;
BEGIN
  v_is_staff := auth.uid() IS NOT NULL AND public.has_any_role(auth.uid());
  SELECT session_id INTO v_session_id FROM public.chat_calls WHERE id = p_call_id;
  IF v_session_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT v_is_staff THEN
    IF p_session_token IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.chat_sessions WHERE id = v_session_id AND session_token = p_session_token
    ) THEN
      RAISE EXCEPTION 'Invalid session';
    END IF;
  END IF;

  RETURN QUERY
  SELECT c.id, c.status, c.caller_signal, c.callee_signal, c.caller_ice, c.callee_ice, c.accepted_at, c.ended_at
  FROM public.chat_calls c WHERE c.id = p_call_id;
END;
$$;