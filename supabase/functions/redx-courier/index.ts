import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const REDX_BASE = 'https://openapi.redx.com.bd/v1.0.0-beta';
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
  const { data: isOrderManager } = await supabaseAdmin.rpc('has_role', { _user_id: user.id, _role: 'order_manager' });
  if (!isAdmin && !isOrderManager) throw new Error('Access denied');
  return supabaseAdmin;
}

async function getRedxConfig(supabaseAdmin: any): Promise<{ token: string; pickupStoreId?: string }> {
  const { data } = await supabaseAdmin.from('store_settings').select('key, value').in('key', ['redx_api_key', 'redx_pickup_store_id']);
  const map: Record<string, string> = {};
  (data || []).forEach((r: any) => { map[r.key] = r.value; });
  const token = map.redx_api_key || '';
  if (!token) throw new Error('RedX API Token কনফিগার করা হয়নি। সেটিংস থেকে দিন।');
  return { token, pickupStoreId: map.redx_pickup_store_id || undefined };
}

async function redxFetch(token: string, path: string, method = 'GET', body?: any) {
  const opts: any = {
    method,
    headers: {
      'API-ACCESS-TOKEN': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${REDX_BASE}${path}`, opts);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`RedX API error (${res.status}): ${text.substring(0, 300)}`);
  }
}

async function createOrder(supabaseAdmin: any, token: string, orderId: string, pickupStoreId?: string) {
  const { data: order, error } = await supabaseAdmin.from('orders').select('*').eq('id', orderId).single();
  if (error || !order) throw new Error(`Order not found: ${orderId}`);

  const { data: items } = await supabaseAdmin.from('order_items').select('product_name, quantity, price').eq('order_id', orderId);

  const phone = (order.customer_phone || '').replace(/^\+?88/, '');
  const address = [order.customer_address, order.city].filter(Boolean).join(', ') || 'N/A';
  const totalValue = Math.round(Number(order.total) || 0);

  const parcelDetailsArr = (items || []).map((i: any) => ({
    name: i.product_name,
    category: 'Parcel',
    value: Math.round(Number(i.price) * (i.quantity || 1)),
  }));

  const altPhone = (order.customer_alt_phone || '').toString().trim();
  const courierNote = (order.courier_note || '').toString().trim();
  const isExchange = order.order_origin === 'exchange';
  const combinedNote = [
    isExchange ? '[EXCHANGE]' : '',
    courierNote,
    altPhone ? `Alt: ${altPhone}` : '',
  ].filter(Boolean).join(' | ') || (order.notes || '');

  const baseParcelBody: any = {
    customer_name: order.customer_name,
    customer_phone: phone,
    delivery_area: address,
    delivery_area_id: 1,
    customer_address: address,
    merchant_invoice_id: order.order_number,
    cash_collection_amount: order.is_gift_order ? '0' : String(totalValue),
    parcel_weight: 500,
    instruction: combinedNote,
    value: String(totalValue),
    parcel_details_json: parcelDetailsArr,
  };

  const parcelBody = pickupStoreId
    ? { ...baseParcelBody, pickup_store_id: Number(pickupStoreId) }
    : baseParcelBody;

  console.log('[redx-courier] parcelBody:', JSON.stringify(parcelBody));

  let result = await redxFetch(token, '/parcel', 'POST', parcelBody);

  if (result?.message?.includes("Cannot read property 'PHONE' of undefined") && pickupStoreId) {
    console.warn('[redx-courier] pickup_store_id failed, retrying without pickup_store_id:', pickupStoreId);
    result = await redxFetch(token, '/parcel', 'POST', baseParcelBody);
  }

  if (result?.message && !result?.tracking_id && !result?.parcel_tracking_id && !result?.data?.tracking_id && !result?.parcel?.tracking_id && !result?.id) {
    if (result.message.includes("Cannot read property 'PHONE' of undefined")) {
      throw new Error('RedX pickup store configuration is invalid. Please verify redx_pickup_store_id from RedX pickup stores.');
    }
    throw new Error(`RedX API Error: ${result.message}`);
  }

  console.log('[redx-courier] createOrder full response:', JSON.stringify(result));

  const trackingId = result.tracking_id || result.parcel_tracking_id || result.data?.tracking_id || result.id || result.parcel?.tracking_id;
  if (!trackingId) {
    throw new Error(`RedX থেকে tracking ID পাওয়া যায়নি। Response: ${JSON.stringify(result).substring(0, 500)}`);
  }

  await supabaseAdmin.from('orders').update({
    courier_consignment_id: String(trackingId),
    courier_status: 'Pending',
    courier_provider: 'redx',
    courier_entry_date: new Date().toISOString(),
    courier_last_synced_total: Number((await supabaseAdmin.from('orders').select('total').eq('id', orderId).single()).data?.total) || 0,
  }).eq('id', orderId);

  return { ...result, tracking_id: trackingId };
}

function extractRedxStatus(result: any): string {
  if (!result) return '';
  return (
    result.current_status
    || result.parcel_status
    || result.status
    || result.data?.current_status
    || result.data?.parcel_status
    || result.data?.status
    || ''
  );
}

const REDX_ACTIVE_STATUSES = [
  'Pending', 'pending', 'pickup-pending', 'Pickup-Pending',
  'pickup-assigned', 'Pickup-Assigned', 'picked', 'Picked',
  'in-transit', 'In-Transit', 'received-at-hub', 'sorted-at-hub',
  'on-hold', 'Hold', 'On-Hold',
];

async function checkStatus(supabaseAdmin: any, token: string, trackingId: string) {
  // Use /parcel/info/ for current status instead of /parcel/track/ (timeline)
  const result = await redxFetch(token, `/parcel/info/${trackingId}`);
  const status = extractRedxStatus(result);
  console.log(`[redx.checkStatus] tid=${trackingId} status=${status}`);

  if (status) {
    await supabaseAdmin.from('orders').update({
      courier_status: status,
    }).eq('courier_consignment_id', trackingId);
  }

  return { status, data: result };
}

async function cancelParcel(token: string, trackingId: string) {
  const result = await redxFetch(token, '/parcels', 'PATCH', {
    tracking_id: trackingId,
    parcel_status: 'Cancelled',
  });
  return result;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = await authenticateAdmin(req);
    const { token, pickupStoreId } = await getRedxConfig(supabaseAdmin);
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    let body: any = {};
    try { body = await req.json(); } catch { /* ok */ }

    let responseData: any;

    switch (action) {
      case 'create_order':
        responseData = await createOrder(supabaseAdmin, token, body.order_id, pickupStoreId);
        break;

      case 'check_status':
        if (!body.consignment_id) throw new Error('tracking_id / consignment_id is required');
        responseData = await checkStatus(supabaseAdmin, token, body.consignment_id);
        break;

      case 'track_parcel':
        if (!body.tracking_id) throw new Error('tracking_id is required');
        responseData = await redxFetch(token, `/parcel/track/${body.tracking_id}`);
        break;

      case 'get_parcel_details':
        if (!body.tracking_id) throw new Error('tracking_id is required');
        responseData = await redxFetch(token, `/parcel/info/${body.tracking_id}`);
        break;

      case 'cancel_parcel':
        if (!body.tracking_id) throw new Error('tracking_id is required');
        responseData = await cancelParcel(token, body.tracking_id);
        break;

      case 'cancel_order': {
        if (!body.order_id) throw new Error('order_id is required');
        const { data: order } = await supabaseAdmin.from('orders')
          .select('id, courier_consignment_id, courier_status, courier_provider')
          .eq('id', body.order_id).single();
        if (!order) throw new Error('Order not found');
        if (!order.courier_consignment_id) { responseData = { success: true, already_clean: true }; break; }
        if (order.courier_provider !== 'redx') throw new Error(`Order is on ${order.courier_provider}, not redx.`);
        let deleted = false;
        let detail = '';
        try {
          await cancelParcel(token, String(order.courier_consignment_id));
          deleted = true;
        } catch (e: any) {
          detail = e?.message || 'cancel failed';
        }
        if (deleted) {
          await supabaseAdmin.from('orders').update({
            courier_consignment_id: null,
            courier_status: null,
            courier_provider: null,
            courier_entry_date: null,
            courier_last_synced_total: null,
          }).eq('id', body.order_id);
        }
        await supabaseAdmin.from('courier_tracking_events').insert({
          order_id: body.order_id,
          consignment_id: String(order.courier_consignment_id),
          status: deleted ? 'cancelled_by_merchant' : 'cancel_failed',
          note: deleted ? 'অর্ডার ক্যানসেল হওয়ায় RedX থেকে পার্সেল ক্যানসেল হয়েছে' : `RedX ক্যানসেল ব্যর্থ: ${detail}`,
          raw_data: { source: 'cancel_order', detail },
        });
        if (!deleted) {
          return new Response(JSON.stringify({ error: `RedX থেকে অটো-ক্যানসেল ব্যর্থ: ${detail}` }), {
            status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        responseData = { success: true, deleted, consignment_id: order.courier_consignment_id };
        break;
      }


      case 'get_areas':
        responseData = await redxFetch(token, '/areas');
        break;

      case 'get_pickup_stores':
        responseData = await redxFetch(token, '/pickup/stores');
        break;

      case 'bulk_status': {
        let query = supabaseAdmin.from('orders').select('id, courier_consignment_id, courier_status')
          .not('courier_consignment_id', 'is', null).eq('courier_provider', 'redx')
          .order('created_at', { ascending: false })
          .limit(typeof body.limit === 'number' ? body.limit : 500);
        if (body.order_ids?.length) query = query.in('id', body.order_ids);
        else if (body.only_active === true) query = query.in('courier_status', REDX_ACTIVE_STATUSES);
        const { data: bulkOrders } = await query;
        const results: any[] = [];
        let updated = 0;
        let failed = 0;
        for (const order of (bulkOrders || [])) {
          try {
            const r = await redxFetch(token, `/parcel/info/${order.courier_consignment_id}`);
            const st = extractRedxStatus(r);
            if (!st) {
              failed++;
              console.warn(`[redx.bulk] tid=${order.courier_consignment_id} no status. keys=${Object.keys(r || {}).join(',')}`);
              results.push({ order_id: order.id, success: false, error: 'no status' });
              continue;
            }
            if (st !== order.courier_status) {
              await supabaseAdmin.from('orders').update({ courier_status: st }).eq('id', order.id);
              updated++;
            }
            results.push({ order_id: order.id, status: st, success: true });
          } catch (e: any) {
            failed++;
            console.error(`[redx.bulk] tid=${order.courier_consignment_id}:`, e?.message);
            results.push({ order_id: order.id, success: false, error: e.message });
          }
        }
        responseData = { updated, failed, total: (bulkOrders || []).length, results };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[redx-courier] Error:', e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
