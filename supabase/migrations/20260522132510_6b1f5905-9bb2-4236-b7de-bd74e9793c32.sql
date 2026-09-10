CREATE TABLE IF NOT EXISTS public.order_courier_parcels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  courier_name text NOT NULL DEFAULT 'steadfast',
  consignment_id text,
  tracking_code text,
  cod_amount numeric DEFAULT 0,
  status text,
  is_active boolean NOT NULL DEFAULT true,
  reason text,
  raw_response jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ocp_order ON public.order_courier_parcels(order_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_ocp_active ON public.order_courier_parcels(order_id) WHERE is_active = true;

ALTER TABLE public.order_courier_parcels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read courier parcels"
ON public.order_courier_parcels FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid()));

CREATE POLICY "Staff can insert courier parcels"
ON public.order_courier_parcels FOR INSERT TO authenticated
WITH CHECK (public.has_any_role(auth.uid()));

CREATE POLICY "Staff can update courier parcels"
ON public.order_courier_parcels FOR UPDATE TO authenticated
USING (public.has_any_role(auth.uid()));

INSERT INTO public.order_courier_parcels (order_id, courier_name, consignment_id, tracking_code, cod_amount, status, is_active, reason, created_at)
SELECT o.id, COALESCE(o.courier_provider, 'steadfast'), o.courier_consignment_id::text, o.courier_tracking_code, COALESCE(o.courier_last_synced_total, o.total, 0), o.courier_status, true, 'seed_initial', o.created_at
FROM public.orders o
WHERE o.courier_consignment_id IS NOT NULL;