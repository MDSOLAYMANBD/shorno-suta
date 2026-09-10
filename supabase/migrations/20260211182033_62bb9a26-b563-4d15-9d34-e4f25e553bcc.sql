
CREATE TABLE public.order_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.order_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view order notes"
ON public.order_notes FOR SELECT
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Authenticated users can insert order notes"
ON public.order_notes FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Authenticated users can delete order notes"
ON public.order_notes FOR DELETE
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()));

CREATE INDEX idx_order_notes_order_id ON public.order_notes(order_id);
