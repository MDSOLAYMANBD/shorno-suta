
-- Create order_exchanges table
CREATE TABLE public.order_exchanges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  exchange_type TEXT NOT NULL CHECK (exchange_type IN ('store_fault', 'customer_fault', 'product_swap')),
  old_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  new_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  old_total NUMERIC NOT NULL DEFAULT 0,
  new_total NUMERIC NOT NULL DEFAULT 0,
  price_difference NUMERIC NOT NULL DEFAULT 0,
  extra_delivery_charge NUMERIC NOT NULL DEFAULT 0,
  customer_owes NUMERIC NOT NULL DEFAULT 0,
  store_owes NUMERIC NOT NULL DEFAULT 0,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_exchanges ENABLE ROW LEVEL SECURITY;

-- Admin and order_manager can do everything
CREATE POLICY "Admins can manage exchanges"
ON public.order_exchanges
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'order_manager')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'order_manager')
);

-- Editors can view
CREATE POLICY "Editors can view exchanges"
ON public.order_exchanges
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'editor'));

-- Index for fast lookup by order
CREATE INDEX idx_order_exchanges_order_id ON public.order_exchanges(order_id);
