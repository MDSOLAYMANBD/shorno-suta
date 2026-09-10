-- 1. Add SELECT policy for order_manager on acc_transactions (sale only)
CREATE POLICY "Order managers can read sale transactions"
ON public.acc_transactions FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'order_manager'::app_role)
  AND type = 'sale'
);

-- 2. Add INSERT policy for order_manager on acc_transactions (sale only)
CREATE POLICY "Order managers can insert sale transactions"
ON public.acc_transactions FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'order_manager'::app_role)
  AND type = 'sale'
);

-- 3. Add UPDATE policy for order_manager on acc_transactions (sale only)
CREATE POLICY "Order managers can update sale transactions"
ON public.acc_transactions FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'order_manager'::app_role)
  AND type = 'sale'
)
WITH CHECK (
  has_role(auth.uid(), 'order_manager'::app_role)
  AND type = 'sale'
);

-- 4. Cleanup orphaned sale entries for unpaid orders and adjust balances
DO $$
DECLARE
  orphan RECORD;
  current_balance NUMERIC;
BEGIN
  FOR orphan IN
    SELECT t.id, t.amount, t.account_id
    FROM acc_transactions t
    JOIN orders o ON t.reference_id = o.id::text
    WHERE t.type = 'sale'
      AND t.reference_type = 'order'
      AND o.payment_status = 'unpaid'
  LOOP
    SELECT balance INTO current_balance FROM acc_accounts WHERE id = orphan.account_id;
    IF FOUND THEN
      UPDATE acc_accounts SET balance = current_balance - orphan.amount WHERE id = orphan.account_id;
    END IF;
    DELETE FROM acc_transactions WHERE id = orphan.id;
  END LOOP;
END $$;