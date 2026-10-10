// CORE Connect: this site's bills, package and admin lock, managed by CORE Automation.
//
// The admin panel calls /api/core-connect with the signed-in staff member's session.
// This function checks them with the site's own backend, then talks to CORE with the
// project's key. The key stays here on the server: Vercel → this project → Settings →
// Environment Variables → CORE_CONNECT_KEY (made in CORE Admin → Projects → this
// project → Connection). Without it the panel simply shows "not connected" and never
// locks.

// The site's backend (as in src/integrations/supabase/config.ts; the override is for tests).
const SUPABASE_URL = process.env.CORE_CONNECT_SITE_SUPABASE_URL || "https://api.shornosuta.com";
const CORE_URL = (process.env.CORE_URL || "https://coreautomationbd.com").replace(/\/$/, "");

// Who sees the bills and can pay or change the package. Other staff only learn
// whether the panel is locked.
const BILLING_ROLES = new Set(["admin", "malik", "system_owner"]);

// POST { action, ...fields } → CORE's endpoint for it.
const ACTIONS = { pay: "payments", plan: "plan", ticket: "tickets", order: "orders" };

/** The signed-in staff member's role, checked with the site's backend (null if not staff). */
async function staffRole(req) {
  const authorization = String(req.headers.authorization || "");
  const apikey = String(req.headers.apikey || "");
  if (!/^Bearer\s+\S+$/i.test(authorization) || !apikey) return null;
  const headers = { apikey, authorization };
  try {
    const user = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers, signal: AbortSignal.timeout(10000) });
    if (!user.ok) return null;
    const { id } = await user.json();
    if (!id) return null;
    const perms = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_user_permissions`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ _user_id: id }),
      signal: AbortSignal.timeout(10000),
    });
    if (!perms.ok) return null;
    const data = await perms.json();
    return typeof data?.role === "string" ? data.role : null;
  } catch {
    return null;
  }
}

async function core(path, init = {}) {
  const res = await fetch(`${CORE_URL}/api/connect/v1/${path}`, {
    ...init,
    headers: { authorization: `Bearer ${process.env.CORE_CONNECT_KEY}`, "content-type": "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!process.env.CORE_CONNECT_KEY) return res.status(503).json({ error: "not_connected" });

  const role = await staffRole(req);
  if (!role) return res.status(401).json({ error: "অ্যাডমিন প্যানেলে লগইন করুন।" });
  const canPay = BILLING_ROLES.has(role);

  try {
    if (req.method === "GET") {
      const { status, body } = await core("status");
      // A key CORE does not know (or CORE answering oddly) must not lock the panel.
      if (status === 401) return res.status(503).json({ error: "not_connected" });
      if (status !== 200) return res.status(502).json({ error: "core_error" });
      if (canPay) return res.status(200).json({ ...body, role, can_pay: true });
      const { status: state, locked, lock_date, next_due_date } = body.billing ?? {};
      return res.status(200).json({
        billing: { status: state, locked, lock_date, next_due_date },
        support: body.support,
        role,
        can_pay: false,
      });
    }

    if (req.method === "POST") {
      if (!canPay) return res.status(403).json({ error: "শুধু অ্যাডমিন এটা করতে পারবেন।" });
      const { action, ...fields } = req.body && typeof req.body === "object" ? req.body : {};
      const path = ACTIONS[action];
      if (!path) return res.status(400).json({ error: "Unknown action." });
      const { status, body } = await core(path, { method: "POST", body: JSON.stringify(fields) });
      return res.status(status === 401 ? 503 : status).json(status === 401 ? { error: "not_connected" } : body);
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed." });
  } catch {
    return res.status(502).json({ error: "core_unreachable" });
  }
}
