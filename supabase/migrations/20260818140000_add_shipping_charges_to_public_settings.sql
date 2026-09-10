-- ============================================================
-- Same class of bug as 20260809170000 (google_ads_accounts): the
-- browser-side shipping-charge hook (src/hooks/useShippingCharges.ts
-- -> useAllSettings, a plain unfiltered `select('key,value')` via the
-- public/anon client) reads store_settings.shipping_dhaka_inside/
-- _suburb/_outside and the legacy delivery_charge_*_dhaka mirrors.
-- The actual gate is this RLS policy's hardcoded key whitelist --
-- none of these 6 keys were ever included, so the anon role's SELECT
-- silently returned zero rows for them. useShippingCharges() has a
-- built-in numeric fallback (SHIPPING_DEFAULTS = 70/100/130) for
-- exactly this "value missing" case, so the gap was invisible: an
-- admin could save a new rate in Admin Settings -> Shipping Charges,
-- verify it present in the table, and every customer browser would
-- still silently render the old hardcoded fallback on Checkout,
-- QuickOrder, ManualOrder, GiveawayOrder, and every landing page --
-- site-wide, not limited to any one page.
--
-- Fix: add the 6 shipping/delivery_charge keys to the same whitelist
-- array, reproducing every existing entry from 20260809170000
-- unchanged.
-- ============================================================

DROP POLICY IF EXISTS "Anyone can read settings" ON public.store_settings;
CREATE POLICY "Anyone can read settings" ON public.store_settings FOR SELECT USING (
  has_role((select auth.uid()), 'admin'::app_role) OR key = ANY (ARRAY[
    'gtm_id','facebook_pixel_id','helpline_number','store_name','store_name_bn',
    'navbar_config','homepage_config','footer_config','pages_config','invoice_config',
    'buttons_config','theme_config','whatsapp_number','messenger_link','chat_welcome_message',
    'captcha_enabled','turnstile_site_key','landing_page_defaults','pinterest_verification',
    'google_verification','facebook_domain_verification','meta_pixel_enabled',
    'payment_uddoktapay_enabled','payment_bkash_enabled','google_ads_accounts',
    'shipping_dhaka_inside','shipping_dhaka_suburb','shipping_dhaka_outside',
    'delivery_charge_inside_dhaka','delivery_charge_dhaka_suburb','delivery_charge_outside_dhaka'
  ])
);
