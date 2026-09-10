# bKash Payment Integration — Manual QA Testing Guide

**Scope:** bKash Tokenized Checkout (mode `0011`) integration added alongside the existing UddoktaPay gateway.
**Status:** Pre-deployment validation phase.
**Audience:** QA / the person running manual sandbox verification before go-live.

This guide assumes the code from the implementation phase is already deployed to a test/staging environment (or production with bKash left disabled) before you begin. Each test lists what it proves, how to run it, what "pass" looks like, which tables and functions are involved, what a failure looks like, and where to look when it fails.

---

## Reference: system map

| Component | Name |
|---|---|
| Checkout-initiation Edge Function | `bkash-checkout` |
| Verification Edge Function | `bkash-verify` |
| Notification Edge Function | `send-order-notification` |
| Invoice Edge Function | `order-memo` |
| Accounting RPC (single source of truth) | `apply_gateway_sale_entry` |
| Frontend checkout page | `/checkout` |
| Frontend redirect landing page | `/payment-result` |
| Admin settings page | `/admin/settings/payment` |
| Admin order list | `/admin/orders` |
| Public invoice page | `/memo/:orderId` |
| Public order tracker | `/order-status` |
| Core tables touched | `orders`, `payment_transactions`, `acc_transactions`, `acc_accounts`, `acc_activity_logs`, `notification_logs`, `store_settings` |

Key `orders` columns to watch: `payment_status`, `payment_method`, `payment_invoice_id`, `paid_amount`, `due_amount`, `paid_at`.
Key `payment_transactions` columns to watch: `gateway`, `gateway_payment_id`, `order_id`, `status`, `transaction_id`, `gateway_response`, `failure_reason`.

**Note on `gateway_response`:** for `bkash-verify` writes (Execute/Query Payment results), this column is deliberately filtered to an allowlist before storage — only `paymentID`, `trxID`, `transactionStatus`, `statusCode`, `statusMessage`, `amount`, `currency`, `paymentExecuteTime`, `merchantInvoiceNumber` are ever kept, regardless of what else bKash's response contains. This is expected, not a bug — do not treat a "missing" field here as a sign something went wrong unless it's one of the fields on that list. `bkash-checkout`'s own write (the Create Payment response) is intentionally left unfiltered, since that response shape contains no customer-identifying fields.

---

## 1. Sandbox Setup

**Objective:** Confirm you have everything needed from bKash before touching the app.

**Steps:**
1. Confirm you have: sandbox username, password, app key, app secret (from bKash's credential document, not from this guide).
2. Confirm you have the sandbox test wallet numbers, OTP (`123456`), and PIN (`12121`) from the same document.
3. Confirm network access to `tokenized.sandbox.bka.sh` from wherever the Edge Functions run (Supabase's network — no local firewall action needed, but worth confirming Supabase isn't blocked by any egress rule if your project has custom networking).

**Expected result:** All four credential values and the test wallet/OTP/PIN are on hand before proceeding.

**Database tables affected:** None yet.
**API called:** None yet.
**Edge Function involved:** None yet.

**Possible failure:** Credentials expired or were rotated by bKash since they were issued.
**How to debug:** Sandbox credentials are managed entirely on bKash's side — if Grant Token fails immediately in Test 4, this is the first thing to re-verify with bKash support, not a bug in this codebase.

---

## 2. Admin Configuration

**Objective:** Confirm the bKash gateway can be configured and toggled from the admin panel without touching code.

**Steps:**
1. Log into `/admin` with an admin account.
2. Navigate to **Settings → পেমেন্ট সেটিংস** (`/admin/settings/payment`).
3. In the bKash card, enter App Key, App Secret, Username, Password. Set Environment to **Sandbox**.
4. Click **সেভ করুন**.
5. Flip the bKash enable switch **on**.
6. Leave the UddoktaPay switch in whatever state it was already in (do not change it as part of this test).

**Expected result:** A success toast appears after saving. Reloading the page shows the switch still on and the credential fields still populated (masked).

**Database tables affected:** `store_settings` — rows for `bkash_app_key`, `bkash_app_secret`, `bkash_username`, `bkash_password`, `bkash_environment`, `payment_bkash_enabled`.
**API called:** None (direct table write via the admin session).
**Edge Function involved:** None.

**Possible failure:** Save button does nothing, or the toggle doesn't persist after reload.
**How to debug:** Check the browser console/network tab for a failed `store_settings` upsert (likely an RLS rejection if the logged-in user isn't actually an `admin` role — confirm via `user_roles` for that user). Confirm `payment_bkash_enabled` and `bkash_app_key` etc. exist as rows in `store_settings` with the expected values.

---

## 3. Database Migration Verification

**Objective:** Confirm all four bKash-related migrations were actually applied to the target database, in order.

**Mandatory pre-flight check, before attempting migration `20260802172834`:** run the duplicate-detection query from `bkash-production-monitoring-runbook.md` §7 (or §3) against the target database. If it returns any rows, the new unique index in that migration will fail to create — resolve the duplicates first using the manual reconciliation procedure in `bkash-rollback-disaster-recovery-plan.md` §5, then re-attempt.

**Steps:**
1. Confirm the `payment_transactions` table exists with columns: `id, gateway, gateway_payment_id, order_id, status, amount, transaction_id, gateway_response, failure_reason, created_at, updated_at`, and a unique constraint on `(gateway, gateway_payment_id)`.
2. Confirm `orders` has a `paid_at` column (nullable timestamp).
3. Confirm the RPC function `apply_gateway_sale_entry` exists and its `EXECUTE` privilege is restricted to `service_role` only (not `PUBLIC`, not `authenticated`, not `anon`).
4. Confirm the `store_settings` SELECT policy's whitelist array includes `payment_uddoktapay_enabled` and `payment_bkash_enabled`.
5. Confirm `payment_transactions.order_id` is **nullable**, and its foreign key to `orders(id)` is `ON DELETE SET NULL` (not `CASCADE`, not `NOT NULL`).
6. Confirm a unique index named `acc_transactions_order_sale_uniq` exists on `acc_transactions`, scoped to `(reference_id) WHERE reference_type = 'order' AND type = 'sale'`.

**Expected result:** All six items present exactly as described.

**Database tables affected:** `payment_transactions` (new table + later FK change), `orders` (new column), `store_settings` (policy change), `acc_transactions` (new index), plus the `apply_gateway_sale_entry` function in `pg_proc` (created, then later redefined).
**API called:** None.
**Edge Function involved:** None.

**Possible failure:** Migration silently failed partway, was applied to the wrong database/branch, or migration `20260802172834` failed outright because the pre-flight duplicate check above was skipped.
**How to debug:** Check your migration tool's applied-migrations log for all four migration timestamps. If `payment_transactions` is missing entirely, nothing past this point will work — stop and re-run the migration before continuing. If specifically the fourth migration failed, re-run the duplicate-detection query — a failed `CREATE UNIQUE INDEX` almost always means it found a duplicate.

---

## 4. Edge Function Deployment Verification

**Objective:** Confirm `bkash-checkout` and `bkash-verify` are actually deployed and reachable, not just present in the codebase.

**Steps:**
1. Confirm both functions appear in your Supabase project's Edge Functions list.
2. Send an intentionally invalid request to each (e.g., an empty JSON body) via any HTTP client and confirm you get a structured JSON error back (`{"error": "..."}`), not a 404 "function not found."
3. Confirm `send-order-notification` and `order-memo` show a recent deployment timestamp (both were modified during implementation).

**Expected result:** All four functions respond (even if with an expected validation error), confirming they're live.

**Database tables affected:** None.
**API called:** None (bKash isn't reached with an invalid/empty body).
**Edge Function involved:** `bkash-checkout`, `bkash-verify`, `send-order-notification`, `order-memo`.

**Possible failure:** 404 or a stale/old version responding.
**How to debug:** Re-run the function deploy command for the missing/stale function. Check the Edge Function logs panel for a deploy-time error (e.g., a bad import path) if deployment silently failed.

---

## 5. Frontend Verification

**Objective:** Confirm the checkout page correctly reflects the admin toggle state before any payment is attempted.

**Steps:**
1. With bKash enabled (from Test 2), open `/checkout` with items in the cart (use a private/incognito window to avoid stale cache).
2. Confirm three payment buttons render: COD, UddoktaPay (if enabled), bKash.
3. Go back to `/admin/settings/payment` and disable bKash.
4. Reload `/checkout` in a fresh tab.
5. Confirm the bKash button is now gone, only COD (+ UddoktaPay if enabled) remain.
6. Re-enable bKash for the remaining tests.

**Expected result:** The checkout button set exactly matches the current admin toggle state after a reload.

**Database tables affected:** None (read-only).
**API called:** None.
**Edge Function involved:** None — this is a direct `store_settings` read gated by RLS.

**Possible failure:** Button doesn't disappear after disabling, or doesn't appear after enabling.
**How to debug:** This is a client-side cache issue (settings are cached for up to 10 minutes) — a hard reload should force a refetch. If it still doesn't update, check that `payment_bkash_enabled` in `store_settings` actually changed value, and confirm the anon/public role can read that specific key (RLS whitelist — see Test 3).

---

## 6. Successful Payment Test

**Objective:** The core happy path — full order lifecycle end to end.

**Steps:**
1. On `/checkout`, fill in valid customer details, select **bKash**, submit.
2. A new tab/redirect opens to bKash's sandbox hosted page.
3. Enter the sandbox test wallet number → OTP `123456` → PIN `12121` → Proceed/Finish.
4. Wait for the redirect back to `/payment-result`.

**Expected result:** Page shows "পেমেন্ট সফল!" and auto-redirects to `/thank-you` with correct order/item details.

**Database tables affected:**
- `payment_transactions`: one row, `status='paid'`, `transaction_id` populated, `gateway_response` populated.
- `orders`: `payment_status='paid'`, `payment_method='bkash'`, `payment_invoice_id`=bKash trxID, `paid_amount`=order total, `due_amount=0`, `paid_at` set.
- `acc_transactions`: one new row, `type='sale'`, `source='bank'`, `reference_id`=order id, `reference_type='order'`.
- `acc_accounts`: the `sale`-type account's `balance` increased by the order total.
- `acc_activity_logs`: one `create` entry for the transaction.
- `notification_logs`: one `email` row, `notification_type='payment'`, `status='sent'`.

**API called:** bKash Grant/Refresh Token, Create Payment, Execute Payment (and Query Payment only if Execute was ambiguous).
**Edge Function involved:** `bkash-checkout` → `bkash-verify` → `send-order-notification`.

**Possible failure:** Stuck on "পেমেন্ট যাচাই করা হচ্ছে..." indefinitely; or redirected to failed/cancelled despite entering correct OTP/PIN.
**How to debug:** Check `payment_transactions` for that `gateway_payment_id` — its `status` and `gateway_response`/`failure_reason` columns tell you exactly what bKash returned. Check `bkash-verify`'s function logs for the raw Execute/Query Payment response. If the row is stuck at `processing`, see Test 9/10 below.

---

## 7. Failed Payment Test

**Objective:** Confirm a genuine payment failure (not cancellation) is handled safely — no charge, no accounting entry, clear UI.

**Steps:**
1. Start a bKash checkout as in Test 6.
2. Deliberately enter an incorrect PIN repeatedly until bKash's page itself reports failure (or use any sandbox-documented way to force a failure, if bKash provides one).
3. Observe the redirect back to `/payment-result`.

**Expected result:** Page shows "পেমেন্ট ব্যর্থ হয়েছে" with a retry button.

**Database tables affected:**
- `payment_transactions`: `status='failed'`, `failure_reason` populated with bKash's message.
- `orders`: **unchanged** — `payment_status` stays `unpaid`.
- No `acc_transactions`, `acc_accounts`, or `notification_logs` rows created.

**API called:** Execute Payment (and Query Payment if ambiguous).
**Edge Function involved:** `bkash-checkout` → `bkash-verify`.

**Possible failure:** Order incorrectly shows as paid, or an accounting entry appears despite the failure.
**How to debug:** This would be a serious defect — check `bkash-verify` logs for what `statusCode`/`transactionStatus` was actually returned and why it was treated as success. Should not occur based on the current implementation, but is exactly what this test exists to catch.

---

## 8. Cancel Payment Test

**Objective:** Confirm a customer-initiated cancellation (closing bKash's page / clicking "Close") is distinguished from a failure and doesn't leave the system in a bad state.

**Steps:**
1. Start a bKash checkout as in Test 6.
2. On bKash's hosted page, click **Close** (or equivalent cancel action) instead of completing the flow.
3. Observe the redirect back to `/payment-result`.

**Expected result:** Page shows "পেমেন্ট বাতিল হয়েছে" (or, if bKash's cancel status string doesn't contain "cancel", it may show the generic failed message instead — both are acceptable outcomes; what matters is the order is not marked paid).

**Database tables affected:** Same as Test 7 — `payment_transactions.status` becomes `cancelled` or `failed`; `orders.payment_status` stays `unpaid`; no accounting/notification rows.

**API called:** None, or Execute Payment only if `bkash-verify` still attempts it (depends on what `status` value bKash's redirect actually carries — this is expected and fine either way).
**Edge Function involved:** `bkash-checkout` → `bkash-verify`.

**Possible failure:** Order left in a state that blocks the customer from ordering again.
**How to debug:** Return to `/checkout` and attempt to place the same order again with the same phone number. This should succeed normally (a cancelled bKash attempt must not trip the duplicate-order fraud guard) — if it does, check `place-order`'s fraud-cooldown logic against this order's `status`/`created_at`, not the bKash code.

---

## 9. Duplicate Callback Test

**Objective:** Confirm calling `bkash-verify` twice for the same `paymentID` never double-processes.

**Steps:**
1. Complete a successful payment as in Test 6, but **before** the page redirects, note the `paymentID` from the URL.
2. After the order shows as paid, manually re-invoke `bkash-verify` with the same `payment_id` a second time (via any HTTP client, or by reloading `/payment-result?paymentID=...&status=success` with the exact same URL).

**Expected result:** The second call returns the same `payment_status: "paid"` response immediately, with no new side effects.

**Database tables affected:** Confirm **no new row** was added to `payment_transactions` (still exactly one row for that `gateway_payment_id`, since it's uniquely constrained), no second `acc_transactions` row, no second email in `notification_logs`, and `acc_accounts.balance` was not incremented twice.

**API called:** None on the second call (idempotent short-circuit — bKash is not contacted again).
**Edge Function involved:** `bkash-verify` only.

**Possible failure:** A second `acc_transactions` row, doubled balance, or a second email.
**How to debug:** This would mean the idempotent short-circuit at the top of `bkash-verify` isn't matching correctly — check that `payment_transactions.status` was actually `'paid'` (not still `'processing'`) at the time of the second call.

---

## 10. Refresh Page Test

**Objective:** Confirm reloading `/payment-result` mid-verification (or after) behaves safely, covering the race-condition path.

**Steps:**
1. Start a bKash payment and complete it on bKash's page.
2. The instant the browser lands back on `/payment-result`, refresh the page immediately (before it's had time to show a final result), simulating two near-simultaneous verify calls.
3. Repeat by refreshing again after the order already shows paid.

**Expected result:** Regardless of timing, the page eventually settles on the correct final state (paid), and the database ends up in exactly the same state as Test 6 — one accounting entry, one email.

**Database tables affected:** Same as Test 9 — no duplication under any refresh timing.
**API called:** Possibly Execute/Query Payment once (from whichever request wins the internal claim), never twice.
**Edge Function involved:** `bkash-verify`.

**Possible failure:** Page gets permanently stuck on the loading spinner.
**How to debug:** Check `payment_transactions.status` for that row. If it's stuck at `processing` for more than a few seconds after all page reloads have stopped, that indicates the rare "confirmed paid but post-processing write failed" edge case — check the Edge Function logs for a line prefixed `CRITICAL: bKash confirmed payment but post-processing failed`, and reconcile `orders.payment_status` manually against `payment_transactions.transaction_id` if found.

---

## 11. Double-Click Payment Test

**Objective:** Confirm rapidly double-clicking the "Pay with bKash" button on `/checkout` doesn't create two payment sessions for one order.

**Steps:**
1. On `/checkout`, fill in valid details, select bKash.
2. Double-click the submit button as fast as possible.

**Expected result:** Only one bKash tab/redirect opens; the button becomes disabled after the first click.

**Database tables affected:** Only one `payment_transactions` row should exist for the resulting order (check by `order_id`, not just `gateway_payment_id` — there could in principle be two *different* `paymentID`s if two Create Payment calls both went through).
**API called:** Create Payment — should only fire once.
**Edge Function involved:** `bkash-checkout`.

**Possible failure:** Two bKash sessions created for one order (two `payment_transactions` rows with the same `order_id`).
**How to debug:** If this happens, it's a button-disable timing issue in the checkout UI, not a backend defect — the backend already handles two sessions safely (whichever one the customer actually completes finalizes normally; the other simply expires unused on bKash's side after 24 hours). Confirm the submit button's `disabled` state during the double-click via browser devtools.

---

## 12. Invoice Verification

**Objective:** Confirm the public invoice correctly reflects a bKash payment.

**Steps:**
1. After Test 6, open the invoice link (`/memo/<order_number>`, from the Thank You page or Admin Orders' memo-share popover).

**Expected result:** Invoice shows a green "PAID" card with "Paid via বিকাশ", the transaction ID, and the payment date/time.

**Database tables affected:** Read-only — reads `orders` (including the new `payment_invoice_id`, `paid_at` columns) and `order_items`.
**API called:** None.
**Edge Function involved:** `order-memo`.

**Possible failure:** Invoice shows unpaid, or shows paid but with missing transaction ID/date.
**How to debug:** Confirm `orders.payment_invoice_id` and `orders.paid_at` are actually populated for this order (Test 6 should have set them). If they're populated in the database but not showing on the page, check `order-memo`'s response payload directly (it should include both fields) — a stale deployed version of `order-memo` predating the field addition would explain this.

---

## 13. Accounting Verification

**Objective:** Confirm the accounting entry from a bKash payment is indistinguishable from one created by an admin manually marking an order "Paid."

**Steps:**
1. Take the `acc_transactions` row created in Test 6.
2. Separately, in the admin panel, manually mark a *different* COD order as "Paid" with the full amount.
3. Compare the two resulting `acc_transactions` rows.

**Expected result:** Both rows have `type='sale'`, `source='bank'`, the same description format (`অনলাইন পেমেন্ট #<order_number> — অটো এন্ট্রি`), and both correctly increment the same `sale`-type `acc_accounts.balance`. They should be structurally identical except for the amount/order reference.

**Database tables affected:** `acc_transactions`, `acc_accounts`, `acc_activity_logs`.
**API called:** None.
**Edge Function involved:** None — both paths go through the same `apply_gateway_sale_entry` RPC logic (bKash) or the equivalent client-side function (manual admin action), which were built to produce identical output.

**Possible failure:** Different description text, different `source` value, or a balance mismatch.
**How to debug:** Check the admin **হিসাব → activity log** for both entries side by side. A mismatch here would indicate the RPC's ported logic has drifted from the original — compare against the current `officeSellSaleEntry.ts` and the RPC's SQL definition.

**13a. Concurrency regression check (added — closes the accounting race-condition fix):** create two separate bKash checkout sessions for the *same* order (two different `paymentID`s), and complete both in bKash's sandbox as close together in time as practically possible. Confirm exactly **one** `acc_transactions` row exists for that order afterward (query: `select count(*) from acc_transactions where reference_id = '<order_id>' and reference_type = 'order' and type = 'sale';` — must return `1`), and that `acc_accounts.balance` reflects exactly one credit, not two. This directly exercises the `acc_transactions_order_sale_uniq` partial unique index and the `ON CONFLICT DO NOTHING` path in `apply_gateway_sale_entry` — a result of `2` here means the race-condition fix did not work and must not go to production.

---

## 14. SMS Verification

**Objective:** Confirm the payment-confirmation SMS respects its admin toggle (default off) and only sends when explicitly enabled.

**Steps:**
1. With **পেমেন্ট কনফার্মেশন SMS** left at its default (off), complete a successful bKash payment (Test 6). Confirm no SMS is sent.
2. Go to `/admin/settings/payment`, enable **পেমেন্ট কনফার্মেশন SMS**.
3. Complete a second successful bKash payment with a valid, real-format test phone number.
4. Confirm an SMS arrives.

**Expected result:** No SMS in step 1; an SMS containing "পেমেন্ট সফল" and the order number in step 3.

**Database tables affected:** `notification_logs` — an `sms` row appears only in the enabled case, with `status='sent'` (or `'failed'` with a provider error if the SMS provider itself is unreachable — that's a provider issue, not a toggle issue).
**API called:** The active SMS provider's send API (MimSMS/Automas), only in the enabled case.
**Edge Function involved:** `bkash-verify` → `send-order-notification`.

**Possible failure:** SMS sends even when the toggle is off, or never sends when it's on.
**How to debug:** Check `store_settings.payment_sms_confirmation_enabled` value directly. Check `send-order-notification`'s logs for the `results.sms` field in its response — it will say `"disabled"`, `"skipped: ..."`, `"sent (...)"`, or `"failed: ..."` explaining exactly why.

---

## 15. Email Verification

**Objective:** Confirm the payment-confirmation email always sends on a successful bKash payment (not admin-toggled, unlike SMS).

**Steps:**
1. Complete a successful bKash payment (Test 6) using an order with a valid `customer_email`.

**Expected result:** An email arrives with subject "পেমেন্ট সফল হয়েছে – <order_number>" and body confirming payment success with an order summary and a "track your order" link.

**Database tables affected:** `notification_logs` — an `email` row, `notification_type='payment'`, `status='sent'`.
**API called:** SMTP send (via the `send-email` function).
**Edge Function involved:** `bkash-verify` → `send-order-notification` → `send-email`.

**Possible failure:** No email received despite a valid email on the order.
**How to debug:** Check `notification_logs` for the row — if `status='failed'`, `error_message` will contain the SMTP error. If no row exists at all, `send-order-notification` wasn't reached or errored before the email step — check its function logs.

---

## 16. Order History Verification

**Objective:** Confirm the customer-facing order tracker shows the correct state for a bKash order.

**Steps:**
1. After Test 6, go to `/order-status` and search by the customer's phone number.

**Expected result:** The order appears with the correct status stepper and courier timeline (unaffected by which gateway was used — this page reads `orders.status`, not `payment_status`).

**Database tables affected:** Read-only — `orders`, `order_items`, `courier_tracking_events`.
**API called:** None.
**Edge Function involved:** `order-lookup`.

**Possible failure:** Order doesn't appear, or shows stale data.
**How to debug:** This page is entirely payment-gateway-agnostic and untouched by this work — if it fails here, the issue is unrelated to bKash (check phone number normalization/matching instead).

---

## 17. Admin Orders Verification

**Objective:** Confirm the admin order list correctly displays and filters bKash orders.

**Steps:**
1. Go to `/admin/orders`.
2. Locate the order from Test 6. Confirm the payment badge shows "পেইড", and beneath it, "BKASH", the transaction ID, and the paid date/time.
3. Use the **সব পেমেন্ট মেথড** filter, select **bKash** — confirm only bKash orders appear.
4. Use the **সব পেমেন্ট স্ট্যাটাস** filter, select **পেইড** — confirm the order appears; select **আনপেইড** — confirm it does not.
5. Combine both filters with the existing status/origin filters and confirm results narrow correctly (no filter cancels another out incorrectly).

**Expected result:** All of the above match exactly.

**Database tables affected:** Read-only — `orders`.
**API called:** None.
**Edge Function involved:** None — direct filtered query from the admin session.

**Possible failure:** Filter returns wrong/empty results, or payment detail text doesn't show.
**How to debug:** Open browser devtools network tab, inspect the actual Supabase query sent for the orders list — confirm the `payment_method`/`payment_status` `.eq()` clauses match what's selected in the dropdowns.

---

## 18. Reports Verification

**Objective:** Confirm bKash orders are correctly included in existing dashboards without any special-casing needed.

**Steps:**
1. Go to the main admin dashboard/overview.
2. Confirm today's revenue figure includes the order total from Test 6's order.
3. Check any best-selling-product or sales-history view and confirm the items from that order are counted.

**Expected result:** Figures include the bKash order exactly as they would any other paid order — no separate "bKash revenue" bucket exists or is needed, since revenue reporting sums `orders.total` without filtering by gateway.

**Database tables affected:** Read-only — `orders`, `order_items`.
**API called:** None.
**Edge Function involved:** None.

**Possible failure:** Order total missing from the revenue figure.
**How to debug:** Confirm the order's `created_at`/`deleted_at` fall within whatever date range and non-deleted filter the dashboard applies — this would be a date-range or soft-delete issue, not a payment-gateway issue, since revenue calculations don't reference `payment_method` at all.

---

## 19. Courier Verification

**Objective:** Confirm a bKash-paid order is correctly handed to a courier without asking the customer to pay again by mistake.

**Steps:**
1. Take the paid order from Test 6.
2. In `/admin/orders`, dispatch it to **Steadfast**.
3. Check the COD amount Steadfast was given.
4. Separately, dispatch a different bKash-paid test order to **Pathao** or **RedX** and check their COD amount too.

**Expected result:**
- **Steadfast**: COD amount sent should be **৳0** (order was fully paid via bKash).
- **Pathao/RedX**: COD amount sent will currently be the **full order total** — this is a known, pre-existing limitation in those two couriers' integration (confirmed unrelated to this bKash work; it affects UddoktaPay-paid orders the same way) and is not something this release changes.

**Database tables affected:** `orders` (`courier_consignment_id`, `courier_status`, `courier_provider` set), and for Steadfast, `order_courier_parcels`.
**API called:** The respective courier's Create Order API.
**Edge Function involved:** `steadfast-courier`, `pathao-courier`, or `redx-courier` (`?action=create_order`).

**Possible failure:** Steadfast also sends a nonzero COD amount for a fully-paid order.
**How to debug:** If Steadfast's COD amount is wrong, check that `orders.due_amount` is actually `0` and `orders.paid_amount` equals `orders.total` for that order (Test 6 should guarantee this) — Steadfast's own code reads these two columns directly.

---

## 20. Production Deployment Verification

**Objective:** Final pre-go-live sanity pass, after switching bKash from Sandbox to Live.

**Steps:**
1. In `/admin/settings/payment`, replace sandbox credentials with production `app_key`/`app_secret`/`username`/`password`. Set Environment to **Live**.
2. Confirm the production callback domain (`https://www.shadamonshop.com/payment-result`) is correctly registered/allowed on bKash's merchant side if their onboarding requires it.
3. Run one real, low-value bKash transaction end to end (Tests 6, 12, 13, 15, 17, 19 in miniature).
4. Immediately verify that base URL calls actually went to `tokenized.pay.bka.sh`, not the sandbox host, by inspecting `payment_transactions.gateway_response` for that transaction.
5. Monitor `payment_transactions` for any row stuck at `processing` for more than a few minutes in the first 24–48 hours of live traffic — this is the one accepted residual-risk state identified during implementation review.

**Expected result:** Real transaction completes, money is verifiably in the merchant's live bKash wallet, order/accounting/invoice/notification all match the sandbox test results exactly.

**Database tables affected:** Same full set as Test 6, on production data this time.
**API called:** bKash's live endpoints.
**Edge Function involved:** `bkash-checkout`, `bkash-verify`, `send-order-notification`.

**Possible failure:** Live credentials rejected, or traffic accidentally still hitting sandbox.
**How to debug:** Re-check `store_settings.bkash_environment = 'live'` was actually saved (not left on `sandbox` from a partial save). If credentials are rejected, confirm with bKash that the live app key/secret pair is activated and not still pending approval.

---

## Sign-off

| Test # | Test Name | Result (Pass/Fail) | Tested By | Date | Notes |
|---|---|---|---|---|---|
| 1 | Sandbox Setup | | | | |
| 2 | Admin Configuration | | | | |
| 3 | Database Migration Verification | | | | |
| 4 | Edge Function Deployment Verification | | | | |
| 5 | Frontend Verification | | | | |
| 6 | Successful Payment Test | | | | |
| 7 | Failed Payment Test | | | | |
| 8 | Cancel Payment Test | | | | |
| 9 | Duplicate Callback Test | | | | |
| 10 | Refresh Page Test | | | | |
| 11 | Double-Click Payment Test | | | | |
| 12 | Invoice Verification | | | | |
| 13 | Accounting Verification | | | | |
| 14 | SMS Verification | | | | |
| 15 | Email Verification | | | | |
| 16 | Order History Verification | | | | |
| 17 | Admin Orders Verification | | | | |
| 18 | Reports Verification | | | | |
| 19 | Courier Verification | | | | |
| 20 | Production Deployment Verification | | | | |

**Integration may only be declared production-ready once every test above is marked Pass.**
