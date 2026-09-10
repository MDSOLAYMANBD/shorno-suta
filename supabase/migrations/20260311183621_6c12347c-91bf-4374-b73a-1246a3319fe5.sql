
CREATE TABLE public.email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL DEFAULT '',
  html_body text NOT NULL DEFAULT '',
  segment_filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  recipient_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read email campaigns"
  ON public.email_campaigns FOR SELECT
  TO authenticated
  USING (has_any_role(auth.uid()));

CREATE POLICY "Admin can insert email campaigns"
  ON public.email_campaigns FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update email campaigns"
  ON public.email_campaigns FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete email campaigns"
  ON public.email_campaigns FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
