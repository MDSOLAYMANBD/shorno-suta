CREATE OR REPLACE FUNCTION public.auto_bank_courier_payment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'Paid' AND (NEW.receive_method IS NULL OR NEW.receive_method = '') THEN
    NEW.receive_method := 'Bank';
    NEW.bank_amount := COALESCE(NEW.receivable_amount, 0);
    NEW.cash_amount := 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_bank_courier_payment ON public.courier_payments;
CREATE TRIGGER trg_auto_bank_courier_payment
BEFORE INSERT OR UPDATE ON public.courier_payments
FOR EACH ROW EXECUTE FUNCTION public.auto_bank_courier_payment();