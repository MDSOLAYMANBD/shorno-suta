-- ============================================================
-- Single source of truth for "record a paid-order sale entry",
-- for payment-gateway-driven payments (bKash today, any future
-- gateway going forward).
--
-- This is a faithful SQL port of the exact rule set already
-- implemented in src/lib/officeSellSaleEntry.ts's
-- ensureOfficeSellSaleEntry() — same table, same
-- reference_id/reference_type/type='sale' matching, same
-- insert/update fields, same balance-adjust math, same
-- acc_activity_logs shape. It does NOT change, replace, or call
-- into that existing TypeScript function — the admin panel's
-- "mark as Paid" flow (AdminOrders.tsx -> officeSellSaleEntry.ts)
-- is untouched and keeps working exactly as it does today.
--
-- Locked to service_role only: this bypasses RLS by design
-- (SECURITY DEFINER) and must never be callable by anon/
-- authenticated clients via PostgREST.
-- ============================================================

CREATE OR REPLACE FUNCTION public.apply_gateway_sale_entry(
  p_order_id uuid,
  p_amount numeric,
  p_source text DEFAULT 'bank'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_account RECORD;
  v_existing RECORD;
  v_desc text;
  v_order_num text;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN;
  END IF;

  SELECT id, order_number, created_at INTO v_order
  FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT id, balance INTO v_account
  FROM public.acc_accounts WHERE type = 'sale' LIMIT 1;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_order_num := COALESCE(v_order.order_number, '');

  SELECT id, amount INTO v_existing
  FROM public.acc_transactions
  WHERE reference_id = p_order_id::text
    AND reference_type = 'order'
    AND type = 'sale'
  LIMIT 1;

  IF FOUND THEN
    IF v_existing.amount <> p_amount THEN
      UPDATE public.acc_transactions SET amount = p_amount WHERE id = v_existing.id;
      UPDATE public.acc_accounts SET balance = balance + (p_amount - v_existing.amount) WHERE id = v_account.id;

      INSERT INTO public.acc_activity_logs
        (user_id, action, entity_type, entity_id, entity_name, old_data, new_data, description)
      VALUES (
        NULL, 'update', 'transaction', v_existing.id::text,
        'বিক্রি #' || v_order_num,
        jsonb_build_object('amount', v_existing.amount, 'orderId', p_order_id),
        jsonb_build_object('amount', p_amount, 'orderId', p_order_id),
        'সেল এন্ট্রি আপডেট: ৳' || v_existing.amount || ' → ৳' || p_amount
      );
    END IF;
    RETURN;
  END IF;

  v_desc := CASE
    WHEN v_order_num <> '' THEN 'অনলাইন পেমেন্ট #' || v_order_num || ' — অটো এন্ট্রি'
    ELSE 'অনলাইন পেমেন্ট — অটো এন্ট্রি'
  END;

  INSERT INTO public.acc_transactions
    (account_id, type, amount, description, reference_id, reference_type, created_by, source, created_at)
  VALUES
    (v_account.id, 'sale', p_amount, v_desc, p_order_id::text, 'order', NULL, p_source, v_order.created_at);

  UPDATE public.acc_accounts SET balance = balance + p_amount WHERE id = v_account.id;

  INSERT INTO public.acc_activity_logs
    (user_id, action, entity_type, entity_name, old_data, new_data, description)
  VALUES (
    NULL, 'create', 'transaction',
    'বিক্রি ৳' || p_amount || ' #' || v_order_num,
    '{}'::jsonb,
    jsonb_build_object('orderId', p_order_id, 'amount', p_amount, 'source', p_source),
    v_desc
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_gateway_sale_entry(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_gateway_sale_entry(uuid, numeric, text) TO service_role;
