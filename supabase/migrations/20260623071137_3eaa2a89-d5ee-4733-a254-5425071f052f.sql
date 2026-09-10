
-- 1) Harden store_settings public read: keep allowlist but defensively exclude
-- any key that looks like a credential, so future allowlist edits cannot leak secrets.
DROP POLICY IF EXISTS "Anyone can read settings" ON public.store_settings;
CREATE POLICY "Anyone can read settings"
ON public.store_settings
FOR SELECT
USING (
  has_role((SELECT auth.uid()), 'admin'::app_role)
  OR (
    key = ANY (ARRAY[
      'gtm_id','facebook_pixel_id','helpline_number','store_name','store_name_bn',
      'navbar_config','homepage_config','footer_config','pages_config','invoice_config',
      'buttons_config','theme_config','whatsapp_number','messenger_link',
      'chat_welcome_message','captcha_enabled','turnstile_site_key',
      'landing_page_defaults','pinterest_verification','google_verification',
      'facebook_domain_verification','meta_pixel_enabled'
    ])
    -- Defense-in-depth: never expose anything that looks like a credential,
    -- even if accidentally added to the allowlist above.
    AND key NOT ILIKE '%api_key%'
    AND key NOT ILIKE '%secret%'
    AND key NOT ILIKE '%password%'
    AND key NOT ILIKE '%access_token%'
    AND key NOT ILIKE '%refresh_token%'
    AND key NOT ILIKE '%private_key%'
    AND key NOT ILIKE '%app_secret%'
    AND key NOT ILIKE 'pathao_%'
    AND key NOT ILIKE 'redx_%'
    AND key NOT ILIKE 'steadfast_%'
    AND key NOT ILIKE 'uddoktapay_%'
    AND key NOT ILIKE 'meta_capi_%'
    AND key NOT ILIKE 'instagram_app_%'
    AND key NOT ILIKE 'meta_app_%'
    AND key NOT ILIKE 'openai_%'
    AND key NOT ILIKE 'gemini_%'
  )
);

-- 2) chat_calls: explicit staff-only INSERT policy. Visitor calls are created
-- via SECURITY DEFINER RPC `initiate_voice_call`, which bypasses RLS by design.
-- Adding this policy documents intent and prevents silent direct-insert failures
-- from being mistaken for a missing-policy bug.
DROP POLICY IF EXISTS "Staff can insert calls" ON public.chat_calls;
CREATE POLICY "Staff can insert calls"
ON public.chat_calls
FOR INSERT
TO authenticated
WITH CHECK (public.has_any_role(auth.uid()));
