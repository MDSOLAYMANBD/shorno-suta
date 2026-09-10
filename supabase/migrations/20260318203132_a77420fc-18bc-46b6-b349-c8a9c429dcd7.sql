ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS shop_banner_url text DEFAULT NULL;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS shop_banner_tagline text DEFAULT NULL;