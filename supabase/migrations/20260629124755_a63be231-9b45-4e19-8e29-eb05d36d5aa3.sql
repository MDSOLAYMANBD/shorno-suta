
-- Audit log table
CREATE TABLE public.crm_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  ip text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.crm_audit_logs TO authenticated;
GRANT ALL ON public.crm_audit_logs TO service_role;

ALTER TABLE public.crm_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view audit logs"
  ON public.crm_audit_logs FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid()));

CREATE POLICY "Staff can insert audit logs"
  ON public.crm_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_any_role(auth.uid()) AND actor_id = auth.uid());

CREATE INDEX idx_crm_audit_logs_created_at ON public.crm_audit_logs (created_at DESC);
CREATE INDEX idx_crm_audit_logs_action ON public.crm_audit_logs (action);
CREATE INDEX idx_crm_audit_logs_entity ON public.crm_audit_logs (entity_type, entity_id);

-- Extend crm_saved_audiences
ALTER TABLE public.crm_saved_audiences
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_count integer NOT NULL DEFAULT 0;

-- Extend sms_campaigns
ALTER TABLE public.sms_campaigns
  ADD COLUMN IF NOT EXISTS audience_id uuid REFERENCES public.crm_saved_audiences(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS audience_filters jsonb,
  ADD COLUMN IF NOT EXISTS actual_cost numeric,
  ADD COLUMN IF NOT EXISTS created_by_email text;
