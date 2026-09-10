-- 1. Broadcast Campaigns
CREATE TABLE IF NOT EXISTS public.inbox_broadcast_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  platform text NOT NULL DEFAULT 'whatsapp',
  message text NOT NULL DEFAULT '',
  media_url text,
  audience_filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  audience_size integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz,
  sent_at timestamptz,
  sent_count integer NOT NULL DEFAULT 0,
  delivered_count integer NOT NULL DEFAULT 0,
  opened_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inbox_broadcast_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read campaigns" ON public.inbox_broadcast_campaigns FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "Staff insert campaigns" ON public.inbox_broadcast_campaigns FOR INSERT TO authenticated WITH CHECK (has_any_role(auth.uid()));
CREATE POLICY "Staff update campaigns" ON public.inbox_broadcast_campaigns FOR UPDATE TO authenticated USING (has_any_role(auth.uid())) WITH CHECK (has_any_role(auth.uid()));
CREATE POLICY "Admin delete campaigns" ON public.inbox_broadcast_campaigns FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX IF NOT EXISTS idx_inbox_campaigns_status ON public.inbox_broadcast_campaigns(status, created_at DESC);

-- 2. Broadcast Recipients
CREATE TABLE IF NOT EXISTS public.inbox_broadcast_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.inbox_broadcast_campaigns(id) ON DELETE CASCADE,
  conversation_id uuid,
  customer_name text NOT NULL DEFAULT '',
  customer_phone text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  simulated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inbox_broadcast_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read recipients" ON public.inbox_broadcast_recipients FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "Staff insert recipients" ON public.inbox_broadcast_recipients FOR INSERT TO authenticated WITH CHECK (has_any_role(auth.uid()));
CREATE POLICY "Staff update recipients" ON public.inbox_broadcast_recipients FOR UPDATE TO authenticated USING (has_any_role(auth.uid())) WITH CHECK (has_any_role(auth.uid()));
CREATE POLICY "Admin delete recipients" ON public.inbox_broadcast_recipients FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX IF NOT EXISTS idx_inbox_recipients_campaign ON public.inbox_broadcast_recipients(campaign_id);

-- 3. Simulated Calls
CREATE TABLE IF NOT EXISTS public.inbox_simulated_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  customer_phone text NOT NULL DEFAULT '',
  outcome text NOT NULL DEFAULT 'pending' CHECK (outcome IN ('confirmed','failed','pending')),
  linked_order_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inbox_simulated_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read sim calls" ON public.inbox_simulated_calls FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "Staff insert sim calls" ON public.inbox_simulated_calls FOR INSERT TO authenticated WITH CHECK (has_any_role(auth.uid()));
CREATE POLICY "Staff update sim calls" ON public.inbox_simulated_calls FOR UPDATE TO authenticated USING (has_any_role(auth.uid())) WITH CHECK (has_any_role(auth.uid()));
CREATE POLICY "Admin delete sim calls" ON public.inbox_simulated_calls FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX IF NOT EXISTS idx_inbox_sim_calls_conv ON public.inbox_simulated_calls(conversation_id, created_at DESC);

-- 4. Follow-ups
CREATE TABLE IF NOT EXISTS public.inbox_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  last_message_id uuid,
  step text NOT NULL CHECK (step IN ('10m','1h','6h')),
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  sent_message_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inbox_followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read followups" ON public.inbox_followups FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "Staff insert followups" ON public.inbox_followups FOR INSERT TO authenticated WITH CHECK (has_any_role(auth.uid()));
CREATE POLICY "Staff update followups" ON public.inbox_followups FOR UPDATE TO authenticated USING (has_any_role(auth.uid())) WITH CHECK (has_any_role(auth.uid()));
CREATE POLICY "Admin delete followups" ON public.inbox_followups FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX IF NOT EXISTS idx_inbox_followups_due ON public.inbox_followups(status, due_at);
CREATE INDEX IF NOT EXISTS idx_inbox_followups_conv ON public.inbox_followups(conversation_id, status);