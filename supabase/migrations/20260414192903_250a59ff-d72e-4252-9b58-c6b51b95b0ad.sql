ALTER TABLE public.order_exchanges 
  DROP CONSTRAINT IF EXISTS order_exchanges_status_check;
ALTER TABLE public.order_exchanges 
  ADD CONSTRAINT order_exchanges_status_check 
  CHECK (status IN ('pending', 'confirmed', 'shipped', 'completed', 'cancelled'));