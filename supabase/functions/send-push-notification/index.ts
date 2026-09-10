import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only allow internal calls (from DB trigger via service role key or dedicated webhook secret)
    const authHeader = req.headers.get('Authorization') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const webhookSecret = Deno.env.get('PUSH_WEBHOOK_SECRET') || '';
    
    const token = authHeader.replace('Bearer ', '');
    const isAuthorized = token === supabaseServiceKey || 
      (webhookSecret && token === webhookSecret);
    
    if (!isAuthorized) {
      console.log('Unauthorized push notification attempt');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@shorno-suta.example';

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error('VAPID keys not configured');
      return new Response(JSON.stringify({ error: 'Configuration error' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const body = await req.json();
    const order = body.record || body;

    const orderId = order.id;
    const orderNumber = order.order_number;
    if (!orderId && !orderNumber) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: verifiedOrder, error: orderErr } = await supabase
      .from('orders')
      .select('id, order_number, total, customer_name')
      .eq(orderId ? 'id' : 'order_number', orderId || orderNumber)
      .maybeSingle();

    if (orderErr || !verifiedOrder) {
      console.log('Order verification failed:', orderErr?.message || 'Order not found');
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const title = '🎉 নতুন অর্ডার এসেছে!';
    const total = Number(verifiedOrder.total || 0).toLocaleString('bn-BD');
    const notifBody = `৳${total} — ${verifiedOrder.customer_name || 'কাস্টমার'} (${verifiedOrder.order_number || ''})`;
    const tag = `order-${verifiedOrder.order_number || verifiedOrder.id}`;

    const payload = JSON.stringify({
      title,
      body: notifBody,
      tag,
      url: `/admin/orders?preview=${verifiedOrder.id}`,
    });

    // Fetch subscriptions with per-user push preference check
    const { data: allSubs, error: fetchErr } = await supabase
      .from('push_subscriptions')
      .select('*');

    if (fetchErr || !allSubs?.length) {
      console.log('No subscriptions found:', fetchErr?.message);
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Filter out users who disabled push notifications
    const { data: disabledPrefs } = await supabase
      .from('staff_notification_preferences')
      .select('user_id')
      .eq('push_enabled', false);

    const disabledUserIds = new Set((disabledPrefs || []).map((p: any) => p.user_id));
    const subscriptions = allSubs.filter((s: any) => !disabledUserIds.has(s.user_id));

    if (!subscriptions.length) {
      console.log('All users have push disabled');
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: sub.keys as { p256dh: string; auth: string },
        };

        await webpush.sendNotification(pushSubscription, payload);
        sent++;
        console.log(`Push sent successfully to ${sub.id}`);
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
          console.log(`Removed expired subscription ${sub.id}`);
        } else {
          console.error(`Push failed for ${sub.id}: ${err.statusCode || ''} ${err.body || err.message}`);
        }
        failed++;
      }
    }

    console.log(`Push complete: sent=${sent}, failed=${failed}`);
    return new Response(JSON.stringify({ sent, failed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Push notification error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
