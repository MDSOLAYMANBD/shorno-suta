
-- 1. Add new roles to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'editor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'viewer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'order_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'product_manager';

-- 2. Create employee_profiles table
CREATE TABLE public.employee_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name text NOT NULL DEFAULT '',
  avatar_url text,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_profiles ENABLE ROW LEVEL SECURITY;

-- Admin can do everything on employee_profiles
CREATE POLICY "Admins can manage employee_profiles"
ON public.employee_profiles FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Authenticated users can read their own profile
CREATE POLICY "Users can read own profile"
ON public.employee_profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_employee_profiles_updated_at
BEFORE UPDATE ON public.employee_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Create activity_logs table
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  description text NOT NULL DEFAULT '',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Admin can read all activity logs
CREATE POLICY "Admins can read all activity_logs"
ON public.activity_logs FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Authenticated users can read own logs
CREATE POLICY "Users can read own activity_logs"
ON public.activity_logs FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Any authenticated user with a role can insert activity logs
CREATE POLICY "Authenticated can insert activity_logs"
ON public.activity_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 4. Add UPDATE policy on user_roles for admins
CREATE POLICY "Admins can update user_roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- 5. Create get_user_permissions function
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
        "sizes_colors": "full", "site_editor": "full", "settings": "full", "employees": "full"
      }'::jsonb;
    WHEN 'editor' THEN
      _permissions := '{
        "dashboard": "view", "orders": "edit", "products": "edit", "categories": "edit",
        "customers": "view", "coupons": "edit", "landing_pages": "edit", "media": "edit",
        "sizes_colors": "edit", "site_editor": "edit", "settings": "none", "employees": "none"
      }'::jsonb;
    WHEN 'order_manager' THEN
      _permissions := '{
        "dashboard": "view", "orders": "edit", "products": "none", "categories": "none",
        "customers": "view", "coupons": "none", "landing_pages": "none", "media": "none",
        "sizes_colors": "none", "site_editor": "none", "settings": "none", "employees": "none"
      }'::jsonb;
    WHEN 'product_manager' THEN
      _permissions := '{
        "dashboard": "view", "orders": "none", "products": "edit", "categories": "edit",
        "customers": "none", "coupons": "none", "landing_pages": "none", "media": "edit",
        "sizes_colors": "edit", "site_editor": "none", "settings": "none", "employees": "none"
      }'::jsonb;
    WHEN 'viewer' THEN
      _permissions := '{
        "dashboard": "view", "orders": "view", "products": "view", "categories": "view",
        "customers": "view", "coupons": "view", "landing_pages": "view", "media": "view",
        "sizes_colors": "view", "site_editor": "view", "settings": "none", "employees": "none"
      }'::jsonb;
    ELSE
      _permissions := '{}'::jsonb;
  END CASE;

  RETURN jsonb_build_object('role', _role::text, 'permissions', _permissions);
END;
$$;

-- 6. Create has_any_role function for login check
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id
  )
$$;
