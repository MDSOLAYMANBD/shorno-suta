
-- 1. Tighten chat-voice INSERT: require {session_id}/{session_token}/...
DROP POLICY IF EXISTS "Visitors can upload chat voice to valid session" ON storage.objects;
CREATE POLICY "Visitors can upload chat voice to valid session"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-voice'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (storage.foldername(name))[2] IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.chat_sessions cs
    WHERE cs.id::text = (storage.foldername(name))[1]
      AND cs.session_token = (storage.foldername(name))[2]
  )
);

-- 2. Tighten chat-images INSERT: require {session_id}/{session_token}/...
DROP POLICY IF EXISTS "Authenticated users can upload chat images" ON storage.objects;
CREATE POLICY "Visitors can upload chat images to valid session"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-images'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (storage.foldername(name))[2] IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.chat_sessions cs
    WHERE cs.id::text = (storage.foldername(name))[1]
      AND cs.session_token = (storage.foldername(name))[2]
  )
);

-- 3. Tighten review-images INSERT: must upload into own user-id folder
DROP POLICY IF EXISTS "Auth users can upload review images in own folder" ON storage.objects;
CREATE POLICY "Auth users can upload review images in own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'review-images'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Lock down chat_sessions.session_token from direct table reads.
-- Visitors fetch their session via security-definer RPCs; staff never need the token.
REVOKE SELECT (session_token) ON public.chat_sessions FROM anon, authenticated;

-- 5. Clear WebRTC signaling + caller phone when calls end.
CREATE OR REPLACE FUNCTION public.end_call_admin(p_call_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      END,
      caller_signal = '{}'::jsonb,
      callee_signal = '{}'::jsonb,
      caller_ice = '[]'::jsonb,
      callee_ice = '[]'::jsonb,
      caller_phone = ''
  WHERE id = p_call_id AND status IN ('ringing', 'waiting', 'accepted');
END;
$function$;

CREATE OR REPLACE FUNCTION public.end_call_visitor(p_call_id uuid, p_session_token text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      END,
      caller_signal = '{}'::jsonb,
      callee_signal = '{}'::jsonb,
      caller_ice = '[]'::jsonb,
      callee_ice = '[]'::jsonb,
      caller_phone = ''
  WHERE id = p_call_id AND status IN ('ringing', 'waiting', 'accepted');
END;
$function$;
