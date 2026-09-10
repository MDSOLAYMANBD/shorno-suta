import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const COURIER_WEBHOOK_SECRET = Deno.env.get('COURIER_WEBHOOK_SECRET') || '';

// Pathao event → readable courier_status mapping
const EVENT_STATUS_MAP: Record<string, string> = {
  'order.created': 'order_created',
  'order.updated': 'order_updated',
  'order.pickup-requested': 'pickup_requested',
  'order.assigned-for-pickup': 'assigned_for_pickup',
  'order.picked': 'picked',
  'order.pickup-failed': 'pickup_failed',
  'order.pickup-cancelled': 'pickup_cancelled',
  'order.at-the-sorting-hub': 'at_sorting_hub',
  'order.in-transit': 'in_transit',
  'order.received-at-last-mile-hub': 'received_at_last_mile_hub',
  'order.assigned-for-delivery': 'assigned_for_delivery',
  'order.delivered': 'delivered',
  'order.partial-delivery': 'partial_delivery',
  'order.returned': 'returned',
  'order.delivery-failed': 'delivery_failed',
  'order.on-hold': 'on_hold',
  'order.paid': 'paid',
  'order.paid-return': 'paid_return',
  'order.exchanged': 'exchanged',
};

// The webhook secret — Pathao requires this in response header. Loaded from env.
const PATHAO_INTEGRATION_SECRET = Deno.env.get('PATHAO_INTEGRATION_SECRET') || '';

function makeResponse(body: any, status = 202) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-pathao-signature',
      'X-Pathao-Merchant-Webhook-Integration-Secret': PATHAO_INTEGRATION_SECRET,
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return makeResponse({ ok: true });
  }

  // Verify webhook secrets (mandatory)
  if (!COURIER_WEBHOOK_SECRET || !PATHAO_INTEGRATION_SECRET) {
    return makeResponse({ error: 'Webhook secret not configured' }, 503);
  }
  const url = new URL(req.url);
  const token = url.searchParams.get('secret') || '';
  if (token !== COURIER_WEBHOOK_SECRET) {
    return makeResponse({ error: 'Unauthorized' }, 403);
  }

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return makeResponse({ error: 'Invalid JSON' });
    }

    console.log('Pathao webhook received:', JSON.stringify(body));

    const event = body.event || '';

    // 1. Integration verification handshake
    if (event === 'webhook_integration') {
      console.log('Pathao webhook integration verification — responding 202');
      return makeResponse({ ok: true });
    }

    // 2. Store events — just acknowledge
    if (event.startsWith('store.')) {
      console.log('Pathao store event:', event);
      return makeResponse({ ok: true });
    }

    // 3. Order events
    const consignmentId = String(body.consignment_id || '');
    if (!consignmentId) {
      console.warn('Pathao webhook: missing consignment_id');
      return makeResponse({ ok: true, warning: 'Missing consignment_id' });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find order by consignment ID
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('courier_consignment_id', consignmentId)
      .single();

    if (!order) {
      // Try by merchant_order_id (order_number)
      const merchantOrderId = body.merchant_order_id || '';
      if (merchantOrderId) {
        const { data: orderByNum } = await supabaseAdmin
          .from('orders')
          .select('id')
          .eq('order_number', merchantOrderId)
          .single();

        if (!orderByNum) {
          console.warn(`Pathao webhook: order not found for consignment ${consignmentId} / merchant ${merchantOrderId}`);
          return makeResponse({ ok: true, warning: 'Order not found' });
        }

        // Update consignment_id on first match
        await supabaseAdmin.from('orders').update({
          courier_consignment_id: consignmentId,
        }).eq('id', orderByNum.id);

        // Process with this order
        await processOrderEvent(supabaseAdmin, orderByNum.id, consignmentId, event, body);
        return makeResponse({ ok: true });
      }

      console.warn(`Pathao webhook: order not found for consignment ${consignmentId}`);
      return makeResponse({ ok: true, warning: 'Order not found' });
    }

    await processOrderEvent(supabaseAdmin, order.id, consignmentId, event, body);
    return makeResponse({ ok: true });
  } catch (e: any) {
    console.error('Pathao webhook error:', e.message);
    return makeResponse({ error: e.message });
  }
});

async function processOrderEvent(supabaseAdmin: any, orderId: string, consignmentId: string, event: string, body: any) {
  const status = EVENT_STATUS_MAP[event] || event;

  // Build note
  const parts: string[] = [];
  if (body.reason) parts.push(body.reason);
  if (body.collected_amount !== undefined) parts.push(`Collected: ৳${body.collected_amount}`);
  if (body.delivery_fee !== undefined) parts.push(`Delivery fee: ৳${body.delivery_fee}`);
  if (body.invoice_id) parts.push(`Invoice: ${body.invoice_id}`);
  const note = parts.join(' | ') || null;

  // Insert tracking event
  try {
    await supabaseAdmin.from('courier_tracking_events').insert({
      order_id: orderId,
      consignment_id: consignmentId,
      status,
      note,
      raw_data: body,
    });
  } catch (e: any) {
    console.error('Failed to insert tracking event:', e.message);
  }

  // Update order courier_status
  try {
    await supabaseAdmin.from('orders').update({
      courier_status: status,
    }).eq('id', orderId);
  } catch (e: any) {
    console.error('Failed to update order status:', e.message);
  }
}
