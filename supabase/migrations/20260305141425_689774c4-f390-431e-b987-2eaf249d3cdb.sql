
CREATE TABLE public.giveaway_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_number serial NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_name text NOT NULL DEFAULT '',
  profile_link text DEFAULT '',
  profile_screenshot text DEFAULT '',
  packaging_image text DEFAULT '',
  product_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.giveaway_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read giveaway entries"
  ON public.giveaway_entries FOR SELECT USING (true);

CREATE POLICY "Admins can manage giveaway entries"
  ON public.giveaway_entries FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
