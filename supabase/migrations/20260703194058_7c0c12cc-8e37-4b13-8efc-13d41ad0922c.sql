DROP POLICY IF EXISTS "Staff can use realtime channels" ON realtime.messages;
DROP POLICY IF EXISTS "Staff can broadcast to realtime channels" ON realtime.messages;

CREATE POLICY "Staff can use realtime channels"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  has_role((SELECT auth.uid()), 'admin'::app_role)
  OR (
    has_any_role((SELECT auth.uid()))
    AND NOT has_role((SELECT auth.uid()), 'product_manager'::app_role)
    AND (
      realtime.topic() LIKE 'admin-%'
      OR realtime.topic() LIKE 'typing-%'
      OR realtime.topic() LIKE 'chat-signal-%'
      OR realtime.topic() LIKE 'cat-orders-%'
      OR realtime.topic() LIKE 'staff-%'
      OR realtime.topic() LIKE 'inbox-%'
    )
  )
);

CREATE POLICY "Staff can broadcast to realtime channels"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  has_role((SELECT auth.uid()), 'admin'::app_role)
  OR (
    has_any_role((SELECT auth.uid()))
    AND NOT has_role((SELECT auth.uid()), 'product_manager'::app_role)
    AND (
      realtime.topic() LIKE 'admin-%'
      OR realtime.topic() LIKE 'typing-%'
      OR realtime.topic() LIKE 'chat-signal-%'
      OR realtime.topic() LIKE 'cat-orders-%'
      OR realtime.topic() LIKE 'staff-%'
      OR realtime.topic() LIKE 'inbox-%'
    )
  )
);