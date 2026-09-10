
-- Add session_token column to chat_sessions
ALTER TABLE public.chat_sessions
ADD COLUMN IF NOT EXISTS session_token text;

-- Backfill existing rows with random tokens
UPDATE public.chat_sessions
SET session_token = encode(gen_random_bytes(32), 'hex')
WHERE session_token IS NULL;

-- Now enforce NOT NULL
ALTER TABLE public.chat_sessions
ALTER COLUMN session_token SET NOT NULL;

-- Set default for future rows
ALTER TABLE public.chat_sessions
ALTER COLUMN session_token SET DEFAULT encode(gen_random_bytes(32), 'hex');
