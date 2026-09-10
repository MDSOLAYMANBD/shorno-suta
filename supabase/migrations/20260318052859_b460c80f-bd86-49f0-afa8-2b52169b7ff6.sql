
-- Add feed_title and feed_description columns to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS feed_title text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS feed_description text;
