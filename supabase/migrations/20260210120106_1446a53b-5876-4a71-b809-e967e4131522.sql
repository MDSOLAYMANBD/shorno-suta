
-- =============================================
-- Part 1: Products - add product_type and variant_images
-- =============================================
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'simple';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS variant_images jsonb NOT NULL DEFAULT '{}'::jsonb;

-- =============================================
-- Part 2: Customers table
-- =============================================
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE,
  name text NOT NULL DEFAULT '',
  address text DEFAULT '',
  total_orders integer NOT NULL DEFAULT 0,
  total_spent numeric NOT NULL DEFAULT 0,
  last_order_date timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read customers" ON public.customers FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert customers" ON public.customers FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update customers" ON public.customers FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete customers" ON public.customers FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Part 3: Coupons table
-- =============================================
CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL DEFAULT 'fixed',
  discount_value numeric NOT NULL DEFAULT 0,
  min_order_amount numeric NOT NULL DEFAULT 0,
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage coupons" ON public.coupons FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Public can read active coupons" ON public.coupons FOR SELECT USING (is_active = true);

CREATE TRIGGER update_coupons_updated_at BEFORE UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Part 4: Landing Pages tables
-- =============================================
CREATE TABLE public.landing_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  meta_title text,
  meta_description text,
  facebook_pixel_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.landing_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage landing pages" ON public.landing_pages FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Public can read active landing pages" ON public.landing_pages FOR SELECT USING (is_active = true);

CREATE TRIGGER update_landing_pages_updated_at BEFORE UPDATE ON public.landing_pages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Landing page sections
CREATE TABLE public.landing_page_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_page_id uuid NOT NULL REFERENCES public.landing_pages(id) ON DELETE CASCADE,
  section_type text NOT NULL DEFAULT 'html',
  sort_order integer NOT NULL DEFAULT 0,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.landing_page_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage landing page sections" ON public.landing_page_sections FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Public can read active sections" ON public.landing_page_sections FOR SELECT USING (is_active = true);

-- Landing page products
CREATE TABLE public.landing_page_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_page_id uuid NOT NULL REFERENCES public.landing_pages(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0
);

ALTER TABLE public.landing_page_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage landing page products" ON public.landing_page_products FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Public can read landing page products" ON public.landing_page_products FOR SELECT USING (true);
