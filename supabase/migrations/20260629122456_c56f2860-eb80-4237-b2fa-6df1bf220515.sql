
CREATE TABLE IF NOT EXISTS public.crm_saved_audiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  channel_hint text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_saved_audiences TO authenticated;
GRANT ALL ON public.crm_saved_audiences TO service_role;

ALTER TABLE public.crm_saved_audiences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read saved audiences"
  ON public.crm_saved_audiences FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid()));

CREATE POLICY "Staff can insert saved audiences"
  ON public.crm_saved_audiences FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid()));

CREATE POLICY "Staff can update saved audiences"
  ON public.crm_saved_audiences FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid()))
  WITH CHECK (public.has_any_role(auth.uid()));

CREATE POLICY "Staff can delete saved audiences"
  ON public.crm_saved_audiences FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid()));

CREATE TRIGGER trg_crm_saved_audiences_updated
  BEFORE UPDATE ON public.crm_saved_audiences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_crm_saved_audiences_created_by
  ON public.crm_saved_audiences(created_by);
