-- Reschedule courier status poll from 30 min to 10 min for tighter sync
DO $$
BEGIN
  PERFORM cron.unschedule('courier-status-poll-30min');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('courier-status-poll-10min');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

SELECT cron.schedule(
  'courier-status-poll-10min',
  '*/10 * * * *',
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