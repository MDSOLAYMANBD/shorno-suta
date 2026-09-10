-- Fix 1: Replace hardcoded email INSERT policy with role-based policy
DROP POLICY IF EXISTS "Owner can insert notifications" ON public.staff_notifications;

CREATE POLICY "Admins can send notifications"
ON public.staff_notifications FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Fix 2: Tighten chat_sessions creation - replace open INSERT with RPC-only approach
-- Drop the permissive "Anyone can create" policy
DROP POLICY IF EXISTS "Anyone can create chat session" ON public.chat_sessions;

-- Staff can still create sessions
CREATE POLICY "Staff can create chat sessions"
ON public.chat_sessions FOR INSERT
TO authenticated
WITH CHECK (public.has_any_role(auth.uid()));