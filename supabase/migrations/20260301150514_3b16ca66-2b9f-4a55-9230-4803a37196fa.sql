
-- Update the public whitelist RLS policy to include verification keys
DROP POLICY IF EXISTS "Public can read whitelisted settings" ON public.store_settings;

CREATE POLICY "Public can read whitelisted settings"
ON public.store_settings
FOR SELECT
USING (
  key = ANY (ARRAY[
    'gtm_id','facebook_pixel_id','helpline_number','store_name','store_name_bn',
    'navbar_config','homepage_config','footer_config','pages_config','invoice_config',
    'buttons_config','theme_config','whatsapp_number','messenger_link',
    'chat_welcome_message','captcha_enabled','turnstile_site_key','landing_page_defaults',
    'pinterest_verification','google_verification','facebook_domain_verification',
    'meta_pixel_enabled'
  ])
);
