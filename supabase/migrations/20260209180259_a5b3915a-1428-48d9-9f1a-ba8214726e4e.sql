
-- Update public read policy to include more settings keys
DROP POLICY IF EXISTS "Public can read marketing settings" ON public.store_settings;

CREATE POLICY "Public can read public settings"
ON public.store_settings
FOR SELECT
USING (key = ANY (ARRAY[
  'gtm_id',
  'facebook_pixel_id',
  'helpline_number',
  'store_name_bn',
  'store_name',
  'whatsapp_number',
  'messenger_link'
]));
