ALTER TABLE public.employee_profiles
  ADD COLUMN IF NOT EXISTS saved_quotes jsonb DEFAULT '[]'::jsonb;