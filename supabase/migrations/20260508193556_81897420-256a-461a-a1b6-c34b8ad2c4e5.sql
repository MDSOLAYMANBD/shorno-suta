-- Fix courier-status-poll cron: was sending anon key, function requires service_role
SELECT cron.unschedule('courier-status-poll-10min');

SELECT cron.schedule(
  'courier-status-poll-10min',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://gdwvktufhsbrblzzeiir.supabase.co/functions/v1/courier-status-poll',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
    ),
    body := jsonb_build_object('triggered_by', 'pg_cron')
  ) AS request_id;
  $$
);