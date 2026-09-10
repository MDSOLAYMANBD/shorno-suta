# bKash Integration — Rollback & Disaster Recovery Plan

**Scope:** What to do when something goes wrong with the bKash integration, from "flip a switch" incident response up to a full deployment rollback.
**Companion documents:** `bkash-integration-qa-guide.md`, `bkash-production-monitoring-runbook.md`.

**Read this first — the golden rule:** for almost every incident, the fastest, safest, and correct first action is **disabling bKash from the admin panel (§4)**, not rolling back code or migrations. Every rollback action below that touches deployed code or the database is more disruptive and carries more risk than the admin toggle. Reach for it last, not first.

---

## 1. Deployment Rollback

**What "deployment" covers here:** the frontend build (Checkout.tsx, PaymentResult.tsx, AdminPaymentSettings.tsx, AdminOrders.tsx, AdminDashboard.tsx, AdminSettings.tsx, PublicMemo.tsx, App.tsx, and the two new files `paymentMethods.ts`/`usePaymentMethods.ts`).

**When to actually do this** (rather than just disabling bKash): only if the *frontend itself* is broken in a way that affects customers regardless of the bKash toggle — for example, if the checkout page fails to render at all, or the payment-method button grid breaks for COD too. A broken bKash button that simply doesn't disappear when disabled would still warrant this, but a broken bKash *payment flow* with the button correctly hidden does not — the toggle already contains the blast radius.

**How:**
1. Identify the last known-good frontend deployment (the one before this integration shipped).
2. Redeploy that build through your normal hosting rollback mechanism (e.g., your host's "promote previous deployment" feature, or redeploying from the prior git tag/commit).
3. Confirm COD and UddoktaPay checkout both still work immediately after rollback — they should be completely unaffected either way, since the rollback only removes the bKash UI code.

**What this does NOT undo:** any database changes (migrations) or edge function deployments — those are independent and must be handled separately if needed (§3, §2).

---

## 2. Edge Function Rollback

**Functions unique to this integration (safe to remove/revert independently):** `bkash-checkout`, `bkash-verify`.
**Functions modified by this integration (do not have a "before" state to revert to without losing other fixes — see note below):** `send-order-notification`, `order-memo`, `_shared/smsProviders.ts`.

**Reverting `bkash-checkout` / `bkash-verify`:** these are new functions with no prior version, so "rollback" means either (a) redeploying an earlier commit that predates them, which effectively un-deploys them, or (b) simply leaving them deployed but disabling bKash via the admin toggle (§4) — **(b) is strongly preferred**. Removing the functions entirely while any `payment_transactions` rows sit at `initiated`/`processing` would strand those sessions with no way to ever verify them, turning a recoverable state into an unrecoverable one. Only fully un-deploy these two functions if you are also certain there are zero non-terminal (`initiated`/`processing`) rows in `payment_transactions` for `gateway='bkash'` — check with:
```sql
select count(*) from payment_transactions where gateway = 'bkash' and status in ('initiated','processing');
```

**Reverting `send-order-notification` / `order-memo` / `smsProviders.ts`:** these were *extended*, not rewritten — the `confirmation`/`processing`/`shipped`/`delivered` notification types and all UddoktaPay-related behavior are byte-for-byte unchanged. Reverting these three files to their pre-bKash versions would only remove:
- The `type: 'payment'` notification path (email/SMS for a bKash or future-gateway payment confirmation)
- `payment_invoice_id`/`paid_at` in `order-memo`'s response (the invoice would fall back to showing payment status without a transaction ID/date)
- The `payment_confirmation` SMS purpose allow-list in `smsProviders.ts`

None of this affects COD, UddoktaPay, order-status-change notifications, or any other existing feature. This makes these three files safe to revert independently of the other two functions if there's ever a reason to (e.g., a bug specifically in the new notification path) — but in practice, disabling bKash (§4) already prevents that code path from ever running, making this rollback rarely necessary on its own.

---

## 3. Migration Rollback Strategy

**Default position: do not run destructive rollback migrations.** The migrations added by this integration are additive (or, in one case, deliberately loosening rather than tightening a constraint):
- `orders.paid_at` — a new nullable column. An unused nullable column does not break anything if the feature above it is disabled.
- `payment_transactions` table, its RLS policy, and its indexes — a new, isolated table. Nothing else in the codebase reads from or writes to it.
- `apply_gateway_sale_entry` RPC — a new function, `EXECUTE`-restricted to `service_role` only. Nothing calls it except `bkash-verify`.
- `store_settings` RLS policy update — widens the public-read whitelist by exactly two keys (`payment_uddoktapay_enabled`, `payment_bkash_enabled`). This is the one migration change that is *not* purely inert — see below.
- `payment_transactions.order_id` FK change (migration `20260802172628`) — changed from `NOT NULL ... ON DELETE CASCADE` to nullable `... ON DELETE SET NULL`, specifically so permanently deleting an order can never again destroy its payment audit trail. See the note on reversibility below.

**Leaving migrations in place (recommended) vs. hard rollback:**

| Migration | Safe to leave in place if bKash is disabled? | Hard rollback risk if reverted |
|---|---|---|
| `orders.paid_at` | Yes — unused column, zero side effects | None significant, but destroys any `paid_at` values already recorded for real payments |
| `payment_transactions` table | Yes — isolated, nothing else depends on it | **Destroys the entire payment audit log and idempotency history.** Do not drop this table if any real payment has ever been processed through it, even if bKash is now disabled — it is your only record of what happened. |
| `apply_gateway_sale_entry` RPC | Yes — unused if nothing calls it | Low risk to drop (no data loss), but only do so after confirming no code path still references it |
| `store_settings` RLS policy widening | Yes, in practice — the two extra keys only expose boolean enabled/disabled flags, never credentials | Reverting this policy would make the checkout page's `useEnabledPaymentMethods()` hook silently fail to read the flags for anonymous customers, which would likely make **all** gateway payment buttons (bKash and UddoktaPay both, since UddoktaPay's flag was added to the same whitelist) disappear from checkout — this is a bigger blast radius than it looks. Only revert this if you are also prepared to accept COD-only checkout, or have separately re-verified the whitelist. |
| `payment_transactions.order_id` FK change | Yes — strictly safer than the original `CASCADE` behavior, no reason to ever revert this one | **Not cleanly reversible once triggered.** If any order has been permanently deleted since this migration shipped, the resulting `order_id = NULL` row(s) will block re-adding `NOT NULL` — those rows would need to be manually resolved (deleted, or backfilled with a placeholder) before the original `CASCADE`/`NOT NULL` constraint could be restored. There is no legitimate reason to want to revert this one — it only exists to prevent data loss. |

**If a hard rollback is genuinely required** (e.g., decommissioning the feature permanently, not just pausing it):
1. **Back up first.** Export `payment_transactions` and any `orders` rows with `payment_method='bkash'` before dropping anything:
   ```sql
   -- run via your normal backup/export tooling, not as a substitute for a full DB backup
   select * from payment_transactions where gateway = 'bkash';
   ```
2. Confirm zero non-terminal rows remain (same query as in §2).
3. Confirm the accounting reconciliation query from the Monitoring Runbook (§4/§7 there) shows no outstanding mismatches — a hard rollback should not be the *first* place you notice a reconciliation problem.
4. Only then run the destructive statements (`DROP TABLE payment_transactions`, `DROP FUNCTION apply_gateway_sale_entry`, `ALTER TABLE orders DROP COLUMN paid_at`, and reverting the `store_settings` policy to its pre-bKash array) — as their own reviewed migration, not as an ad hoc console session.

---

## 4. Disabling bKash Safely

This is the primary incident-response lever and should be the default first action for almost any bKash-related problem.

**How:** Admin → Settings → পেমেন্ট সেটিংস (`/admin/settings/payment`) → flip the bKash switch off. Takes effect immediately (no deploy, no downtime).

**If the admin panel itself is inaccessible** (e.g., total app outage unrelated to bKash), the same effect can be achieved directly against the database:
```sql
update store_settings set value = 'false' where key = 'payment_bkash_enabled';
```

**What this does and does not do:**
- **Does:** immediately hides the bKash button on `/checkout` (client reads the flag), and — independently, as defense in depth — `bkash-checkout` itself refuses to create any *new* payment session once the flag is off, even if called directly. Both layers were verified during implementation review.
- **Does not:** affect any payment session already in progress. A customer who already clicked "Pay with bKash" and is mid-flow on bKash's own page will still be able to complete it, and the resulting redirect to `/payment-result` will still call `bkash-verify`, which will still finalize it correctly. **This is intentional, not a gap** — refusing to verify an already-initiated payment would risk telling an actually-charged customer that their payment failed, which is worse than letting it complete normally. Disabling bKash stops the bleeding for *new* customers without abandoning customers already mid-transaction.
- **Does not:** touch UddoktaPay or COD in any way — they are gated by their own independent flag/logic.

---

## 5. Handling Partially Completed Payments

This is the manual procedure for the "stuck at `processing`" and "confirmed-but-unrecorded charge" scenarios flagged in the Monitoring Runbook.

**Step 1 — Establish ground truth.** Never assume. Check, in this order:
1. `payment_transactions.gateway_response` for the row in question — does the last recorded response show `statusCode: "0000"` (bKash confirmed the charge)?
2. If ambiguous or absent, use bKash's merchant portal (or contact bKash support) with the `gateway_payment_id` to get a definitive charge status. This is the authoritative source, not any inference from application logs.

**Step 2 — If bKash confirms the charge succeeded, but `orders.payment_status` is still `unpaid`:**
1. Manually update the order via the *existing, tested* "mark as Paid" action in `/admin/orders` (not a raw SQL update) — this ensures the accounting entry, activity log, and `paid_amount`/`due_amount` fields are all set consistently through the same code path already verified in the QA guide.
2. Additionally record the transaction reference for support/audit purposes: `payment_invoice_id` on the order and `transaction_id`/`status='paid'` on the `payment_transactions` row should be set to match, since the admin "mark as Paid" action does not know the bKash `trxID` — do this as a direct, one-off update *after* the admin action, purely for record-keeping:
   ```sql
   update orders set payment_invoice_id = '<trxID from bKash>', payment_method = 'bkash', paid_at = '<time from bKash response>'
     where id = '<order_id>' and payment_status = 'paid';
   update payment_transactions set status = 'paid', transaction_id = '<trxID>'
     where id = '<row id>' and status != 'paid';
   ```
3. Notify the customer manually if the automated payment-confirmation email/SMS didn't fire as part of the original flow (it won't, since this path bypasses `bkash-verify` entirely).

**Step 3 — If bKash confirms the charge did NOT succeed (or was never completed):**
1. Release the stuck row so the system doesn't wait on it forever:
   ```sql
   update payment_transactions set status = 'failed', failure_reason = 'Manually reconciled: bKash confirmed no charge'
     where id = '<row id>' and status = 'processing';
   ```
2. No further action needed — `orders.payment_status` was never touched by this session, so it correctly remains `unpaid`. The customer can retry from `/checkout` normally.

**Step 4 — If the customer was charged twice** (duplicate session scenario from the Monitoring Runbook §3): escalate to support/finance for a refund through bKash's merchant portal. This system's accounting will already be correct (only one ledger entry per order regardless of how many sessions reached "paid"), so no accounting correction is needed — only the customer-facing refund.

---

## 6. Recovery After Deployment Failure

**Why deployment order matters:** the three deployable pieces — migrations, edge functions, and the admin-toggle-controlled feature flag — are independent, and that independence is what makes partial-failure recovery straightforward. The recommended order is:
1. Apply both migrations.
2. Deploy `bkash-checkout`, `bkash-verify`, and the updated `send-order-notification`/`order-memo`/`smsProviders.ts`.
3. Deploy the frontend build.
4. **Only then**, enable bKash via the admin toggle.

Doing it in this order means that at every intermediate stage, the feature is simply invisible/inert rather than broken — there is no window where a customer can reach a half-deployed state.

**If migrations succeeded but edge function deployment failed:** harmless. `payment_transactions` and `apply_gateway_sale_entry` sit unused. Nothing references them until `bkash-checkout`/`bkash-verify` are live. Re-attempt the function deployment; no data cleanup needed.

**If edge functions deployed but a migration failed partway (e.g., `payment_transactions` table created but `apply_gateway_sale_entry` RPC migration failed):** `bkash-checkout` would work normally (it only touches `orders`, `store_settings`, `payment_transactions`). `bkash-verify` would still correctly update `orders.payment_status` and finalize the payment — the RPC call is wrapped in a non-fatal check (`saleEntryErr` is logged, not thrown), so a missing RPC degrades to "payment recorded correctly, accounting entry silently skipped" rather than a hard failure. This is still a real problem (missing accounting entries) but not a customer-facing outage — re-run the failed migration, then run the accounting-reconciliation query from the Monitoring Runbook (§4/§7) to find and manually fix any orders that were paid during the gap using the §5 procedure above.

**If the frontend deployed but edge functions/migrations did not:** the bKash button would be visible (if the admin toggle happens to be on) but every click would fail with "পেমেন্ট শুরু করতে সমস্যা হয়েছে" (`bkash-checkout` returning a 404/error since it isn't deployed, or a 500 since `payment_transactions` doesn't exist yet). This is why step 4 above — enabling the toggle only after confirming both prior steps succeeded — is the actual safeguard; if you follow that order, this scenario can only happen from someone manually flipping the toggle early. If it does happen: disable bKash immediately (§4) and complete the remaining deployment steps before re-enabling.

**General principle for any deployment failure:** the admin toggle for bKash should default to **off** for any environment where you are not actively certain both the migrations and the edge functions are fully deployed and verified against the QA guide. Never treat "the code is deployed" as equivalent to "safe to enable" — the toggle, not the deploy, is the actual go-live gate.
