
-- Add courier_provider column to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS courier_provider text;

-- Comment for clarity
COMMENT ON COLUMN public.orders.courier_provider IS 'Which courier service was used: steadfast, pathao, redx. NULL means steadfast (legacy)';
