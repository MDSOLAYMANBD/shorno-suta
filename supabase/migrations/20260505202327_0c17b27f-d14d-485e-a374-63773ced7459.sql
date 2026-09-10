DO $$
DECLARE p text;
BEGIN
  FOR p IN SELECT DISTINCT phone FROM public.customers WHERE phone IS NOT NULL AND trim(phone) <> ''
  LOOP
    PERFORM public.recompute_customer_stats(p);
  END LOOP;
END $$;