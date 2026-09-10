
-- chat_calls: restrict to staff roles excluding product_manager
DROP POLICY IF EXISTS "Staff can view all calls" ON public.chat_calls;
CREATE POLICY "Chat-authorized staff can read chat calls"
ON public.chat_calls FOR SELECT TO authenticated
USING (
  has_role((SELECT auth.uid()), 'admin'::app_role)
  OR has_role((SELECT auth.uid()), 'order_manager'::app_role)
  OR has_role((SELECT auth.uid()), 'editor'::app_role)
  OR has_role((SELECT auth.uid()), 'viewer'::app_role)
);

-- inbox_conversations
DROP POLICY IF EXISTS "Staff can read inbox_conversations" ON public.inbox_conversations;
CREATE POLICY "Chat-authorized staff can read inbox_conversations"
ON public.inbox_conversations FOR SELECT TO authenticated
USING (
  has_role((SELECT auth.uid()), 'admin'::app_role)
  OR has_role((SELECT auth.uid()), 'order_manager'::app_role)
  OR has_role((SELECT auth.uid()), 'editor'::app_role)
  OR has_role((SELECT auth.uid()), 'viewer'::app_role)
);

-- inbox_broadcast_recipients
DROP POLICY IF EXISTS "Staff read recipients" ON public.inbox_broadcast_recipients;
CREATE POLICY "Chat-authorized staff read recipients"
ON public.inbox_broadcast_recipients FOR SELECT TO authenticated
USING (
  has_role((SELECT auth.uid()), 'admin'::app_role)
  OR has_role((SELECT auth.uid()), 'order_manager'::app_role)
  OR has_role((SELECT auth.uid()), 'editor'::app_role)
  OR has_role((SELECT auth.uid()), 'viewer'::app_role)
);

-- inbox_simulated_calls
DROP POLICY IF EXISTS "Staff read sim calls" ON public.inbox_simulated_calls;
CREATE POLICY "Chat-authorized staff read sim calls"
ON public.inbox_simulated_calls FOR SELECT TO authenticated
USING (
  has_role((SELECT auth.uid()), 'admin'::app_role)
  OR has_role((SELECT auth.uid()), 'order_manager'::app_role)
  OR has_role((SELECT auth.uid()), 'editor'::app_role)
  OR has_role((SELECT auth.uid()), 'viewer'::app_role)
);

-- inbox_customer_notes (two existing SELECT policies)
DROP POLICY IF EXISTS "Staff read customer notes" ON public.inbox_customer_notes;
DROP POLICY IF EXISTS "Staff read inbox notes" ON public.inbox_customer_notes;
CREATE POLICY "Chat-authorized staff read customer notes"
ON public.inbox_customer_notes FOR SELECT TO authenticated
USING (
  has_role((SELECT auth.uid()), 'admin'::app_role)
  OR has_role((SELECT auth.uid()), 'order_manager'::app_role)
  OR has_role((SELECT auth.uid()), 'editor'::app_role)
  OR has_role((SELECT auth.uid()), 'viewer'::app_role)
);

-- inbox_customer_attributes
DROP POLICY IF EXISTS "Staff read customer attrs" ON public.inbox_customer_attributes;
CREATE POLICY "Chat-authorized staff read customer attrs"
ON public.inbox_customer_attributes FOR SELECT TO authenticated
USING (
  has_role((SELECT auth.uid()), 'admin'::app_role)
  OR has_role((SELECT auth.uid()), 'order_manager'::app_role)
  OR has_role((SELECT auth.uid()), 'editor'::app_role)
  OR has_role((SELECT auth.uid()), 'viewer'::app_role)
);

-- inbox_detected_orders
DROP POLICY IF EXISTS "Staff read detected orders" ON public.inbox_detected_orders;
CREATE POLICY "Chat-authorized staff read detected orders"
ON public.inbox_detected_orders FOR SELECT TO authenticated
USING (
  has_role((SELECT auth.uid()), 'admin'::app_role)
  OR has_role((SELECT auth.uid()), 'order_manager'::app_role)
  OR has_role((SELECT auth.uid()), 'editor'::app_role)
  OR has_role((SELECT auth.uid()), 'viewer'::app_role)
);

-- staff_notification_comments: restrict to staff only
DROP POLICY IF EXISTS "Authenticated users can read all comments" ON public.staff_notification_comments;
CREATE POLICY "Staff can read all comments"
ON public.staff_notification_comments FOR SELECT TO authenticated
USING (has_any_role(auth.uid()));

-- staff_notification_reactions: restrict to staff only
DROP POLICY IF EXISTS "Authenticated users can read all reactions" ON public.staff_notification_reactions;
CREATE POLICY "Staff can read all reactions"
ON public.staff_notification_reactions FOR SELECT TO authenticated
USING (has_any_role(auth.uid()));
