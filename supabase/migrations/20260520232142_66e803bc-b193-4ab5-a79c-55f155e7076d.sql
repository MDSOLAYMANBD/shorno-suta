
CREATE TABLE IF NOT EXISTS public.sms_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  body text NOT NULL,
  tone text,
  language text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sms_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  body text NOT NULL,
  audience_filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  audience_size int NOT NULL DEFAULT 0,
  sent_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  total_parts int NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.sms_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.sms_campaigns(id) ON DELETE CASCADE,
  customer_name text,
  phone text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  parts int NOT NULL DEFAULT 1,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_campaign_recipients_campaign ON public.sms_campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sms_campaigns_created_at ON public.sms_campaigns(created_at DESC);

ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff full access sms_templates" ON public.sms_templates FOR ALL TO authenticated USING (public.has_any_role(auth.uid())) WITH CHECK (public.has_any_role(auth.uid()));
CREATE POLICY "Staff full access sms_campaigns" ON public.sms_campaigns FOR ALL TO authenticated USING (public.has_any_role(auth.uid())) WITH CHECK (public.has_any_role(auth.uid()));
CREATE POLICY "Staff full access sms_campaign_recipients" ON public.sms_campaign_recipients FOR ALL TO authenticated USING (public.has_any_role(auth.uid())) WITH CHECK (public.has_any_role(auth.uid()));

CREATE TRIGGER trg_sms_templates_updated_at
BEFORE UPDATE ON public.sms_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
