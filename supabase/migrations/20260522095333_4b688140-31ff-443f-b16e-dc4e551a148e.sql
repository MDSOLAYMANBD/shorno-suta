ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS courier_last_synced_total numeric;
-- Backfill existing rows that already have a consignment so we don't trigger a false resync on first edit
UPDATE public.orders SET courier_last_synced_total = total WHERE courier_consignment_id IS NOT NULL AND courier_last_synced_total IS NULL;