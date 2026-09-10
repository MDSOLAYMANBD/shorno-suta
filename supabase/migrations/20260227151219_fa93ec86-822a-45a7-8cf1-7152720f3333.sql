
-- customer_reviews table
CREATE TABLE public.customer_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  customer_location text,
  rating integer NOT NULL DEFAULT 5,
  review_text text,
  images text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (public review submission)
CREATE POLICY "Anyone can submit reviews"
ON public.customer_reviews FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Public can only read approved reviews
CREATE POLICY "Public can read approved reviews"
ON public.customer_reviews FOR SELECT
TO anon, authenticated
USING (status = 'approved');

-- Admins can read all reviews
CREATE POLICY "Admins can read all reviews"
ON public.customer_reviews FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Admins can update reviews (approve/reject)
CREATE POLICY "Admins can update reviews"
ON public.customer_reviews FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Admins can delete reviews
CREATE POLICY "Admins can delete reviews"
ON public.customer_reviews FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Storage bucket for review images
INSERT INTO storage.buckets (id, name, public)
VALUES ('review-images', 'review-images', true);

-- Anyone can upload review images
CREATE POLICY "Anyone can upload review images"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'review-images');

-- Anyone can read review images
CREATE POLICY "Anyone can read review images"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'review-images');

-- Admins can delete review images
CREATE POLICY "Admins can delete review images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'review-images' AND has_role(auth.uid(), 'admin'));
