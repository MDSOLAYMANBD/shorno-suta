-- ============================================================
-- Fix: the browser-side Google Ads Enhanced Conversions code
-- (src/hooks/useMarketingScripts.tsx -> initGoogleAdsGtag,
-- src/lib/ecommerceTracking.ts -> fireGoogleAdsConversion) reads
-- store_settings.google_ads_accounts via the public/anon client
-- (usePublicSettings -> useAllSettings, a plain unfiltered
-- `select('key,value')`). The actual gate is this RLS policy's
-- hardcoded key whitelist, added in migration 20260802142800 --
-- google_ads_accounts was never included, so the anon role's
-- SELECT silently returned zero rows for that key. The app code
-- has no error path for this (fireGoogleAdsConversion just no-ops
-- when window.gtag/_googleAdsAccounts are unset), so the gap was
-- invisible: the setting could be saved by an admin and verified
-- present in the table, while the live site never saw it and the
-- gtag conversion tag never loaded.
--
-- Fix: add 'google_ads_accounts' to the same whitelist array,
-- reproducing every existing entry from 20260802142800 unchanged.
-- google_ads_webhook_url is deliberately NOT added -- it's only
-- read server-side (track-conversion, via the service-role
-- client, unaffected by this RLS policy) and has no client-side
-- reader, so no reason to expose it publicly.
-- ============================================================

DROP POLICY IF EXISTS "Anyone can read settings" ON public.store_settings;
CREATE POLICY "Anyone can read settings" ON public.store_settings FOR SELECT USING (
  has_role((select auth.uid()), 'admin'::app_role) OR key = ANY (ARRAY[
    'gtm_id','facebook_pixel_id','helpline_number','store_name','store_name_bn',
    'navbar_config','homepage_config','footer_config','pages_config','invoice_config',
    'buttons_config','theme_config','whatsapp_number','messenger_link','chat_welcome_message',
    'captcha_enabled','turnstile_site_key','landing_page_defaults','pinterest_verification',
    'google_verification','facebook_domain_verification','meta_pixel_enabled',
    'payment_uddoktapay_enabled','payment_bkash_enabled','google_ads_accounts'
  ])
);
