# Billing: CORE Connect

This site's monthly package, bills and admin lock are run by CORE Automation
(coreautomationbd.com).

- `api/core-connect.js` (Vercel function) talks to CORE with the project key kept in the
  Vercel env `CORE_CONNECT_KEY` (made in CORE Admin → Projects → this project →
  Connection; add it, then redeploy). It checks the caller with this site's Supabase
  (`/auth/v1/user` + `get_user_permissions`): admins see the bills and can pay, change
  package or ask CORE for help; other staff only learn whether the panel is locked.
  Without the key it answers `not_connected` and the panel never locks.
- Admin → বিল ও প্যাকেজ (`src/pages/admin/AdminBilling.tsx`): the bill and its dates,
  pay by bKash/Nagad with the TrxID, the packages (change any time, from the next
  bill), past bills and payments, help.
- While CORE has locked the panel for an unpaid bill, every admin page but Billing
  shows `CoreLockScreen`; the storefront is never taken offline. `CoreBillingNotice`
  shows an open bill in the sidebar. When CORE cannot be reached the last known state
  is used.
- Code: `src/lib/coreConnect.ts`, `src/hooks/useCoreBilling.ts`.
