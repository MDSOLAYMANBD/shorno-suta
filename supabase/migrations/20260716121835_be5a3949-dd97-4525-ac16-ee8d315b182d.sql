-- 1. Order-level tracking context
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS ga_client_id text,
  ADD COLUMN IF NOT EXISTS ga_session_id text,
  ADD COLUMN IF NOT EXISTS fbp text,
  ADD COLUMN IF NOT EXISTS fbc text,
  ADD COLUMN IF NOT EXISTS gclid text,
  ADD COLUMN IF NOT EXISTS gbraid text,
  ADD COLUMN IF NOT EXISTS wbraid text,
  ADD COLUMN IF NOT EXISTS client_ip text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS event_source_url text,
  ADD COLUMN IF NOT EXISTS consent_snapshot jsonb;

-- 2. conversions_sent
CREATE TABLE IF NOT EXISTS public.conversions_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  channel text NOT NULL,
  stage text NOT NULL DEFAULT 'purchase',
  event_id text NOT NULL,
  event_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempt_count int NOT NULL DEFAULT 0,
  request_payload jsonb,
  response_body jsonb,
  error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversions_sent_uniq UNIQUE (order_id, channel, stage)
);
CREATE INDEX IF NOT EXISTS conversions_sent_order_idx
  ON public.conversions_sent(order_id);
CREATE INDEX IF NOT EXISTS conversions_sent_channel_stage_status_idx
  ON public.conversions_sent(channel, stage, status);
CREATE INDEX IF NOT EXISTS conversions_sent_sent_at_idx
  ON public.conversions_sent(sent_at DESC);

GRANT ALL ON public.conversions_sent TO service_role;
ALTER TABLE public.conversions_sent ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated; access via admin RPC only.

DROP TRIGGER IF EXISTS trg_conversions_sent_updated_at ON public.conversions_sent;
CREATE TRIGGER trg_conversions_sent_updated_at
  BEFORE UPDATE ON public.conversions_sent
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_conversions_sent(
  p_order_id uuid DEFAULT NULL,
  p_channel  text DEFAULT NULL,
  p_stage    text DEFAULT NULL,
  p_status   text DEFAULT NULL,
  p_limit    int  DEFAULT 200
) RETURNS SETOF public.conversions_sent
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'access denied';
  END IF;
  RETURN QUERY
  SELECT * FROM public.conversions_sent
  WHERE (p_order_id IS NULL OR order_id = p_order_id)
    AND (p_channel  IS NULL OR channel  = p_channel)
    AND (p_stage    IS NULL OR stage    = p_stage)
    AND (p_status   IS NULL OR status   = p_status)
  ORDER BY created_at DESC
  LIMIT LEAST(COALESCE(p_limit, 200), 1000);
END;
$$;

-- 3. tracking_consent_events
CREATE TABLE IF NOT EXISTS public.tracking_consent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text,
  user_id uuid,
  ad_storage text,
  analytics_storage text,
  ad_user_data text,
  ad_personalization text,
  source text,
  user_agent text,
  client_ip text,
  page_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tracking_consent_events_session_idx
  ON public.tracking_consent_events(session_id);
CREATE INDEX IF NOT EXISTS tracking_consent_events_created_idx
  ON public.tracking_consent_events(created_at DESC);

GRANT ALL ON public.tracking_consent_events TO service_role;
ALTER TABLE public.tracking_consent_events ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated; inserts flow through consent-log EF only.

CREATE OR REPLACE FUNCTION public.get_consent_events(
  p_limit int DEFAULT 200
) RETURNS SETOF public.tracking_consent_events
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'access denied';
  END IF;
  RETURN QUERY
  SELECT * FROM public.tracking_consent_events
  ORDER BY created_at DESC
  LIMIT LEAST(COALESCE(p_limit, 200), 1000);
END;
$$;

-- 4. Retention sweep
CREATE OR REPLACE FUNCTION public.tracking_retention_sweep()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pii_days  int := 30;
  conv_days int := 395;
BEGIN
  BEGIN
    SELECT COALESCE(NULLIF(value,'')::int, 30)
      INTO pii_days
      FROM public.store_settings WHERE key = 'tracking_pii_retention_days';
  EXCEPTION WHEN OTHERS THEN pii_days := 30;
  END;
  BEGIN
    SELECT COALESCE(NULLIF(value,'')::int, 395)
      INTO conv_days
      FROM public.store_settings WHERE key = 'tracking_conversion_retention_days';
  EXCEPTION WHEN OTHERS THEN conv_days := 395;
  END;

  UPDATE public.orders
     SET client_ip=NULL, user_agent=NULL, event_source_url=NULL,
         fbp=NULL, fbc=NULL, ga_client_id=NULL, ga_session_id=NULL,
         gclid=NULL, gbraid=NULL, wbraid=NULL, consent_snapshot=NULL
   WHERE created_at < now() - (pii_days || ' days')::interval
     AND (client_ip IS NOT NULL OR user_agent IS NOT NULL
          OR event_source_url IS NOT NULL OR fbp IS NOT NULL OR fbc IS NOT NULL
          OR ga_client_id IS NOT NULL OR ga_session_id IS NOT NULL
          OR gclid IS NOT NULL OR gbraid IS NOT NULL OR wbraid IS NOT NULL
          OR consent_snapshot IS NOT NULL);

  UPDATE public.conversions_sent
     SET response_body   = jsonb_build_object('purged', true),
         request_payload = jsonb_build_object('purged', true)
   WHERE created_at < now() - '90 days'::interval
     AND (response_body IS NOT NULL OR request_payload IS NOT NULL)
     AND COALESCE(response_body->>'purged','') <> 'true';

  DELETE FROM public.conversions_sent
   WHERE created_at < now() - (conv_days || ' days')::interval;
END;
$$;
