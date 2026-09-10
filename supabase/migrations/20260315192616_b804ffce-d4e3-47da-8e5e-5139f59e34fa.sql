
-- =============================================
-- Smart Inbox tables
-- =============================================

CREATE TABLE public.inbox_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL DEFAULT 'website',
  platform_conversation_id text,
  customer_name text NOT NULL DEFAULT '',
  customer_phone text DEFAULT '',
  customer_avatar text,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  last_message text DEFAULT '',
  last_message_at timestamptz NOT NULL DEFAULT now(),
  unread_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  assigned_to uuid,
  tags text[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inbox_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read inbox_conversations" ON public.inbox_conversations
  FOR SELECT TO authenticated USING (has_any_role(auth.uid()));

CREATE POLICY "Staff can insert inbox_conversations" ON public.inbox_conversations
  FOR INSERT TO authenticated WITH CHECK (has_any_role(auth.uid()));

CREATE POLICY "Staff can update inbox_conversations" ON public.inbox_conversations
  FOR UPDATE TO authenticated USING (has_any_role(auth.uid()));

CREATE POLICY "Admin can delete inbox_conversations" ON public.inbox_conversations
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE INDEX idx_inbox_conversations_status ON public.inbox_conversations(status);
CREATE INDEX idx_inbox_conversations_platform ON public.inbox_conversations(platform);
CREATE INDEX idx_inbox_conversations_last_message_at ON public.inbox_conversations(last_message_at DESC);

-- =============================================

CREATE TABLE public.inbox_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.inbox_conversations(id) ON DELETE CASCADE,
  sender_type text NOT NULL DEFAULT 'customer',
  sender_name text NOT NULL DEFAULT '',
  message text DEFAULT '',
  image_url text,
  metadata jsonb DEFAULT '{}',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inbox_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read inbox_messages" ON public.inbox_messages
  FOR SELECT TO authenticated USING (has_any_role(auth.uid()));

CREATE POLICY "Staff can insert inbox_messages" ON public.inbox_messages
  FOR INSERT TO authenticated WITH CHECK (has_any_role(auth.uid()));

CREATE POLICY "Staff can update inbox_messages" ON public.inbox_messages
  FOR UPDATE TO authenticated USING (has_any_role(auth.uid()));

CREATE INDEX idx_inbox_messages_conversation ON public.inbox_messages(conversation_id, created_at);

-- =============================================

CREATE TABLE public.inbox_quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  shortcut text,
  category text DEFAULT 'general',
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inbox_quick_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read inbox_quick_replies" ON public.inbox_quick_replies
  FOR SELECT TO authenticated USING (has_any_role(auth.uid()));

CREATE POLICY "Admin can manage inbox_quick_replies" ON public.inbox_quick_replies
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- =============================================
-- CRM tables
-- =============================================

CREATE TABLE public.crm_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  description text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(name)
);

ALTER TABLE public.crm_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read crm_tags" ON public.crm_tags
  FOR SELECT TO authenticated USING (has_any_role(auth.uid()));

CREATE POLICY "Admin can manage crm_tags" ON public.crm_tags
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- =============================================

CREATE TABLE public.crm_customer_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.crm_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(customer_id, tag_id)
);

ALTER TABLE public.crm_customer_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read crm_customer_tags" ON public.crm_customer_tags
  FOR SELECT TO authenticated USING (has_any_role(auth.uid()));

CREATE POLICY "Admin can manage crm_customer_tags" ON public.crm_customer_tags
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE INDEX idx_crm_customer_tags_customer ON public.crm_customer_tags(customer_id);
CREATE INDEX idx_crm_customer_tags_tag ON public.crm_customer_tags(tag_id);

-- =============================================

CREATE TABLE public.crm_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  note text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read crm_notes" ON public.crm_notes
  FOR SELECT TO authenticated USING (has_any_role(auth.uid()));

CREATE POLICY "Staff can insert crm_notes" ON public.crm_notes
  FOR INSERT TO authenticated WITH CHECK (has_any_role(auth.uid()));

CREATE POLICY "Admin can manage crm_notes" ON public.crm_notes
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE INDEX idx_crm_notes_customer ON public.crm_notes(customer_id, created_at DESC);

-- =============================================
-- Update get_user_permissions to include new sections
-- =============================================

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
        "live_chat": "full", "accounting": "full", "giveaway": "full", "courier": "full",
        "smart_inbox": "full", "crm": "full", "automation": "full", "marketing": "full"
      }'::jsonb;
    WHEN 'editor' THEN
      _permissions := '{
        "dashboard": "view", "orders": "edit", "products": "edit", "categories": "edit",
        "customers": "view", "coupons": "edit", "landing_pages": "edit", "media": "edit",
        "sizes_colors": "edit", "site_editor": "edit", "settings": "none", "employees": "none",
        "live_chat": "edit", "accounting": "none", "giveaway": "none", "courier": "none",
        "smart_inbox": "edit", "crm": "view", "automation": "none", "marketing": "none"
      }'::jsonb;
    WHEN 'order_manager' THEN
      _permissions := '{
        "dashboard": "view", "orders": "full", "products": "view", "categories": "none",
        "customers": "none", "coupons": "none", "landing_pages": "none", "media": "none",
        "sizes_colors": "none", "site_editor": "none", "settings": "none", "employees": "none",
        "live_chat": "edit", "accounting": "none", "giveaway": "full", "courier": "none",
        "smart_inbox": "edit", "crm": "none", "automation": "none", "marketing": "none"
      }'::jsonb;
    WHEN 'product_manager' THEN
      _permissions := '{
        "dashboard": "view", "orders": "none", "products": "edit", "categories": "edit",
        "customers": "none", "coupons": "none", "landing_pages": "none", "media": "edit",
        "sizes_colors": "edit", "site_editor": "none", "settings": "none", "employees": "none",
        "live_chat": "none", "accounting": "none", "giveaway": "none", "courier": "none",
        "smart_inbox": "none", "crm": "none", "automation": "none", "marketing": "none"
      }'::jsonb;
    WHEN 'viewer' THEN
      _permissions := '{
        "dashboard": "view", "orders": "view", "products": "view", "categories": "view",
        "customers": "view", "coupons": "view", "landing_pages": "view", "media": "view",
        "sizes_colors": "view", "site_editor": "view", "settings": "none", "employees": "none",
        "live_chat": "view", "accounting": "none", "giveaway": "none", "courier": "none",
        "smart_inbox": "view", "crm": "view", "automation": "none", "marketing": "none"
      }'::jsonb;
    ELSE
      _permissions := '{}'::jsonb;
  END CASE;

  RETURN jsonb_build_object('role', _role::text, 'permissions', _permissions);
END;
$function$;
