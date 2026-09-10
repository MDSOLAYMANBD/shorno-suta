-- pg_cron runs as postgres without access to vault.decrypted_secrets directly.
-- Create a SECURITY DEFINER helper that returns the COURIER_WEBHOOK_SECRET,
-- then reschedule the cron to use it via x-poll-secret header (anon key as Authorization for routing).

CREATE OR REPLACE FUNCTION public._get_courier_poll_secret()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'COURIER_WEBHOOK_SECRET' LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public._get_courier_poll_secret() FROM PUBLIC, anon, authenticated;

DO $$ BEGIN PERFORM cron.unschedule('courier-status-poll-10min'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'courier-status-poll-10min',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://gdwvktufhsbrblzzeiir.supabase.co/functions/v1/courier-status-poll',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdkd3ZrdHVmaHNicmJsenplaWlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MjkzMTgsImV4cCI6MjA4NjIwNTMxOH0.l-Q9GkJgmK-oKGz6wolftLHNSJA2CkeBTZ9DbpYB3RU',
      'x-poll-secret', public._get_courier_poll_secret()
    ),
    body := jsonb_build_object('triggered_by', 'pg_cron')
  ) AS request_id;
  $$
);

-- Trigger one immediate run to sync SD-010288 now
SELECT net.http_post(
  url := 'https://gdwvktufhsbrblzzeiir.supabase.co/functions/v1/courier-status-poll',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdkd3ZrdHVmaHNicmJsenplaWlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MjkzMTgsImV4cCI6MjA4NjIwNTMxOH0.l-Q9GkJgmK-oKGz6wolftLHNSJA2CkeBTZ9DbpYB3RU',
    'x-poll-secret', public._get_courier_poll_secret()
  ),
  body := jsonb_build_object('triggered_by', 'manual_kickoff')
);