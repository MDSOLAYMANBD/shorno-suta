
-- Staff Attendance table for employee self-service check-in/out
CREATE TABLE public.staff_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  check_in timestamptz,
  check_out timestamptz,
  lunch_start timestamptz,
  lunch_end timestamptz,
  status text NOT NULL DEFAULT 'present',
  late_minutes int NOT NULL DEFAULT 0,
  lunch_duration_minutes int,
  lunch_overtime_minutes int NOT NULL DEFAULT 0,
  early_leave_minutes int NOT NULL DEFAULT 0,
  overtime_minutes int NOT NULL DEFAULT 0,
  total_working_hours numeric(4,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Enable RLS
ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;

-- Employee can read own records
CREATE POLICY "Employees can read own attendance"
  ON public.staff_attendance FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admin can read all records
CREATE POLICY "Admins can read all staff attendance"
  ON public.staff_attendance FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Insert/Update only via service role (edge function)
-- No direct insert/update policies for regular users
