// Scrapes Steadfast public tracking page (https://steadfast.com.bd/t/<code>) and
// inserts each timeline entry into courier_tracking_events (dedup by note+created_at).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const STEADFAST_BASE = 'https://portal.packzy.com/api/v1';
const INTERNAL_SHARED_SECRET = Deno.env.get('PUSH_WEBHOOK_SECRET') || Deno.env.get('COURIER_WEBHOOK_SECRET') || '';

async function authenticateAdmin(req: Request) {
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const internalSecret = req.headers.get('x-internal-secret') || '';
  if (INTERNAL_SHARED_SECRET && internalSecret === INTERNAL_SHARED_SECRET) return supabaseAdmin;
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader) throw new Error('Unauthorized');
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (token && token === SUPABASE_SERVICE_ROLE_KEY) return supabaseAdmin;
  const supabaseUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  const { data: isAdmin } = await supabaseAdmin.rpc('has_role', { _user_id: user.id, _role: 'admin' });
  const { data: isOM } = await supabaseAdmin.rpc('has_role', { _user_id: user.id, _role: 'order_manager' });
  if (!isAdmin && !isOM) throw new Error('Access denied');
  return supabaseAdmin;
}

// Pull tracking_code from Steadfast portal API if not already saved on the order
async function fetchTrackingCode(consignmentId: string, supabaseAdmin: any): Promise<string | null> {
  const { data: keys } = await supabaseAdmin
    .from('store_settings')
    .select('key, value')
    .in('key', ['steadfast_api_key', 'steadfast_secret_key']);
  let apiKey = Deno.env.get('STEADFAST_API_KEY') || '';
  let secretKey = Deno.env.get('STEADFAST_SECRET_KEY') || '';
  for (const r of (keys || [])) {
    if (r.key === 'steadfast_api_key' && r.value) apiKey = r.value;
    if (r.key === 'steadfast_secret_key' && r.value) secretKey = r.value;
  }
  if (!apiKey || !secretKey) return null;
  try {
    const res = await fetch(`${STEADFAST_BASE}/status_by_cid/${consignmentId}`, {
      headers: { 'Api-Key': apiKey, 'Secret-Key': secretKey, 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    return data?.tracking_code || data?.consignment?.tracking_code || data?.data?.tracking_code || null;
  } catch {
    return null;
  }
}

interface ScrapedEvent {
  date_text: string;
  iso: string;
  note: string;
}

function parseTrackingHtml(html: string): ScrapedEvent[] {
  // Find the "Tracking Updates" section
  const idx = html.indexOf('Tracking Updates');
  if (idx === -1) return [];
  const section = html.slice(idx, idx + 30000);

  // Pattern matches each row: <div ...min-width:140px;...>DATE</div><div ...font-size:.85rem;>NOTE</div>
  const rowRe = /min-width:140px[^>]*>\s*([^<]+?)\s*<\/div>\s*<div[^>]*font-size:\.85rem[^>]*>\s*([\s\S]*?)\s*<\/div>/g;
  const events: ScrapedEvent[] = [];
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(section)) !== null) {
    const dateText = m[1].replace(/\s+/g, ' ').trim();
    const note = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (!note) continue;
    const iso = parseSteadfastDate(dateText);
    events.push({ date_text: dateText, iso, note });
  }
  return events;
}

// "May 07, 2026 09:50 pm" → ISO string (treat as Asia/Dhaka, UTC+6)
function parseSteadfastDate(s: string): string {
  try {
    const re = /^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*(am|pm)$/i;
    const m = s.match(re);
    if (!m) return new Date().toISOString();
    const months: Record<string, number> = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };
    const month = months[m[1].slice(0,3).toLowerCase()];
    const day = parseInt(m[2], 10);
    const year = parseInt(m[3], 10);
    let hour = parseInt(m[4], 10);
    const min = parseInt(m[5], 10);
    const ap = m[6].toLowerCase();
    if (ap === 'pm' && hour !== 12) hour += 12;
    if (ap === 'am' && hour === 12) hour = 0;
    // Asia/Dhaka = UTC+6 (no DST)
    const utcMs = Date.UTC(year, month, day, hour - 6, min, 0);
    return new Date(utcMs).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

// Map note → readable status
function inferStatus(note: string): string | null {
  const n = note.toLowerCase();
  if (n.includes('delivered')) return 'delivered';
  if (n.includes('cancelled') || n.includes('canceled')) return 'cancelled';
  if (n.includes('returned')) return 'returned';
  if (n.includes('in_review') || n.includes('in review') || n.includes('created by sender')) return 'in_review';
  if (n.includes('pending')) return 'pending';
  if (n.includes('hold')) return 'hold';
  if (n.includes('hub') || n.includes('warehouse') || n.includes('dispatch')) return 'in_transit';
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = await authenticateAdmin(req);

    const { order_id } = await req.json();
    if (!order_id) throw new Error('order_id required');

    const { data: order, error: oErr } = await supabaseAdmin
      .from('orders')
      .select('id, courier_consignment_id, courier_tracking_code, courier_provider')
      .eq('id', order_id)
      .single();
    if (oErr || !order) throw new Error('Order not found');
    if (order.courier_provider && order.courier_provider !== 'steadfast') {
      throw new Error('শুধুমাত্র Steadfast অর্ডারের জন্য সাপোর্ট আছে');
    }
    if (!order.courier_consignment_id) throw new Error('কুরিয়ারে পাঠানো হয়নি');

    // Resolve tracking code
    let trackingCode = order.courier_tracking_code as string | null;
    if (!trackingCode) {
      trackingCode = await fetchTrackingCode(String(order.courier_consignment_id), supabaseAdmin);
      if (trackingCode) {
        await supabaseAdmin.from('orders').update({ courier_tracking_code: trackingCode }).eq('id', order.id);
      }
    }
    if (!trackingCode) {
      return new Response(JSON.stringify({ ok: true, inserted: 0, total: 0, message: 'tracking_code unavailable (legacy order)' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch public tracking page
    const pageRes = await fetch(`https://steadfast.com.bd/t/${trackingCode}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ShadamonShop/1.0)' },
    });
    if (!pageRes.ok) throw new Error(`Steadfast page error: ${pageRes.status}`);
    const html = await pageRes.text();

    const events = parseTrackingHtml(html);
    if (events.length === 0) {
      return new Response(JSON.stringify({ ok: true, inserted: 0, total: 0, message: 'কোনো timeline পাওয়া যায়নি' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load existing notes for dedup
    const { data: existing } = await supabaseAdmin
      .from('courier_tracking_events')
      .select('note, created_at')
      .eq('order_id', order.id);
    const existingKeys = new Set(
      (existing || []).map((e: any) => `${(e.note || '').trim()}|${e.created_at?.slice(0, 16)}`)
    );

    let inserted = 0;
    for (const ev of events) {
      const key = `${ev.note}|${ev.iso.slice(0, 16)}`;
      // Also skip if same note already present without timestamp match
      const noteOnly = (existing || []).some((e: any) => (e.note || '').trim() === ev.note);
      if (existingKeys.has(key) || noteOnly) continue;
      const status = inferStatus(ev.note);
      await supabaseAdmin.from('courier_tracking_events').insert({
        order_id: order.id,
        consignment_id: String(order.courier_consignment_id),
        status,
        note: ev.note,
        raw_data: { source: 'steadfast_page_scrape', date_text: ev.date_text, scraped_at: new Date().toISOString() },
        created_at: ev.iso,
      });
      inserted++;
    }

    return new Response(JSON.stringify({
      ok: true,
      inserted,
      total: events.length,
      tracking_code: trackingCode,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: e?.message === 'Unauthorized' ? 401 : 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
