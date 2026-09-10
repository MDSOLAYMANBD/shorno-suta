-- ============================================================
-- Fix: apply_gateway_sale_entry's existing-row check (SELECT ...
-- LIMIT 1, no FOR UPDATE) followed by a conditional INSERT is a
-- classic check-then-act race under Postgres's default READ
-- COMMITTED isolation. Two genuinely concurrent calls for the
-- same order (e.g. two bKash payment sessions for one order both
-- completing within milliseconds of each other — see the
-- Monitoring Runbook's "Duplicate Payment Detection" section)
-- could both observe "no existing row" before either commits its
-- INSERT, producing two ledger rows — and, worse, two balance
-- increments — for a single payment.
--
-- Fix, in two parts:
--   1. A partial unique index makes a second INSERT for the same
--      order's sale entry impossible at the database level,
--      regardless of application-level timing.
--   2. apply_gateway_sale_entry is redefined (CREATE OR REPLACE,
--      per this project's append-only migration convention — the
--      original migration 20260802145915 is not edited) so its
--      INSERT uses ON CONFLICT ... DO NOTHING against that index.
--
-- Decision (from implementation plan review): ON CONFLICT DO
-- NOTHING was chosen over DO UPDATE deliberately. The existing
-- amount-update logic further up in this function doesn't just
-- change acc_transactions.amount — it also computes and applies a
-- balance DELTA to acc_accounts.balance and writes an activity
-- log entry. A bare "DO UPDATE SET amount = EXCLUDED.amount" on
-- the INSERT would bypass all of that and silently corrupt the
-- account balance. DO NOTHING, combined with checking whether the
-- INSERT actually happened (via RETURNING ... INTO / FOUND) before
-- touching the balance or activity log, means: on conflict, this
-- call did not win the race, so it does nothing further — the
-- concurrent call that *did* win already applied the balance
-- change and logged it. The pre-existing SELECT-based branch
-- above (unchanged) remains the sole path for legitimate amount
-- corrections in the common, non-concurrent case.
--
-- Scope of the unique index: deliberately narrow — reference_id
-- only, under a partial predicate fixing reference_type='order'
-- AND type='sale'. acc_transactions is a general-purpose ledger
-- used for salary/expense/other transaction types that have no
-- "one row per reference" semantic; a blanket unique constraint
-- would risk breaking those. This index only ever applies to
-- gateway-driven order-sale entries.
--
-- IMPORTANT — operational precondition before this migration is
-- applied: run the duplicate-detection query from
-- docs/bkash-production-monitoring-runbook.md (§3/§7) against the
-- target database first. If any order already has more than one
-- acc_transactions row with type='sale' and reference_type='order'
-- for the same reference_id, CREATE UNIQUE INDEX below will fail
-- outright — Postgres refuses to build a unique index over data
-- that already violates it. Any such duplicates must be resolved
-- manually (see the Rollback plan §5) before this migration can
-- succeed. This check is intentionally NOT embedded as a guard
-- inside this migration — see implementation plan Decision 6.
-- ============================================================

CREATE UNIQUE INDEX acc_transactions_order_sale_uniq
  ON public.acc_transactions (reference_id)
  WHERE reference_type = 'order' AND type = 'sale';

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
  v_new_id uuid;
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

  -- Common, non-concurrent path: an entry already exists (checked
  -- and possibly amount-corrected here, unchanged from before).
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

  -- Race-safety net: if a concurrent call already inserted the sale
  -- entry for this order between the SELECT above and this INSERT,
  -- the partial unique index causes a conflict here and DO NOTHING
  -- skips the insert. RETURNING ... INTO leaves v_new_id NULL and
  -- FOUND false in that case (standard PL/pgSQL behavior for an
  -- INSERT ... RETURNING that returns no row).
  INSERT INTO public.acc_transactions
    (account_id, type, amount, description, reference_id, reference_type, created_by, source, created_at)
  VALUES
    (v_account.id, 'sale', p_amount, v_desc, p_order_id::text, 'order', NULL, p_source, v_order.created_at)
  ON CONFLICT (reference_id) WHERE reference_type = 'order' AND type = 'sale' DO NOTHING
  RETURNING id INTO v_new_id;

  IF NOT FOUND THEN
    -- Lost the race — a concurrent call already inserted and will
    -- apply the balance change and activity log itself. Doing
    -- either here too would double-count the sale, which is
    -- exactly the bug this migration fixes.
    RETURN;
  END IF;

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
