
DROP POLICY "Public can read public settings" ON public.store_settings;
CREATE POLICY "Public can read public settings" ON public.store_settings
FOR SELECT USING (
  key = ANY (ARRAY[
    'gtm_id', 'facebook_pixel_id', 'helpline_number', 'store_name_bn', 'store_name',
    'whatsapp_number', 'messenger_link', 'captcha_enabled', 'turnstile_site_key',
    'navbar_config', 'homepage_config', 'footer_config', 'pages_config', 'invoice_config',
    'buttons_config'
  ])
);
