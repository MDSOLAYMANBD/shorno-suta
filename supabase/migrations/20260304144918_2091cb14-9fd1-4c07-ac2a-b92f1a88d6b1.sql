
-- ============================================================
-- RLS Policy Performance Optimization
-- Wrap auth.uid() in (select auth.uid()) so PostgreSQL
-- evaluates it once per query instead of once per row.
-- ============================================================

-- ==================== 1. CATEGORIES ====================
DROP POLICY IF EXISTS "Admins can delete categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can update categories" ON public.categories;
DROP POLICY IF EXISTS "Anyone can read categories" ON public.categories;

CREATE POLICY "Admins can delete categories" ON public.categories FOR DELETE TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can insert categories" ON public.categories FOR INSERT TO authenticated
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can update categories" ON public.categories FOR UPDATE TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Anyone can read categories" ON public.categories FOR SELECT
  USING (true);

-- ==================== 2. PRODUCTS ====================
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Admins can update products" ON public.products;
DROP POLICY IF EXISTS "Anyone can read active products" ON public.products;

CREATE POLICY "Admins can delete products" ON public.products FOR DELETE TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can insert products" ON public.products FOR INSERT TO authenticated
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can update products" ON public.products FOR UPDATE TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Anyone can read active products" ON public.products FOR SELECT
  USING ((is_active = true) OR has_role((select auth.uid()), 'admin'::app_role));

-- ==================== 3. ORDERS ====================
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can read orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
DROP POLICY IF EXISTS "Deny anon access to orders" ON public.orders;
DROP POLICY IF EXISTS "Order managers can read orders" ON public.orders;
DROP POLICY IF EXISTS "Order managers can update orders" ON public.orders;

CREATE POLICY "Admins can delete orders" ON public.orders FOR DELETE TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can insert orders" ON public.orders FOR INSERT TO authenticated
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can read orders" ON public.orders FOR SELECT TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can update orders" ON public.orders FOR UPDATE TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Deny anon access to orders" ON public.orders FOR ALL TO anon
  USING (false);
CREATE POLICY "Order managers can read orders" ON public.orders FOR SELECT TO authenticated
  USING (has_role((select auth.uid()), 'order_manager'::app_role));
CREATE POLICY "Order managers can update orders" ON public.orders FOR UPDATE TO authenticated
  USING (has_role((select auth.uid()), 'order_manager'::app_role));

-- ==================== 4. ORDER_ITEMS ====================
DROP POLICY IF EXISTS "Admins can delete order items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can insert order items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can read order items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can update order items" ON public.order_items;
DROP POLICY IF EXISTS "Deny anon access to order_items" ON public.order_items;
DROP POLICY IF EXISTS "Order managers can read order items" ON public.order_items;
DROP POLICY IF EXISTS "Order managers can update order items" ON public.order_items;

CREATE POLICY "Admins can delete order items" ON public.order_items FOR DELETE TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can insert order items" ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can read order items" ON public.order_items FOR SELECT TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can update order items" ON public.order_items FOR UPDATE TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Deny anon access to order_items" ON public.order_items FOR ALL TO anon
  USING (false);
CREATE POLICY "Order managers can read order items" ON public.order_items FOR SELECT TO authenticated
  USING (has_role((select auth.uid()), 'order_manager'::app_role));
CREATE POLICY "Order managers can update order items" ON public.order_items FOR UPDATE TO authenticated
  USING (has_role((select auth.uid()), 'order_manager'::app_role));

-- ==================== 5. USER_ROLES ====================
DROP POLICY IF EXISTS "Admins can delete user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can read user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update user_roles" ON public.user_roles;

CREATE POLICY "Admins can delete user_roles" ON public.user_roles FOR DELETE TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can manage user_roles" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can read user_roles" ON public.user_roles FOR SELECT TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can update user_roles" ON public.user_roles FOR UPDATE TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

-- ==================== 6. STORE_SETTINGS ====================
DROP POLICY IF EXISTS "Admins can delete store settings" ON public.store_settings;
DROP POLICY IF EXISTS "Admins can insert store settings" ON public.store_settings;
DROP POLICY IF EXISTS "Admins can read store settings" ON public.store_settings;
DROP POLICY IF EXISTS "Admins can update store settings" ON public.store_settings;
DROP POLICY IF EXISTS "Public can read public settings" ON public.store_settings;
DROP POLICY IF EXISTS "Public can read whitelisted settings" ON public.store_settings;

CREATE POLICY "Admins can delete store settings" ON public.store_settings FOR DELETE TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can insert store settings" ON public.store_settings FOR INSERT TO authenticated
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can read store settings" ON public.store_settings FOR SELECT TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can update store settings" ON public.store_settings FOR UPDATE TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Public can read whitelisted settings" ON public.store_settings FOR SELECT
  USING (key = ANY (ARRAY['gtm_id','facebook_pixel_id','helpline_number','store_name','store_name_bn','navbar_config','homepage_config','footer_config','pages_config','invoice_config','buttons_config','theme_config','whatsapp_number','messenger_link','chat_welcome_message','captcha_enabled','turnstile_site_key','landing_page_defaults','pinterest_verification','google_verification','facebook_domain_verification','meta_pixel_enabled']));

-- ==================== 7. ACTIVITY_LOGS ====================
DROP POLICY IF EXISTS "Admins can read all activity_logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Authenticated can insert activity_logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Order managers can insert activity_logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Staff can read order activity_logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Users can read own activity_logs" ON public.activity_logs;

CREATE POLICY "Admins can read all activity_logs" ON public.activity_logs FOR SELECT TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Authenticated can insert activity_logs" ON public.activity_logs FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Order managers can insert activity_logs" ON public.activity_logs FOR INSERT TO authenticated
  WITH CHECK (has_role((select auth.uid()), 'order_manager'::app_role) AND (select auth.uid()) = user_id);
CREATE POLICY "Staff can read order activity_logs" ON public.activity_logs FOR SELECT TO authenticated
  USING (has_any_role((select auth.uid())) AND entity_type = 'order');
CREATE POLICY "Users can read own activity_logs" ON public.activity_logs FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
