
-- 1. Link chat sessions to customer accounts
ALTER TABLE public.chat_sessions ADD COLUMN IF NOT EXISTS customer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_chat_sessions_customer_user ON public.chat_sessions(customer_user_id);

-- 2. Voice message columns
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS voice_url text;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS voice_duration_ms integer;

-- 3. Voice calls table
CREATE TABLE IF NOT EXISTS public.chat_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  caller_name text NOT NULL DEFAULT '',
  caller_phone text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'ringing',
  initiated_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  ended_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  caller_signal jsonb DEFAULT '{}'::jsonb,
  callee_signal jsonb DEFAULT '{}'::jsonb,
  caller_ice jsonb DEFAULT '[]'::jsonb,
  callee_ice jsonb DEFAULT '[]'::jsonb,
  duration_seconds integer
);

CREATE INDEX IF NOT EXISTS idx_chat_calls_session ON public.chat_calls(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_calls_status ON public.chat_calls(status);
CREATE INDEX IF NOT EXISTS idx_chat_calls_initiated ON public.chat_calls(initiated_at DESC);

ALTER TABLE public.chat_calls ENABLE ROW LEVEL SECURITY;

-- Admin/staff can do everything
CREATE POLICY "Staff can view all calls" ON public.chat_calls FOR SELECT
  USING (public.has_any_role(auth.uid()));
CREATE POLICY "Staff can update calls" ON public.chat_calls FOR UPDATE
  USING (public.has_any_role(auth.uid()));
CREATE POLICY "Staff can delete calls" ON public.chat_calls FOR DELETE
  USING (public.has_any_role(auth.uid()));

-- 4. Working hours settings
INSERT INTO public.store_settings (key, value) VALUES
  ('live_agent_start_hour', '10'),
  ('live_agent_end_hour', '21'),
  ('live_agent_timezone', 'Asia/Dhaka')
ON CONFLICT (key) DO NOTHING;

-- 5. chat-voice storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-voice', 'chat-voice', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for chat-voice
DO $$ BEGIN
  CREATE POLICY "Public read chat voice" ON storage.objects FOR SELECT
    USING (bucket_id = 'chat-voice');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Anyone can upload chat voice" ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'chat-voice');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Staff can delete chat voice" ON storage.objects FOR DELETE
    USING (bucket_id = 'chat-voice' AND public.has_any_role(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. RPC: Link chat session to logged-in user
CREATE OR REPLACE FUNCTION public.link_chat_session_to_user(
  p_session_id uuid,
  p_session_token text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_session_token IS NULL OR trim(p_session_token) = '' THEN
    RAISE EXCEPTION 'Session token required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_sessions
    WHERE id = p_session_id AND session_token = p_session_token
  ) THEN
    RAISE EXCEPTION 'Invalid session';
  END IF;

  UPDATE public.chat_sessions
  SET customer_user_id = auth.uid()
  WHERE id = p_session_id;
END;
$$;

-- 7. RPC: Get most-recent chat session for the logged-in user
CREATE OR REPLACE FUNCTION public.get_user_chat_session()
RETURNS TABLE(id uuid, session_token text, visitor_name text, visitor_phone text, last_message_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT s.id, s.session_token, s.visitor_name, s.visitor_phone, s.last_message_at
  FROM public.chat_sessions s
  WHERE s.customer_user_id = auth.uid()
    AND s.status != 'closed'
  ORDER BY s.last_message_at DESC
  LIMIT 1;
END;
$$;

-- 8. RPC: Initiate voice call (visitor side)
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

  -- End any previous ringing call from this session
  UPDATE public.chat_calls
  SET status = 'missed', ended_at = now()
  WHERE session_id = p_session_id AND status = 'ringing';

  INSERT INTO public.chat_calls (
    session_id, caller_name, caller_phone, status, caller_signal
  ) VALUES (
    p_session_id,
    COALESCE(left(trim(p_caller_name), 200), ''),
    COALESCE(left(trim(p_caller_phone), 20), ''),
    'ringing',
    COALESCE(p_offer, '{}'::jsonb)
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

-- 9. RPC: Update WebRTC signal (used by both visitor and admin)
CREATE OR REPLACE FUNCTION public.update_call_signal(
  p_call_id uuid,
  p_session_token text,
  p_role text,           -- 'caller' | 'callee'
  p_signal jsonb,        -- answer / offer
  p_ice jsonb DEFAULT NULL  -- new ICE candidate to append
)
RETURNS void
LANGUAGE plpgsql
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
    RAISE EXCEPTION 'Call not found';
  END IF;

  IF NOT v_is_staff THEN
    IF p_session_token IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.chat_sessions WHERE id = v_session_id AND session_token = p_session_token
    ) THEN
      RAISE EXCEPTION 'Invalid session';
    END IF;
  END IF;

  IF p_role = 'caller' THEN
    IF p_signal IS NOT NULL THEN
      UPDATE public.chat_calls SET caller_signal = p_signal WHERE id = p_call_id;
    END IF;
    IF p_ice IS NOT NULL THEN
      UPDATE public.chat_calls
      SET caller_ice = COALESCE(caller_ice, '[]'::jsonb) || jsonb_build_array(p_ice)
      WHERE id = p_call_id;
    END IF;
  ELSIF p_role = 'callee' THEN
    IF p_signal IS NOT NULL THEN
      UPDATE public.chat_calls SET callee_signal = p_signal WHERE id = p_call_id;
    END IF;
    IF p_ice IS NOT NULL THEN
      UPDATE public.chat_calls
      SET callee_ice = COALESCE(callee_ice, '[]'::jsonb) || jsonb_build_array(p_ice)
      WHERE id = p_call_id;
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid role';
  END IF;
END;
$$;

-- 10. RPC: Visitor reads call (to poll for admin answer)
CREATE OR REPLACE FUNCTION public.get_call_state(
  p_call_id uuid,
  p_session_token text
)
RETURNS TABLE(
  id uuid, status text, caller_signal jsonb, callee_signal jsonb,
  caller_ice jsonb, callee_ice jsonb, accepted_at timestamptz, ended_at timestamptz
)
LANGUAGE plpgsql
STABLE
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

-- 11. RPC: Visitor ends/cancels call
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
  WHERE id = p_call_id AND status IN ('ringing', 'accepted');
END;
$$;
