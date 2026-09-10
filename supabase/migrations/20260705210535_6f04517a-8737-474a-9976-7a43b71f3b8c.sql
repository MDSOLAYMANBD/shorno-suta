
-- 1) acc_transactions: enforce type immutability + non-admin can only touch 'sale'
CREATE OR REPLACE FUNCTION public.enforce_acc_transactions_type_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  -- Service role / no auth context (server-side) bypasses
  IF uid IS NULL THEN
    RETURN NEW;
  END IF;

  -- Admins can do anything
  IF public.has_role(uid, 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- For any other role (e.g. order_manager), type must be 'sale' and cannot be mutated away from 'sale'
  IF TG_OP = 'UPDATE' AND OLD.type IS DISTINCT FROM NEW.type THEN
    RAISE EXCEPTION 'Changing transaction type is not permitted';
  END IF;

  IF NEW.type <> 'sale' THEN
    RAISE EXCEPTION 'Only sale transactions are permitted for this role';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_acc_transactions_type_guard ON public.acc_transactions;
CREATE TRIGGER trg_acc_transactions_type_guard
BEFORE INSERT OR UPDATE ON public.acc_transactions
FOR EACH ROW EXECUTE FUNCTION public.enforce_acc_transactions_type_guard();


-- 2) customer_reviews: require order ownership when order_id is provided
DROP POLICY IF EXISTS "Anyone can submit reviews with validation" ON public.customer_reviews;

CREATE POLICY "Anyone can submit reviews with validation"
ON public.customer_reviews
FOR INSERT
TO public
WITH CHECK (
  customer_name IS NOT NULL
  AND length(trim(both from customer_name)) > 0
  AND length(trim(both from customer_name)) <= 200
  AND (customer_location IS NULL OR length(trim(both from customer_location)) <= 200)
  AND (review_text IS NULL OR length(trim(both from review_text)) <= 2000)
  AND rating >= 1 AND rating <= 5
  AND status = 'pending'
  AND (customer_user_id IS NULL OR customer_user_id = auth.uid())
  -- If an order_id is referenced, submitter must own that order
  AND (
    order_id IS NULL
    OR (
      auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = order_id
          AND o.customer_user_id = auth.uid()
      )
    )
  )
);


-- 3) site_visits: rate-limit inserts per session (max 60 per minute)
CREATE OR REPLACE FUNCTION public.enforce_site_visits_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count int;
BEGIN
  IF NEW.session_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO recent_count
  FROM public.site_visits
  WHERE session_id = NEW.session_id
    AND created_at > now() - interval '1 minute';

  IF recent_count >= 60 THEN
    RAISE EXCEPTION 'site_visits rate limit exceeded for this session';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_site_visits_rate_limit ON public.site_visits;
CREATE TRIGGER trg_site_visits_rate_limit
BEFORE INSERT ON public.site_visits
FOR EACH ROW EXECUTE FUNCTION public.enforce_site_visits_rate_limit();

CREATE INDEX IF NOT EXISTS idx_site_visits_session_created
  ON public.site_visits (session_id, created_at DESC);
