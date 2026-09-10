-- 1. orders: Allow order_manager to INSERT
DROP POLICY IF EXISTS "Admins can insert orders" ON orders;
CREATE POLICY "Staff can insert orders" ON orders FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'order_manager'::app_role));

-- 2. order_items: Allow order_manager to INSERT and DELETE
DROP POLICY IF EXISTS "Admins can insert order items" ON order_items;
CREATE POLICY "Staff can insert order items" ON order_items FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'order_manager'::app_role));

DROP POLICY IF EXISTS "Admins can delete order items" ON order_items;
CREATE POLICY "Staff can delete order items" ON order_items FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'order_manager'::app_role));

-- 3. giveaway_entries: Allow order_manager ALL access
CREATE POLICY "Order managers can manage giveaway entries" ON giveaway_entries FOR ALL TO authenticated
USING (has_role(auth.uid(), 'order_manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'order_manager'::app_role));

-- 4. products: Allow order_manager to SELECT all products
CREATE POLICY "Order managers can read products" ON products FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'order_manager'::app_role));

-- 5. Update get_user_permissions: remove customers, add giveaway for order_manager
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _role app_role;
  _permissions jsonb;
BEGIN
  SELECT role INTO _role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
  
  IF _role IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  CASE _role
    WHEN 'admin' THEN
      _permissions := '{
        "dashboard": "full", "orders": "full", "products": "full", "categories": "full",
        "customers": "full", "coupons": "full", "landing_pages": "full", "media": "full",
        "sizes_colors": "full", "site_editor": "full", "settings": "full", "employees": "full",
        "live_chat": "full", "accounting": "full", "giveaway": "full"
      }'::jsonb;
    WHEN 'editor' THEN
      _permissions := '{
        "dashboard": "view", "orders": "edit", "products": "edit", "categories": "edit",
        "customers": "view", "coupons": "edit", "landing_pages": "edit", "media": "edit",
        "sizes_colors": "edit", "site_editor": "edit", "settings": "none", "employees": "none",
        "live_chat": "edit", "accounting": "none", "giveaway": "none"
      }'::jsonb;
    WHEN 'order_manager' THEN
      _permissions := '{
        "dashboard": "view", "orders": "full", "products": "view", "categories": "none",
        "customers": "none", "coupons": "none", "landing_pages": "none", "media": "none",
        "sizes_colors": "none", "site_editor": "none", "settings": "none", "employees": "none",
        "live_chat": "edit", "accounting": "none", "giveaway": "full"
      }'::jsonb;
    WHEN 'product_manager' THEN
      _permissions := '{
        "dashboard": "view", "orders": "none", "products": "edit", "categories": "edit",
        "customers": "none", "coupons": "none", "landing_pages": "none", "media": "edit",
        "sizes_colors": "edit", "site_editor": "none", "settings": "none", "employees": "none",
        "live_chat": "none", "accounting": "none", "giveaway": "none"
      }'::jsonb;
    WHEN 'viewer' THEN
      _permissions := '{
        "dashboard": "view", "orders": "view", "products": "view", "categories": "view",
        "customers": "view", "coupons": "view", "landing_pages": "view", "media": "view",
        "sizes_colors": "view", "site_editor": "view", "settings": "none", "employees": "none",
        "live_chat": "view", "accounting": "none", "giveaway": "none"
      }'::jsonb;
    ELSE
      _permissions := '{}'::jsonb;
  END CASE;

  RETURN jsonb_build_object('role', _role::text, 'permissions', _permissions);
END;
$function$;