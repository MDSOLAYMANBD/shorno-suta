
-- Chat sessions table
CREATE TABLE public.chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_name text NOT NULL DEFAULT '',
  visitor_phone text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  assigned_to uuid,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  unread_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Chat messages table
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  sender_type text NOT NULL DEFAULT 'visitor',
  sender_id uuid,
  sender_name text NOT NULL DEFAULT '',
  sender_avatar text,
  message text NOT NULL DEFAULT '',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_chat_messages_session_id ON public.chat_messages(session_id);
CREATE INDEX idx_chat_sessions_status ON public.chat_sessions(status);
CREATE INDEX idx_chat_sessions_last_message ON public.chat_sessions(last_message_at DESC);

-- Enable RLS
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- chat_sessions RLS: anyone can insert (visitor starts chat)
CREATE POLICY "Anyone can create chat session"
ON public.chat_sessions FOR INSERT
WITH CHECK (true);

-- chat_sessions RLS: anyone can read their own session (by id, visitor uses localStorage id)
CREATE POLICY "Anyone can read chat sessions"
ON public.chat_sessions FOR SELECT
USING (true);

-- chat_sessions RLS: staff can update sessions
CREATE POLICY "Staff can update chat sessions"
ON public.chat_sessions FOR UPDATE
USING (has_any_role(auth.uid()));

-- chat_messages RLS: anyone can insert messages
CREATE POLICY "Anyone can insert chat messages"
ON public.chat_messages FOR INSERT
WITH CHECK (true);

-- chat_messages RLS: anyone can read messages (visitor reads own session via app logic)
CREATE POLICY "Anyone can read chat messages"
ON public.chat_messages FOR SELECT
USING (true);

-- chat_messages RLS: staff can update messages (mark read)
CREATE POLICY "Staff can update chat messages"
ON public.chat_messages FOR UPDATE
USING (has_any_role(auth.uid()));

-- Enable Realtime for chat_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_sessions;

-- Update get_user_permissions to include live_chat
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _role app_role;
  _permissions jsonb;
BEGIN
  SELECT role INTO _role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
  
  IF _role IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  CASE _role
    WHEN 'admin' THEN
      _permissions := '{
        "dashboard": "full", "orders": "full", "products": "full", "categories": "full",
        "customers": "full", "coupons": "full", "landing_pages": "full", "media": "full",
        "sizes_colors": "full", "site_editor": "full", "settings": "full", "employees": "full",
        "live_chat": "full"
      }'::jsonb;
    WHEN 'editor' THEN
      _permissions := '{
        "dashboard": "view", "orders": "edit", "products": "edit", "categories": "edit",
        "customers": "view", "coupons": "edit", "landing_pages": "edit", "media": "edit",
        "sizes_colors": "edit", "site_editor": "edit", "settings": "none", "employees": "none",
        "live_chat": "edit"
      }'::jsonb;
    WHEN 'order_manager' THEN
      _permissions := '{
        "dashboard": "view", "orders": "edit", "products": "none", "categories": "none",
        "customers": "view", "coupons": "none", "landing_pages": "none", "media": "none",
        "sizes_colors": "none", "site_editor": "none", "settings": "none", "employees": "none",
        "live_chat": "edit"
      }'::jsonb;
    WHEN 'product_manager' THEN
      _permissions := '{
        "dashboard": "view", "orders": "none", "products": "edit", "categories": "edit",
        "customers": "none", "coupons": "none", "landing_pages": "none", "media": "edit",
        "sizes_colors": "edit", "site_editor": "none", "settings": "none", "employees": "none",
        "live_chat": "none"
      }'::jsonb;
    WHEN 'viewer' THEN
      _permissions := '{
        "dashboard": "view", "orders": "view", "products": "view", "categories": "view",
        "customers": "view", "coupons": "view", "landing_pages": "view", "media": "view",
        "sizes_colors": "view", "site_editor": "view", "settings": "none", "employees": "none",
        "live_chat": "view"
      }'::jsonb;
    ELSE
      _permissions := '{}'::jsonb;
  END CASE;

  RETURN jsonb_build_object('role', _role::text, 'permissions', _permissions);
END;
$function$;
