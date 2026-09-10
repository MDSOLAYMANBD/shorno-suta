CREATE TABLE IF NOT EXISTS public.inbox_customer_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone text NOT NULL,
  note text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inbox_customer_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read inbox notes" ON public.inbox_customer_notes FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "Staff insert inbox notes" ON public.inbox_customer_notes FOR INSERT TO authenticated WITH CHECK (has_any_role(auth.uid()));
CREATE POLICY "Staff update inbox notes" ON public.inbox_customer_notes FOR UPDATE TO authenticated USING (has_any_role(auth.uid())) WITH CHECK (has_any_role(auth.uid()));
CREATE POLICY "Admin delete inbox notes" ON public.inbox_customer_notes FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX IF NOT EXISTS idx_inbox_notes_phone ON public.inbox_customer_notes(customer_phone, created_at DESC);