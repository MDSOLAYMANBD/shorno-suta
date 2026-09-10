-- Add theme_config to public read whitelist for store_settings
-- First check if existing policy needs updating
DO $$
BEGIN
  -- Drop existing public read policy if it exists, then recreate with theme_config included
  DROP POLICY IF EXISTS "Public can read whitelisted settings" ON public.store_settings;
  
  CREATE POLICY "Public can read whitelisted settings"
    ON public.store_settings
    FOR SELECT
    USING (
      key IN (
        'gtm_id', 'facebook_pixel_id', 'helpline_number', 'store_name',
        'store_name_bn', 'navbar_config', 'homepage_config', 'footer_config',
        'pages_config', 'invoice_config', 'buttons_config', 'theme_config',
        'whatsapp_number', 'messenger_link', 'chat_welcome_message',
        'captcha_enabled', 'turnstile_site_key'
      )
      OR auth.uid() IS NOT NULL
    );
END $$;