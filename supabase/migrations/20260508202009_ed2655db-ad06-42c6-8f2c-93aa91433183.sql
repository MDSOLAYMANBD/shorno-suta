SELECT net.http_post(
  url := 'https://gdwvktufhsbrblzzeiir.supabase.co/functions/v1/steadfast-tracking-fetch',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdkd3ZrdHVmaHNicmJsenplaWlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MjkzMTgsImV4cCI6MjA4NjIwNTMxOH0.l-Q9GkJgmK-oKGz6wolftLHNSJA2CkeBTZ9DbpYB3RU',
    'x-internal-secret', public._get_courier_poll_secret()
  ),
  body := jsonb_build_object('order_id', '95a15641-203c-4fc0-8664-4dfd686eb12c')
) AS request_id;