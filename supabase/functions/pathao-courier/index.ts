import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PATHAO_BASE = 'https://api-hermes.pathao.com';
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

async function getSetting(supabaseAdmin: any, key: string): Promise<string> {
  const { data } = await supabaseAdmin.from('store_settings').select('value').eq('key', key).single();
  return data?.value || '';
}

async function setSetting(supabaseAdmin: any, key: string, value: string) {
  const { data: existing } = await supabaseAdmin.from('store_settings').select('id').eq('key', key).single();
  if (existing) {
    await supabaseAdmin.from('store_settings').update({ value }).eq('key', key);
  } else {
    await supabaseAdmin.from('store_settings').insert({ key, value });
  }
}

async function getAccessToken(supabaseAdmin: any): Promise<string> {
  // Check cached token
  const cachedToken = await getSetting(supabaseAdmin, 'pathao_access_token');
  const expiresAt = await getSetting(supabaseAdmin, 'pathao_token_expires_at');

  if (cachedToken && expiresAt && Date.now() < Number(expiresAt) - 60000) {
    return cachedToken;
  }

  // Try refresh token first
  const refreshToken = await getSetting(supabaseAdmin, 'pathao_refresh_token');
  const clientId = await getSetting(supabaseAdmin, 'pathao_api_key');
  const clientSecret = await getSetting(supabaseAdmin, 'pathao_secret_key');

  if (!clientId || !clientSecret) {
    throw new Error('Pathao Client ID / Secret Key কনফিগার করা হয়নি। সেটিংস থেকে দিন।');
  }

  let tokenData: any = null;

  if (refreshToken) {
    try {
      const res = await fetch(`${PATHAO_BASE}/aladdin/api/v1/issue-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });
      if (res.ok) {
        tokenData = await res.json();
      }
    } catch {
      console.log('[pathao] Refresh token failed, falling back to password grant');
    }
  }

  // Fall back to password grant
  if (!tokenData?.access_token) {
    const username = await getSetting(supabaseAdmin, 'pathao_username');
    const password = await getSetting(supabaseAdmin, 'pathao_password');

    if (!username || !password) {
      throw new Error('Pathao Username ও Password কনফিগার করা হয়নি। সেটিংস থেকে দিন।');
    }

    const res = await fetch(`${PATHAO_BASE}/aladdin/api/v1/issue-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'password',
        username,
        password,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Pathao token issue failed (${res.status}): ${errText.substring(0, 300)}`);
    }
    tokenData = await res.json();
  }

  if (!tokenData?.access_token) {
    throw new Error('Pathao access token পাওয়া যায়নি');
  }

  // Cache tokens
  const expiresInMs = (tokenData.expires_in || 432000) * 1000;
  await setSetting(supabaseAdmin, 'pathao_access_token', tokenData.access_token);
  await setSetting(supabaseAdmin, 'pathao_refresh_token', tokenData.refresh_token || '');
  await setSetting(supabaseAdmin, 'pathao_token_expires_at', String(Date.now() + expiresInMs));

  return tokenData.access_token;
}

async function pathaoFetch(supabaseAdmin: any, path: string, method = 'GET', body?: any) {
  const token = await getAccessToken(supabaseAdmin);
  const opts: any = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${PATHAO_BASE}${path}`, opts);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Pathao API error (${res.status}): ${text.substring(0, 300)}`);
  }
}

async function createOrder(supabaseAdmin: any, orderId: string) {
  const { data: order, error } = await supabaseAdmin.from('orders').select('*').eq('id', orderId).single();
  if (error || !order) throw new Error(`Order not found: ${orderId}`);

  const storeId = await getSetting(supabaseAdmin, 'pathao_store_id');
  if (!storeId) throw new Error('Pathao Store ID কনফিগার করা হয়নি। সেটিংস থেকে দিন।');

  // Build item description from order items
  const { data: items } = await supabaseAdmin.from('order_items').select('product_name, quantity, price').eq('order_id', orderId);
  const itemDesc = (items || []).map((i: any) => `${i.product_name} x${i.quantity}`).join(', ');

  const altPhone = (order.customer_alt_phone || '').toString().trim();
  const courierNote = (order.courier_note || '').toString().trim();
  const isExchange = order.order_origin === 'exchange';
  const combinedNote = [
    isExchange ? '[EXCHANGE]' : '',
    courierNote,
    altPhone ? `Alt: ${altPhone}` : '',
  ].filter(Boolean).join(' | ') || (order.notes || '');

  const result = await pathaoFetch(supabaseAdmin, '/aladdin/api/v1/orders', 'POST', {
    store_id: Number(storeId),
    merchant_order_id: order.order_number,
    recipient_name: order.customer_name,
    recipient_phone: order.customer_phone?.replace(/^\+?88/, '') || '',
    recipient_address: [order.customer_address, order.city].filter(Boolean).join(', ') || 'N/A',
    delivery_type: 48, // Normal delivery
    item_type: 2, // Parcel
    item_quantity: (items || []).reduce((sum: number, i: any) => sum + (i.quantity || 1), 0) || 1,
    item_weight: 0.5,
    item_description: itemDesc || 'Parcel',
    amount_to_collect: order.is_gift_order ? 0 : Math.round(Number(order.total) || 0),
    special_instruction: combinedNote,
  });

  if (result.data?.consignment_id) {
    await supabaseAdmin.from('orders').update({
      courier_consignment_id: String(result.data.consignment_id),
      courier_status: result.data.order_status || 'Pending',
      courier_provider: 'pathao',
      courier_entry_date: new Date().toISOString(),
      courier_last_synced_total: Number(order.total) || 0,
    }).eq('id', orderId);
  }

  return result;
}

function extractPathaoStatus(result: any): string {
  if (!result) return '';
  return (
    result.data?.order_status_slug
    || result.data?.order_status
    || result.order_status_slug
    || result.order_status
    || ''
  );
}

const PATHAO_ACTIVE_STATUSES = [
  'Pending', 'pending', 'Pickup_Requested', 'pickup_requested',
  'Assigned_for_Pickup', 'Picked', 'picked', 'Pickup', 'pickup',
  'At_the_Sorting_HUB', 'In_Transit', 'in_transit',
  'Received_at_Last_Mile_Hub', 'Assigned_for_Delivery',
  'On_Hold', 'hold',
];

async function checkStatus(supabaseAdmin: any, consignmentId: string) {
  const result = await pathaoFetch(supabaseAdmin, `/aladdin/api/v1/orders/${consignmentId}/info`);
  const status = extractPathaoStatus(result);
  console.log(`[pathao.checkStatus] cid=${consignmentId} status=${status}`);

  if (status) {
    await supabaseAdmin.from('orders').update({
      courier_status: status,
    }).eq('courier_consignment_id', consignmentId);
  }

  return { status, data: result };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = await authenticateAdmin(req);
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    let body: any = {};
    try { body = await req.json(); } catch { /* ok */ }

    let responseData: any;

    switch (action) {
      case 'create_order':
        responseData = await createOrder(supabaseAdmin, body.order_id);
        break;

      case 'check_status':
        if (!body.consignment_id) throw new Error('consignment_id is required');
        responseData = await checkStatus(supabaseAdmin, body.consignment_id);
        break;

      case 'cancel_order': {
        if (!body.order_id) throw new Error('order_id is required');
        const { data: order } = await supabaseAdmin.from('orders')
          .select('id, courier_consignment_id, courier_status, courier_provider')
          .eq('id', body.order_id).single();
        if (!order) throw new Error('Order not found');
        if (!order.courier_consignment_id) { responseData = { success: true, already_clean: true }; break; }
        if (order.courier_provider !== 'pathao') throw new Error(`Order is on ${order.courier_provider}, not pathao.`);
        // Pathao doesn't expose a public cancel API for merchants. We clear DB so the order
        // can be re-pushed, and require the user to manually delete in Pathao portal.
        await supabaseAdmin.from('orders').update({
          courier_consignment_id: null,
          courier_status: null,
          courier_provider: null,
          courier_entry_date: null,
          courier_last_synced_total: null,
        }).eq('id', body.order_id);
        await supabaseAdmin.from('courier_tracking_events').insert({
          order_id: body.order_id,
          consignment_id: String(order.courier_consignment_id),
          status: 'cancelled_by_merchant',
          note: 'অর্ডার ক্যানসেল — Pathao API অটো-ডিলিট সাপোর্ট করে না। Pathao পোর্টাল থেকে ম্যানুয়ালি পার্সেল ক্যানসেল করুন।',
          raw_data: { source: 'cancel_order' },
        });
        responseData = { success: true, deleted: false, requires_manual: true, consignment_id: order.courier_consignment_id };
        break;
      }



      case 'get_stores':
        responseData = await pathaoFetch(supabaseAdmin, '/aladdin/api/v1/stores');
        break;

      case 'get_cities':
        responseData = await pathaoFetch(supabaseAdmin, '/aladdin/api/v1/city-list');
        break;

      case 'get_zones':
        if (!body.city_id) throw new Error('city_id is required');
        responseData = await pathaoFetch(supabaseAdmin, `/aladdin/api/v1/cities/${body.city_id}/zone-list`);
        break;

      case 'get_areas':
        if (!body.zone_id) throw new Error('zone_id is required');
        responseData = await pathaoFetch(supabaseAdmin, `/aladdin/api/v1/zones/${body.zone_id}/area-list`);
        break;

      case 'price_plan':
        responseData = await pathaoFetch(supabaseAdmin, '/aladdin/api/v1/merchant/price-plan', 'POST', body);
        break;

      case 'bulk_status': {
        let query = supabaseAdmin.from('orders').select('id, courier_consignment_id, courier_status')
          .not('courier_consignment_id', 'is', null).eq('courier_provider', 'pathao')
          .order('created_at', { ascending: false })
          .limit(typeof body.limit === 'number' ? body.limit : 500);
        if (body.order_ids?.length) query = query.in('id', body.order_ids);
        else if (body.only_active === true) query = query.in('courier_status', PATHAO_ACTIVE_STATUSES);
        const { data: bulkOrders } = await query;
        const results: any[] = [];
        let updated = 0;
        let failed = 0;
        for (const order of (bulkOrders || [])) {
          try {
            const r = await pathaoFetch(supabaseAdmin, `/aladdin/api/v1/orders/${order.courier_consignment_id}/info`);
            const st = extractPathaoStatus(r);
            if (!st) {
              failed++;
              console.warn(`[pathao.bulk] cid=${order.courier_consignment_id} no status. keys=${Object.keys(r || {}).join(',')}`);
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
            console.error(`[pathao.bulk] cid=${order.courier_consignment_id}:`, e?.message);
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
    console.error('[pathao-courier] Error:', e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
