
-- Drop duplicate constraint on push_subscriptions
ALTER TABLE public.push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_endpoint_key;

-- =============================================
-- 2. landing_page_products
-- =============================================
DROP POLICY IF EXISTS "Admins can manage landing page products" ON public.landing_page_products;
DROP POLICY IF EXISTS "Public can read landing page products" ON public.landing_page_products;

CREATE POLICY "Anyone can read landing page products" ON public.landing_page_products FOR SELECT USING (true);
CREATE POLICY "Admins can insert landing page products" ON public.landing_page_products FOR INSERT WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can update landing page products" ON public.landing_page_products FOR UPDATE USING (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can delete landing page products" ON public.landing_page_products FOR DELETE USING (has_role((select auth.uid()), 'admin'::app_role));

-- =============================================
-- 3. landing_page_sections
-- =============================================
DROP POLICY IF EXISTS "Admins can manage landing page sections" ON public.landing_page_sections;
DROP POLICY IF EXISTS "Public can read active sections" ON public.landing_page_sections;

CREATE POLICY "Anyone can read active or admin sections" ON public.landing_page_sections FOR SELECT USING (is_active = true OR has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can insert landing page sections" ON public.landing_page_sections FOR INSERT WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can update landing page sections" ON public.landing_page_sections FOR UPDATE USING (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can delete landing page sections" ON public.landing_page_sections FOR DELETE USING (has_role((select auth.uid()), 'admin'::app_role));

-- =============================================
-- 4. landing_pages
-- =============================================
DROP POLICY IF EXISTS "Admins can manage landing pages" ON public.landing_pages;
DROP POLICY IF EXISTS "Public can read active landing pages" ON public.landing_pages;

CREATE POLICY "Anyone can read active or admin landing pages" ON public.landing_pages FOR SELECT USING (is_active = true OR has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can insert landing pages" ON public.landing_pages FOR INSERT WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can update landing pages" ON public.landing_pages FOR UPDATE USING (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can delete landing pages" ON public.landing_pages FOR DELETE USING (has_role((select auth.uid()), 'admin'::app_role));

-- =============================================
-- 5. product_collections
-- =============================================
DROP POLICY IF EXISTS "Admin can manage collections" ON public.product_collections;
DROP POLICY IF EXISTS "Anyone can read collections" ON public.product_collections;

CREATE POLICY "Anyone can read collections" ON public.product_collections FOR SELECT USING (true);
CREATE POLICY "Admins can insert collections" ON public.product_collections FOR INSERT WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can update collections" ON public.product_collections FOR UPDATE USING (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can delete collections" ON public.product_collections FOR DELETE USING (has_role((select auth.uid()), 'admin'::app_role));

-- =============================================
-- 6. orders
-- =============================================
DROP POLICY IF EXISTS "Deny anon access to orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can read orders" ON public.orders;
DROP POLICY IF EXISTS "Order managers can read orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
DROP POLICY IF EXISTS "Order managers can update orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;

CREATE POLICY "Staff can read orders" ON public.orders FOR SELECT USING (
  has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'order_manager'::app_role)
);
CREATE POLICY "Staff can update orders" ON public.orders FOR UPDATE USING (
  has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'order_manager'::app_role)
);
CREATE POLICY "Admins can insert orders" ON public.orders FOR INSERT WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can delete orders" ON public.orders FOR DELETE USING (has_role((select auth.uid()), 'admin'::app_role));

-- =============================================
-- 7. order_items
-- =============================================
DROP POLICY IF EXISTS "Deny anon access to order_items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can read order items" ON public.order_items;
DROP POLICY IF EXISTS "Order managers can read order items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can update order items" ON public.order_items;
DROP POLICY IF EXISTS "Order managers can update order items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can insert order items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can delete order items" ON public.order_items;

CREATE POLICY "Staff can read order items" ON public.order_items FOR SELECT USING (
  has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'order_manager'::app_role)
);
CREATE POLICY "Staff can update order items" ON public.order_items FOR UPDATE USING (
  has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'order_manager'::app_role)
);
CREATE POLICY "Admins can insert order items" ON public.order_items FOR INSERT WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can delete order items" ON public.order_items FOR DELETE USING (has_role((select auth.uid()), 'admin'::app_role));

-- =============================================
-- 8. staff_notifications
-- =============================================
DROP POLICY IF EXISTS "Admin can read all notifications" ON public.staff_notifications;
DROP POLICY IF EXISTS "Users can read own notifications" ON public.staff_notifications;
DROP POLICY IF EXISTS "Admins can send notifications" ON public.staff_notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.staff_notifications;

CREATE POLICY "Staff can read notifications" ON public.staff_notifications FOR SELECT USING (
  has_role((select auth.uid()), 'admin'::app_role) OR recipient_id = (select auth.uid())
);
CREATE POLICY "Admins can send notifications" ON public.staff_notifications FOR INSERT WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Users can update own notifications" ON public.staff_notifications FOR UPDATE USING (recipient_id = (select auth.uid()));

-- =============================================
-- 9. store_settings
-- =============================================
DROP POLICY IF EXISTS "Admins can read store settings" ON public.store_settings;
DROP POLICY IF EXISTS "Public can read whitelisted settings" ON public.store_settings;
DROP POLICY IF EXISTS "Admins can insert store settings" ON public.store_settings;
DROP POLICY IF EXISTS "Admins can update store settings" ON public.store_settings;
DROP POLICY IF EXISTS "Admins can delete store settings" ON public.store_settings;

CREATE POLICY "Anyone can read settings" ON public.store_settings FOR SELECT USING (
  has_role((select auth.uid()), 'admin'::app_role) OR key = ANY (ARRAY[
    'gtm_id','facebook_pixel_id','helpline_number','store_name','store_name_bn',
    'navbar_config','homepage_config','footer_config','pages_config','invoice_config',
    'buttons_config','theme_config','whatsapp_number','messenger_link','chat_welcome_message',
    'captcha_enabled','turnstile_site_key','landing_page_defaults','pinterest_verification',
    'google_verification','facebook_domain_verification','meta_pixel_enabled'
  ])
);
CREATE POLICY "Admins can insert store settings" ON public.store_settings FOR INSERT WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can update store settings" ON public.store_settings FOR UPDATE USING (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can delete store settings" ON public.store_settings FOR DELETE USING (has_role((select auth.uid()), 'admin'::app_role));

-- =============================================
-- 10. abandoned_checkouts
-- =============================================
DROP POLICY IF EXISTS "Admins can read abandoned checkouts" ON public.abandoned_checkouts;
DROP POLICY IF EXISTS "Order managers can read abandoned checkouts" ON public.abandoned_checkouts;
DROP POLICY IF EXISTS "Admins can update abandoned checkouts" ON public.abandoned_checkouts;
DROP POLICY IF EXISTS "Order managers can update abandoned checkouts" ON public.abandoned_checkouts;
DROP POLICY IF EXISTS "Admins can delete abandoned checkouts" ON public.abandoned_checkouts;
DROP POLICY IF EXISTS "Only service role can insert abandoned checkouts" ON public.abandoned_checkouts;

CREATE POLICY "Staff can read abandoned checkouts" ON public.abandoned_checkouts FOR SELECT USING (
  has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'order_manager'::app_role)
);
CREATE POLICY "Staff can update abandoned checkouts" ON public.abandoned_checkouts FOR UPDATE USING (
  has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'order_manager'::app_role)
);
CREATE POLICY "Admins can delete abandoned checkouts" ON public.abandoned_checkouts FOR DELETE USING (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Only service role can insert abandoned checkouts" ON public.abandoned_checkouts FOR INSERT WITH CHECK (false);

-- =============================================
-- 11. activity_logs
-- =============================================
DROP POLICY IF EXISTS "Admins can read all activity_logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Staff can read order activity_logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Users can read own activity_logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Authenticated can insert activity_logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Order managers can insert activity_logs" ON public.activity_logs;

CREATE POLICY "Staff can read activity_logs" ON public.activity_logs FOR SELECT USING (
  has_role((select auth.uid()), 'admin'::app_role)
  OR (has_any_role((select auth.uid())) AND entity_type = 'order')
  OR (select auth.uid()) = user_id
);
CREATE POLICY "Authenticated can insert activity_logs" ON public.activity_logs FOR INSERT WITH CHECK (
  (select auth.uid()) = user_id
);

-- =============================================
-- 12. customer_reviews
-- =============================================
DROP POLICY IF EXISTS "Admins can read all reviews" ON public.customer_reviews;
DROP POLICY IF EXISTS "Public can read approved reviews" ON public.customer_reviews;
DROP POLICY IF EXISTS "Admins can update reviews" ON public.customer_reviews;
DROP POLICY IF EXISTS "Admins can delete reviews" ON public.customer_reviews;
DROP POLICY IF EXISTS "Anyone can submit reviews with validation" ON public.customer_reviews;

CREATE POLICY "Anyone can read reviews" ON public.customer_reviews FOR SELECT USING (
  status = 'approved' OR has_role((select auth.uid()), 'admin'::app_role)
);
CREATE POLICY "Admins can update reviews" ON public.customer_reviews FOR UPDATE USING (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can delete reviews" ON public.customer_reviews FOR DELETE USING (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Anyone can submit reviews with validation" ON public.customer_reviews FOR INSERT WITH CHECK (
  (customer_name IS NOT NULL) AND (length(TRIM(BOTH FROM customer_name)) > 0) AND (length(TRIM(BOTH FROM customer_name)) <= 200)
  AND ((customer_location IS NULL) OR (length(TRIM(BOTH FROM customer_location)) <= 200))
  AND ((review_text IS NULL) OR (length(TRIM(BOTH FROM review_text)) <= 2000))
  AND (rating >= 1) AND (rating <= 5) AND (status = 'pending')
);

-- =============================================
-- 13. customers
-- =============================================
DROP POLICY IF EXISTS "Admins can read customers" ON public.customers;
DROP POLICY IF EXISTS "Order managers can read customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can update customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can delete customers" ON public.customers;

CREATE POLICY "Staff can read customers" ON public.customers FOR SELECT USING (
  has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'order_manager'::app_role)
);
CREATE POLICY "Admins can insert customers" ON public.customers FOR INSERT WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can update customers" ON public.customers FOR UPDATE USING (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can delete customers" ON public.customers FOR DELETE USING (has_role((select auth.uid()), 'admin'::app_role));

-- =============================================
-- 14. coupons
-- =============================================
DROP POLICY IF EXISTS "Admins can manage coupons" ON public.coupons;
DROP POLICY IF EXISTS "Anyone can read active coupons" ON public.coupons;

CREATE POLICY "Anyone can read coupons" ON public.coupons FOR SELECT USING (
  is_active = true OR has_role((select auth.uid()), 'admin'::app_role)
);
CREATE POLICY "Admins can insert coupons" ON public.coupons FOR INSERT WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can update coupons" ON public.coupons FOR UPDATE USING (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can delete coupons" ON public.coupons FOR DELETE USING (has_role((select auth.uid()), 'admin'::app_role));

-- =============================================
-- 15. employee_profiles
-- =============================================
DROP POLICY IF EXISTS "Admins can manage employee_profiles" ON public.employee_profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.employee_profiles;

CREATE POLICY "Staff can read employee profiles" ON public.employee_profiles FOR SELECT USING (
  has_role((select auth.uid()), 'admin'::app_role) OR (select auth.uid()) = user_id
);
CREATE POLICY "Admins can insert employee profiles" ON public.employee_profiles FOR INSERT WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can update employee profiles" ON public.employee_profiles FOR UPDATE USING (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can delete employee profiles" ON public.employee_profiles FOR DELETE USING (has_role((select auth.uid()), 'admin'::app_role));

-- =============================================
-- 16. global_colors
-- =============================================
DROP POLICY IF EXISTS "Admin manage colors" ON public.global_colors;
DROP POLICY IF EXISTS "Anyone can read colors" ON public.global_colors;

CREATE POLICY "Anyone can read colors" ON public.global_colors FOR SELECT USING (true);
CREATE POLICY "Admins can insert colors" ON public.global_colors FOR INSERT WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can update colors" ON public.global_colors FOR UPDATE USING (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can delete colors" ON public.global_colors FOR DELETE USING (has_role((select auth.uid()), 'admin'::app_role));

-- =============================================
-- 17. global_sizes
-- =============================================
DROP POLICY IF EXISTS "Admin manage sizes" ON public.global_sizes;
DROP POLICY IF EXISTS "Anyone can read sizes" ON public.global_sizes;

CREATE POLICY "Anyone can read sizes" ON public.global_sizes FOR SELECT USING (true);
CREATE POLICY "Admins can insert sizes" ON public.global_sizes FOR INSERT WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can update sizes" ON public.global_sizes FOR UPDATE USING (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can delete sizes" ON public.global_sizes FOR DELETE USING (has_role((select auth.uid()), 'admin'::app_role));

-- =============================================
-- 18. push_subscriptions
-- =============================================
DROP POLICY IF EXISTS "Service role can read all subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can read own subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can delete own subscriptions" ON public.push_subscriptions;

CREATE POLICY "Anyone can read subscriptions" ON public.push_subscriptions FOR SELECT USING (true);
CREATE POLICY "Users can insert own subscriptions" ON public.push_subscriptions FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update own subscriptions" ON public.push_subscriptions FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete own subscriptions" ON public.push_subscriptions FOR DELETE USING ((select auth.uid()) = user_id);

-- =============================================
-- 19. order_notes
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view order notes" ON public.order_notes;
DROP POLICY IF EXISTS "Authenticated users can insert order notes" ON public.order_notes;
DROP POLICY IF EXISTS "Authenticated users can delete order notes" ON public.order_notes;

CREATE POLICY "Staff can read order notes" ON public.order_notes FOR SELECT USING (has_any_role((select auth.uid())));
CREATE POLICY "Staff can insert order notes" ON public.order_notes FOR INSERT WITH CHECK (has_any_role((select auth.uid())));
CREATE POLICY "Staff can delete order notes" ON public.order_notes FOR DELETE USING (has_any_role((select auth.uid())));

-- =============================================
-- 20. site_visits
-- =============================================
DROP POLICY IF EXISTS "Admins can read visits" ON public.site_visits;
DROP POLICY IF EXISTS "Anyone can insert visits with valid data" ON public.site_visits;

CREATE POLICY "Staff can read visits" ON public.site_visits FOR SELECT USING (has_any_role((select auth.uid())));
CREATE POLICY "Anyone can insert visits with valid data" ON public.site_visits FOR INSERT WITH CHECK (
  (session_id IS NOT NULL) AND (length(session_id) > 0) AND (length(session_id) <= 200)
);

-- =============================================
-- 21. chat_messages
-- =============================================
DROP POLICY IF EXISTS "Staff can insert chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Staff can read chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Staff can update chat messages" ON public.chat_messages;

CREATE POLICY "Staff can read chat messages" ON public.chat_messages FOR SELECT USING (has_any_role((select auth.uid())));
CREATE POLICY "Staff can insert chat messages" ON public.chat_messages FOR INSERT WITH CHECK (has_any_role((select auth.uid())));
CREATE POLICY "Staff can update chat messages" ON public.chat_messages FOR UPDATE USING (has_any_role((select auth.uid())));

-- =============================================
-- 22. chat_sessions
-- =============================================
DROP POLICY IF EXISTS "Staff can read chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Staff can create chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Staff can update chat sessions" ON public.chat_sessions;

CREATE POLICY "Staff can read chat sessions" ON public.chat_sessions FOR SELECT USING (has_any_role((select auth.uid())));
CREATE POLICY "Staff can create chat sessions" ON public.chat_sessions FOR INSERT WITH CHECK (has_any_role((select auth.uid())));
CREATE POLICY "Staff can update chat sessions" ON public.chat_sessions FOR UPDATE USING (has_any_role((select auth.uid())));

-- =============================================
-- 23. acc_* tables
-- =============================================
DROP POLICY IF EXISTS "Admin can manage acc_accounts" ON public.acc_accounts;
DROP POLICY IF EXISTS "Staff can read acc_accounts" ON public.acc_accounts;
CREATE POLICY "Admin can manage acc_accounts" ON public.acc_accounts FOR ALL USING (has_role((select auth.uid()), 'admin'::app_role)) WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Staff can read acc_accounts" ON public.acc_accounts FOR SELECT USING (has_any_role((select auth.uid())));

DROP POLICY IF EXISTS "Admin can manage acc_attendance" ON public.acc_attendance;
DROP POLICY IF EXISTS "Staff can read acc_attendance" ON public.acc_attendance;
CREATE POLICY "Admin can manage acc_attendance" ON public.acc_attendance FOR ALL USING (has_role((select auth.uid()), 'admin'::app_role)) WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Staff can read acc_attendance" ON public.acc_attendance FOR SELECT USING (has_any_role((select auth.uid())));

DROP POLICY IF EXISTS "Admin can manage acc_off_days" ON public.acc_off_days;
DROP POLICY IF EXISTS "Staff can read acc_off_days" ON public.acc_off_days;
CREATE POLICY "Admin can manage acc_off_days" ON public.acc_off_days FOR ALL USING (has_role((select auth.uid()), 'admin'::app_role)) WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Staff can read acc_off_days" ON public.acc_off_days FOR SELECT USING (has_any_role((select auth.uid())));

DROP POLICY IF EXISTS "Admin can manage acc_party_entries" ON public.acc_party_entries;
DROP POLICY IF EXISTS "Staff can read acc_party_entries" ON public.acc_party_entries;
CREATE POLICY "Admin can manage acc_party_entries" ON public.acc_party_entries FOR ALL USING (has_role((select auth.uid()), 'admin'::app_role)) WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Staff can read acc_party_entries" ON public.acc_party_entries FOR SELECT USING (has_any_role((select auth.uid())));

DROP POLICY IF EXISTS "Admin can manage acc_persons" ON public.acc_persons;
CREATE POLICY "Admin can manage acc_persons" ON public.acc_persons FOR ALL USING (has_role((select auth.uid()), 'admin'::app_role)) WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Admin can manage acc_production_entries" ON public.acc_production_entries;
DROP POLICY IF EXISTS "Staff can read acc_production_entries" ON public.acc_production_entries;
CREATE POLICY "Admin can manage acc_production_entries" ON public.acc_production_entries FOR ALL USING (has_role((select auth.uid()), 'admin'::app_role)) WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Staff can read acc_production_entries" ON public.acc_production_entries FOR SELECT USING (has_any_role((select auth.uid())));

DROP POLICY IF EXISTS "Admin can manage acc_production_payments" ON public.acc_production_payments;
DROP POLICY IF EXISTS "Staff can read acc_production_payments" ON public.acc_production_payments;
CREATE POLICY "Admin can manage acc_production_payments" ON public.acc_production_payments FOR ALL USING (has_role((select auth.uid()), 'admin'::app_role)) WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Staff can read acc_production_payments" ON public.acc_production_payments FOR SELECT USING (has_any_role((select auth.uid())));

DROP POLICY IF EXISTS "Admin can manage acc_salary_config" ON public.acc_salary_config;
DROP POLICY IF EXISTS "Staff can read acc_salary_config" ON public.acc_salary_config;
CREATE POLICY "Admin can manage acc_salary_config" ON public.acc_salary_config FOR ALL USING (has_role((select auth.uid()), 'admin'::app_role)) WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Staff can read acc_salary_config" ON public.acc_salary_config FOR SELECT USING (has_any_role((select auth.uid())));

DROP POLICY IF EXISTS "Admin can manage acc_salary_increments" ON public.acc_salary_increments;
DROP POLICY IF EXISTS "Staff can read acc_salary_increments" ON public.acc_salary_increments;
CREATE POLICY "Admin can manage acc_salary_increments" ON public.acc_salary_increments FOR ALL USING (has_role((select auth.uid()), 'admin'::app_role)) WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Staff can read acc_salary_increments" ON public.acc_salary_increments FOR SELECT USING (has_any_role((select auth.uid())));

DROP POLICY IF EXISTS "Admin can manage acc_salary_records" ON public.acc_salary_records;
CREATE POLICY "Admin can manage acc_salary_records" ON public.acc_salary_records FOR ALL USING (has_role((select auth.uid()), 'admin'::app_role)) WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Admin can manage acc_transactions" ON public.acc_transactions;
CREATE POLICY "Admin can manage acc_transactions" ON public.acc_transactions FOR ALL USING (has_role((select auth.uid()), 'admin'::app_role)) WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Admin can manage acc_units" ON public.acc_units;
DROP POLICY IF EXISTS "Staff can read acc_units" ON public.acc_units;
CREATE POLICY "Admin can manage acc_units" ON public.acc_units FOR ALL USING (has_role((select auth.uid()), 'admin'::app_role)) WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "Staff can read acc_units" ON public.acc_units FOR SELECT USING (has_any_role((select auth.uid())));
