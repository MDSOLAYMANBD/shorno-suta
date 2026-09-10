
CREATE TABLE public.global_sizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.global_colors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.global_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_colors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read sizes" ON public.global_sizes FOR SELECT USING (true);
CREATE POLICY "Anyone can read colors" ON public.global_colors FOR SELECT USING (true);

CREATE POLICY "Admin manage sizes" ON public.global_sizes FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin manage colors" ON public.global_colors FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.global_sizes (name, sort_order) VALUES
  ('XS', 1), ('S', 2), ('M', 3), ('L', 4), ('XL', 5);
