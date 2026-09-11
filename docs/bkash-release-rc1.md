# bKash Payment Integration — Release Candidate 1 (RC1)

**Status:** Frozen for release. No further feature work, refactoring, or optimization against this scope until RC1 has been through the sandbox QA sequence below.
**Companion documents:** `bkash-integration-qa-guide.md`, `bkash-production-monitoring-runbook.md`, `bkash-rollback-disaster-recovery-plan.md`.

---

## 1. Final Release Summary

Adds bKash Tokenized Checkout (mode `0011`, one-time payment) as a second online payment gateway alongside the existing UddoktaPay integration, with independent admin enable/disable toggles (COD always available). Includes four post-implementation-audit fixes: payment amount now sourced from the amount frozen at Create Payment time rather than a live, mutable order total; permanently deleting an order no longer destroys its payment audit trail; a database-level unique constraint closes a concurrency race that could have double-counted a ledger entry; and gateway API responses are filtered to an allowlist before storage. UddoktaPay, the existing accounting module's admin-facing "mark as Paid" flow, the courier integrations, and all pre-existing order/notification/reporting logic were not modified.

---

## 2. Complete List of Changed Files

**New files (this release):**
- `supabase/functions/bkash-checkout/index.ts`
- `supabase/functions/bkash-verify/index.ts`
- `supabase/functions/_shared/bkash-client.ts`
- `supabase/migrations/20260802142800_add_bkash_payment_gateway.sql`
- `supabase/migrations/20260802145915_add_apply_gateway_sale_entry_rpc.sql`
- `supabase/migrations/20260802172628_payment_transactions_order_id_set_null.sql`
- `supabase/migrations/20260802172834_fix_apply_gateway_sale_entry_race.sql`
- `src/lib/paymentMethods.ts`
- `src/hooks/usePaymentMethods.ts`
- `src/pages/admin/AdminPaymentSettings.tsx`
- `docs/bkash-integration-qa-guide.md`
- `docs/bkash-production-monitoring-runbook.md`
- `docs/bkash-rollback-disaster-recovery-plan.md`
- `docs/bkash-release-rc1.md` (this file)

**Modified files (this release):**
- `supabase/functions/send-order-notification/index.ts` — extended for `type:'payment'` (email always, SMS admin-gated); `confirmation`/`processing`/`shipped`/`delivered` paths unchanged.
- `supabase/functions/order-memo/index.ts` — two columns added to its `select()`; response shape additive only.
- `supabase/functions/_shared/smsProviders.ts` — one additional allowed SMS purpose (`payment_confirmation`); `order_confirmation` path unchanged.
- `supabase/config.toml` — two new `[functions.*]` entries; existing entries (including both `uddoktapay-*`) unchanged.
- `src/pages/Checkout.tsx` — payment-method button grid now driven by the enabled-methods registry; bKash branch added beside the untouched UddoktaPay branch.
- `src/pages/PaymentResult.tsx` — gateway detection added (routes to `bkash-verify` vs `uddoktapay-verify` based on which redirect param is present); UddoktaPay branch logic unchanged.
- `src/pages/PublicMemo.tsx` — invoice now displays transaction ID/paid-at when present; existing payment-status card logic unchanged.
- `src/pages/admin/AdminOrders.tsx` — payment status/method filters and per-row payment detail display added; existing status/origin filters unchanged.
- `src/pages/admin/AdminDashboard.tsx` — one sidebar entry added.
- `src/pages/admin/AdminSettings.tsx` — one settings-hub card added.
- `src/App.tsx` — one lazy route added.

**Incidental, not part of this release (auto-generated / unrelated):**
- `package-lock.json` — dependency lockfile churn from local tooling, not a feature change.
- `public/sitemap.xml` — regenerated automatically by the existing `prebuild` script on every build; not hand-edited.

---

## 3. Complete List of Migrations, Execution Order

1. `20260802142800_add_bkash_payment_gateway.sql` — creates `payment_transactions`, adds `orders.paid_at`, widens the `store_settings` public-read whitelist by two keys.
2. `20260802145915_add_apply_gateway_sale_entry_rpc.sql` — creates the `apply_gateway_sale_entry` RPC (service-role only).
3. `20260802172628_payment_transactions_order_id_set_null.sql` — changes `payment_transactions.order_id` from `NOT NULL ON DELETE CASCADE` to nullable `ON DELETE SET NULL`.
4. `20260802172834_fix_apply_gateway_sale_entry_race.sql` — adds the `acc_transactions_order_sale_uniq` partial unique index; redefines `apply_gateway_sale_entry` via `CREATE OR REPLACE FUNCTION` to use `ON CONFLICT ... DO NOTHING`.

**Mandatory pre-condition before migration 4:** run the duplicate-detection query (Monitoring Runbook §7) against the target database; it must return zero rows, or `CREATE UNIQUE INDEX` will fail outright.
**Recommended pre-condition before migration 3:** confirm the live FK constraint name is `payment_transactions_order_id_fkey` (`information_schema.table_constraints`) before running — the migration assumes Postgres's default auto-generated name for an inline `REFERENCES` clause; this has not been confirmed against a live schema in this project.

None of these migrations have been applied to any database as of this release candidate — they exist as files only.

---

## 4. Required Environment Variables

No new environment variables are introduced by this release. bKash's own credentials (`app_key`, `app_secret`, `username`, `password`) are stored in `store_settings` via the admin panel, not as Supabase project secrets — this is a deliberate design choice matching how UddoktaPay's own credentials are already handled in this codebase.

The existing environment variables already required by every Edge Function in this project remain required and unchanged:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY` (used by functions that verify a caller's JWT; not required by `bkash-checkout`/`bkash-verify` themselves, which are public endpoints)

---

## 5. Required Secrets

No new Supabase project secrets are required for this release. The three variables listed above must already be configured on the project (they are — every pre-existing Edge Function depends on them). bKash's four credential values are entered once, post-deployment, via **Admin → Settings → পেমেন্ট সেটিংস**, and stored in `store_settings` (admin-only readable, per the existing RLS policy — not exposed to anon/authenticated clients).

---

## 6. Required Supabase Deployment Commands

Run from the project root, against the correct Supabase project (`xxucasikopqtcztbgfbw`):

```bash
supabase db push
```
(applies all pending migrations, including the four listed in §3, in filename order — confirm the two pre-conditions in §3 before running)

```bash
supabase functions deploy bkash-checkout
supabase functions deploy bkash-verify
supabase functions deploy send-order-notification
supabase functions deploy order-memo
```

`_shared/bkash-client.ts` and `_shared/smsProviders.ts` are not deployed independently — they are bundled automatically with every function that imports them (`bkash-checkout`, `bkash-verify`, `send-order-notification`) when those functions are deployed.

---

## 7. Required Frontend Deployment Commands

```bash
npm run build
```
(runs the existing `prebuild` sitemap-generation step automatically, then the Vite production build into `dist/`)

Deploy the resulting `dist/` output through this project's existing hosting deployment step. This release does not introduce a new hosting target or deployment mechanism — whatever process currently ships `dist/` to production is unchanged.

---

## 8. Exact Rollback Procedure

In order of increasing severity/disruption — stop at the earliest step that resolves the incident:

1. **Disable bKash**: Admin → Settings → পেমেন্ট সেটিংস → toggle off. Immediate, no deploy required. Hides the checkout button and independently blocks `bkash-checkout` server-side. Does not affect any payment already in progress — those still resolve correctly through `bkash-verify`.
2. **If step 1 is insufficient and the frontend itself is broken** (not just the bKash flow): redeploy the previous frontend build.
3. **If `bkash-checkout`/`bkash-verify` themselves must be un-deployed**: first confirm zero non-terminal rows exist —
   ```sql
   select count(*) from payment_transactions where gateway = 'bkash' and status in ('initiated','processing');
   ```
   Only proceed if this returns 0; otherwise disable via step 1 instead and leave the functions deployed so in-flight sessions can still resolve.
4. **If `apply_gateway_sale_entry` must be reverted**: redeploy its pre-migration-4 body via a new `CREATE OR REPLACE FUNCTION` **first**. Only drop `acc_transactions_order_sale_uniq` **after** that — dropping the index first while the current function is still live will break it (its `ON CONFLICT` clause references that index).
5. **Do not revert the `payment_transactions.order_id` FK migration** once any order has been permanently deleted under the new behavior — resulting `NULL` rows will block re-adding `NOT NULL`, and there is no scenario in which reverting to `CASCADE` is desirable (it only reintroduces data loss).
6. **Never** drop `payment_transactions` if any real payment has been processed through it — it is the only record of what happened, regardless of whether bKash is currently enabled.

Full detail and reasoning for each of these: `bkash-rollback-disaster-recovery-plan.md`.

---

## 9. Exact Sandbox QA Sequence

Run in this order, per `bkash-integration-qa-guide.md`:

1. Sandbox Setup
2. Admin Configuration
3. Database Migration Verification (all 6 checks, including the pre-flight duplicate check before migration 4)
4. Edge Function Deployment Verification
5. Frontend Verification
6. Successful Payment Test
7. Failed Payment Test
8. Cancel Payment Test
9. Duplicate Callback Test
10. Refresh Page Test
11. Double-Click Payment Test
12. Invoice Verification
13. Accounting Verification, including **13a — Concurrency Regression Check** (two concurrent sessions for one order must produce exactly one `acc_transactions` row — this is the specific test that proves the Phase 3 fix works, not just that it deployed)
14. SMS Verification
15. Email Verification
16. Order History Verification
17. Admin Orders Verification
18. Reports Verification
19. Courier Verification
20. Production Deployment Verification (Sandbox→Live credential switch, one real low-value transaction)

Every test must reach Pass on the sign-off table before proceeding to §10.

---

## 10. Exact Production Deployment Sequence

1. Confirm all 20 sandbox tests (§9) are marked Pass.
2. Run the pre-flight duplicate-detection query against the **production** database (not staging) — zero rows required.
3. Confirm the live FK constraint name (§3 note) against the **production** schema.
4. `supabase db push` against production — applies all four migrations in order.
5. Deploy the four functions listed in §6 to production.
6. Deploy the frontend build (§7) to production.
7. Leave the bKash admin toggle **off** through steps 4–6.
8. Re-run Database Migration Verification (QA guide Test 3, all 6 checks) against the live production database specifically.
9. Enter production bKash credentials via Admin → Settings → পেমেন্ট সেটিংস; set Environment to **Live**.
10. Enable the bKash toggle.
11. Immediately proceed to §11.

---

## 11. Post-Deployment Verification Checklist

- [ ] `payment_transactions` table exists in production with the correct schema (QA guide Test 3, all 6 items).
- [ ] `acc_transactions_order_sale_uniq` exists in production.
- [ ] One real, low-value bKash transaction completes end to end (Tests 6, 12, 13, 15, 17 in miniature).
- [ ] That transaction's `payment_transactions.gateway_response` shows the live base URL (`tokenized.pay.bka.sh`), not the sandbox host.
- [ ] That transaction's `acc_transactions` entry is structurally identical to a manually-marked-paid order's entry (Test 13's comparison).
- [ ] Confirmation email received; SMS behaves per the current admin toggle state.
- [ ] Invoice (`/memo/:orderId`) shows PAID, method, transaction ID, and timestamp.
- [ ] Admin order list filters correctly find the transaction by payment status and method.
- [ ] UddoktaPay and COD checkout both still work, unaffected, in production (regression check).

---

## 12. Monitoring Checklist

Per `bkash-production-monitoring-runbook.md`, beginning immediately at launch:

- **Stuck-transaction check** (§2): any `payment_transactions` row at `status='processing'` for >5 minutes → investigate; >30 minutes → treat as a confirmed incident.
- **Duplicate-session check** (§3, `order_id is not null`-filtered): daily.
- **Accounting reconciliation** (§4): daily total comparison; per-order spot check on any support ticket.
- **Notification failure rate** (§5): daily.
- **Courier reconciliation** (§6): daily/weekly for any bKash-paid order dispatched via Pathao or RedX specifically (known gap, not auto-detectable).
- **Payment success rate** (§1): rolling-hour during the first two weeks post-launch, daily thereafter.
- Alert thresholds and first-response procedures: §8/§9 of the same document, unchanged by this release.

---

## 13. Known Limitations

Carried forward from implementation and both adversarial reviews, none blocking this release:

- If two concurrent bKash sessions exist for the same order **and** their frozen amounts differ, the losing session's amount is silently dropped rather than reconciled (not double-counted — that was the bug fixed; this is a narrower residual gap).
- An order permanently deleted while a bKash payment is still in flight results in a `paid` audit row with no order and no accounting entry to reconcile against — the payment record survives (the actual goal), but full reconciliation becomes impossible for that specific case.
- `payment_transactions.amount` remains schema-nullable despite always being populated by the only current writer; no `NOT NULL` constraint was added.
- Pathao and RedX do not read `due_amount`/`paid_amount` and will request full COD on an already-paid order regardless of gateway — pre-existing, identical for UddoktaPay, not introduced or fixed by this release.
- Rate limiting on `bkash-checkout`/`bkash-verify` is in-memory and per-instance, not durable across concurrent Edge Function isolates — same limitation as the existing UddoktaPay functions.
- Whether a premature (pre-customer-approval) call to `bkash-verify` has any consequence on bKash's side is unconfirmed — no ownership binding exists on the public endpoint, and bKash's exact behavior in that case was never verified against a primary source.
- No automated test suite exists for any of this; all verification is the manual QA guide.
- None of this release's code has been executed against a live database or live bKash sandbox in the course of building it — verification to date is static code/SQL review only.

---

## 14. Final GO / NO-GO

**GO — for the sandbox QA sequence (§9), not yet for production traffic.**

RC1 is complete and frozen: every planned fix from the implementation and both adversarial reviews is present in the codebase, verified by direct re-reading against fresh `git diff` output and a clean `tsc`/`vite build`, with zero unresolved code-level defects. What remains before this can be a production GO is entirely execution, not engineering: apply the migrations, run the pre-flight checks, deploy, and pass all 20 sandbox tests including 13a. This document exists so that sequence can be followed exactly, in order, without re-deriving it under deployment pressure.
