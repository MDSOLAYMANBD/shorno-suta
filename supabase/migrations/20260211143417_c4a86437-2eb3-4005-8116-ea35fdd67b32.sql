-- Update INSERT policy on staff_notifications to only allow owner
DROP POLICY IF EXISTS "Admin can insert notifications" ON public.staff_notifications;

CREATE POLICY "Owner can insert notifications"
ON public.staff_notifications
FOR INSERT
WITH CHECK (
  auth.uid() IN (
    SELECT au.id FROM auth.users au WHERE au.email = 'amisrsolayman@gmail.com'
  )
);