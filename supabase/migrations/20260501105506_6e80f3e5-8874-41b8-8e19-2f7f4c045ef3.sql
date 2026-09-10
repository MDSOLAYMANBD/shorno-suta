ALTER TABLE public.inbox_messages ADD COLUMN IF NOT EXISTS provider_message_id text;
CREATE UNIQUE INDEX IF NOT EXISTS inbox_messages_provider_msg_id_uniq
  ON public.inbox_messages (conversation_id, provider_message_id)
  WHERE provider_message_id IS NOT NULL;