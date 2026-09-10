-- ============================================================
-- Add bKash payment gateway support (additive only).
-- Does NOT touch orders.payment_invoice_id semantics for
-- UddoktaPay, does NOT touch acc_transactions/acc_accounts,
-- does NOT touch any existing store_settings row or policy
-- beyond appending two new whitelisted keys.
-- ============================================================

-- 1. orders.paid_at — timestamp of a verified/confirmed payment.
--    Nullable, no default, no impact on existing rows/queries.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- 2. payment_transactions — per-gateway payment audit log AND the
--    idempotency mechanism (UNIQUE(gateway, gateway_payment_id)).
--    Used by bKash (and future gateways) only; UddoktaPay's existing
--    flow does not write to this table.
CREATE TABLE public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway text NOT NULL,
  gateway_payment_id text NOT NULL,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'initiated'
    CHECK (status IN ('initiated', 'processing', 'paid', 'failed', 'cancelled')),
  amount numeric,
  transaction_id text,
  gateway_response jsonb,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_transactions_gateway_payment_uniq UNIQUE (gateway, gateway_payment_id)
);

CREATE INDEX payment_transactions_order_idx ON public.payment_transactions(order_id);
CREATE INDEX payment_transactions_status_idx ON public.payment_transactions(gateway, status);

CREATE TRIGGER trg_payment_transactions_updated_at
  BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Admin-only read (audit log). No anon/authenticated write policy —
-- all writes come from edge functions using the service-role key,
-- which bypasses RLS by design (same pattern as conversions_sent).
CREATE POLICY "Admins can read payment transactions"
  ON public.payment_transactions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. store_settings RLS — allow anonymous checkout to read the two
--    gateway enabled/disabled flags (needed to decide which payment
--    buttons to render) without exposing any credential key.
--    Reproduces the exact existing whitelist from migration
--    20260304151051, plus 'payment_uddoktapay_enabled' and
--    'payment_bkash_enabled'. Credential keys (bkash_app_key,
--    bkash_app_secret, etc.) and payment_sms_confirmation_enabled
--    are intentionally NOT added — admin-only by omission, same as
--    uddoktapay_api_key today.
DROP POLICY IF EXISTS "Anyone can read settings" ON public.store_settings;
CREATE POLICY "Anyone can read settings" ON public.store_settings FOR SELECT USING (
  has_role((select auth.uid()), 'admin'::app_role) OR key = ANY (ARRAY[
    'gtm_id','facebook_pixel_id','helpline_number','store_name','store_name_bn',
    'navbar_config','homepage_config','footer_config','pages_config','invoice_config',
    'buttons_config','theme_config','whatsapp_number','messenger_link','chat_welcome_message',
    'captcha_enabled','turnstile_site_key','landing_page_defaults','pinterest_verification',
    'google_verification','facebook_domain_verification','meta_pixel_enabled',
    'payment_uddoktapay_enabled','payment_bkash_enabled'
  ])
);
