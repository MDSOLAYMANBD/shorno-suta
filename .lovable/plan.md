# Tracking Architecture — Final Plan (v3.1)

Revisions from v3 based on security feedback. All other sections unchanged.

## Changes vs v3

### A. `conversions_sent` access model — admin RLS only
- **Remove** `GRANT SELECT ... TO authenticated`.
- Grants restricted to `service_role` (edge functions) only.
- Admins read via a **`SECURITY DEFINER` RPC** (`get_conversions_sent`) that internally checks `has_role(auth.uid(),'admin')`. This keeps the table invisible to the anon/authenticated PostgREST surface entirely.
- Future Debug Dashboard will call this RPC, not query the table directly.

### B. PII policy for `request_payload`
- `request_payload` stores **only hashed identifiers**: `em_sha256`, `ph_sha256`, `fn_sha256`, `ln_sha256`, `zp_sha256`, plus non-PII fields (transaction id, value, currency, item ids, event_source_url).
- Never store: raw email, raw phone, raw name, raw address, plaintext IP, plaintext UA.
- Edge function `track-conversion` enforces this with a whitelist helper (`redactForLog`) — writes to `conversions_sent` go through this helper only.
- **Additionally on `orders`:** `client_ip` and `user_agent` are still captured (needed for CAPI/Ads calls) but treated as short-retention PII (see C).

### C. Retention strategy for order-level tracking context
- New scheduled cleanup (Supabase `pg_cron` or a nightly EF `tracking-retention-sweep`) runs daily and:
  - After **30 days** from `orders.created_at`: NULLs `client_ip`, `user_agent`, `event_source_url`, `fbp`, `fbc`, `ga_client_id`, `ga_session_id`, `gclid`, `gbraid`, `wbraid`, `consent_snapshot`.
  - `conversions_sent.response_body` older than **90 days**: replaced with `{ "purged": true }` (retain status + event_id for reporting).
  - `conversions_sent` rows older than **13 months**: hard-deleted.
- Retention lengths stored in `store_settings` (`tracking_pii_retention_days=30`, `tracking_conversion_retention_days=395`) so the merchant can shorten/lengthen without a code change.
- Cron scheduling done via a helper SQL function (`schedule_tracking_retention()`) invoked in the migration; if `pg_cron` isn't enabled, a comment in the migration tells us to enable it and the sweep function can also be triggered by a Vercel cron pinging an EF.

### D. `tracking_consent_events` — no direct anonymous INSERT
- **Remove** the anon/authenticated INSERT grant and policy.
- Grants: `SELECT` implicit (none — admins go via RPC); `INSERT` to `service_role` only.
- New edge function **`consent-log`** accepts `{ ad_storage, analytics_storage, ad_user_data, ad_personalization, source, page_url }`:
  - Zod-validates values are in `granted|denied`.
  - Rate limits per-IP (60/hour) similarly to `meta-capi`.
  - Enriches with server-side `client_ip` and `user_agent`.
  - Inserts using service role.
- Frontend `updateConsent` in `src/lib/consent.ts` calls this EF via `supabase.functions.invoke('consent-log', …)` in a fire-and-forget manner.
- A `SECURITY DEFINER` RPC `get_consent_events` gates admin reads.

## Updated migration (what will be executed)

```sql
-- 1. Order-level tracking context (unchanged from v3)
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

-- 2. conversions_sent — service_role only + admin RPC
CREATE TABLE public.conversions_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  channel text NOT NULL,
  stage text NOT NULL DEFAULT 'purchase',
  event_id text NOT NULL,
  event_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempt_count int NOT NULL DEFAULT 0,
  request_payload jsonb,   -- hashed identifiers only, enforced in EF
  response_body jsonb,
  error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversions_sent_uniq UNIQUE (order_id, channel, stage)
);
CREATE INDEX conversions_sent_order_idx        ON public.conversions_sent(order_id);
CREATE INDEX conversions_sent_channel_stage_status_idx
  ON public.conversions_sent(channel, stage, status);
CREATE INDEX conversions_sent_sent_at_idx      ON public.conversions_sent(sent_at DESC);

GRANT ALL ON public.conversions_sent TO service_role;   -- NO authenticated/anon
ALTER TABLE public.conversions_sent ENABLE ROW LEVEL SECURITY;
-- No SELECT policy for authenticated — reads go through RPC only.

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
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
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

-- 3. tracking_consent_events — service_role only + admin RPC
CREATE TABLE public.tracking_consent_events (
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
CREATE INDEX tracking_consent_events_session_idx ON public.tracking_consent_events(session_id);
CREATE INDEX tracking_consent_events_created_idx ON public.tracking_consent_events(created_at DESC);

GRANT ALL ON public.tracking_consent_events TO service_role;   -- NO anon/authenticated
ALTER TABLE public.tracking_consent_events ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated — insert flows through consent-log EF only.

CREATE OR REPLACE FUNCTION public.get_consent_events(
  p_limit int DEFAULT 200
) RETURNS SETOF public.tracking_consent_events
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'access denied';
  END IF;
  RETURN QUERY
  SELECT * FROM public.tracking_consent_events
  ORDER BY created_at DESC
  LIMIT LEAST(COALESCE(p_limit, 200), 1000);
END;
$$;

-- 4. Retention sweep — daily; PII on orders and old response bodies purged
CREATE OR REPLACE FUNCTION public.tracking_retention_sweep()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pii_days     int := 30;
  conv_days    int := 395;   -- ~13 months
BEGIN
  SELECT COALESCE(NULLIF(value,'')::int, 30)
    INTO pii_days
    FROM public.store_settings WHERE key = 'tracking_pii_retention_days';
  SELECT COALESCE(NULLIF(value,'')::int, 395)
    INTO conv_days
    FROM public.store_settings WHERE key = 'tracking_conversion_retention_days';

  UPDATE public.orders
     SET client_ip=NULL, user_agent=NULL, event_source_url=NULL,
         fbp=NULL, fbc=NULL, ga_client_id=NULL, ga_session_id=NULL,
         gclid=NULL, gbraid=NULL, wbraid=NULL, consent_snapshot=NULL
   WHERE created_at < now() - (pii_days || ' days')::interval
     AND (client_ip IS NOT NULL OR user_agent IS NOT NULL
          OR event_source_url IS NOT NULL OR fbp IS NOT NULL OR fbc IS NOT NULL);

  UPDATE public.conversions_sent
     SET response_body = jsonb_build_object('purged', true),
         request_payload = jsonb_build_object('purged', true)
   WHERE created_at < now() - '90 days'::interval
     AND (response_body IS NOT NULL OR request_payload IS NOT NULL)
     AND response_body::text <> '{"purged": true}';

  DELETE FROM public.conversions_sent
   WHERE created_at < now() - (conv_days || ' days')::interval;
END;
$$;
```

Scheduling: `pg_cron` (`SELECT cron.schedule('tracking-retention-sweep','30 3 * * *', $$select public.tracking_retention_sweep()$$)`) if the extension is available; otherwise a Vercel cron hits an EF wrapper.

## Updated EF list (P0)

1. `track-conversion` — dispatcher (Meta CAPI + GA4 MP + Google Ads server stub). Uses `redactForLog` before writing to `conversions_sent`.
2. `consent-log` — validated, rate-limited server insert into `tracking_consent_events`.
3. (Optional) `tracking-retention-sweep` — thin EF wrapper for Vercel cron if `pg_cron` unavailable.

## Updated deliverables checklist (P0)

- [ ] Migration (above): orders columns + `conversions_sent` (service_role only) + `tracking_consent_events` (service_role only) + retention SQL function + admin RPCs.
- [ ] `store_settings` seed keys: `tracking_pii_retention_days=30`, `tracking_conversion_retention_days=395`.
- [ ] EF `track-conversion` (with `redactForLog`).
- [ ] EF `consent-log` (validated + rate-limited).
- [ ] `place-order` — persist context + invoke `track-conversion`.
- [ ] `src/lib/trackingIds.ts`, `src/lib/consent.ts`, `src/lib/consentBoot.ts`.
- [ ] Google Ads gtag + Enhanced Conversions in `useMarketingScripts` + `trackPurchase`.
- [ ] `docs/tracking-architecture.md`.

All other sections of the v3 plan (event matrix, dedup keys, Consent Mode v2 defaults, phased rollout P0→P4, offline-conversion extensibility, diagram) remain as approved.
