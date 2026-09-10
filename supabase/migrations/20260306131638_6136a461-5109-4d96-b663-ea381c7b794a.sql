CREATE OR REPLACE FUNCTION public.claim_orders_by_phone(_user_id uuid, _phone text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean_phone text;
  claimed integer := 0;
BEGIN
  -- Security: only allow claiming for own user
  IF _user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  clean_phone := regexp_replace(regexp_replace(_phone, '[\s-]', '', 'g'), '^\+?88', '');
  IF clean_phone = '' OR length(clean_phone) < 10 THEN
    RETURN 0;
  END IF;

  UPDATE orders
  SET customer_user_id = _user_id
  WHERE customer_user_id IS NULL
    AND deleted_at IS NULL
    AND customer_phone IN (clean_phone, '+88' || clean_phone, '88' || clean_phone);

  GET DIAGNOSTICS claimed = ROW_COUNT;
  RETURN claimed;
END;
$$;