-- Add email column to customer_profiles
ALTER TABLE public.customer_profiles ADD COLUMN IF NOT EXISTS email text DEFAULT '';

-- Create function to get auth info for admin
CREATE OR REPLACE FUNCTION public.get_customer_auth_info(user_ids uuid[])
RETURNS TABLE (id uuid, email text, provider text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT 
    u.id,
    u.email,
    COALESCE(u.raw_app_meta_data->>'provider', 'email') as provider
  FROM auth.users u
  WHERE u.id = ANY(user_ids);
$$;

-- Update trigger to capture email on Google signup
CREATE OR REPLACE FUNCTION public.handle_new_customer_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.customer_profiles (user_id, full_name, phone, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    CASE 
      WHEN COALESCE(NEW.raw_app_meta_data->>'provider', 'email') != 'email' 
      THEN COALESCE(NEW.email, '')
      ELSE ''
    END,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', NULL)
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;