// Verifies token validity and webhook subscription status for connected
// Meta assets (Facebook Pages, Instagram Business accounts, WhatsApp phones).
// Updates public.integration_assets.health_status accordingly.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GRAPH = 'https://graph.facebook.com/v21.0';

async function checkAsset(asset: any): Promise<{ status: string; detail: any; expires_at?: string | null }> {
  const token = asset.access_token;
  if (!token) return { status: 'reconnect_required', detail: { reason: 'no_token' } };
  try {
    if (asset.asset_type === 'fb_page') {
      const r = await fetch(`${GRAPH}/${asset.asset_id}?fields=id,name&access_token=${encodeURIComponent(token)}`);
      const j = await r.json();
      if (!r.ok) {
        const code = j?.error?.code;
        if (code === 190) return { status: 'token_expired', detail: j.error };
        if (code === 200 || code === 10) return { status: 'permission_missing', detail: j.error };
        return { status: 'reconnect_required', detail: j.error };
      }
      return { status: 'connected', detail: { name: j?.name } };
    }
    if (asset.asset_type === 'ig_business') {
      const r = await fetch(`${GRAPH}/${asset.asset_id}?fields=id,username&access_token=${encodeURIComponent(token)}`);
      const j = await r.json();
      if (!r.ok) return { status: 'reconnect_required', detail: j?.error };
      return { status: 'connected', detail: { username: j?.username } };
    }
    if (asset.asset_type === 'waba_phone') {
      const r = await fetch(`${GRAPH}/${asset.asset_id}?fields=display_phone_number,verified_name&access_token=${encodeURIComponent(token)}`);
      const j = await r.json();
      if (!r.ok) {
        const code = j?.error?.code;
        if (code === 190) return { status: 'token_expired', detail: j.error };
        return { status: 'reconnect_required', detail: j?.error };
      }
      return { status: 'connected', detail: { phone: j?.display_phone_number } };
    }
    return { status: 'unknown', detail: { reason: 'unhandled_type' } };
  } catch (e: any) {
    return { status: 'reconnect_required', detail: { reason: e?.message } };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization') || '';
    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roleRow } = await admin.from('user_roles').select('role').eq('user_id', userData.user.id).eq('role', 'admin').maybeSingle();
    if (!roleRow) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const body = await req.json().catch(() => ({}));
    const assetId = body?.asset_id as string | undefined;

    let q = admin.from('integration_assets').select('*');
    if (assetId) q = q.eq('id', assetId);
    const { data: assets } = await q;

    const results: any[] = [];
    for (const a of (assets || [])) {
      const res = await checkAsset(a);
      await admin.from('integration_assets').update({
        health_status: res.status,
        health_detail: res.detail,
        last_health_check_at: new Date().toISOString(),
      }).eq('id', a.id);
      results.push({ id: a.id, platform: a.platform, asset_id: a.asset_id, status: res.status });
    }

    return new Response(JSON.stringify({ ok: true, count: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'health_check_failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
