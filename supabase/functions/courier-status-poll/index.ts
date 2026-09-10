// Safety-net cron: every ~10 min poll active courier orders for status updates
// AND import Steadfast public tracking timeline events (warehouse dispatch,
// rider assignment, hub updates, etc.) so the admin panel reflects courier
// reality without any manual button click.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-poll-secret, x-internal-secret',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const SHARED_SECRET =
  Deno.env.get('PUSH_WEBHOOK_SECRET') ||
  Deno.env.get('COURIER_WEBHOOK_SECRET') ||
  '';

const PROVIDERS = [
  { name: 'steadfast', fn: 'steadfast-courier' },
  { name: 'pathao', fn: 'pathao-courier' },
  { name: 'redx', fn: 'redx-courier' },
];

async function callProvider(fn: string, action: string, payload: any) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}?action=${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
      'x-internal-secret': SHARED_SECRET,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let data: any = {};
  try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 300) }; }
  return { ok: res.ok, status: res.status, data, text };
}

async function fetchActiveSteadfastOrders(): Promise<string[]> {
  // Use service role via REST to query active orders that need timeline scrape
  const url = `${SUPABASE_URL}/rest/v1/orders?select=id&courier_provider=eq.steadfast&courier_consignment_id=not.is.null&courier_status=in.(in_review,pending,hold,delivered_approval_pending,partial_delivered_approval_pending,cancelled_approval_pending,unknown_approval_pending)&order=created_at.desc&limit=200`;
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) return [];
  const rows: any[] = await res.json();
  return rows.map((r) => r.id);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Accept either: service-role bearer, OR shared-secret header (used by pg_cron).
  const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '') || '';
  const pollSecret = req.headers.get('x-poll-secret') || '';

  const authorized =
    (authHeader && authHeader === SUPABASE_SERVICE_ROLE_KEY) ||
    (SHARED_SECRET && pollSecret === SHARED_SECRET);

  if (!authorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const results: Record<string, any> = {};

  console.log(`[poll] start shared_len=${SHARED_SECRET.length}`);

  // Step 1: bulk_status for each provider
  for (const p of PROVIDERS) {
    try {
      const r = await callProvider(p.fn, 'bulk_status', { provider: p.name, only_active: true, limit: 500 });
      results[p.name] = r;
      console.log(`[poll] ${p.name} bulk_status: ${r.status} body=${r.text.slice(0, 200)}`);
    } catch (e: any) {
      results[p.name] = { ok: false, error: e?.message || String(e) };
      console.error(`[poll] ${p.name} bulk_status error:`, e?.message);
    }
  }

  // Step 2: timeline scrape for active Steadfast orders (rider/hub/dispatch events)
  const timelineResults: any[] = [];
  try {
    const activeIds = await fetchActiveSteadfastOrders();
    console.log(`[poll] steadfast active orders for timeline: ${activeIds.length}`);
    for (const orderId of activeIds) {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/steadfast-tracking-fetch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'apikey': SUPABASE_ANON_KEY,
            'x-internal-secret': SHARED_SECRET,
          },
          body: JSON.stringify({ order_id: orderId }),
        });
        const txt = await res.text();
        let d: any = {}; try { d = JSON.parse(txt); } catch { d = { raw: txt.slice(0, 200) }; }
        timelineResults.push({ order_id: orderId, ok: res.ok, status: res.status, inserted: d?.inserted ?? 0, error: d?.error });
      } catch (e: any) {
        timelineResults.push({ order_id: orderId, ok: false, error: e?.message });
      }
      // small delay to avoid hammering Steadfast public page
      await new Promise((r) => setTimeout(r, 250));
    }
  } catch (e: any) {
    console.error('[poll] timeline phase error:', e?.message);
  }

  const totalInserted = timelineResults.reduce((s, r) => s + (r.inserted || 0), 0);
  console.log(`[poll] timeline events inserted total=${totalInserted}`);

  return new Response(JSON.stringify({
    ok: true,
    ran_at: new Date().toISOString(),
    bulk_status: results,
    timeline: { processed: timelineResults.length, inserted: totalInserted, results: timelineResults.slice(0, 30) },
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
