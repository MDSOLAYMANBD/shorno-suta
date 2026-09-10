ALTER TABLE public.sms_campaigns
  ADD COLUMN IF NOT EXISTS final_count integer,
  ADD COLUMN IF NOT EXISTS duplicates_removed integer,
  ADD COLUMN IF NOT EXISTS excluded_count integer,
  ADD COLUMN IF NOT EXISTS invalid_count integer,
  ADD COLUMN IF NOT EXISTS template_name text,
  ADD COLUMN IF NOT EXISTS sender_name text;