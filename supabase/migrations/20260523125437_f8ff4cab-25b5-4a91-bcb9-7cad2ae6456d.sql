
DROP POLICY IF EXISTS "Staff can use realtime channels" ON realtime.messages;
DROP POLICY IF EXISTS "Staff can broadcast to realtime channels" ON realtime.messages;

CREATE POLICY "Staff can use realtime channels"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.has_any_role((SELECT auth.uid()))
  AND NOT public.has_role((SELECT auth.uid()), 'product_manager'::public.app_role)
);

CREATE POLICY "Staff can broadcast to realtime channels"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_any_role((SELECT auth.uid()))
  AND NOT public.has_role((SELECT auth.uid()), 'product_manager'::public.app_role)
);
