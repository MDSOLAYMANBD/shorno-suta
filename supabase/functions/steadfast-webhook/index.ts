import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('COURIER_WEBHOOK_SECRET') || '';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify webhook secret (mandatory)
  if (!WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: 'Webhook secret not configured' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const url = new URL(req.url);
  const token = url.searchParams.get('secret') || '';
  if (token !== WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Steadfast webhook received:', JSON.stringify(body));

    // Steadfast webhook payload fields
    const consignmentId = String(body.consignment_id || body.consignment?.consignment_id || '');
    const status = body.status || body.delivery_status || body.consignment?.status || '';
    const note = body.note || body.tracking_message || body.message || '';
    const riderName = body.rider_name || body.delivery_man?.name || '';
    const riderPhone = body.rider_phone || body.delivery_man?.phone || '';
    const hubName = body.hub_name || body.branch?.name || body.assigned_hub || '';
    const hubPhone = body.hub_phone || body.branch?.phone || '';

    if (!consignmentId) {
      return new Response(JSON.stringify({ error: 'Missing consignment_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find the order by consignment ID
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('courier_consignment_id', consignmentId)
      .single();

    if (!order) {
      console.warn(`Order not found for consignment: ${consignmentId}`);
      return new Response(JSON.stringify({ ok: true, warning: 'Order not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert tracking event
    await supabaseAdmin.from('courier_tracking_events').insert({
      order_id: order.id,
      consignment_id: consignmentId,
      status: status || null,
      note: note || null,
      rider_name: riderName || null,
      rider_phone: riderPhone || null,
      hub_name: hubName || null,
      hub_phone: hubPhone || null,
      raw_data: body,
    });

    // Update order courier_status if status provided
    if (status) {
      await supabaseAdmin.from('orders').update({
        courier_status: status,
      }).eq('id', order.id);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Steadfast webhook error:', e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
