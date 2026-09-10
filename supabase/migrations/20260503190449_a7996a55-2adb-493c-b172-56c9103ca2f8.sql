-- Lock down chat_sessions.session_token: prevent staff/anon from reading the column.
-- Edge functions (service_role) and SECURITY DEFINER RPCs continue to access it.
REVOKE SELECT (session_token) ON public.chat_sessions FROM anon, authenticated;