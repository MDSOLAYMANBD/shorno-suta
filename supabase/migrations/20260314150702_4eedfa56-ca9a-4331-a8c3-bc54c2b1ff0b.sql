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
        "live_chat": "full", "accounting": "full", "giveaway": "full", "courier": "full"
      }'::jsonb;
    WHEN 'editor' THEN
      _permissions := '{
        "dashboard": "view", "orders": "edit", "products": "edit", "categories": "edit",
        "customers": "view", "coupons": "edit", "landing_pages": "edit", "media": "edit",
        "sizes_colors": "edit", "site_editor": "edit", "settings": "none", "employees": "none",
        "live_chat": "edit", "accounting": "none", "giveaway": "none", "courier": "none"
      }'::jsonb;
    WHEN 'order_manager' THEN
      _permissions := '{
        "dashboard": "view", "orders": "full", "products": "view", "categories": "none",
        "customers": "none", "coupons": "none", "landing_pages": "none", "media": "none",
        "sizes_colors": "none", "site_editor": "none", "settings": "none", "employees": "none",
        "live_chat": "edit", "accounting": "none", "giveaway": "full", "courier": "none"
      }'::jsonb;
    WHEN 'product_manager' THEN
      _permissions := '{
        "dashboard": "view", "orders": "none", "products": "edit", "categories": "edit",
        "customers": "none", "coupons": "none", "landing_pages": "none", "media": "edit",
        "sizes_colors": "edit", "site_editor": "none", "settings": "none", "employees": "none",
        "live_chat": "none", "accounting": "none", "giveaway": "none", "courier": "none"
      }'::jsonb;
    WHEN 'viewer' THEN
      _permissions := '{
        "dashboard": "view", "orders": "view", "products": "view", "categories": "view",
        "customers": "view", "coupons": "view", "landing_pages": "view", "media": "view",
        "sizes_colors": "view", "site_editor": "view", "settings": "none", "employees": "none",
        "live_chat": "view", "accounting": "none", "giveaway": "none", "courier": "none"
      }'::jsonb;
    ELSE
      _permissions := '{}'::jsonb;
  END CASE;

  RETURN jsonb_build_object('role', _role::text, 'permissions', _permissions);
END;
$function$;