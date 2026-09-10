-- Switch AI chat to the latest Gemini 3 flash preview model for better instruction following
UPDATE public.store_settings SET value = 'google/gemini-3-flash-preview' WHERE key = 'ai_chat_model';

-- Make sure chat_messages and chat_sessions are in the realtime publication so admin sees AI replies live
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='chat_messages') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='chat_sessions') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_sessions';
  END IF;
END $$;

-- Ensure REPLICA IDENTITY FULL so realtime payload includes full row (needed for metadata cards in admin)
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.chat_sessions REPLICA IDENTITY FULL;