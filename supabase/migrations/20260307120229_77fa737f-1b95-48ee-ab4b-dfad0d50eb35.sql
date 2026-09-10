
-- Create admin_notifications table
CREATE TABLE public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  link text,
  reference_id text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- Staff can read notifications
CREATE POLICY "Staff can read admin notifications"
ON public.admin_notifications FOR SELECT
TO authenticated
USING (has_any_role(auth.uid()));

-- Staff can update (mark read)
CREATE POLICY "Staff can update admin notifications"
ON public.admin_notifications FOR UPDATE
TO authenticated
USING (has_any_role(auth.uid()))
WITH CHECK (has_any_role(auth.uid()));

-- Only service role / triggers can insert (block anon insert)
CREATE POLICY "Service role insert only"
ON public.admin_notifications FOR INSERT
TO authenticated
WITH CHECK (false);

-- Staff can delete (clear old)
CREATE POLICY "Admins can delete admin notifications"
ON public.admin_notifications FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for fast queries
CREATE INDEX idx_admin_notifications_created_at ON public.admin_notifications (created_at DESC);
CREATE INDEX idx_admin_notifications_is_read ON public.admin_notifications (is_read) WHERE is_read = false;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;

-- Trigger function: new order notification
CREATE OR REPLACE FUNCTION public.notify_admin_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.admin_notifications (type, title, message, link, reference_id)
  VALUES (
    'order',
    'নতুন অর্ডার! 🎉',
    '৳' || NEW.total::text || ' — ' || COALESCE(NEW.customer_name, '') || ' (' || COALESCE(NEW.order_number, '') || ')',
    '/admin/orders',
    NEW.id::text
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_admin_notify_new_order
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_new_order();

-- Trigger function: order status change
CREATE OR REPLACE FUNCTION public.notify_admin_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  status_label text;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  CASE NEW.status
    WHEN 'confirmed' THEN status_label := 'কনফার্মড ✅';
    WHEN 'shipped' THEN status_label := 'শিপড 🚚';
    WHEN 'delivered' THEN status_label := 'ডেলিভারড ✔️';
    WHEN 'cancelled' THEN status_label := 'ক্যান্সেলড ❌';
    WHEN 'delivery_failed' THEN status_label := 'ডেলিভারি ফেইলড ⚠️';
    WHEN 'paid_return' THEN status_label := 'পেইড রিটার্ন 🔄';
    WHEN 'office_sell' THEN status_label := 'অফিস সেল 🏢';
    ELSE status_label := NEW.status;
  END CASE;

  INSERT INTO public.admin_notifications (type, title, message, link, reference_id)
  VALUES (
    'order_update',
    'অর্ডার ' || status_label,
    COALESCE(NEW.order_number, '') || ' — ' || COALESCE(NEW.customer_name, ''),
    '/admin/orders',
    NEW.id::text
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_admin_notify_order_status
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_order_status();

-- Trigger function: new visitor chat message
CREATE OR REPLACE FUNCTION public.notify_admin_new_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.sender_type != 'visitor' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.admin_notifications (type, title, message, link, reference_id)
  VALUES (
    'chat',
    '💬 নতুন চ্যাট মেসেজ',
    COALESCE(NEW.sender_name, 'ভিজিটর') || ': ' || LEFT(COALESCE(NEW.message, ''), 80),
    '/admin/live-chat',
    NEW.session_id::text
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_admin_notify_new_chat
AFTER INSERT ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_new_chat();

-- Trigger function: new abandoned checkout
CREATE OR REPLACE FUNCTION public.notify_admin_abandoned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.admin_notifications (type, title, message, link, reference_id)
  VALUES (
    'abandoned',
    '⚠️ অসম্পূর্ণ চেকআউট',
    COALESCE(NEW.customer_name, '') || ' — ৳' || NEW.subtotal::text,
    '/admin/abandoned-checkouts',
    NEW.id::text
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_admin_notify_abandoned
AFTER INSERT ON public.abandoned_checkouts
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_abandoned();
