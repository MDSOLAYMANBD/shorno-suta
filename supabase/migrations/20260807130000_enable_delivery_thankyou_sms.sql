UPDATE public.email_templates
SET
  sms_content = 'স্বর্ণ সুতা ❤️ ধন্যবাদ! আবার কেনাকাটা করুন shorno-suta.vercel.app',
  is_active = true
WHERE template_key = 'sms_order_delivered';
