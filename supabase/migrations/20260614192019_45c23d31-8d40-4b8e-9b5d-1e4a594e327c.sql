
-- =========================================================
-- Free Shipping System
-- =========================================================

CREATE TABLE IF NOT EXISTS public.free_shipping_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  banner_image text,
  status text NOT NULL DEFAULT 'draft', -- 'active' | 'draft' | 'scheduled' | 'expired'
  start_date timestamptz,
  end_date timestamptz,
  priority int NOT NULL DEFAULT 0,
  rule_type text NOT NULL DEFAULT 'amount',
    -- 'quantity' | 'amount' | 'category_quantity' | 'product_quantity'
    -- | 'product_amount' | 'combo'
  combine_logic text NOT NULL DEFAULT 'and', -- 'and' | 'or' (combo only)
  min_quantity int,
  max_quantity int,
  min_amount numeric(12,2),
  max_amount numeric(12,2),
  applicable_category_ids uuid[] NOT NULL DEFAULT '{}',
  applicable_product_ids uuid[] NOT NULL DEFAULT '{}',
  excluded_product_ids uuid[] NOT NULL DEFAULT '{}',
  coupon_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fs_campaigns_status ON public.free_shipping_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_fs_campaigns_priority ON public.free_shipping_campaigns(priority DESC);

GRANT SELECT ON public.free_shipping_campaigns TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.free_shipping_campaigns TO authenticated;
GRANT ALL ON public.free_shipping_campaigns TO service_role;

ALTER TABLE public.free_shipping_campaigns ENABLE ROW LEVEL SECURITY;

-- Public can read only currently-live campaigns
CREATE POLICY "Public can view active free shipping campaigns"
ON public.free_shipping_campaigns
FOR SELECT
USING (
  status = 'active'
  AND (start_date IS NULL OR start_date <= now())
  AND (end_date IS NULL OR end_date >= now())
);

-- Admin / order manager full access
CREATE POLICY "Admins manage free shipping campaigns"
ON public.free_shipping_campaigns
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'order_manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'order_manager'));

-- Updated_at trigger
CREATE TRIGGER trg_fs_campaigns_updated_at
BEFORE UPDATE ON public.free_shipping_campaigns
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- =========================================================
-- Stats roll-up
-- =========================================================

CREATE TABLE IF NOT EXISTS public.free_shipping_campaign_stats (
  campaign_id uuid PRIMARY KEY REFERENCES public.free_shipping_campaigns(id) ON DELETE CASCADE,
  orders_count int NOT NULL DEFAULT 0,
  revenue numeric(14,2) NOT NULL DEFAULT 0,
  free_shipping_cost numeric(14,2) NOT NULL DEFAULT 0,
  last_recomputed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.free_shipping_campaign_stats TO authenticated;
GRANT ALL ON public.free_shipping_campaign_stats TO service_role;

ALTER TABLE public.free_shipping_campaign_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view free shipping stats"
ON public.free_shipping_campaign_stats
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'order_manager'));

CREATE POLICY "Admins manage free shipping stats"
ON public.free_shipping_campaign_stats
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'order_manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'order_manager'));

CREATE TRIGGER trg_fs_campaign_stats_updated_at
BEFORE UPDATE ON public.free_shipping_campaign_stats
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- =========================================================
-- Realtime
-- =========================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.free_shipping_campaigns;
