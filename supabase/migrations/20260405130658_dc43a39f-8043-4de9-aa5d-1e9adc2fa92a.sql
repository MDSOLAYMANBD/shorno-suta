
CREATE TABLE public.webhook_event_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  platform text NOT NULL DEFAULT 'unknown',
  object_type text,
  event_type text NOT NULL DEFAULT 'post',
  parsed_count int NOT NULL DEFAULT 0,
  saved_count int NOT NULL DEFAULT 0,
  status_count int NOT NULL DEFAULT 0,
  skipped_reasons jsonb DEFAULT '[]'::jsonb,
  raw_preview text,
  error text,
  has_signature boolean DEFAULT false
);

ALTER TABLE public.webhook_event_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view webhook logs"
ON public.webhook_event_logs FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid()));

CREATE INDEX idx_webhook_event_logs_created ON public.webhook_event_logs(created_at DESC);
CREATE INDEX idx_webhook_event_logs_platform ON public.webhook_event_logs(platform);

-- Auto-cleanup: keep only last 500 rows
CREATE OR REPLACE FUNCTION public.cleanup_webhook_event_logs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.webhook_event_logs
  WHERE id NOT IN (
    SELECT id FROM public.webhook_event_logs
    ORDER BY created_at DESC
    LIMIT 500
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cleanup_webhook_logs
AFTER INSERT ON public.webhook_event_logs
FOR EACH STATEMENT
EXECUTE FUNCTION public.cleanup_webhook_event_logs();
