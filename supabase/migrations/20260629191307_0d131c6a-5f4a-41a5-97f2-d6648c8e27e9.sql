
-- =====================================================================
-- SMS Short-Link Tracking & Analytics — final, fully idempotent
-- =====================================================================

-- ---------- 1. ADDITIVE COLUMNS -------------------------------------

ALTER TABLE public.sms_campaigns
  ADD COLUMN IF NOT EXISTS final_body text,
  ADD COLUMN IF NOT EXISTS short_link_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS snapshot jsonb,
  ADD COLUMN IF NOT EXISTS first_click_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_order_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_order_at timestamptz,
  ADD COLUMN IF NOT EXISTS parent_campaign_id uuid REFERENCES public.sms_campaigns(id) ON DELETE SET NULL;

ALTER TABLE public.sms_campaign_recipients
  ADD COLUMN IF NOT EXISTS order_id uuid,
  ADD COLUMN IF NOT EXISTS final_message text,
  ADD COLUMN IF NOT EXISTS click_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS click_status text NOT NULL DEFAULT 'not_clicked';

CREATE INDEX IF NOT EXISTS idx_sms_campaigns_archived_at ON public.sms_campaigns(archived_at);
CREATE INDEX IF NOT EXISTS idx_sms_campaigns_parent ON public.sms_campaigns(parent_campaign_id);
CREATE INDEX IF NOT EXISTS idx_sms_campaign_recipients_order ON public.sms_campaign_recipients(order_id);

-- ---------- 2. sms_short_links --------------------------------------

CREATE TABLE IF NOT EXISTS public.sms_short_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  campaign_id uuid NOT NULL REFERENCES public.sms_campaigns(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES public.sms_campaign_recipients(id) ON DELETE SET NULL,
  original_url text NOT NULL,
  expires_at timestamptz,
  click_count int NOT NULL DEFAULT 0,
  unique_click_count int NOT NULL DEFAULT 0,
  first_clicked_at timestamptz,
  last_clicked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_short_links TO authenticated;
GRANT ALL ON public.sms_short_links TO service_role;

ALTER TABLE public.sms_short_links ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sms_short_links_campaign_recipient_url
  ON public.sms_short_links(campaign_id, COALESCE(recipient_id, '00000000-0000-0000-0000-000000000000'::uuid), original_url);
CREATE INDEX IF NOT EXISTS idx_sms_short_links_campaign ON public.sms_short_links(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sms_short_links_recipient ON public.sms_short_links(recipient_id);

DROP POLICY IF EXISTS "staff_read_short_links" ON public.sms_short_links;
CREATE POLICY "staff_read_short_links" ON public.sms_short_links FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid()));
DROP POLICY IF EXISTS "staff_write_short_links" ON public.sms_short_links;
CREATE POLICY "staff_write_short_links" ON public.sms_short_links FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid())) WITH CHECK (public.has_any_role(auth.uid()));

-- ---------- 3. sms_short_link_clicks --------------------------------

CREATE TABLE IF NOT EXISTS public.sms_short_link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  short_link_id uuid NOT NULL REFERENCES public.sms_short_links(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL,
  recipient_id uuid,
  phone text,
  click_key text,
  is_unique boolean NOT NULL DEFAULT false,
  ip text,
  user_agent text,
  referer text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sms_short_link_clicks TO authenticated;
GRANT ALL ON public.sms_short_link_clicks TO service_role;

ALTER TABLE public.sms_short_link_clicks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sms_clicks_campaign ON public.sms_short_link_clicks(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sms_clicks_link_key ON public.sms_short_link_clicks(short_link_id, click_key);
CREATE INDEX IF NOT EXISTS idx_sms_clicks_phone_created ON public.sms_short_link_clicks(phone, created_at);

DROP POLICY IF EXISTS "staff_read_clicks" ON public.sms_short_link_clicks;
CREATE POLICY "staff_read_clicks" ON public.sms_short_link_clicks FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid()));
DROP POLICY IF EXISTS "service_write_clicks" ON public.sms_short_link_clicks;
CREATE POLICY "service_write_clicks" ON public.sms_short_link_clicks FOR INSERT TO service_role
  WITH CHECK (true);

-- ---------- 4. PHONE NORMALIZATION ----------------------------------

CREATE OR REPLACE FUNCTION public._sms_phone_variants(p_phone text)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_clean text;
BEGIN
  IF p_phone IS NULL OR trim(p_phone) = '' THEN RETURN ARRAY[]::text[]; END IF;
  v_clean := regexp_replace(p_phone, '[^0-9]', '', 'g');
  IF v_clean LIKE '88%' AND length(v_clean) > 11 THEN
    v_clean := substr(v_clean, 3);
  END IF;
  IF length(v_clean) = 10 AND left(v_clean, 1) = '1' THEN
    v_clean := '0' || v_clean;
  END IF;
  IF length(v_clean) < 11 THEN RETURN ARRAY[p_phone]; END IF;
  RETURN ARRAY[v_clean, '88' || v_clean, '+88' || v_clean, p_phone];
END $$;

-- ---------- 5. TOKEN GENERATION (Base62, configurable) --------------

CREATE OR REPLACE FUNCTION public._sms_gen_token(p_len int DEFAULT 8)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  alphabet text := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result text := '';
  i int;
BEGIN
  FOR i IN 1..GREATEST(p_len, 4) LOOP
    result := result || substr(alphabet, 1 + floor(random() * 62)::int, 1);
  END LOOP;
  RETURN result;
END $$;

-- ---------- 6. REGISTER SHORT LINK ----------------------------------

CREATE OR REPLACE FUNCTION public.sms_register_short_link(
  p_campaign_id uuid,
  p_recipient_id uuid,
  p_original_url text,
  p_expires_at timestamptz DEFAULT NULL,
  p_force_new boolean DEFAULT false
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_existing text;
  v_url text;
  v_attempt int := 0;
  v_len int := 8;
  v_len_setting text;
BEGIN
  IF NOT public.has_any_role(auth.uid()) AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'access denied';
  END IF;

  SELECT value INTO v_len_setting FROM public.store_settings WHERE key = 'sms_short_link_token_length' LIMIT 1;
  v_len := GREATEST(COALESCE(NULLIF(v_len_setting, '')::int, 8), 6);

  v_url := p_original_url;
  IF p_force_new THEN
    v_url := p_original_url || '#r=' || public._sms_gen_token(4);
  ELSE
    SELECT token INTO v_existing
    FROM public.sms_short_links
    WHERE campaign_id = p_campaign_id
      AND COALESCE(recipient_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = COALESCE(p_recipient_id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND original_url = v_url
    LIMIT 1;
    IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  END IF;

  LOOP
    v_attempt := v_attempt + 1;
    v_token := public._sms_gen_token(v_len + LEAST(v_attempt / 5, 4));
    BEGIN
      INSERT INTO public.sms_short_links (token, campaign_id, recipient_id, original_url, expires_at)
      VALUES (v_token, p_campaign_id, p_recipient_id, v_url, p_expires_at);
      RETURN v_token;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt > 25 THEN RAISE; END IF;
    END;
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.sms_register_short_link(uuid, uuid, text, timestamptz, boolean) TO authenticated, service_role;

-- ---------- 7. RECORD CLICK (public) --------------------------------

CREATE OR REPLACE FUNCTION public.sms_record_click(
  p_token text,
  p_click_key text,
  p_ip text DEFAULT NULL,
  p_ua text DEFAULT NULL,
  p_referer text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link record;
  v_is_unique boolean := false;
  v_phone text;
  v_now timestamptz := now();
  v_target text;
BEGIN
  SELECT * INTO v_link FROM public.sms_short_links WHERE token = p_token LIMIT 1;
  IF v_link.id IS NULL THEN RETURN jsonb_build_object('error', 'not_found'); END IF;

  IF v_link.expires_at IS NOT NULL AND v_link.expires_at < v_now THEN
    RETURN jsonb_build_object('expired', true, 'campaign_id', v_link.campaign_id);
  END IF;

  SELECT phone INTO v_phone FROM public.sms_campaign_recipients WHERE id = v_link.recipient_id LIMIT 1;

  IF p_click_key IS NOT NULL AND p_click_key <> '' THEN
    SELECT NOT EXISTS (
      SELECT 1 FROM public.sms_short_link_clicks
      WHERE short_link_id = v_link.id AND click_key = p_click_key
    ) INTO v_is_unique;
  END IF;

  INSERT INTO public.sms_short_link_clicks
    (short_link_id, campaign_id, recipient_id, phone, click_key, is_unique, ip, user_agent, referer)
  VALUES
    (v_link.id, v_link.campaign_id, v_link.recipient_id, v_phone, p_click_key, v_is_unique, p_ip, p_ua, p_referer);

  UPDATE public.sms_short_links
    SET click_count = click_count + 1,
        unique_click_count = unique_click_count + CASE WHEN v_is_unique THEN 1 ELSE 0 END,
        first_clicked_at = COALESCE(first_clicked_at, v_now),
        last_clicked_at = v_now
   WHERE id = v_link.id;

  IF v_link.recipient_id IS NOT NULL THEN
    UPDATE public.sms_campaign_recipients
      SET click_count = click_count + 1,
          last_clicked_at = v_now,
          click_status = CASE
            WHEN click_status = 'ordered' THEN 'ordered'
            WHEN click_count + 1 >= 2 THEN 'clicked_multiple'
            ELSE 'clicked_once'
          END
     WHERE id = v_link.recipient_id;
  END IF;

  UPDATE public.sms_campaigns SET first_click_at = COALESCE(first_click_at, v_now) WHERE id = v_link.campaign_id;

  v_target := regexp_replace(v_link.original_url, '#r=[A-Za-z0-9]+$', '');

  RETURN jsonb_build_object(
    'target_url', v_target,
    'campaign_id', v_link.campaign_id,
    'recipient_id', v_link.recipient_id
  );
END $$;

GRANT EXECUTE ON FUNCTION public.sms_record_click(text, text, text, text, text) TO anon, authenticated, service_role;

-- ---------- 8. LINK ORDER FROM CLICKS (phone normalized) ------------

CREATE OR REPLACE FUNCTION public.sms_link_order_from_clicks(
  p_order_id uuid,
  p_phone text,
  p_click_keys text[]
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_linked int := 0;
  v_now timestamptz := now();
  v_phones text[] := public._sms_phone_variants(p_phone);
BEGIN
  WITH matched AS (
    SELECT DISTINCT r.id AS recipient_id, r.campaign_id
    FROM public.sms_campaign_recipients r
    LEFT JOIN public.sms_short_link_clicks c ON c.recipient_id = r.id
    WHERE r.order_id IS NULL
      AND (
        (p_click_keys IS NOT NULL AND array_length(p_click_keys, 1) > 0 AND c.click_key = ANY(p_click_keys))
        OR (array_length(v_phones, 1) > 0 AND r.phone = ANY(v_phones))
      )
  ), upd AS (
    UPDATE public.sms_campaign_recipients r
       SET order_id = p_order_id,
           click_status = 'ordered'
      FROM matched m
     WHERE r.id = m.recipient_id AND r.order_id IS NULL
    RETURNING m.campaign_id
  )
  SELECT count(*) INTO v_linked FROM upd;

  IF v_linked > 0 THEN
    UPDATE public.sms_campaigns
       SET first_order_at = COALESCE(first_order_at, v_now),
           last_order_at  = v_now
     WHERE id IN (SELECT DISTINCT campaign_id FROM public.sms_campaign_recipients WHERE order_id = p_order_id);
  END IF;

  RETURN v_linked;
END $$;

GRANT EXECUTE ON FUNCTION public.sms_link_order_from_clicks(uuid, text, text[]) TO anon, authenticated, service_role;

-- ---------- 9. CAMPAIGN REPORT (CTR, repeat clicks, AOV, snapshot) --

CREATE OR REPLACE FUNCTION public.sms_campaign_report(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_camp record;
  v_kpi jsonb;
  v_links jsonb;
  v_sent int;
  v_delivered int;
  v_clicks int;
  v_unique_clickers int;
  v_repeat_clicks int;
  v_orders int;
  v_revenue numeric;
  v_aov numeric;
  v_ctr numeric;
  v_conv numeric;
BEGIN
  IF NOT public.has_any_role(auth.uid()) THEN RAISE EXCEPTION 'access denied'; END IF;

  SELECT * INTO v_camp FROM public.sms_campaigns WHERE id = p_campaign_id;
  IF v_camp.id IS NULL THEN RETURN jsonb_build_object('error', 'not_found'); END IF;

  SELECT
    COUNT(*) FILTER (WHERE r.status IN ('sent','delivered')),
    COUNT(*) FILTER (WHERE r.status = 'delivered'),
    COALESCE(SUM(r.click_count), 0),
    COUNT(*) FILTER (WHERE r.click_count > 0),
    COALESCE(SUM(GREATEST(r.click_count - 1, 0)), 0),
    COUNT(*) FILTER (WHERE r.order_id IS NOT NULL),
    COALESCE(SUM(o.total) FILTER (
      WHERE r.order_id IS NOT NULL
        AND o.status IN ('delivered','office_sell')
        AND o.deleted_at IS NULL
    ), 0)
  INTO v_sent, v_delivered, v_clicks, v_unique_clickers, v_repeat_clicks, v_orders, v_revenue
  FROM public.sms_campaign_recipients r
  LEFT JOIN public.orders o ON o.id = r.order_id
  WHERE r.campaign_id = p_campaign_id;

  v_ctr  := CASE WHEN v_sent > 0 THEN ROUND(v_unique_clickers::numeric / v_sent * 100, 2) ELSE 0 END;
  v_conv := CASE WHEN v_unique_clickers > 0 THEN ROUND(v_orders::numeric / v_unique_clickers * 100, 2) ELSE 0 END;
  v_aov  := CASE WHEN v_orders > 0 THEN ROUND(v_revenue / v_orders, 2) ELSE 0 END;

  v_kpi := jsonb_build_object(
    'sent',           v_sent,
    'delivered',      v_delivered,
    'clicks',         v_clicks,
    'unique_clicks',  v_unique_clickers,
    'repeat_clicks',  v_repeat_clicks,
    'orders',         v_orders,
    'revenue',        v_revenue,
    'aov',            v_aov,
    'ctr_pct',        v_ctr,
    'conversion_pct', v_conv
  );

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'short_link_id', sl.id,
    'token', sl.token,
    'original_url', regexp_replace(sl.original_url, '#r=[A-Za-z0-9]+$', ''),
    'clicks', sl.click_count,
    'unique_clicks', sl.unique_click_count,
    'created_at', sl.created_at
  ) ORDER BY sl.click_count DESC), '[]'::jsonb) INTO v_links
  FROM public.sms_short_links sl
  WHERE sl.campaign_id = p_campaign_id;

  -- Snapshot-first: prefer saved snapshot metadata; live KPIs always returned.
  RETURN jsonb_build_object(
    'kpi', v_kpi,
    'links', v_links,
    'snapshot', v_camp.snapshot,
    'source', CASE WHEN v_camp.snapshot IS NOT NULL THEN 'snapshot' ELSE 'live' END
  );
END $$;

GRANT EXECUTE ON FUNCTION public.sms_campaign_report(uuid) TO authenticated, service_role;

-- ---------- 10. FOLLOW-UP AUDIENCE ----------------------------------

CREATE OR REPLACE FUNCTION public.sms_followup_audience_phones(
  p_campaign_id uuid,
  p_behavior text
) RETURNS SETOF text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_any_role(auth.uid()) THEN RAISE EXCEPTION 'access denied'; END IF;

  RETURN QUERY
  SELECT DISTINCT r.phone
  FROM public.sms_campaign_recipients r
  WHERE r.campaign_id = p_campaign_id
    AND r.phone IS NOT NULL
    AND CASE p_behavior
      WHEN 'not_clicked'      THEN r.click_count = 0
      WHEN 'clicked_no_order' THEN r.click_count > 0 AND r.order_id IS NULL
      WHEN 'ordered'          THEN r.order_id IS NOT NULL
      WHEN 'multi_clicked'    THEN r.click_count > 1
      ELSE false
    END;
END $$;

GRANT EXECUTE ON FUNCTION public.sms_followup_audience_phones(uuid, text) TO authenticated, service_role;

-- ---------- 11. DUPLICATE CAMPAIGN ----------------------------------

CREATE OR REPLACE FUNCTION public.sms_duplicate_campaign(p_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_id uuid;
BEGIN
  IF NOT public.has_any_role(auth.uid()) THEN RAISE EXCEPTION 'access denied'; END IF;

  INSERT INTO public.sms_campaigns (
    name, body, audience_filter, audience_filters, audience_id,
    sender_name, template_name, short_link_expires_at,
    parent_campaign_id, status, audience_size
  )
  SELECT
    name || ' (Copy)', body, audience_filter, audience_filters, audience_id,
    sender_name, template_name, short_link_expires_at,
    id, 'draft', 0
  FROM public.sms_campaigns
  WHERE id = p_id
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END $$;

GRANT EXECUTE ON FUNCTION public.sms_duplicate_campaign(uuid) TO authenticated, service_role;

-- ---------- 12. SHORT-LINK HEALTH -----------------------------------

CREATE OR REPLACE FUNCTION public.sms_short_link_health()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v jsonb;
BEGIN
  IF NOT public.has_any_role(auth.uid()) THEN RAISE EXCEPTION 'access denied'; END IF;
  SELECT jsonb_build_object(
    'total',         COUNT(*),
    'active',        COUNT(*) FILTER (WHERE expires_at IS NULL OR expires_at > now()),
    'expired',       COUNT(*) FILTER (WHERE expires_at IS NOT NULL AND expires_at <= now()),
    'with_clicks',   COUNT(*) FILTER (WHERE click_count > 0),
    'never_clicked', COUNT(*) FILTER (WHERE click_count = 0)
  ) INTO v FROM public.sms_short_links;
  RETURN v;
END $$;

GRANT EXECUTE ON FUNCTION public.sms_short_link_health() TO authenticated, service_role;

-- ---------- 13. DEFAULT SETTINGS (idempotent) -----------------------

INSERT INTO public.store_settings (key, value) VALUES
  ('sms_short_link_base', 'https://shorno-suta.vercel.app/s'),
  ('sms_short_link_default_expiry_days', '30'),
  ('sms_short_link_enabled', 'true'),
  ('sms_click_tracking_enabled', 'true'),
  ('sms_order_tracking_enabled', 'true'),
  ('sms_short_link_token_length', '8')
ON CONFLICT (key) DO NOTHING;
