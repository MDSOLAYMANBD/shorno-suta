CREATE TABLE public.site_visits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id text NOT NULL,
  page_path text DEFAULT '/',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_site_visits_created ON site_visits(created_at);
CREATE UNIQUE INDEX idx_site_visits_session ON site_visits(session_id);
ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert visits" ON public.site_visits FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can read visits" ON public.site_visits FOR SELECT USING (public.has_any_role(auth.uid()));