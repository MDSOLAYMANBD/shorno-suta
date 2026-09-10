SELECT net.http_post(
  url := 'https://gdwvktufhsbrblzzeiir.supabase.co/functions/v1/courier-status-poll',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdkd3ZrdHVmaHNicmJsenplaWlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MjkzMTgsImV4cCI6MjA4NjIwNTMxOH0.l-Q9GkJgmK-oKGz6wolftLHNSJA2CkeBTZ9DbpYB3RU',
    'x-poll-secret', public._get_courier_poll_secret()
  ),
  body := jsonb_build_object('manual_test', true)
) AS request_id;