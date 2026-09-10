
-- Add channel and sms_content columns to email_templates
ALTER TABLE public.email_templates 
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS sms_content text NOT NULL DEFAULT '';

-- Insert SMS templates
INSERT INTO public.email_templates (template_key, subject, html_content, channel, sms_content, is_active)
VALUES 
  ('sms_order_confirmation', 'SMS: অর্ডার কনফার্মেশন', '', 'sms', 'স্বর্ণ সুতা ❤️
অর্ডার: {order_number}
৳{total}
shorno-suta.vercel.app/memo/{order_number}', true),
  ('sms_order_processing', 'SMS: অর্ডার প্রসেসিং', '', 'sms', 'স্বর্ণ সুতা ❤️
{order_number} প্রস্তুত হচ্ছে
shorno-suta.vercel.app/memo/{order_number}', false),
  ('sms_order_shipped', 'SMS: অর্ডার শিপড', '', 'sms', 'স্বর্ণ সুতা ❤️
{order_number} পাঠানো হয়েছে 🚚
shorno-suta.vercel.app/memo/{order_number}', false),
  ('sms_order_delivered', 'SMS: অর্ডার ডেলিভারড', '', 'sms', 'স্বর্ণ সুতা ❤️
{order_number} ডেলিভারি সম্পন্ন ✅
shorno-suta.vercel.app/memo/{order_number}', false)
ON CONFLICT DO NOTHING;

-- Update existing email templates to have channel = 'email'
UPDATE public.email_templates SET channel = 'email' WHERE channel IS NULL OR channel = '';
