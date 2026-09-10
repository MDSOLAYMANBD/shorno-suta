
CREATE TABLE public.product_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  product_ids uuid[] NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.product_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read collections"
  ON public.product_collections
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admin can manage collections"
  ON public.product_collections
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
