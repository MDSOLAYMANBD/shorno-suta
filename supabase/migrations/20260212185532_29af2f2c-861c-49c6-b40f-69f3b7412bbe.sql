
-- Fix: Replace public SELECT on chat_messages with staff-only policy
-- Visitors will use a new RPC to fetch their messages

-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Anyone can read chat messages" ON public.chat_messages;

-- Staff can read all chat messages
CREATE POLICY "Staff can read chat messages"
ON public.chat_messages FOR SELECT
USING (public.has_any_role(auth.uid()));

-- Create RPC for visitors to fetch their session messages (no auth required)
CREATE OR REPLACE FUNCTION public.get_visitor_chat_messages(p_session_id uuid)
RETURNS SETOF public.chat_messages
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.chat_messages
  WHERE session_id = p_session_id
  ORDER BY created_at ASC;
$$;

-- Also create RPC for visitor to insert messages (replacing direct INSERT)
DROP POLICY IF EXISTS "Anyone can insert chat messages" ON public.chat_messages;

-- Only staff can insert directly
CREATE POLICY "Staff can insert chat messages"
ON public.chat_messages FOR INSERT
WITH CHECK (public.has_any_role(auth.uid()));

-- RPC for visitor message insertion
CREATE OR REPLACE FUNCTION public.send_visitor_chat_message(
  p_session_id uuid,
  p_sender_name text,
  p_message text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _msg_id uuid;
BEGIN
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'Session ID is required';
  END IF;
  IF p_message IS NULL OR trim(p_message) = '' THEN
    RAISE EXCEPTION 'Message is required';
  END IF;
  
  -- Verify session exists
  IF NOT EXISTS (SELECT 1 FROM public.chat_sessions WHERE id = p_session_id) THEN
    RAISE EXCEPTION 'Invalid session';
  END IF;
  
  INSERT INTO public.chat_messages (session_id, sender_type, sender_name, message)
  VALUES (p_session_id, 'visitor', COALESCE(trim(p_sender_name), ''), trim(p_message))
  RETURNING id INTO _msg_id;
  
  RETURN _msg_id;
END;
$$;
