-- Remove any prior version
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'steadfast-payment-autosync-hourly';

SELECT cron.schedule(
  'steadfast-payment-autosync-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://gdwvktufhsbrblzzeiir.supabase.co/functions/v1/steadfast-courier?action=fetch_payments',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdkd3ZrdHVmaHNicmJsenplaWlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MjkzMTgsImV4cCI6MjA4NjIwNTMxOH0.l-Q9GkJgmK-oKGz6wolftLHNSJA2CkeBTZ9DbpYB3RU',
      'x-internal-secret', public._get_courier_poll_secret()
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);