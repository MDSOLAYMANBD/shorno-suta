
CREATE TABLE public.acc_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  entity_name text,
  old_data jsonb DEFAULT '{}',
  new_data jsonb DEFAULT '{}',
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.acc_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access to acc_activity_logs"
ON public.acc_activity_logs
FOR ALL
TO authenticated
USING (public.has_any_role(auth.uid()))
WITH CHECK (public.has_any_role(auth.uid()));

CREATE INDEX idx_acc_activity_logs_entity ON public.acc_activity_logs(entity_type, entity_id);
CREATE INDEX idx_acc_activity_logs_created ON public.acc_activity_logs(created_at DESC);
