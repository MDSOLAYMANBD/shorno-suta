ALTER TABLE public.acc_production_entries 
  ADD COLUMN order_number text,
  ADD COLUMN order_total_quantity integer;