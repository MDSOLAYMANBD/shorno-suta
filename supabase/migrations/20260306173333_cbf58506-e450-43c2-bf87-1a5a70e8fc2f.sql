
CREATE TABLE public.courier_tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  consignment_id text,
  status text,
  note text,
  rider_name text,
  rider_phone text,
  hub_name text,
  hub_phone text,
  raw_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_courier_tracking_order_id ON public.courier_tracking_events(order_id);
CREATE INDEX idx_courier_tracking_consignment ON public.courier_tracking_events(consignment_id);

ALTER TABLE public.courier_tracking_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read courier tracking events"
  ON public.courier_tracking_events
  FOR SELECT
  TO authenticated
  USING (has_any_role(auth.uid()));

CREATE POLICY "Service role can insert courier tracking events"
  ON public.courier_tracking_events
  FOR INSERT
  WITH CHECK (false);
