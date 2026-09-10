# bKash Integration — Production Monitoring Runbook

**Scope:** Operational monitoring for the bKash Tokenized Checkout integration, running alongside UddoktaPay.
**Audience:** Whoever is on call for payment-related incidents.
**Companion documents:** `bkash-integration-qa-guide.md` (pre-launch testing), `bkash-rollback-disaster-recovery-plan.md` (incident response actions).

This is a documentation-only runbook. No application code is described as needing to change here — every query below is a read-only verification query, and every "fix" is an operational action (an admin panel toggle, a manual data correction, or a support escalation), not a code deploy.

---

## 1. Payment Health Metrics

Track these daily, and ideally on a rolling-hour basis during the first weeks after launch.

| Metric | How to derive it | Why it matters |
|---|---|---|
| **Payment success rate** | `paid` rows ÷ (`paid` + `failed` + `cancelled`) rows in `payment_transactions` for `gateway='bkash'`, per day | A sudden drop usually means a bKash-side outage, an expired/misconfigured credential, or a code regression — not "customers changed their mind" |
| **Session-to-completion time** | `payment_transactions.updated_at - payment_transactions.created_at` for rows that reached `paid`, averaged per day | A creeping increase suggests bKash API latency or repeated Query Payment fallbacks (i.e., Execute Payment is timing out) |
| **Gateway mix** | Count of `orders.payment_method` grouped by `cod` / `uddoktapay` / `bkash`, per day | Sanity-check against expectations after launch (e.g., a sudden 0% bKash share right after a deploy is itself a signal) |
| **Grant/Refresh Token failures** | Count of `"bKash token grant/refresh failed"` log lines in `bkash-checkout` / `bkash-verify` function logs, per day | Should be near-zero in steady state; a spike means credentials were rotated on bKash's side, or the sandbox/live environment toggle is misconfigured |
| **Notification delivery rate** | `sent` rows ÷ total rows in `notification_logs` where `notification_type='payment'`, per day | Covers both email (always attempted) and SMS (only if enabled) |

---

## 2. Stuck Transaction Detection

This is the single most important thing to watch. It corresponds directly to the one accepted residual risk identified during implementation review: a `payment_transactions` row can be left at `status='processing'` if bKash confirmed a charge but a post-processing database write failed.

**What "stuck" means:**
- `status = 'processing'` and `updated_at` is more than **5 minutes** old → investigate.
- `status = 'processing'` and `updated_at` is more than **30 minutes** old → treat as a confirmed incident (see §9 First-Response Procedures).
- `status = 'initiated'` older than **24 hours** is *expected and harmless* — bKash's own `paymentID` expires after 24 hours if unused (customer simply abandoned checkout). Do not alert on this; it is not a bug.

**Daily query** (see §7 for the full query set) — count and list any `processing` rows older than 5 minutes.

**Why it happens:** bKash confirmed the charge (`statusCode: "0000"`), but the subsequent write to `orders`, the `apply_gateway_sale_entry` call, or the final `payment_transactions` update failed (database blip, function timeout, etc.). The system deliberately does **not** auto-retry Execute Payment in this state — retrying would risk a second execution attempt against an already-charged `paymentID`, which is explicitly unsafe per bKash's own documentation ("a payment ID permits only one execution attempt"). A stuck row is therefore *safe* (no risk of a duplicate charge) but *incomplete* (the order may not reflect that the customer was actually charged), and requires manual reconciliation — see §5 and §9.

---

## 3. Duplicate Payment Detection

`payment_transactions` has a hard uniqueness constraint on `(gateway, gateway_payment_id)`, so a true duplicate row for the same bKash session is structurally impossible. What this section actually monitors is a different, real scenario: **the same order having more than one bKash payment session**, which can happen if a customer navigates back to `/checkout` and starts bKash again after already paying (e.g., using the browser back button after a successful payment, before the page redirected).

**What to check daily:** any `order_id` that appears more than once in `payment_transactions` with `gateway='bkash'`, where more than one of those rows reached `status='paid'`.

**Impact if found:** the customer's bKash wallet may have been debited twice, even though the internal accounting entry (`acc_transactions`) will **not** double-count — `apply_gateway_sale_entry` matches by `order_id`/`reference_type`, so a second "paid" call for the same order only updates the existing ledger row rather than creating a second one. This means the books stay correct, but the **customer may be owed a refund** for the second real-world charge. This is a business/support action (contact the customer, process a refund through bKash's merchant portal), not a data-integrity bug.

**Note on `order_id = NULL` rows:** `payment_transactions.order_id` is nullable (`ON DELETE SET NULL` — see the Rollback plan §3) so that permanently deleting an order never destroys its payment audit history. A row with `order_id = NULL` simply means the original order was later permanently deleted from `/admin/orders`; it is expected, not a data-integrity problem, and should be excluded from the duplicate-session query below (grouping NULLs together would otherwise falsely merge unrelated orphaned rows into one "duplicate" group).

---

## 4. Accounting Reconciliation

**Daily check:** the sum of `acc_transactions.amount` where `type='sale'`, `source='bank'`, `reference_type='order'`, for orders created that day with `payment_method IN ('uddoktapay','bkash')`, should equal the sum of `orders.paid_amount` for those same orders.

**Per-order check (spot check, or on any support ticket):** every `orders` row with `payment_status='paid'` and `payment_method='bkash'` should have exactly one `acc_transactions` row with matching `reference_id`. Zero rows means the accounting step failed for that order (see §2/§9); more than one row should be structurally impossible given `apply_gateway_sale_entry`'s existing-row check, and would indicate the RPC itself was bypassed (e.g., a manual SQL insert).

**Balance sanity check:** the `sale`-type `acc_accounts.balance` should always equal the sum of all `acc_transactions.amount` where `type='sale'` (accounting for any manual expense/adjustment entries elsewhere per the existing accounting module's own rules — this is unrelated to bKash and was true before this integration).

---

## 5. Notification Failures

**Daily check:** count of `notification_logs` rows with `status='failed'`, grouped by `channel` (`email`/`sms`) and `notification_type`, for `notification_type='payment'`.

**Common causes and what they mean:**
- Email failures clustered around one provider error → SMTP credential or provider outage issue (unrelated to bKash specifically — same `send-email` function used by every other order notification).
- SMS failures → either the SMS provider is down, or (expected, not a failure) the payment-confirmation SMS toggle is off, in which case `notification_logs` will show no row at all for SMS, not a `failed` row — a missing row is normal when the toggle is off; a `failed` row means it tried and the provider rejected it.
- No email row at all for a paid bKash order → the order's `customer_email` was blank/invalid (checkout allows email to be optional), which is expected, not a bug.

---

## 6. Courier Reconciliation

**Daily/weekly check:** for every order dispatched to a courier on a given day where `orders.payment_method IN ('uddoktapay','bkash')` and `orders.payment_status='paid'`:
- If dispatched via **Steadfast**: confirm the COD amount recorded on the courier side is ৳0 (Steadfast reads `due_amount`/`paid_amount` directly, so this should already be correct with no manual action).
- If dispatched via **Pathao or RedX**: confirm the COD amount collected. **These two couriers do not read `due_amount`/`paid_amount` and will request the full order total from the customer at the door, even though it was already paid online.** This is a known, pre-existing limitation (confirmed identical for UddoktaPay orders, not introduced by bKash) and is not something this monitoring runbook can auto-detect from the database alone — it requires manually cross-checking courier COD remittance reports against `orders.paid_amount` for any Pathao/RedX-dispatched order that was also gateway-paid. Until this is fixed at the courier-integration level, the operational mitigation is: **prefer Steadfast for any order that was paid via UddoktaPay or bKash**, or manually instruct dispatch staff to zero out the COD amount in the Pathao/RedX portal for such orders.

---

## 7. Daily SQL Verification Queries

Read-only queries for the daily ops check. Run against the production database with a role that can read `payment_transactions`, `orders`, `acc_transactions`, `notification_logs` (admin/service role — these are not exposed to anon/authenticated clients by RLS).

**Stuck transactions (§2):**
```sql
select id, order_id, gateway_payment_id, status, updated_at,
       now() - updated_at as stuck_for
from payment_transactions
where gateway = 'bkash' and status = 'processing'
  and updated_at < now() - interval '5 minutes'
order by updated_at asc;
```

**Multiple bKash sessions per order, more than one paid (§3):**
```sql
-- order_id is nullable (orphaned rows from a permanently-deleted order,
-- see §3 note) — excluded here so unrelated orphaned rows are never
-- grouped together and misreported as duplicate sessions.
select order_id, count(*) filter (where status = 'paid') as paid_sessions, count(*) as total_sessions
from payment_transactions
where gateway = 'bkash' and order_id is not null
group by order_id
having count(*) filter (where status = 'paid') > 1;
```

**Paid bKash orders missing an accounting entry (§4):**
```sql
select o.id, o.order_number, o.paid_amount, o.paid_at
from orders o
where o.payment_method = 'bkash' and o.payment_status = 'paid'
  and not exists (
    select 1 from acc_transactions t
    where t.reference_type = 'order' and t.reference_id = o.id::text and t.type = 'sale'
  );
```

**Daily accounting total vs. paid-order total (§4):**
```sql
select
  (select coalesce(sum(amount),0) from acc_transactions
     where type='sale' and source='bank' and reference_type='order'
       and created_at::date = current_date) as accounting_total,
  (select coalesce(sum(paid_amount),0) from orders
     where payment_method in ('uddoktapay','bkash') and payment_status='paid'
       and paid_at::date = current_date) as orders_paid_total;
```

**Yesterday's payment success rate (§1):**
```sql
select
  count(*) filter (where status = 'paid') as paid,
  count(*) filter (where status = 'failed') as failed,
  count(*) filter (where status = 'cancelled') as cancelled,
  count(*) filter (where status in ('initiated','processing')) as unresolved
from payment_transactions
where gateway = 'bkash' and created_at::date = current_date - interval '1 day';
```

**Failed notifications for payment confirmations, last 24h (§5):**
```sql
select channel, status, count(*)
from notification_logs
where notification_type = 'payment' and created_at > now() - interval '24 hours'
group by channel, status;
```

---

## 8. Alert Thresholds

| Condition | Severity | Action |
|---|---|---|
| Any `payment_transactions` row at `processing` for >30 minutes | **Critical — page on-call** | Follow §9 stuck-transaction procedure immediately |
| >5 rows at `processing` for >5 minutes at any single check | **Critical — page on-call** | Likely a systemic issue (deploy regression, DB outage) rather than an isolated stuck row — check recent deploys first |
| Payment success rate <70% over a rolling hour with ≥5 attempts | **Warning** | Check bKash sandbox/live status, check recent credential changes in Admin → Payment Settings |
| Any log line containing `CRITICAL: bKash confirmed payment but post-processing failed` | **Critical — page on-call** | This is the exact log signature for a confirmed-but-unrecorded charge — go straight to §9/§5 of the Rollback doc |
| Paid bKash order with no matching `acc_transactions` row, found in daily check | **Warning, same-day fix required** | Reconcile manually (see Rollback doc §5) |
| Notification failure rate >20% for `notification_type='payment'` over 24h | **Warning** | Check SMTP/SMS provider status — unrelated to bKash logic itself |
| Grant/Refresh Token failures >3 in an hour | **Warning** | Check bKash credential validity and environment (sandbox vs. live) setting |

---

## 9. First-Response Procedures

**On a "stuck processing" alert:**
1. Look up the row: `select * from payment_transactions where id = '<id>';` — note `order_id` and `gateway_payment_id`.
2. Check the `bkash-verify` function logs around `updated_at` for that row for a `CRITICAL` log line — this tells you exactly which write failed and what the underlying error was.
3. Check `orders.payment_status` for that `order_id` — if it's already `paid`, the order-level write actually succeeded and only the final `payment_transactions` status write failed; safe to manually set that row's `status` to `paid` to unstick it (no further action needed).
4. If `orders.payment_status` is still `unpaid`, you must determine whether bKash actually charged the customer before touching anything — check `payment_transactions.gateway_response` for a `statusCode: "0000"` from the last known Execute/Query Payment call. If present, proceed to the manual reconciliation procedure in the Rollback doc (§5 — Handling Partially Completed Payments). If absent/ambiguous, contact bKash merchant support with the `paymentID` to get a definitive answer before taking any action — never guess.

**On a payment success-rate drop alert:**
1. Check whether the drop is bKash-specific or affects UddoktaPay too — if both, the issue is elsewhere in the order pipeline, not bKash.
2. Check `store_settings.bkash_environment`, `bkash_app_key`, `bkash_app_secret` were not accidentally changed (compare against Admin → Payment Settings audit trail in `activity_logs`, `action_type='payment_settings_update'`).
3. If bKash-specific and credentials look correct, this is most likely a bKash-side sandbox/live outage — check bKash's own status channel, and consider disabling bKash via the admin toggle (see Rollback doc §4) while waiting for resolution, so customers aren't stuck on a failing payment option.

**On a duplicate-payment-session finding:**
1. Confirm via `payment_transactions.gateway_response` for both sessions whether both actually reached a real "Completed" charge on bKash's side, or whether only one did (the other might show `statusCode` other than `0000` despite `status='paid'` in rare edge cases — check this explicitly, don't assume).
2. If genuinely double-charged, escalate to support/finance for a customer refund via bKash's merchant portal — this is a business process, not a database fix.

**On any accounting mismatch found in the daily check:**
1. Do not manually `INSERT` into `acc_transactions` directly — this bypasses the balance-adjustment logic in `apply_gateway_sale_entry` and will desynchronize `acc_accounts.balance`.
2. Instead, use the existing, tested "mark as Paid" action in `/admin/orders` for the affected order (even if `orders.payment_status` already shows `paid` from the bKash flow, re-triggering this admin action for the same amount is safe and idempotent — it will detect the correct existing state or create the missing entry cleanly).
