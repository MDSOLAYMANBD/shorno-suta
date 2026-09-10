
ALTER TABLE public.customers
ADD COLUMN courier_data jsonb DEFAULT NULL,
ADD COLUMN courier_checked_at timestamptz DEFAULT NULL;
