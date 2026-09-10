DROP POLICY IF EXISTS "Owner can insert notifications" ON public.staff_notifications;

CREATE POLICY "Owner can insert notifications"
ON public.staff_notifications
FOR INSERT
WITH CHECK (
  auth.email() = 'amisrsolayman@gmail.com'
);