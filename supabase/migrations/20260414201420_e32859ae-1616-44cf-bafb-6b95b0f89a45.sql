ALTER TABLE public.employee_profiles
  ADD COLUMN IF NOT EXISTS duty_start_time text DEFAULT '10:00',
  ADD COLUMN IF NOT EXISTS duty_end_time text DEFAULT '21:00',
  ADD COLUMN IF NOT EXISTS off_day text DEFAULT 'friday';