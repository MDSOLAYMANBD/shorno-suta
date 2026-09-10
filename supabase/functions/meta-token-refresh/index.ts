// Background long-lived token refresh for Meta assets. Designed to be
// scheduled via pg_cron later. Selects assets whose token expires in <=7 days
// and exchanges them for a new long-lived token.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_SECRET = Deno.env.get('META_APP_SECRET') || '';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Read app id from store_settings.
  const { data: settings } = await admin.from('store_settings').select('value').eq('key', 'meta_integration').maybeSingle();
  const appId = (settings?.value as any)?.app_id;
  if (!appId || !APP_SECRET) {
    return new Response(JSON.stringify({ error: 'missing_app_credentials' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const cutoff = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  const { data: assets } = await admin.from('integration_assets')
    .select('*')
    .lte('token_expires_at', cutoff)
    .not('access_token', 'is', null);

  const refreshed: any[] = [];
  for (const a of (assets || [])) {
    try {
      const url = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(APP_SECRET)}&fb_exchange_token=${encodeURIComponent(a.access_token)}`;
      const r = await fetch(url);
      const j = await r.json();
      if (r.ok && j?.access_token) {
        const expiresAt = j.expires_in ? new Date(Date.now() + j.expires_in * 1000).toISOString() : null;
        await admin.from('integration_assets').update({
          access_token: j.access_token,
          token_expires_at: expiresAt,
          health_status: 'connected',
          last_health_check_at: new Date().toISOString(),
        }).eq('id', a.id);
        refreshed.push({ id: a.id, platform: a.platform });
      }
    } catch {}
  }

  return new Response(JSON.stringify({ ok: true, refreshed: refreshed.length, items: refreshed }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
