-- ============================================================
-- এম্ব্রয়ডারি, কারখানা and প্রিন্ট all have units.settings.internal_work_party_id
-- set (each names its own "SHORNO SUTA ___" internal work-tracking person), but
-- they use two genuinely different data sources for that internal work:
--   - এম্ব্রয়ডারি still logs it as plain acc_party_entries memo rows (11 rows,
--     ৳103,543, predates this feature area's rebuild).
--   - কারখানা and প্রিন্ট were moved this session to the live WorkOrderContent /
--     acc_work_orders engine (order creation + per-worker কাজ উঠান progress),
--     and have zero acc_party_entries rows for their internal person.
-- AdminPersonProfile.tsx's PartyProfileView previously assumed ALL
-- internal-work-sheet units use acc_work_orders, so এম্ব্রয়ডারির person profile
-- hid its real memo ledger table and showed the (permanently empty, for
-- এম্ব্রয়ডারি) কাজের অর্ডার section instead -- its real logged work became
-- invisible. This flag lets the UI tell the two architectures apart and show
-- the right one per unit, without guessing from current row counts (which
-- would be fragile if a unit is ever between entries).
-- ============================================================

update acc_units
set settings = settings || '{"internal_work_uses_orders": true}'::jsonb
where name in ('কারখানা', 'প্রিন্ট');
