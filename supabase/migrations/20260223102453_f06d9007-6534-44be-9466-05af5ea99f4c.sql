
-- Drop insecure single-parameter overloads that lack ownership verification
DROP FUNCTION IF EXISTS public.get_visitor_chat_messages(uuid);
DROP FUNCTION IF EXISTS public.send_visitor_chat_message(uuid, text, text);
DROP FUNCTION IF EXISTS public.update_visitor_chat_activity(uuid, integer);
