// One-shot full backfill: refresh courier_status for ALL orders with a consignment ID
// (Steadfast + Pathao). Skips already-terminal courier states by default.
// The DB trigger trg_sync_status_from_courier will then auto-update orders.status.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const STEADFAST_BASE = 'https://portal.packzy.com/api/v1';

const TERMINAL = new Set(['delivered', 'cancelled', 'partial_delivered', 'delivered_approval_pending']);
const VALID_STEADFAST_STATUSES = new Set([
  'pending', 'in_review', 'hold', 'delivered', 'partial_delivered',
  'cancelled', 'unknown',
  'delivered_approval_pending', 'partial_delivered_approval_pending',
  'cancelled_approval_pending', 'unknown_approval_pending',
]);

function normalizeSteadfastStatus(raw: any): string | null {
  const s = (raw == null ? '' : String(raw)).toLowerCase().trim();
  if (!s) return null;
  return VALID_STEADFAST_STATUSES.has(s) ? s : null;
}

async function getSteadfastHeaders(admin: any) {
  let apiKey = '';
  let secretKey = '';
  const { data } = await admin.from('store_settings').select('key, value')
    .in('key', ['steadfast_api_key', 'steadfast_secret_key']);
  for (const r of data || []) {
    if (r.key === 'steadfast_api_key') apiKey = r.value;
    if (r.key === 'steadfast_secret_key') secretKey = r.value;
  }
  if (!apiKey || !secretKey) throw new Error('Steadfast credentials missing');
  return { 'Api-Key': apiKey, 'Secret-Key': secretKey, 'Content-Type': 'application/json' };
}

async function authAdmin(req: Request) {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '') || '';
  if (authHeader && authHeader === SUPABASE_SERVICE_ROLE_KEY) return admin;
  throw new Error('Unauthorized');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const admin = await authAdmin(req);
    const body = await req.json().catch(() => ({}));
    const includeTerminal: boolean = !!body.include_terminal;
    const limit: number = Math.min(Number(body.limit) || 5000, 10000);
    const ascending: boolean = body.ascending !== false; // default oldest first

    // Fetch all eligible Steadfast orders (paged to bypass 1000 limit)
    const all: { id: string; cid: string; cur: string | null }[] = [];
    let from = 0;
    const pageSize = 1000;
    while (all.length < limit) {
      let q = admin.from('orders')
        .select('id, courier_consignment_id, courier_status')
        .not('courier_consignment_id', 'is', null)
        .or('courier_provider.eq.steadfast,courier_provider.is.null')
        .order('created_at', { ascending })
        .range(from, from + pageSize - 1);
      const { data, error } = await q;
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const r of data) {
        if (!includeTerminal && r.courier_status && TERMINAL.has(String(r.courier_status).toLowerCase())) continue;
        all.push({ id: r.id, cid: r.courier_consignment_id, cur: r.courier_status });
      }
      if (data.length < pageSize) break;
      from += pageSize;
    }

    const headers = await getSteadfastHeaders(admin);
    const target = all.slice(0, limit);

    let updated = 0;
    let checked = 0;
    let errors = 0;
    const counts: Record<string, number> = {};

    // Concurrency-controlled fan-out
    const CONCURRENCY = 25;
    let idx = 0;
    async function worker() {
      while (idx < target.length) {
        const i = idx++;
        const o = target[i];
        try {
          const res = await fetch(`${STEADFAST_BASE}/status_by_cid/${o.cid}`, { headers });
          const text = await res.text();
          let json: any = {};
          try { json = JSON.parse(text); } catch {}
          const ns = normalizeSteadfastStatus(json.delivery_status);
          checked++;
          if (ns) {
            counts[ns] = (counts[ns] || 0) + 1;
            if (ns !== o.cur) {
              await admin.from('orders').update({
                courier_status: ns,
                courier_provider: 'steadfast',
              }).eq('id', o.id);
              await admin.from('courier_tracking_events').insert({
                order_id: o.id,
                consignment_id: o.cid,
                status: ns,
                note: `স্ট্যাটাস আপডেট (full_backfill): ${o.cur || '—'} → ${ns}`,
              });
              updated++;
            }
          }
        } catch (e) {
          errors++;
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

    return new Response(JSON.stringify({
      ok: true,
      total_eligible: all.length,
      checked,
      updated,
      errors,
      status_counts: counts,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
