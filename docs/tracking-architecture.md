# Tracking Architecture — v3.1 (Implemented)

## Overview

Server-authoritative conversion tracking with Supabase as the single source of
truth for completed purchases. The browser fires deduplication signals
(GA4/Meta Pixel), and the server mirrors every purchase to Meta CAPI, GA4
Measurement Protocol, and Google Ads offline conversions.

## Data flow

```
Browser (Pixel/gtag + Consent Mode v2)
   │  buildTrackingContext(): _ga, _fbp, gclid, fbc, consent snapshot
   ▼
place-order (Edge Function)
   │  writes trackingCols → orders row
   │  invokes track-conversion (fire-and-forget)
   ▼
track-conversion (Edge Function)
   ├─► Meta CAPI            → conversions_sent (channel=meta)
   ├─► GA4 Measurement Protocol → conversions_sent (channel=ga4)
   └─► Google Ads (offline) → conversions_sent (channel=google_ads)
```

## Storage

- `orders` (new columns): `ga_client_id`, `ga_session_id`, `fbp`, `fbc`,
  `gclid`, `gbraid`, `wbraid`, `client_ip`, `user_agent`, `event_source_url`,
  `consent_snapshot`. Automatically nulled after 30 days by
  `cron.job: purge_tracking_context` — only hashed identifiers survive there.
- `conversions_sent`: admin-only via RLS + SECURITY DEFINER RPC
  `get_conversions_sent`. `request_payload` is **hashed-only**; the server
  redacts every raw PII field (email, phone, name, IP, UA…) before insert via
  `redactForLog()` in `track-conversion`.
- `tracking_consent_events`: no anon/authenticated policies. All writes flow
  through `consent-log` EF which rate-limits and validates keys.

## Consent Mode v2

- Defaults pushed via `src/lib/consentBoot.ts` (imported first thing in
  `main.tsx`) so no tag fires with unknown consent state.
- `updateConsent()` in `src/lib/consent.ts` updates `gtag('consent','update')`,
  persists to `localStorage`, and mirrors to the `consent-log` EF.
- Server-side dispatchers respect `orders.consent_snapshot`:
  - `analytics_storage=denied` → skip GA4 MP.
  - `ad_storage=denied` → skip Meta CAPI + Google Ads.

## Settings (store_settings keys)

| Key | Purpose |
| --- | --- |
| `facebook_pixel_id`, `meta_capi_access_token`, `meta_capi_enabled`, `meta_test_event_code` | Meta CAPI |
| `ga4_measurement_id`, `ga4_api_secret` | GA4 Measurement Protocol |
| `google_ads_conversion_id`, `google_ads_conversion_label`, `google_ads_webhook_url` | Google Ads offline (webhook is optional, otherwise recorded as `pending`) |

## Deduplication

- Meta: `event_id = purchase_${order_number}` matches the browser Pixel event.
- GA4: `transaction_id = order_number` matches the browser purchase event.
- Google Ads: `conversion_id = purchase_${order_number}` prevents double-count.

## Future work

- Additional stages: `track-conversion` accepts `stage` parameter
  (`confirmed`, `shipped`, `delivered`, `cancelled`, `returned`). Hook these
  into `orders` status triggers to send Meta CAPI custom events and Google Ads
  offline conversion adjustments.
- Cookie banner UI → call `updateConsent({...})`.
