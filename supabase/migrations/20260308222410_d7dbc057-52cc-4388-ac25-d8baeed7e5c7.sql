
-- Step 1: Add customer_email to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_email text;

-- Step 2: Create visitor_activity table
CREATE TABLE IF NOT EXISTS public.visitor_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  activity_type text NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.visitor_activity ENABLE ROW LEVEL SECURITY;

-- Public can insert visitor activity (anonymous tracking)
CREATE POLICY "Anyone can insert visitor activity"
  ON public.visitor_activity FOR INSERT
  WITH CHECK (true);

-- Staff can read visitor activity
CREATE POLICY "Staff can read visitor activity"
  ON public.visitor_activity FOR SELECT
  USING (has_any_role(auth.uid()));

-- Admin can delete visitor activity
CREATE POLICY "Admin can delete visitor activity"
  ON public.visitor_activity FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Step 3: Create email_templates table
CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text UNIQUE NOT NULL,
  subject text NOT NULL,
  html_content text NOT NULL DEFAULT '',
  is_active boolean DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Admin can manage email templates
CREATE POLICY "Admin can manage email templates"
  ON public.email_templates FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Staff can read email templates
CREATE POLICY "Staff can read email templates"
  ON public.email_templates FOR SELECT
  USING (has_any_role(auth.uid()));

-- Step 4: Create notification_logs table for tracking sent notifications
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  channel text NOT NULL DEFAULT 'email',
  recipient text,
  status text DEFAULT 'sent',
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read notification logs"
  ON public.notification_logs FOR SELECT
  USING (has_any_role(auth.uid()));

CREATE POLICY "Service role insert notification logs"
  ON public.notification_logs FOR INSERT
  WITH CHECK (false);

-- Insert default email templates
INSERT INTO public.email_templates (template_key, subject, html_content) VALUES
  ('order_confirmation', 'আপনার অর্ডার সফল হয়েছে – Shorno Suta', ''),
  ('order_processing', 'আপনার অর্ডার প্রস্তুত হচ্ছে – Shorno Suta', ''),
  ('order_shipped', 'আপনার অর্ডার পাঠানো হয়েছে – Shorno Suta', ''),
  ('order_delivered', 'আপনার অর্ডার ডেলিভারি সম্পন্ন হয়েছে – Shorno Suta', ''),
  ('payment_confirmation', 'পেমেন্ট সফল হয়েছে – Shorno Suta', ''),
  ('abandoned_cart', 'আপনার কার্টে এখনো পণ্য রয়েছে – Shorno Suta', '')
ON CONFLICT (template_key) DO NOTHING;
