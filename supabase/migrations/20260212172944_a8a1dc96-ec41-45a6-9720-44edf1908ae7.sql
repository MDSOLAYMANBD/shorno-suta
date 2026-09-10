
-- Fix 1: Restrict chat_sessions SELECT to staff only (protect visitor PII)
-- Visitors will use RPC functions instead of direct queries

-- Drop overly permissive chat_sessions SELECT policy
DROP POLICY IF EXISTS "Anyone can read chat sessions" ON public.chat_sessions;

-- Add staff-only SELECT policy
CREATE POLICY "Staff can read chat sessions"
ON public.chat_sessions FOR SELECT
TO authenticated
USING (has_any_role(auth.uid()));

-- Drop overly permissive chat_sessions UPDATE/INSERT 
-- (keep INSERT open but restrict UPDATE to staff)
DROP POLICY IF EXISTS "Anyone can create chat session" ON public.chat_sessions;
DROP POLICY IF EXISTS "Staff can update chat sessions" ON public.chat_sessions;

-- Visitors can create sessions via RPC, staff can also insert
CREATE POLICY "Anyone can create chat session"
ON public.chat_sessions FOR INSERT
WITH CHECK (true);

-- Only staff can update sessions directly
CREATE POLICY "Staff can update chat sessions"
ON public.chat_sessions FOR UPDATE
USING (has_any_role(auth.uid()));

-- Create RPC for visitor to create a chat session (returns session id)
CREATE OR REPLACE FUNCTION public.create_visitor_chat_session(p_name text, p_phone text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _session_id uuid;
BEGIN
  -- Basic input validation
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Name is required';
  END IF;
  IF p_phone IS NULL OR trim(p_phone) = '' THEN
    RAISE EXCEPTION 'Phone is required';
  END IF;
  
  INSERT INTO public.chat_sessions (visitor_name, visitor_phone)
  VALUES (trim(p_name), trim(p_phone))
  RETURNING id INTO _session_id;
  
  RETURN _session_id;
END;
$$;

-- Create RPC for visitor to update session activity (no direct UPDATE needed)
CREATE OR REPLACE FUNCTION public.update_visitor_chat_activity(p_session_id uuid, p_unread_count integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'Session ID is required';
  END IF;
  
  UPDATE public.chat_sessions
  SET last_message_at = now(),
      unread_count = COALESCE(p_unread_count, 0)
  WHERE id = p_session_id;
END;
$$;
