-- ============================================================
-- Smart Inbox Automation + CRM — schema
-- ============================================================

-- Additive columns on existing inbox_conversations (nullable, defaulted)
ALTER TABLE public.inbox_conversations
  ADD COLUMN IF NOT EXISTS lead_score text,
  ADD COLUMN IF NOT EXISTS sla_first_response_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_last_agent_reply_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_breached boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_intent_message_id uuid;

-- ============================================================
-- inbox_automation_rules
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inbox_automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trigger_type text NOT NULL CHECK (trigger_type IN ('keyword','order_intent','confirm','cancel')),
  match_pattern text,
  match_keywords text[] NOT NULL DEFAULT '{}',
  reply_template text,
  reply_lang text NOT NULL DEFAULT 'bn',
  action text NOT NULL DEFAULT 'reply_only'
    CHECK (action IN ('reply_only','create_detected_order','update_detected_order','none')),
  priority integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_iar_active_priority
  ON public.inbox_automation_rules (is_active, priority);

ALTER TABLE public.inbox_automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read automation rules"
  ON public.inbox_automation_rules FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid()));

CREATE POLICY "Admin manage automation rules"
  ON public.inbox_automation_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_iar_updated_at
  BEFORE UPDATE ON public.inbox_automation_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- inbox_detected_orders
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inbox_detected_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.inbox_conversations(id) ON DELETE CASCADE,
  message_id uuid,
  customer_phone text,
  product_hint text,
  detected_price numeric,
  currency text NOT NULL DEFAULT 'BDT',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','cancelled','converted')),
  linked_order_id uuid,
  raw_text text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enforce at most one PENDING detected order per conversation
CREATE UNIQUE INDEX IF NOT EXISTS inbox_detected_orders_one_pending
  ON public.inbox_detected_orders (conversation_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_ido_conv_status
  ON public.inbox_detected_orders (conversation_id, status);

ALTER TABLE public.inbox_detected_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read detected orders"
  ON public.inbox_detected_orders FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid()));

CREATE POLICY "Staff write detected orders"
  ON public.inbox_detected_orders FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid()))
  WITH CHECK (public.has_any_role(auth.uid()));

CREATE TRIGGER trg_ido_updated_at
  BEFORE UPDATE ON public.inbox_detected_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- inbox_automation_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inbox_automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.inbox_conversations(id) ON DELETE CASCADE,
  message_id uuid,
  rule_id uuid,
  event text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ial_conv_created
  ON public.inbox_automation_logs (conversation_id, created_at DESC);

ALTER TABLE public.inbox_automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read automation logs"
  ON public.inbox_automation_logs FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid()));

CREATE POLICY "Staff insert automation logs"
  ON public.inbox_automation_logs FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid()));

-- ============================================================
-- inbox_customer_notes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inbox_customer_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.inbox_conversations(id) ON DELETE CASCADE,
  customer_phone text,
  author_id uuid,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_icn_conv ON public.inbox_customer_notes (conversation_id, created_at DESC);

ALTER TABLE public.inbox_customer_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read customer notes"
  ON public.inbox_customer_notes FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid()));

CREATE POLICY "Staff write customer notes"
  ON public.inbox_customer_notes FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid()))
  WITH CHECK (public.has_any_role(auth.uid()));

-- ============================================================
-- inbox_customer_attributes (one row per conversation)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inbox_customer_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL UNIQUE REFERENCES public.inbox_conversations(id) ON DELETE CASCADE,
  customer_phone text,
  attrs jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inbox_customer_attributes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read customer attrs"
  ON public.inbox_customer_attributes FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid()));

CREATE POLICY "Staff write customer attrs"
  ON public.inbox_customer_attributes FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid()))
  WITH CHECK (public.has_any_role(auth.uid()));

CREATE TRIGGER trg_ica_updated_at
  BEFORE UPDATE ON public.inbox_customer_attributes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- inbox_ai_cache
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inbox_ai_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.inbox_conversations(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('suggestions','summary','lead_score')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_message_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_iac_conv_kind ON public.inbox_ai_cache (conversation_id, kind);

ALTER TABLE public.inbox_ai_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read ai cache"
  ON public.inbox_ai_cache FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid()));

CREATE POLICY "Staff write ai cache"
  ON public.inbox_ai_cache FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid()))
  WITH CHECK (public.has_any_role(auth.uid()));

-- ============================================================
-- Trigger: purge stale AI cache rows on every new message
-- ============================================================
CREATE OR REPLACE FUNCTION public.purge_inbox_ai_cache()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.inbox_ai_cache
   WHERE conversation_id = NEW.conversation_id
     AND (last_message_id IS NULL OR last_message_id <> NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inbox_ai_cache_purge ON public.inbox_messages;
CREATE TRIGGER trg_inbox_ai_cache_purge
  AFTER INSERT ON public.inbox_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.purge_inbox_ai_cache();

-- ============================================================
-- Seed default keyword auto-reply rules (idempotent)
-- ============================================================
INSERT INTO public.inbox_automation_rules (name, trigger_type, match_keywords, reply_template, reply_lang, action, priority)
SELECT * FROM (VALUES
  ('Price asked', 'keyword',
    ARRAY['price','price koto','দাম','দাম কত','koto taka','kt'],
    'এই ড্রেসটির দাম ৮৫০ টাকা 😊 আপনি কি নিতে চান?', 'bn', 'reply_only', 200),
  ('Delivery info', 'keyword',
    ARRAY['delivery','ডেলিভারি','কুরিয়ার','courier'],
    'ঢাকায় ১-২ দিন, ঢাকার বাইরে ২-৩ দিন 🚚', 'bn', 'reply_only', 200),
  ('Stock check', 'keyword',
    ARRAY['available','in stock','স্টক','available?','স্টকে আছে'],
    'জি, প্রোডাক্টটি এখন স্টকে আছে ✅', 'bn', 'reply_only', 200)
) AS s(name, trigger_type, match_keywords, reply_template, reply_lang, action, priority)
WHERE NOT EXISTS (SELECT 1 FROM public.inbox_automation_rules);