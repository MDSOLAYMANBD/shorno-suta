ALTER TABLE public.customer_reviews 
ADD COLUMN IF NOT EXISTS order_id uuid,
ADD COLUMN IF NOT EXISTS product_id uuid,
ADD COLUMN IF NOT EXISTS product_name text;