-- Enable required extensions for cron-based safety-net polling of courier statuses
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any prior schedule with the same name (idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule('courier-status-poll-30min');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

-- Schedule the poll every 30 minutes — webhook safety-net only
SELECT cron.schedule(
  'courier-status-poll-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://gdwvktufhsbrblzzeiir.supabase.co/functions/v1/courier-status-poll',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdkd3ZrdHVmaHNicmJsenplaWlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MjkzMTgsImV4cCI6MjA4NjIwNTMxOH0.l-Q9GkJgmK-oKGz6wolftLHNSJA2CkeBTZ9DbpYB3RU'
    ),
    body := jsonb_build_object('triggered_by', 'pg_cron')
  ) AS request_id;
  $$
);

-- Enable Realtime for courier_tracking_events so admin UI auto-refreshes on new events
ALTER PUBLICATION supabase_realtime ADD TABLE public.courier_tracking_events;