-- page_views: full multi-page navigation log (one row per navigation),
-- distinct from site_visits (one row per session, landing page only).
-- Powers the ভিজিটর অ্যানালিটিক্স admin page's "সাম্প্রতিক ভিজিটর জার্নি" feed.
CREATE TABLE public.page_views (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id text NOT NULL,
  page_path text NOT NULL DEFAULT '/',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_page_views_created ON public.page_views (created_at);
CREATE INDEX idx_page_views_session_created ON public.page_views (session_id, created_at DESC);
-- Deliberately NO unique index on session_id (unlike site_visits) — every
-- navigation gets its own row so the full journey can be reconstructed.

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert page views with valid data"
  ON public.page_views FOR INSERT
  WITH CHECK (
    session_id IS NOT NULL AND
    length(session_id) > 0 AND
    length(session_id) <= 200 AND
    page_path IS NOT NULL AND
    length(page_path) <= 500
  );

CREATE POLICY "Staff can read page views"
  ON public.page_views FOR SELECT
  USING (has_any_role((select auth.uid())));

CREATE POLICY "Admin can delete page views"
  ON public.page_views FOR DELETE
  USING (has_role((select auth.uid()), 'admin'::app_role));

-- Rate-limit trigger, mirrors enforce_site_visits_rate_limit() exactly
-- (same 60/min-per-session ceiling; ordinary navigation never gets close,
-- this only catches scripted/bot abuse of the anon insert policy).
CREATE OR REPLACE FUNCTION public.enforce_page_views_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count int;
BEGIN
  IF NEW.session_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO recent_count
  FROM public.page_views
  WHERE session_id = NEW.session_id
    AND created_at > now() - interval '1 minute';

  IF recent_count >= 60 THEN
    RAISE EXCEPTION 'page_views rate limit exceeded for this session';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_page_views_rate_limit ON public.page_views;
CREATE TRIGGER trg_page_views_rate_limit
BEFORE INSERT ON public.page_views
FOR EACH ROW EXECUTE FUNCTION public.enforce_page_views_rate_limit();

CREATE INDEX IF NOT EXISTS idx_visitor_activity_type_created
  ON public.visitor_activity (activity_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_activity_product_id
  ON public.visitor_activity (product_id);
