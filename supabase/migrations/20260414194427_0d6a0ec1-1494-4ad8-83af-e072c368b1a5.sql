ALTER TABLE public.order_exchanges 
  ADD COLUMN IF NOT EXISTS new_order_id uuid REFERENCES public.orders(id);