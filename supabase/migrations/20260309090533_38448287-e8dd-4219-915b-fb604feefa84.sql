
-- Add customer_email to abandoned_checkouts
ALTER TABLE public.abandoned_checkouts ADD COLUMN IF NOT EXISTS customer_email text;

-- Insert default email templates if not exist
INSERT INTO public.email_templates (template_key, subject, html_content, is_active) VALUES
('order_confirmation', 'আপনার অর্ডার সফল হয়েছে – Shorno Suta', '', true),
('order_processing', 'আপনার অর্ডার প্রস্তুত হচ্ছে', '', true),
('order_shipped', 'আপনার অর্ডার পাঠানো হয়েছে', '', true),
('order_delivered', 'আপনার অর্ডার ডেলিভারি সম্পন্ন হয়েছে', '', true),
('payment_confirmation', 'পেমেন্ট সফল হয়েছে', '', true),
('cart_abandoned', 'আপনার কার্টে এখনো পণ্য রয়েছে', '', true)
ON CONFLICT (template_key) DO NOTHING;
