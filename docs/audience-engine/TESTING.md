# Audience Engine — Manual Testing Checklist

Run through before each release. The legacy SMS pipeline must remain
identical; the new engine is additive.

## 1. Legacy Campaign Compatibility

- [ ] Open Admin → SMS ক্যাম্পেইন → **ক্যাম্পেইন** tab.
- [ ] Pick any segment (VIP / city / manual) → recipient count matches `customers` table.
- [ ] Send a 1-recipient test SMS → arrives, history row written, status `completed`.

## 2. Audience Engine Parity

- [ ] Open **অডিয়েন্স ইঞ্জিন** tab.
- [ ] Select preset `VIP` → preview count == count returned by `get_audience_preset_count('vip')` (or your engine's preset SQL).
- [ ] Add district `Dhaka` → final count drops accordingly.
- [ ] Add `manualExclude` of one phone → final count drops by 1.

## 3. Template Variables

- [ ] Compose with `হ্যালো {{first_name}}, {{district}} থেকে অর্ডার {{order_count}}টি — {{shop}}`.
- [ ] Preview shows sample customer name + Dhaka + 5 + shop name.
- [ ] Send to a real test customer → SMS body has their real name/district/count.

## 4. Export Parity

- [ ] Pick any filter that resolves to N recipients.
- [ ] Export → CSV → row count == N.
- [ ] Export → Facebook → row count == N, phone column is SHA-256 hash.

## 5. Cross-page Selection

- [ ] In Customer Preview Table, jump from page 1 → 5 → 1.
- [ ] Selection set persists across pages.
- [ ] "Select all matching" reflects same total as Audience Summary.

## 6. Dry Run

- [ ] Open Send Confirm dialog → toggle "ড্রাই রান মোড" on.
- [ ] Click "ড্রাই রান চালান" → no SMS leaves; history row appears with status `dry_run` and `[DRY]` prefix.
- [ ] Audit log shows `sms_dry_run` action.

## 7. Saved Audience

- [ ] Save current filter as "Test VIP" with category "QA".
- [ ] Reload page → opens in **সেভড অডিয়েন্স** tab with star, category, customer_count.
- [ ] Toggle favorite → moves to top of list, audit log row appears.
- [ ] Rename to "Test VIP v2" → list updates.
- [ ] Open → engine tab loads with the saved filter.

## 8. Campaign History

- [ ] **ইতিহাস** tab shows all `sms_campaigns` rows with created-by email, final count, parts, actual vs estimated cost.
- [ ] Search by name → narrows.
- [ ] Date range → narrows.
- [ ] Click View → drawer shows full message + filter JSON.
- [ ] Click Reuse → engine tab populated with filter + body.
- [ ] Click Export → CSV of `sms_campaign_recipients` for that campaign, row count == sent + failed.

## 9. Audit Log

- [ ] **অডিট লগ** tab lists actions in reverse-chronological order.
- [ ] Filter by `sms_sent` → only send rows.
- [ ] Each row shows actor email + IP + metadata.

## 10. Mobile

- [ ] On 375px viewport, tabs wrap and remain tappable.
- [ ] Confirm dialog grid collapses, send button reachable.
- [ ] Preview table horizontally scrolls without breaking layout.

## 11. Performance — Large Dataset

- [ ] With 10k+ customers, resolving a preset completes in < 4s.
- [ ] Preview table loads under 1s per page.
- [ ] Analytics panel renders within 1.5s after filter change.
- [ ] Sending 500-recipient campaign keeps UI responsive (progress dialog updates ~ every 2s).

## 12. Error Handling

- [ ] Disconnect network → send fails with toast "ইন্টারনেট সংযোগে সমস্যা".
- [ ] Empty body → "মেসেজ লিখুন" toast, no campaign row.
- [ ] No recipients → "কোনো রিসিপিয়েন্ট নেই" toast.
- [ ] SMS provider error → recipient row gets `error_message`, retry happens once.
