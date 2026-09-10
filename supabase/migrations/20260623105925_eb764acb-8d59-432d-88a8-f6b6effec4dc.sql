
-- SMS Providers table for multi-provider SMS support
CREATE TABLE public.sms_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name TEXT NOT NULL UNIQUE,
  api_url TEXT,
  api_key TEXT,
  sender_id TEXT,
  username TEXT,
  password TEXT,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_providers TO authenticated;
GRANT ALL ON public.sms_providers TO service_role;

ALTER TABLE public.sms_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage sms_providers"
  ON public.sms_providers
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER sms_providers_updated_at
  BEFORE UPDATE ON public.sms_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure only one provider is active at a time
CREATE OR REPLACE FUNCTION public.enforce_single_active_sms_provider()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active = TRUE THEN
    UPDATE public.sms_providers
       SET is_active = FALSE, updated_at = now()
     WHERE id <> NEW.id AND is_active = TRUE;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_single_active_sms_provider
  AFTER INSERT OR UPDATE OF is_active ON public.sms_providers
  FOR EACH ROW
  WHEN (NEW.is_active = TRUE)
  EXECUTE FUNCTION public.enforce_single_active_sms_provider();

-- Seed: MimSMS active, Automas inactive. Prefill MimSMS creds from existing store_settings.
INSERT INTO public.sms_providers (provider_name, username, api_key, sender_id, is_active)
SELECT
  'mimsms',
  (SELECT value FROM public.store_settings WHERE key = 'mimsms_username' LIMIT 1),
  (SELECT value FROM public.store_settings WHERE key = 'mimsms_api_key' LIMIT 1),
  (SELECT value FROM public.store_settings WHERE key = 'mimsms_sender_id' LIMIT 1),
  TRUE
ON CONFLICT (provider_name) DO NOTHING;

INSERT INTO public.sms_providers (provider_name, api_url, is_active)
VALUES ('automas', 'https://api.automas.com.bd/smsapiv4', FALSE)
ON CONFLICT (provider_name) DO NOTHING;
