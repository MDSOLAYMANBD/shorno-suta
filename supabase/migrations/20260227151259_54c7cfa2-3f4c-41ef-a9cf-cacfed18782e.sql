
-- Replace the overly permissive INSERT policy with a validated one
DROP POLICY "Anyone can submit reviews" ON public.customer_reviews;

CREATE POLICY "Anyone can submit reviews with validation"
ON public.customer_reviews FOR INSERT
TO anon, authenticated
WITH CHECK (
  customer_name IS NOT NULL
  AND length(trim(customer_name)) > 0
  AND length(trim(customer_name)) <= 200
  AND (customer_location IS NULL OR length(trim(customer_location)) <= 200)
  AND (review_text IS NULL OR length(trim(review_text)) <= 2000)
  AND rating >= 1 AND rating <= 5
  AND status = 'pending'
);
