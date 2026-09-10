-- Restrict accounting/HR tables to admin-only SELECT
DROP POLICY IF EXISTS "Staff can read acc_attendance" ON public.acc_attendance;
CREATE POLICY "Admin can read acc_attendance"
  ON public.acc_attendance FOR SELECT
  USING (has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Staff can read acc_party_entries" ON public.acc_party_entries;
CREATE POLICY "Admin can read acc_party_entries"
  ON public.acc_party_entries FOR SELECT
  USING (has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Staff can read acc_production_entries" ON public.acc_production_entries;
CREATE POLICY "Admin can read acc_production_entries"
  ON public.acc_production_entries FOR SELECT
  USING (has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Staff can read acc_work_order_entries" ON public.acc_work_order_entries;
CREATE POLICY "Admin can read acc_work_order_entries"
  ON public.acc_work_order_entries FOR SELECT
  USING (has_role((SELECT auth.uid()), 'admin'::app_role));

-- Restrict chat tables to roles with live_chat permission (exclude product_manager)
DROP POLICY IF EXISTS "Staff can read chat sessions" ON public.chat_sessions;
CREATE POLICY "Chat-authorized staff can read chat sessions"
  ON public.chat_sessions FOR SELECT
  USING (
    has_role((SELECT auth.uid()), 'admin'::app_role)
    OR has_role((SELECT auth.uid()), 'order_manager'::app_role)
    OR has_role((SELECT auth.uid()), 'editor'::app_role)
    OR has_role((SELECT auth.uid()), 'viewer'::app_role)
  );

DROP POLICY IF EXISTS "Staff can update chat sessions" ON public.chat_sessions;
CREATE POLICY "Chat-authorized staff can update chat sessions"
  ON public.chat_sessions FOR UPDATE
  USING (
    has_role((SELECT auth.uid()), 'admin'::app_role)
    OR has_role((SELECT auth.uid()), 'order_manager'::app_role)
    OR has_role((SELECT auth.uid()), 'editor'::app_role)
  );

DROP POLICY IF EXISTS "Staff can read chat messages" ON public.chat_messages;
CREATE POLICY "Chat-authorized staff can read chat messages"
  ON public.chat_messages FOR SELECT
  USING (
    has_role((SELECT auth.uid()), 'admin'::app_role)
    OR has_role((SELECT auth.uid()), 'order_manager'::app_role)
    OR has_role((SELECT auth.uid()), 'editor'::app_role)
    OR has_role((SELECT auth.uid()), 'viewer'::app_role)
  );

DROP POLICY IF EXISTS "Staff can update chat messages" ON public.chat_messages;
CREATE POLICY "Chat-authorized staff can update chat messages"
  ON public.chat_messages FOR UPDATE
  USING (
    has_role((SELECT auth.uid()), 'admin'::app_role)
    OR has_role((SELECT auth.uid()), 'order_manager'::app_role)
    OR has_role((SELECT auth.uid()), 'editor'::app_role)
  );