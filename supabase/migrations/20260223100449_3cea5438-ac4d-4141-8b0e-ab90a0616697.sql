-- Fix: Remove the overly permissive "Public can read whitelisted settings" policy
-- that allows ANY authenticated user to read ALL store_settings (including API keys)
DROP POLICY IF EXISTS "Public can read whitelisted settings" ON public.store_settings;

-- Re-create it WITHOUT the dangerous OR clause - only whitelisted keys for public
CREATE POLICY "Public can read whitelisted settings"
ON public.store_settings FOR SELECT
USING (
  key = ANY (ARRAY[
    'gtm_id','facebook_pixel_id','helpline_number','store_name','store_name_bn',
    'navbar_config','homepage_config','footer_config','pages_config','invoice_config',
    'buttons_config','theme_config','whatsapp_number','messenger_link',
    'chat_welcome_message','captcha_enabled','turnstile_site_key',
    'landing_page_defaults'
  ])
);