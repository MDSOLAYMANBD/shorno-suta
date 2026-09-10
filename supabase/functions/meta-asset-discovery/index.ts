// Discovers Meta assets (Facebook Pages, Instagram Business accounts, WhatsApp
// phone numbers) right after a successful OAuth exchange and upserts them into
// the public.integration_assets table for multi-asset support.
//
// SECURITY: Only authenticated admins can call this. Tokens are read from
// public.store_settings (where meta-oauth-exchange already stored them
// server-side); this function never accepts tokens from the client.
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

interface DiscoveredAsset {
  platform: 'messenger' | 'instagram' | 'whatsapp';
  asset_type: 'fb_page' | 'ig_business' | 'waba_phone';
  asset_id: string;
  parent_id?: string;
  display_name: string;
  access_token?: string;
  scopes?: string[];
}

async function fetchJson(url: string): Promise<any> {
  const r = await fetch(url);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `HTTP ${r.status}`);
  return j;
}

async function discoverFacebookAndInstagram(userToken: string): Promise<DiscoveredAsset[]> {
  const out: DiscoveredAsset[] = [];
  const pages = await fetchJson(`${GRAPH}/me/accounts?fields=id,name,access_token&limit=100&access_token=${encodeURIComponent(userToken)}`);
  for (const p of (pages?.data || [])) {
    out.push({
      platform: 'messenger',
      asset_type: 'fb_page',
      asset_id: p.id,
      display_name: p.name,
      access_token: p.access_token,
    });
    // Linked IG business account (best-effort).
    try {
      const ig = await fetchJson(`${GRAPH}/${p.id}?fields=instagram_business_account{id,username}&access_token=${encodeURIComponent(p.access_token)}`);
      const iga = ig?.instagram_business_account;
      if (iga?.id) {
        out.push({
          platform: 'instagram',
          asset_type: 'ig_business',
          asset_id: iga.id,
          parent_id: p.id,
          display_name: iga.username ? `@${iga.username}` : iga.id,
          access_token: p.access_token,
        });
      }
    } catch {}
  }
  return out;
}

async function discoverWhatsApp(userToken: string): Promise<DiscoveredAsset[]> {
  const out: DiscoveredAsset[] = [];
  // List businesses → for each, list owned WABAs → list phone numbers.
  const biz = await fetchJson(`${GRAPH}/me/businesses?access_token=${encodeURIComponent(userToken)}`);
  for (const b of (biz?.data || [])) {
    try {
      const wabas = await fetchJson(`${GRAPH}/${b.id}/owned_whatsapp_business_accounts?access_token=${encodeURIComponent(userToken)}`);
      for (const w of (wabas?.data || [])) {
        try {
          const phones = await fetchJson(`${GRAPH}/${w.id}/phone_numbers?access_token=${encodeURIComponent(userToken)}`);
          for (const ph of (phones?.data || [])) {
            out.push({
              platform: 'whatsapp',
              asset_type: 'waba_phone',
              asset_id: ph.id,
              parent_id: w.id,
              display_name: ph.display_phone_number || ph.verified_name || ph.id,
              access_token: userToken,
            });
          }
        } catch {}
      }
    } catch {}
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization') || '';
    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roleRow } = await admin.from('user_roles').select('role').eq('user_id', userData.user.id).eq('role', 'admin').maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json().catch(() => ({}));
    const platform = String(body?.platform || 'facebook');

    // Read user/system token previously stored by meta-oauth-exchange in store_settings.
    const { data: settings } = await admin.from('store_settings').select('value').eq('key', 'meta_integration').maybeSingle();
    const cfg = (settings?.value as any) || {};
    const userToken: string | undefined =
      cfg?.user_access_token ||
      cfg?.system_user_token ||
      cfg?.access_token ||
      cfg?.[platform]?.access_token;

    if (!userToken) {
      return new Response(JSON.stringify({ error: 'no_token', detail: 'No access token found in store_settings.meta_integration' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let assets: DiscoveredAsset[] = [];
    if (platform === 'whatsapp') {
      assets = await discoverWhatsApp(userToken);
    } else {
      assets = await discoverFacebookAndInstagram(userToken);
    }

    // Upsert (platform, asset_id) — prevents duplicates and updates display_name + token.
    if (assets.length > 0) {
      const rows = assets.map(a => ({
        platform: a.platform,
        asset_type: a.asset_type,
        asset_id: a.asset_id,
        parent_id: a.parent_id || null,
        display_name: a.display_name,
        access_token: a.access_token || null,
        scopes: a.scopes || null,
        health_status: 'connected',
        last_health_check_at: new Date().toISOString(),
      }));
      await admin.from('integration_assets').upsert(rows, { onConflict: 'platform,asset_id' });
    }

    return new Response(JSON.stringify({ ok: true, count: assets.length, assets }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'discovery_failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
