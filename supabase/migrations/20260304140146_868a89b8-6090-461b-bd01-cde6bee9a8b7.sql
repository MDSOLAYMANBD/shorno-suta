
-- Drop overly permissive public read policies on chat tables
DROP POLICY IF EXISTS "Anyone can read chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Anyone can read chat messages" ON public.chat_messages;
