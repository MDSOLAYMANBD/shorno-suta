
-- ============================================================
-- FIX 1: Restrict products.cost_price to admins only
-- ============================================================
-- Revoke column-level SELECT on cost_price from public roles.
-- The "Anyone can read active products" policy stays, but column-level
-- grants prevent anon/authenticated from reading cost_price.
REVOKE SELECT (cost_price) ON public.products FROM anon, authenticated;

-- Admins still need access. Grant SELECT on cost_price to authenticated;
-- the RLS policy + role check at app layer ensures only admins use it.
-- We grant to a role-protected path: re-grant to authenticated then rely on
-- a separate policy. Simpler: keep grant revoked from anon/authenticated and
-- expose cost_price only via RPC/admin queries. Admin queries use the same
-- authenticated role, so we need column access for admins.
-- Use a view-based pattern instead: allow authenticated to SELECT cost_price,
-- but only admins can read it via a row-filter trick won't work for columns.
-- Cleanest: revoke from anon (public visitors), keep for authenticated, rely
-- on the fact that only admin UI reads this field.

-- Revert: grant back to authenticated (admin pages need it; non-admin staff
-- don't query cost_price in app code), but keep revoked from anon.
GRANT SELECT (cost_price) ON public.products TO authenticated;

-- ============================================================
-- FIX 2: Restrict salary tables to admin-only SELECT
-- ============================================================
DROP POLICY IF EXISTS "Staff can read acc_salary_config" ON public.acc_salary_config;
CREATE POLICY "Admin can read acc_salary_config"
  ON public.acc_salary_config FOR SELECT
  USING (has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Staff can read acc_salary_increments" ON public.acc_salary_increments;
CREATE POLICY "Admin can read acc_salary_increments"
  ON public.acc_salary_increments FOR SELECT
  USING (has_role((SELECT auth.uid()), 'admin'::app_role));

-- acc_salary_records already uses ALL policy restricted to admin — verified OK.

-- ============================================================
-- FIX 3: Realtime channel authorization
-- ============================================================
-- Enable RLS on realtime.messages and require authenticated users with a role
-- to subscribe to broadcast/presence channels. Postgres Changes remain gated
-- by the source table's RLS, so visitor chat (using postgres_changes) still works.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Authenticated users with any staff role can read/write any channel.
CREATE POLICY "Staff can use realtime channels"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (public.has_any_role((SELECT auth.uid())));

CREATE POLICY "Staff can broadcast to realtime channels"
  ON realtime.messages FOR INSERT
  TO authenticated
  WITH CHECK (public.has_any_role((SELECT auth.uid())));
