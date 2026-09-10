-- ============================================================
-- Fix: permanently deleting an order must not destroy its bKash
-- (or any future gateway's) payment audit trail.
--
-- payment_transactions.order_id was originally declared
-- ON DELETE CASCADE. AdminOrders.tsx's existing "permanently
-- delete" bulk action performs a real hard DELETE on orders
-- (unrelated to this payment work, predates it). Combined, a
-- routine trash-cleanup action would silently and irreversibly
-- destroy payment_transactions rows — the only record of a
-- gateway's transaction ID, verification result, and gateway
-- response for that order.
--
-- Fix: ON DELETE SET NULL instead of CASCADE. The payment audit
-- row survives as an orphan (order_id nulled) rather than being
-- destroyed. This requires order_id to become nullable, since a
-- NOT NULL column cannot have ON DELETE SET NULL.
--
-- Decision (from implementation plan review): SET NULL was
-- chosen over ON DELETE RESTRICT specifically so the existing
-- admin permanent-delete workflow is not changed or blocked —
-- see docs/bkash-rollback-disaster-recovery-plan.md §3.
--
-- Note: this migration is not cleanly reversible once any order
-- has been permanently deleted under the new behavior — any
-- resulting order_id = NULL rows would block re-adding NOT NULL
-- + CASCADE without first resolving them. See the Rollback plan.
-- ============================================================

ALTER TABLE public.payment_transactions
  DROP CONSTRAINT payment_transactions_order_id_fkey;

ALTER TABLE public.payment_transactions
  ALTER COLUMN order_id DROP NOT NULL;

ALTER TABLE public.payment_transactions
  ADD CONSTRAINT payment_transactions_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;
