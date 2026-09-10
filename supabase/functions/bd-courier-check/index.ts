import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Unauthorized');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Two callers use this function: an admin in the browser (normal user JWT,
    // checked against has_any_role below), and the orders_auto_courier_check_trigger
    // DB trigger firing right after a new order is inserted (there's no browser
    // session at insert time, so it authenticates with its own shared secret,
    // stored in store_settings — not the real service role key, which this
    // project doesn't expose to Postgres via current_setting).
    const token = authHeader.replace('Bearer ', '');
    const { data: secretRow } = await supabaseAdmin
      .from('store_settings').select('value').eq('key', 'internal_trigger_secret').maybeSingle();
    const isTrustedInternalCall = !!secretRow?.value && token === secretRow.value;

    if (!isTrustedInternalCall) {
      const supabaseUser = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await supabaseUser.auth.getUser();
      if (!user) throw new Error('Unauthorized');

      const { data: hasRole } = await supabaseAdmin.rpc('has_any_role', { _user_id: user.id });
      if (!hasRole) throw new Error('Access denied');
    }

    const { phone, force } = await req.json();
    if (!phone) throw new Error('Phone number required');

    // Skip the paid external lookup if this phone was already checked before —
    // courier history belongs to the customer, not one order, so re-checking
    // on every repeat order would burn the API quota for no new information.
    // The admin's "রিফ্রেশ" button passes force:true to bypass this.
    if (!force) {
      const { data: existing } = await supabaseAdmin
        .from('customers').select('courier_data').eq('phone', phone).maybeSingle();
      if (existing?.courier_data) {
        return new Response(JSON.stringify(existing.courier_data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Get BD Courier API key: try store_settings first, fallback to env
    let BD_COURIER_API_KEY = Deno.env.get('BD_COURIER_API_KEY');
    const { data: dbKey } = await supabaseAdmin.from('store_settings').select('value').eq('key', 'bd_courier_api_key').single();
    if (dbKey?.value) BD_COURIER_API_KEY = dbKey.value;

    if (!BD_COURIER_API_KEY) throw new Error('BD_COURIER_API_KEY not configured. সেটিংস পেজ থেকে API Key দিন।');

    const res = await fetch('https://api.bdcourier.com/courier-check', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BD_COURIER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone }),
    });

    const data = await res.json();

    // Persist here (not just client-side) so a trigger-invoked check — with no
    // browser listening for the response — still gets saved, and so it's
    // visible to every admin/device via useBDCourierCache's DB preload.
    await supabaseAdmin.from('customers').upsert(
      { phone, courier_data: data, courier_checked_at: new Date().toISOString() },
      { onConflict: 'phone' },
    );

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
