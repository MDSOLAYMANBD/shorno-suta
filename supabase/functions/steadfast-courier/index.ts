import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const INTERNAL_SHARED_SECRET = Deno.env.get('PUSH_WEBHOOK_SECRET') || Deno.env.get('COURIER_WEBHOOK_SECRET') || '';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const STEADFAST_BASE = 'https://portal.packzy.com/api/v1';
const MAX_PAYMENT_SYNC_PAGES = 100;

async function parseResponse(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Steadfast API error (HTTP ${res.status}): ${text.substring(0, 300)}`);
  }
}

async function getSteadfastCredentials(supabaseAdmin: any) {
  let apiKey = Deno.env.get('STEADFAST_API_KEY') || '';
  let secretKey = Deno.env.get('STEADFAST_SECRET_KEY') || '';

  const { data: dbKeys } = await supabaseAdmin
    .from('store_settings')
    .select('key, value')
    .in('key', ['steadfast_api_key', 'steadfast_secret_key']);

  if (dbKeys) {
    for (const row of dbKeys) {
      if (row.key === 'steadfast_api_key' && row.value) apiKey = row.value;
      if (row.key === 'steadfast_secret_key' && row.value) secretKey = row.value;
    }
  }

  if (!apiKey || !secretKey) {
    throw new Error('Steadfast API credentials not configured। সেটিংস পেজ থেকে API Key ও Secret Key দিন।');
  }

  return {
    'Api-Key': apiKey,
    'Secret-Key': secretKey,
    'Content-Type': 'application/json',
  };
}

async function authenticateAdmin(req: Request) {
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Internal shared-secret bypass (used by courier-status-poll cron + server-to-server)
  const internalSecret = req.headers.get('x-internal-secret') || '';
  if (INTERNAL_SHARED_SECRET && internalSecret === INTERNAL_SHARED_SECRET) {
    return supabaseAdmin;
  }

  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader) throw new Error('Unauthorized');

  // Internal service-role bypass
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (token && token === SUPABASE_SERVICE_ROLE_KEY) {
    return supabaseAdmin;
  }

  const supabaseUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: isAdmin } = await supabaseAdmin.rpc('has_role', { _user_id: user.id, _role: 'admin' });
  const { data: isOrderManager } = await supabaseAdmin.rpc('has_role', { _user_id: user.id, _role: 'order_manager' });
  if (!isAdmin && !isOrderManager) throw new Error('Access denied');

  return supabaseAdmin;
}

// Steadfast `delivery_status` whitelist — anything else (e.g. API meta "success") is normalized
const VALID_STEADFAST_STATUSES = new Set([
  'pending', 'in_review', 'hold', 'delivered', 'partial_delivered',
  'cancelled', 'unknown',
  'delivered_approval_pending', 'partial_delivered_approval_pending',
  'cancelled_approval_pending', 'unknown_approval_pending',
]);

function normalizeSteadfastStatus(raw: any, fallback = 'in_review'): string {
  const s = (raw == null ? '' : String(raw)).toLowerCase().trim();
  if (!s) return fallback;
  return VALID_STEADFAST_STATUSES.has(s) ? s : fallback;
}

// Steadfast `status_by_cid` returns multiple shapes depending on case:
//   { status: 200, delivery_status: "in_review" }
//   { delivery_status: "in_review" }
//   { data: { delivery_status: "in_review" } }
//   { consignment: { status: "in_review" } }
function extractSteadfastRawStatus(result: any): string {
  if (!result || typeof result !== 'object') return '';
  return (
    result.delivery_status
    || result.data?.delivery_status
    || result.consignment?.delivery_status
    || result.consignment?.status
    || result.data?.status
    || ''
  );
}

// Statuses we still need to actively poll (non-terminal)
const ACTIVE_COURIER_STATUSES = [
  'pending', 'in_review', 'hold',
  'delivered_approval_pending', 'partial_delivered_approval_pending',
  'cancelled_approval_pending', 'unknown_approval_pending',
];

async function logTrackingEvent(
  supabaseAdmin: any,
  orderId: string,
  consignmentId: string,
  status: string,
  prevStatus: string | null,
  source: string,
) {
  if (!status || status === prevStatus) return;
  try {
    await supabaseAdmin.from('courier_tracking_events').insert({
      order_id: orderId,
      consignment_id: consignmentId,
      status,
      note: `স্ট্যাটাস আপডেট (${source}): ${prevStatus || '—'} → ${status}`,
      raw_data: { source, previous_status: prevStatus },
    });
  } catch (e) {
    console.warn('[steadfast] tracking event insert failed:', (e as any)?.message);
  }
}

// Fetches the same store-wide default courier note the admin UI shows as a
// placeholder when an order has no explicit courier_note of its own — the UI
// displays this text in the note box, making it look saved, but it was never
// actually written to the order until now, so Steadfast received a blank
// note. Mirrors OrderPreviewDialog's own lookup (courier_default_note /
// courier_exchange_default_note) so what the admin sees is what gets sent.
async function getDefaultCourierNotes(supabaseAdmin: any): Promise<{ normal: string; exchange: string }> {
  const { data } = await supabaseAdmin
    .from('store_settings').select('key, value').in('key', ['courier_default_note', 'courier_exchange_default_note']);
  const map: Record<string, string> = {};
  (data || []).forEach((r: any) => { map[r.key] = r.value || ''; });
  return { normal: map.courier_default_note || '', exchange: map.courier_exchange_default_note || map.courier_default_note || '' };
}

function pickDefaultNote(defaults: { normal: string; exchange: string }, orderOrigin: string): string {
  return orderOrigin === 'exchange' ? defaults.exchange : defaults.normal;
}

function buildOrderPayload(order: any, defaultNote = '') {
  const address = [order.customer_address, order.city].filter(Boolean).join(', ');
  const altPhone = (order.customer_alt_phone || '').toString().trim();
  const courierNote = (order.courier_note || '').toString().trim() || defaultNote.trim();
  // Append alt phone into note as a safety fallback (in case Steadfast API ignores alternative_phone field)
  const combinedNote = [
    courierNote,
    altPhone ? `Alt: ${altPhone}` : '',
  ].filter(Boolean).join(' | ') || (order.notes || '');
  const payload: Record<string, any> = {
    invoice: order.order_number,
    recipient_name: order.customer_name,
    recipient_phone: order.customer_phone,
    recipient_address: address || 'N/A',
    cod_amount: order.is_gift_order ? 0 : Math.round(Number(order.due_amount) > 0 ? Number(order.due_amount) : (Number(order.due_amount) === 0 && Number(order.paid_amount) > 0 ? 0 : Number(order.total) || 0)),
    note: combinedNote,
  };
  if (altPhone) payload.alternative_phone = altPhone;
  if (order.order_origin === 'exchange') payload.is_exchange = 1;
  return payload;
}

// Single order creation
async function createOrder(supabaseAdmin: any, headers: Record<string, string>, orderId: string) {
  const { data: order, error } = await supabaseAdmin.from('orders').select('*').eq('id', orderId).single();
  if (error || !order) throw new Error(`Order not found: ${orderId}`);

  const defaults = await getDefaultCourierNotes(supabaseAdmin);
  const res = await fetch(`${STEADFAST_BASE}/create_order`, {
    method: 'POST',
    headers,
    body: JSON.stringify(buildOrderPayload(order, pickDefaultNote(defaults, order.order_origin))),
  });

  const result = await parseResponse(res);

  if (!res.ok || !result?.consignment?.consignment_id) {
    const detail = result?.message || result?.error || result?.errors || `HTTP ${res.status}`;
    throw new Error(`Steadfast parcel তৈরি ব্যর্থ: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
  }

  const consignmentId = String(result.consignment.consignment_id);
  const status = normalizeSteadfastStatus(result.consignment.status, 'in_review');
  const trackingCode = result.consignment.tracking_code || null;
  await supabaseAdmin.from('orders').update({
    courier_consignment_id: consignmentId,
    courier_tracking_code: trackingCode,
    courier_status: status,
    courier_provider: 'steadfast',
    courier_entry_date: new Date().toISOString(),
    courier_last_synced_total: Number(order.total) || 0,
  }).eq('id', orderId);
  await logTrackingEvent(supabaseAdmin, orderId, consignmentId, status, null, 'create_order');

  return result;
}

// Cancel an in-review parcel at courier. Returns deleted flag.
async function cancelOrder(supabaseAdmin: any, headers: Record<string, string>, orderId: string) {
  const { data: order, error } = await supabaseAdmin.from('orders').select('id, courier_consignment_id, courier_status, courier_provider').eq('id', orderId).single();
  if (error || !order) throw new Error(`Order not found: ${orderId}`);
  if (!order.courier_consignment_id) {
    return { success: true, already_clean: true, detail: 'No consignment to cancel' };
  }
  if (order.courier_provider && order.courier_provider !== 'steadfast') {
    throw new Error(`Order is on ${order.courier_provider}, not steadfast.`);
  }
  if (order.courier_status && order.courier_status !== 'in_review' && order.courier_status !== 'pending') {
    const err: any = new Error(`Cannot cancel at courier: status is "${order.courier_status}". Only in_review parcels can be auto-cancelled.`);
    err.statusCode = 409;
    throw err;
  }

  const cid = String(order.courier_consignment_id);
  const del = await tryDeleteConsignment(headers, cid);
  if (del.deleted) {
    await supabaseAdmin.from('orders').update({
      courier_consignment_id: null,
      courier_tracking_code: null,
      courier_status: null,
      courier_provider: null,
      courier_entry_date: null,
      courier_last_synced_total: null,
    }).eq('id', orderId);
    await supabaseAdmin.from('courier_tracking_events').insert({
      order_id: orderId,
      consignment_id: cid,
      status: 'cancelled_by_merchant',
      note: 'অর্ডার ক্যানসেল হওয়ায় কুরিয়ার থেকে পার্সেল ডিলিট হয়েছে',
      raw_data: { source: 'cancel_order', delete_attempt: del },
    });
  } else {
    await supabaseAdmin.from('courier_tracking_events').insert({
      order_id: orderId,
      consignment_id: cid,
      status: 'cancel_failed',
      note: 'কুরিয়ার থেকে অটো-ডিলিট ব্যর্থ — Steadfast পোর্টাল থেকে ম্যানুয়ালি ডিলিট করুন',
      raw_data: { source: 'cancel_order', delete_attempt: del },
    });
  }
  return { success: del.deleted, deleted: del.deleted, detail: del.detail, consignment_id: cid };
}

// Bulk order creation using Steadfast's native bulk endpoint
async function bulkCreateOrders(supabaseAdmin: any, headers: Record<string, string>, orderIds: string[]) {
  if (!orderIds.length) throw new Error('No order IDs provided');

  const { data: orders, error } = await supabaseAdmin
    .from('orders')
    .select('*')
    .in('id', orderIds);

  if (error || !orders?.length) throw new Error('Orders not found');

  const defaults = await getDefaultCourierNotes(supabaseAdmin);
  const payloads = orders.map((order: any) => buildOrderPayload(order, pickDefaultNote(defaults, order.order_origin)));

  // Steadfast bulk API expects: data as JSON string of array
  const formData = new FormData();
  formData.append('data', JSON.stringify(payloads));

  const bulkHeaders = { ...headers };
  delete bulkHeaders['Content-Type']; // FormData sets its own content-type

  const res = await fetch(`${STEADFAST_BASE}/create_order/bulk-order`, {
    method: 'POST',
    headers: bulkHeaders,
    body: formData,
  });

  const result = await parseResponse(res);

  // Update DB for each successful consignment
  const results: any[] = [];
  if (Array.isArray(result.data)) {
    for (const item of result.data) {
      const matchedOrder = orders.find((o: any) => o.order_number === item.invoice);
      if (matchedOrder && item.consignment_id) {
        const consignmentId = String(item.consignment_id);
        const status = normalizeSteadfastStatus(item.status, 'in_review');
        const trackingCode = item.tracking_code || null;
        await supabaseAdmin.from('orders').update({
          courier_consignment_id: consignmentId,
          courier_tracking_code: trackingCode,
          courier_status: status,
          courier_provider: 'steadfast',
          courier_entry_date: new Date().toISOString(),
          courier_last_synced_total: Number(matchedOrder.total) || 0,
        }).eq('id', matchedOrder.id);
        await logTrackingEvent(supabaseAdmin, matchedOrder.id, consignmentId, status, null, 'bulk_create');
        results.push({ order_id: matchedOrder.id, success: true, consignment_id: item.consignment_id });
      } else if (matchedOrder) {
        results.push({ order_id: matchedOrder.id, success: false, error: item.errors || 'Unknown error' });
      }
    }
  }

  return { results, raw: result };
}

// Try to delete/cancel an in-review consignment. Caller must never create a
// replacement parcel unless this returns deleted=true.
async function tryDeleteConsignment(headers: Record<string, string>, consignmentId: string): Promise<{ deleted: boolean; detail: string; result?: any }> {
  const candidates = [
    { url: `${STEADFAST_BASE}/cancel_order/cid/${consignmentId}`, method: 'GET' },
    { url: `${STEADFAST_BASE}/cancel_order/${consignmentId}`, method: 'GET' },
    { url: `${STEADFAST_BASE}/delete_order/cid/${consignmentId}`, method: 'GET' },
    { url: `${STEADFAST_BASE}/delete_order/${consignmentId}`, method: 'DELETE' },
  ];
  const failures: string[] = [];
  for (const c of candidates) {
    try {
      const res = await fetch(c.url, { method: c.method, headers });
      const txt = await res.text();
      let result: any = null;
      try { result = txt ? JSON.parse(txt) : null; } catch { /* non-json response */ }
      const message = String(result?.message || result?.status || result?.error || txt || '').toLowerCase();
      const success = res.ok && result && !result?.error && !result?.errors
        && (Number(result?.status) === 200 || message.includes('success') || message.includes('deleted') || message.includes('cancel'))
        && !message.includes('fail') && !message.includes('error') && !message.includes('not found')
        && !message.includes('cannot') && !message.includes('can not') && !message.includes('unable')
        && !message.includes('invalid') && !message.includes('unauthorized');
      if (success) return { deleted: true, detail: `${c.method} ${c.url} → ${res.status}`, result };
      failures.push(`${c.method} ${res.status}: ${(txt || '').slice(0, 160)}`);
    } catch (e) {
      failures.push(`${c.method} network: ${(e as any)?.message || 'failed'}`);
    }
  }
  return { deleted: false, detail: failures.filter(Boolean).slice(0, 4).join(' | ') || 'No delete endpoint available' };
}

// Re-sync an order with Steadfast safely: in-review parcels cannot be edited via
// the public API, so delete the old parcel first, then create one fresh parcel.
// If delete fails, stop immediately to avoid duplicate courier entries.
async function resyncOrder(supabaseAdmin: any, headers: Record<string, string>, orderId: string) {
  const { data: order, error } = await supabaseAdmin.from('orders').select('*').eq('id', orderId).single();
  if (error || !order) throw new Error(`Order not found: ${orderId}`);
  if (order.courier_provider && order.courier_provider !== 'steadfast') {
    throw new Error(`Order is on ${order.courier_provider}, not steadfast. Re-sync supported for steadfast only.`);
  }
  if (!order.courier_consignment_id) {
    throw new Error('Order has no courier consignment yet. Send to courier first.');
  }
  if (order.courier_status !== 'in_review') {
    const err: any = new Error(`Cannot re-sync: courier status is "${order.courier_status}". Only in_review parcels can be re-synced.`);
    err.statusCode = 409;
    throw err;
  }

  const oldCid = String(order.courier_consignment_id);
  const defaults = await getDefaultCourierNotes(supabaseAdmin);
  const payload = buildOrderPayload(order, pickDefaultNote(defaults, order.order_origin));
  const statusRes = await fetch(`${STEADFAST_BASE}/status_by_cid/${oldCid}`, { headers });
  const statusResult = await parseResponse(statusRes);
  const rawStatus = extractSteadfastRawStatus(statusResult);
  const liveStatus = normalizeSteadfastStatus(rawStatus, order.courier_status || 'in_review');
  if (liveStatus && liveStatus !== 'in_review' && liveStatus !== 'pending') {
    const err: any = new Error(`Cannot re-sync: Steadfast parcel #${oldCid} এখন "${liveStatus}"। শুধু in_review parcel auto update করা যাবে।`);
    err.statusCode = 409;
    throw err;
  }

  const del = await tryDeleteConsignment(headers, oldCid);
  if (!del.deleted) {
    const err: any = new Error(`পুরাতন parcel #${oldCid} Steadfast থেকে delete/cancel হয়নি। Duplicate এড়াতে নতুন parcel তৈরি করা হয়নি। Steadfast পোর্টাল থেকে ম্যানুয়ালি edit/delete করুন।`);
    err.statusCode = 409;
    err.detail = del.detail;
    await supabaseAdmin.from('courier_tracking_events').insert({
      order_id: orderId,
      consignment_id: oldCid,
      status: 'resync_blocked',
      note: `পুরাতন parcel delete/cancel হয়নি — duplicate এড়াতে নতুন parcel তৈরি হয়নি। পোর্টালে COD ৳${payload.cod_amount} ম্যানুয়ালি আপডেট করুন।`,
      raw_data: { source: 'resync_order', live_status: liveStatus, delete_attempt: del, desired_payload: payload },
    });
    throw err;
  }

  await supabaseAdmin.from('courier_tracking_events').insert({
    order_id: orderId,
    consignment_id: oldCid,
    status: 'deleted_for_resync',
    note: `পুরাতন Steadfast parcel #${oldCid} delete/cancel হয়েছে — updated COD দিয়ে নতুন parcel তৈরি হচ্ছে।`,
    raw_data: { source: 'resync_order', live_status: liveStatus, delete_attempt: del },
  });

  await supabaseAdmin.from('orders').update({
    courier_consignment_id: null,
    courier_tracking_code: null,
    courier_status: null,
    courier_provider: null,
    courier_entry_date: null,
    courier_last_synced_total: null,
  }).eq('id', orderId);

  const createRes = await fetch(`${STEADFAST_BASE}/create_order`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const createResult = await parseResponse(createRes);
  if (!createRes.ok || !createResult?.consignment?.consignment_id) {
    const detail = createResult?.message || createResult?.error || createResult?.errors || `HTTP ${createRes.status}`;
    const err: any = new Error(`পুরাতন parcel delete হয়েছে, কিন্তু নতুন Steadfast parcel তৈরি ব্যর্থ: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
    err.statusCode = 400;
    throw err;
  }

  const newCid = String(createResult.consignment.consignment_id);
  const newStatus = normalizeSteadfastStatus(createResult.consignment.status, 'in_review');
  const trackingCode = createResult.consignment.tracking_code || null;

  await supabaseAdmin.from('orders').update({
    courier_consignment_id: newCid,
    courier_tracking_code: trackingCode,
    courier_status: newStatus,
    courier_provider: 'steadfast',
    courier_entry_date: new Date().toISOString(),
    courier_last_synced_total: Number(order.total) || 0,
  }).eq('id', orderId);

  await supabaseAdmin.from('courier_tracking_events').insert({
    order_id: orderId,
    consignment_id: newCid,
    status: newStatus,
    note: `Updated COD ৳${payload.cod_amount} দিয়ে নতুন Steadfast parcel #${newCid} তৈরি হয়েছে (পুরাতন #${oldCid} delete/cancel)।`,
    raw_data: { source: 'resync_order', old_consignment_id: oldCid, create_result: createResult, desired_payload: payload },
  });

  return {
    success: true,
    replaced: true,
    old_deleted: true,
    old_consignment_id: oldCid,
    new_consignment_id: newCid,
    consignment_id: newCid,
    new_cod: payload.cod_amount,
    detail: del.detail,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Auto Parcel Recreation (Steadfast)
// Detects courier-relevant change → archives current active parcel → optional
// best-effort delete (never blocks) → creates brand-new parcel → inserts new
// active row in order_courier_parcels and updates orders.courier_* pointers.
// ────────────────────────────────────────────────────────────────────────────
const RECREATABLE_STATUSES = new Set(['in_review', 'draft', 'awaiting_dispatch', 'pending']);

async function recreateParcel(
  supabaseAdmin: any,
  headers: Record<string, string>,
  orderId: string,
  reason: string,
) {
  const { data: order, error } = await supabaseAdmin.from('orders').select('*').eq('id', orderId).single();
  if (error || !order) throw new Error(`Order not found: ${orderId}`);

  // 1) Status gate — only if there's an existing parcel and it's still safe
  const hasExisting = !!order.courier_consignment_id;
  if (hasExisting) {
    const currentStatus = (order.courier_status || '').toLowerCase();
    if (currentStatus && !RECREATABLE_STATUSES.has(currentStatus)) {
      const err: any = new Error(
        `This parcel has already entered the courier network (status: ${currentStatus}) and cannot be recreated automatically.`
      );
      err.statusCode = 409;
      throw err;
    }
    if (order.courier_provider && order.courier_provider !== 'steadfast') {
      const err: any = new Error(`Order is on ${order.courier_provider}, not steadfast.`);
      err.statusCode = 409;
      throw err;
    }
  }

  const defaults = await getDefaultCourierNotes(supabaseAdmin);
  const payload = buildOrderPayload(order, pickDefaultNote(defaults, order.order_origin));
  const newCod = Number(payload.cod_amount) || 0;

  // 2) Idempotency: if the active parcel already reflects this exact COD, skip
  const { data: activeRow } = await supabaseAdmin
    .from('order_courier_parcels')
    .select('id, consignment_id, cod_amount, status')
    .eq('order_id', orderId)
    .eq('is_active', true)
    .maybeSingle();

  if (activeRow && Math.round(Number(activeRow.cod_amount) || 0) === Math.round(newCod) && activeRow.consignment_id === order.courier_consignment_id) {
    return { success: true, skipped: true, reason: 'no_change', active_consignment_id: activeRow.consignment_id };
  }

  let oldCid: string | null = null;
  let deleteAttempt: any = null;

  // 3) Archive existing active row + optional delete attempt (best-effort)
  if (hasExisting && activeRow) {
    oldCid = String(order.courier_consignment_id);
    if ((order.courier_status || '').toLowerCase() === 'in_review') {
      try { deleteAttempt = await tryDeleteConsignment(headers, oldCid); } catch (e: any) {
        deleteAttempt = { deleted: false, detail: e?.message || 'delete threw' };
      }
    }
    await supabaseAdmin.from('order_courier_parcels').update({
      is_active: false,
      archived_at: new Date().toISOString(),
      deleted_at: deleteAttempt?.deleted ? new Date().toISOString() : null,
    }).eq('id', activeRow.id);

    await supabaseAdmin.from('courier_tracking_events').insert({
      order_id: orderId,
      consignment_id: oldCid,
      status: 'parcel_archived',
      note: `পুরাতন parcel #${oldCid} archived (reason: ${reason}${deleteAttempt?.deleted ? ', deleted at courier' : ''}).`,
      raw_data: { source: 'recreate_parcel', reason, delete_attempt: deleteAttempt },
    });
  }

  // 4) Create brand-new parcel
  const createRes = await fetch(`${STEADFAST_BASE}/create_order`, {
    method: 'POST', headers, body: JSON.stringify(payload),
  });
  const createResult = await parseResponse(createRes);
  if (!createRes.ok || !createResult?.consignment?.consignment_id) {
    // Roll-back archive flag so we don't lose pointer to the still-live old parcel
    if (activeRow) {
      await supabaseAdmin.from('order_courier_parcels').update({ is_active: true, archived_at: null }).eq('id', activeRow.id);
    }
    const detail = createResult?.message || createResult?.error || createResult?.errors || `HTTP ${createRes.status}`;
    const err: any = new Error(`নতুন Steadfast parcel তৈরি ব্যর্থ: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
    err.statusCode = 400;
    throw err;
  }

  const newCid = String(createResult.consignment.consignment_id);
  const newStatus = normalizeSteadfastStatus(createResult.consignment.status, 'in_review');
  const trackingCode = createResult.consignment.tracking_code || null;

  // 5) Insert new active history row
  await supabaseAdmin.from('order_courier_parcels').insert({
    order_id: orderId,
    courier_name: 'steadfast',
    consignment_id: newCid,
    tracking_code: trackingCode,
    cod_amount: newCod,
    status: newStatus,
    is_active: true,
    reason,
    raw_response: createResult,
  });

  // 6) Update active pointer on orders row
  await supabaseAdmin.from('orders').update({
    courier_consignment_id: newCid,
    courier_tracking_code: trackingCode,
    courier_status: newStatus,
    courier_provider: 'steadfast',
    courier_entry_date: new Date().toISOString(),
    courier_last_synced_total: Number(order.total) || 0,
  }).eq('id', orderId);

  await supabaseAdmin.from('courier_tracking_events').insert({
    order_id: orderId,
    consignment_id: newCid,
    status: newStatus,
    note: `Courier parcel recreated due to ${reason}. পুরাতন${oldCid ? ` #${oldCid}` : ''} → নতুন #${newCid} (COD ৳${newCod})।`,
    raw_data: { source: 'recreate_parcel', reason, old_consignment_id: oldCid, delete_attempt: deleteAttempt, new_cod: newCod },
  });

  return {
    success: true,
    recreated: true,
    old_consignment_id: oldCid,
    new_consignment_id: newCid,
    consignment_id: newCid,
    tracking_code: trackingCode,
    new_cod: newCod,
    status: newStatus,
    old_deleted: !!deleteAttempt?.deleted,
    delete_detail: deleteAttempt?.detail,
    reason,
  };
}

// Check single consignment status
async function checkStatus(supabaseAdmin: any, headers: Record<string, string>, consignmentId: string) {
  const res = await fetch(`${STEADFAST_BASE}/status_by_cid/${consignmentId}`, { headers });
  const result = await parseResponse(res);

  const rawStatus = extractSteadfastRawStatus(result);
  const newStatus = normalizeSteadfastStatus(rawStatus, '');
  console.log(`[steadfast.checkStatus] cid=${consignmentId} http=${res.status} raw=${rawStatus} normalized=${newStatus}`);

  if (newStatus) {
    const { data: existing } = await supabaseAdmin
      .from('orders')
      .select('id, courier_status')
      .eq('courier_consignment_id', consignmentId)
      .maybeSingle();

    if (existing && existing.courier_status !== newStatus) {
      await supabaseAdmin.from('orders').update({
        courier_status: newStatus,
        courier_provider: 'steadfast',
      }).eq('id', existing.id);
      await logTrackingEvent(supabaseAdmin, existing.id, consignmentId, newStatus, existing.courier_status, 'check_status');
    }
  }

  return { status: newStatus || rawStatus, http_status: res.status, raw_status: rawStatus, data: result };
}

// Bulk status sync — fetch status for all orders with consignment IDs
async function bulkStatusSync(
  supabaseAdmin: any,
  headers: Record<string, string>,
  orderIds?: string[],
  onlyActive = false,
  limit = 500,
) {
  let query = supabaseAdmin
    .from('orders')
    .select('id, courier_consignment_id, courier_status')
    .not('courier_consignment_id', 'is', null)
    .eq('courier_provider', 'steadfast')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (orderIds?.length) {
    query = query.in('id', orderIds);
  } else if (onlyActive) {
    query = query.in('courier_status', ACTIVE_COURIER_STATUSES);
  }

  const { data: orders, error } = await query;
  if (error) {
    console.error('[steadfast.bulkStatusSync] query error:', error.message);
    return { updated: 0, failed: 0, total: 0, results: [], error: error.message };
  }
  if (!orders?.length) return { updated: 0, failed: 0, total: 0, results: [] };

  const results: any[] = [];
  let updated = 0;
  let failed = 0;

  for (const order of orders) {
    try {
      const res = await fetch(`${STEADFAST_BASE}/status_by_cid/${order.courier_consignment_id}`, { headers });
      const result = await parseResponse(res);
      const rawStatus = extractSteadfastRawStatus(result);
      const newStatus = normalizeSteadfastStatus(rawStatus, '');

      if (!res.ok) {
        failed++;
        console.warn(`[steadfast.bulk] cid=${order.courier_consignment_id} http=${res.status} body=${JSON.stringify(result).slice(0, 200)}`);
        results.push({ order_id: order.id, success: false, http_status: res.status, error: 'API non-200' });
        continue;
      }

      if (!newStatus) {
        failed++;
        console.warn(`[steadfast.bulk] cid=${order.courier_consignment_id} no status field. keys=${Object.keys(result || {}).join(',')}`);
        results.push({ order_id: order.id, success: false, error: 'no status in response' });
        continue;
      }

      if (newStatus !== order.courier_status) {
        await supabaseAdmin.from('orders').update({
          courier_status: newStatus,
          courier_provider: 'steadfast',
        }).eq('id', order.id);
        await logTrackingEvent(supabaseAdmin, order.id, order.courier_consignment_id, newStatus, order.courier_status, 'bulk_status');
        updated++;
      }
      results.push({ order_id: order.id, status: newStatus, success: true });
    } catch (e: any) {
      failed++;
      console.error(`[steadfast.bulk] cid=${order.courier_consignment_id} exception:`, e?.message);
      results.push({ order_id: order.id, success: false, error: e?.message });
    }
  }

  console.log(`[steadfast.bulkStatusSync] total=${orders.length} updated=${updated} failed=${failed}`);
  return { updated, failed, total: orders.length, results };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = await authenticateAdmin(req);
    const steadfastHeaders = await getSteadfastCredentials(supabaseAdmin);

    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    
    let body: any = {};
    try { body = await req.json(); } catch { /* empty body ok for some actions */ }

    let responseData: any;

    switch (action) {
      case 'create_order': {
        responseData = await createOrder(supabaseAdmin, steadfastHeaders, body.order_id);
        break;
      }

      case 'bulk_create': {
        responseData = await bulkCreateOrders(supabaseAdmin, steadfastHeaders, body.order_ids || []);
        break;
      }

      case 'check_status': {
        if (!body.consignment_id) throw new Error('consignment_id is required');
        responseData = await checkStatus(supabaseAdmin, steadfastHeaders, body.consignment_id);
        break;
      }

      case 'resync_order': {
        if (!body.order_id) throw new Error('order_id is required');
        try {
          responseData = await resyncOrder(supabaseAdmin, steadfastHeaders, body.order_id);
        } catch (e: any) {
          const status = e?.statusCode === 409 ? 409 : 400;
          return new Response(JSON.stringify({ error: e.message }), {
            status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        break;
      }

      case 'recreate_parcel': {
        if (!body.order_id) throw new Error('order_id is required');
        try {
          responseData = await recreateParcel(
            supabaseAdmin,
            steadfastHeaders,
            body.order_id,
            String(body.reason || 'manual'),
          );
        } catch (e: any) {
          const status = e?.statusCode === 409 ? 409 : 400;
          return new Response(JSON.stringify({ error: e.message }), {
            status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        break;
      }

      case 'cancel_order': {
        if (!body.order_id) throw new Error('order_id is required');
        try {
          responseData = await cancelOrder(supabaseAdmin, steadfastHeaders, body.order_id);
        } catch (e: any) {
          const status = e?.statusCode === 409 ? 409 : 400;
          return new Response(JSON.stringify({ error: e.message }), {
            status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        break;
      }



      case 'bulk_status': {
        responseData = await bulkStatusSync(
          supabaseAdmin,
          steadfastHeaders,
          body.order_ids,
          body.only_active === true,
          typeof body.limit === 'number' ? body.limit : 500,
        );
        break;
      }

      case 'get_balance': {
        const res = await fetch(`${STEADFAST_BASE}/get_balance`, { headers: steadfastHeaders });
        responseData = await parseResponse(res);
        break;
      }

      case 'fetch_payments': {
        const allPaymentsMap = new Map<string, any>();
        let currentPage = 1;
        let pagesFetched = 0;
        let totalRawFetched = 0;
        let metadataLastPage: number | null = null;

        while (currentPage <= MAX_PAYMENT_SYNC_PAGES) {
          const paymentsRes = await fetch(`${STEADFAST_BASE}/payments?page=${currentPage}`, { headers: steadfastHeaders });
          const rawText = await paymentsRes.text();
          console.log(`[fetch_payments] Page ${currentPage} HTTP Status:`, paymentsRes.status);

          let paymentsResult: any;
          try {
            paymentsResult = JSON.parse(rawText);
          } catch {
            paymentsResult = {};
          }

          const pKey = paymentsResult.payments;
          if (currentPage === 1) {
            console.log('[fetch_payments] Response keys:', Object.keys(paymentsResult));
            if (pKey && typeof pKey === 'object' && !Array.isArray(pKey)) {
              console.log('[fetch_payments] payments is OBJECT with keys:', Object.keys(pKey), 'last_page:', pKey.last_page ?? null);
            } else if (Array.isArray(pKey)) {
              console.log('[fetch_payments] payments is ARRAY, length:', pKey.length);
            }
          }

          if (pKey && typeof pKey === 'object' && !Array.isArray(pKey) && pKey.last_page) {
            metadataLastPage = Number(pKey.last_page) || metadataLastPage;
          } else if (paymentsResult.data && typeof paymentsResult.data === 'object' && !Array.isArray(paymentsResult.data) && paymentsResult.data.last_page) {
            metadataLastPage = Number(paymentsResult.data.last_page) || metadataLastPage;
          } else if (paymentsResult.last_page) {
            metadataLastPage = Number(paymentsResult.last_page) || metadataLastPage;
          } else if (paymentsResult.meta?.last_page) {
            metadataLastPage = Number(paymentsResult.meta.last_page) || metadataLastPage;
          }

          let pagePayments: any[] = [];
          if (pKey && typeof pKey === 'object' && !Array.isArray(pKey) && Array.isArray(pKey.data)) {
            pagePayments = pKey.data;
          } else if (paymentsResult.data && typeof paymentsResult.data === 'object' && !Array.isArray(paymentsResult.data) && Array.isArray(paymentsResult.data.data)) {
            pagePayments = paymentsResult.data.data;
          } else if (Array.isArray(paymentsResult.data)) {
            pagePayments = paymentsResult.data;
          } else if (Array.isArray(pKey)) {
            pagePayments = pKey;
          } else if (Array.isArray(paymentsResult)) {
            pagePayments = paymentsResult;
          }

          pagesFetched++;
          totalRawFetched += pagePayments.length;

          const pageLabel = metadataLastPage ? `${currentPage}/${metadataLastPage}` : `${currentPage}`;
          console.log(`[fetch_payments] Page ${pageLabel}: ${pagePayments.length} payments`);

          if (!pagePayments.length) {
            console.log(`[fetch_payments] Stopping at page ${currentPage}: empty page`);
            break;
          }

          let newOnThisPage = 0;
          for (const payment of pagePayments) {
            const paymentId = String(payment.payment_id || payment.invoice_number || payment.id || '');
            if (!paymentId) continue;

            if (!allPaymentsMap.has(paymentId)) {
              newOnThisPage++;
            }
            allPaymentsMap.set(paymentId, payment);
          }

          console.log(`[fetch_payments] Page ${currentPage}: ${newOnThisPage} new unique payments`);

          if (metadataLastPage && currentPage >= metadataLastPage) {
            console.log(`[fetch_payments] Stopping at page ${currentPage}: reached metadata last_page ${metadataLastPage}`);
            break;
          }

          // Incremental sync: stop if ALL payments on this page already exist in DB
          if (newOnThisPage === 0) {
            console.log(`[fetch_payments] Stopping at page ${currentPage}: duplicate-only page (incremental sync)`);
            break;
          }

          currentPage++;
        }

        const paymentsList = Array.from(allPaymentsMap.values());
        console.log('[fetch_payments] Total raw fetched across all pages:', totalRawFetched);
        console.log('[fetch_payments] Total unique payments across all pages:', paymentsList.length);

        let saved = 0;
        let skipped = 0;
        for (const p of paymentsList) {
          const invoiceNum = String(p.payment_id || p.invoice_number || p.id || '');
          if (!invoiceNum) { skipped++; continue; }

          const collectedAmount = Number(p.amount || p.collected_amount) || 0;
          const deliveryBill = Number(p.due_bills || p.delivery_bill) || 0;
          const codCharge = Number(p.charges || p.cod_charge) || 0;
          const receivableAmount = Number(p.total || p.receivable_amount) || 0;
          const subTotal = Number(p.sub_total) || (collectedAmount - deliveryBill);
          const statusLabel = p.status_label || p.status || 'Pending';
          const normalizedStatus = statusLabel.toLowerCase() === 'paid' ? 'Paid' : 'Pending';
          const dateVal = p.created_at || p.date || new Date().toISOString();

          const { error: upsertErr } = await supabaseAdmin.from('courier_payments').upsert({
            invoice_number: invoiceNum,
            date: dateVal,
            collected_amount: collectedAmount,
            delivery_bill: deliveryBill,
            sub_total: subTotal,
            cod_charge: codCharge,
            receivable_amount: receivableAmount,
            status: normalizedStatus,
            courier_provider: 'steadfast',
          }, { onConflict: 'invoice_number' });

          if (upsertErr) {
            console.error('[fetch_payments] Upsert error for', invoiceNum, upsertErr.message);
            skipped++;
          } else {
            saved++;
          }
        }

        const paymentDates = paymentsList
          .map((payment) => payment.created_at || payment.date)
          .filter(Boolean)
          .map((value) => new Date(value).toISOString())
          .sort();

        const oldestPaymentDate = paymentDates[0] ?? null;
        const newestPaymentDate = paymentDates[paymentDates.length - 1] ?? null;

        console.log('[fetch_payments] Results: saved=', saved, 'skipped=', skipped, 'pages_fetched=', pagesFetched);
        responseData = {
          synced: paymentsList.length,
          saved,
          skipped,
          pages_fetched: pagesFetched,
          total_raw_fetched: totalRawFetched,
          unique_payments: paymentsList.length,
          oldest_payment_date: oldestPaymentDate,
          newest_payment_date: newestPaymentDate,
          payments: paymentsList,
        };
        break;
      }

      case 'fetch_payment_detail': {
        if (!body.payment_id) throw new Error('payment_id is required');
        const detailRes = await fetch(`${STEADFAST_BASE}/payments/${body.payment_id}`, { headers: steadfastHeaders });
        const detailRawText = await detailRes.text();
        console.log('[fetch_payment_detail] HTTP Status:', detailRes.status);
        console.log('[fetch_payment_detail] Raw Response (first 2000 chars):', detailRawText.substring(0, 2000));
        
        let detailResult: any;
        try { detailResult = JSON.parse(detailRawText); } catch { detailResult = {}; }
        
        // Flexible consignment extraction
        const consignments = Array.isArray(detailResult) 
          ? detailResult 
          : (detailResult.consignments || detailResult.data || detailResult.parcels || detailResult.orders || detailResult.items || []);
        
        console.log('[fetch_payment_detail] Consignments count:', consignments.length, 'Response keys:', Object.keys(detailResult || {}));
        
        responseData = { 
          ...detailResult, 
          consignments, 
          raw_response: detailResult 
        };
        break;
      }

      case 'add_payment': {
        const { invoice_number, date, collected_amount, delivery_bill, sub_total, cod_charge, receivable_amount, status: payStatus } = body;
        const { data: inserted, error: insErr } = await supabaseAdmin.from('courier_payments').insert({
          invoice_number: invoice_number || '',
          date: date || new Date().toISOString(),
          collected_amount: Number(collected_amount) || 0,
          delivery_bill: Number(delivery_bill) || 0,
          sub_total: Number(sub_total) || 0,
          cod_charge: Number(cod_charge) || 0,
          receivable_amount: Number(receivable_amount) || 0,
          status: payStatus || 'Pending',
          courier_provider: 'steadfast',
        }).select().single();
        if (insErr) throw new Error(insErr.message);
        responseData = inserted;
        break;
      }

      case 'list_payments': {
        const { data: payments, error: listErr } = await supabaseAdmin
          .from('courier_payments')
          .select('*')
          .eq('courier_provider', 'steadfast')
          .order('date', { ascending: false });
        if (listErr) throw new Error(listErr.message);
        responseData = payments;
        break;
      }

      case 'update_payment': {
        if (!body.payment_id) throw new Error('payment_id is required');
        const updates: any = {};
        if (body.status !== undefined) updates.status = body.status;
        if (body.collected_amount !== undefined) updates.collected_amount = Number(body.collected_amount);
        if (body.delivery_bill !== undefined) updates.delivery_bill = Number(body.delivery_bill);
        if (body.sub_total !== undefined) updates.sub_total = Number(body.sub_total);
        if (body.cod_charge !== undefined) updates.cod_charge = Number(body.cod_charge);
        if (body.receivable_amount !== undefined) updates.receivable_amount = Number(body.receivable_amount);
        if (body.receive_method !== undefined) updates.receive_method = body.receive_method;
        if (body.bank_amount !== undefined) updates.bank_amount = Number(body.bank_amount);
        if (body.cash_amount !== undefined) updates.cash_amount = Number(body.cash_amount);
        const { data: updated, error: updErr } = await supabaseAdmin
          .from('courier_payments')
          .update(updates)
          .eq('id', body.payment_id)
          .select()
          .single();
        if (updErr) throw new Error(updErr.message);
        responseData = updated;
        break;
      }

      default:
        throw new Error(`Invalid action: ${action}`);
    }

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Steadfast courier error:', e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
