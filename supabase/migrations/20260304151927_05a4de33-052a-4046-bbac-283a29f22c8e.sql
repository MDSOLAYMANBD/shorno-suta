-- Add missing indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products (category_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON public.orders (customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items (product_id);
CREATE INDEX IF NOT EXISTS idx_staff_notifications_recipient_id ON public.staff_notifications (recipient_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_type ON public.activity_logs (entity_type);
CREATE INDEX IF NOT EXISTS idx_customer_reviews_status ON public.customer_reviews (status);