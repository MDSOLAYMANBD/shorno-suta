-- ============================================================
-- Live visitor count — "how many people are on the site right
-- now", shown on both the storefront navbar and the admin panel.
--
-- Design deliberately avoids Realtime/websocket presence channels:
-- a persistent websocket per visitor would count against Supabase's
-- concurrent Realtime connection limit and could push the project
-- toward a paid-tier upgrade under real ad traffic. Instead this is
-- a plain heartbeat table + short-lived rows + a single COUNT(*):
--   - each browser tab upserts its own (client-generated) session_id
--     row roughly every 45s while the tab is visible (see
--     src/hooks/useLivePresence.ts) — a handful of bytes per write.
--   - "currently online" = rows updated in the last 2 minutes.
--   - a pg_cron job prunes rows older than 10 minutes every 5
--     minutes, so the table stays bounded by concurrent visitors,
--     never grows with total historical traffic (unlike site_visits).
-- Net cost: one small indexed table + one lightweight cron job +
-- ordinary REST calls, no new Realtime/websocket usage.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.live_presence (
  session_id text PRIMARY KEY,
  last_seen timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_presence_last_seen ON public.live_presence (last_seen);

ALTER TABLE public.live_presence ENABLE ROW LEVEL SECURITY;

-- Anonymous visitors heartbeat their own session_id. No SELECT policy
-- is granted here on purpose — the raw table (with session_ids) is
-- never exposed publicly; only the aggregate count below is.
CREATE POLICY "Anyone can upsert their own presence heartbeat"
  ON public.live_presence FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can refresh their own presence heartbeat"
  ON public.live_presence FOR UPDATE
  USING (true);

CREATE POLICY "Admins can read live presence"
  ON public.live_presence FOR SELECT TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role));

-- Public, PII-free aggregate — this is what both the storefront badge
-- and the admin panel actually call.
CREATE OR REPLACE FUNCTION public.get_live_visitor_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer FROM public.live_presence
  WHERE last_seen > now() - interval '2 minutes';
$$;

REVOKE ALL ON FUNCTION public.get_live_visitor_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_live_visitor_count() TO anon, authenticated;

-- Keep the table tiny — prune anything that's aged out of the
-- "online" window with headroom, every 5 minutes.
DO $$ BEGIN PERFORM cron.unschedule('purge_live_presence'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'purge_live_presence',
  '*/5 * * * *',
  $$DELETE FROM public.live_presence WHERE last_seen < now() - interval '10 minutes'$$
);
