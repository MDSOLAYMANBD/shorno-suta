import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    console.log('RedX webhook received:', JSON.stringify(body));

    const trackingNumber = String(body.tracking_number || '');
    const status = body.status || '';
    const messageEn = body.message_en || '';
    const messageBn = body.message_bn || '';
    const timestamp = body.timestamp || '';
    const invoiceNumber = body.invoice_number || '';

    if (!trackingNumber) {
      return new Response(JSON.stringify({ error: 'Missing tracking_number' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find the order by tracking number
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('courier_consignment_id', trackingNumber)
      .single();

    if (!order) {
      console.warn(`Order not found for RedX tracking: ${trackingNumber}`);
      return new Response(JSON.stringify({ ok: true, warning: 'Order not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build note from English and Bengali messages
    const note = [messageEn, messageBn].filter(Boolean).join(' | ');

    // Insert tracking event
    await supabaseAdmin.from('courier_tracking_events').insert({
      order_id: order.id,
      consignment_id: trackingNumber,
      status: status || null,
      note: note || null,
      raw_data: body,
    });

    // Update order courier_status
    if (status) {
      await supabaseAdmin.from('orders').update({
        courier_status: status,
      }).eq('id', order.id);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('RedX webhook error:', e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
