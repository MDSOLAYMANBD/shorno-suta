// WhatsApp Embedded Signup completion — fetches WABA + phone metadata,
// subscribes the app to WABA webhooks, and upserts integration_assets rows.
//
// Called by AdminOAuthCallback right after the standard whatsapp-oauth-exchange
// succeeds so the basic connection is already live before this enriches it.
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

// Inline redaction for safe logging (mirrors the frontend redact helper).
function redact(s: unknown): string {
  if (s == null) return '';
  const str = typeof s === 'string' ? s : JSON.stringify(s);
  return str
    .replace(/(access_token=)[^&\s"]+/gi, '$1[REDACTED]')
    .replace(/(client_secret=)[^&\s"]+/gi, '$1[REDACTED]')
    .replace(/("access_token"\s*:\s*")[^"]+/gi, '$1[REDACTED]');
}

async function fetchJson(url: string): Promise<any> {
  const r = await fetch(url);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `HTTP ${r.status}`);
  return j;
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
    if (!roleRow) {
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json().catch(() => ({}));
    const wabaIdHint: string | undefined = body?.waba_id;
    const phoneIdHint: string | undefined = body?.phone_number_id;

    // Pull stored WhatsApp access token (saved by whatsapp-oauth-exchange).
    const { data: settings } = await admin.from('store_settings').select('value').eq('key', 'meta_integration').maybeSingle();
    const cfg = (settings?.value as any) || {};
    const token: string | undefined = cfg?.whatsapp?.access_token || cfg?.user_access_token || cfg?.access_token;
    if (!token) {
      return new Response(JSON.stringify({ error: 'no_token' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 1. Discover WABAs (via business if hint missing).
    let wabaIds: string[] = wabaIdHint ? [wabaIdHint] : [];
    if (wabaIds.length === 0) {
      try {
        const biz = await fetchJson(`${GRAPH}/me/businesses?access_token=${encodeURIComponent(token)}`);
        for (const b of (biz?.data || [])) {
          try {
            const wabas = await fetchJson(`${GRAPH}/${b.id}/owned_whatsapp_business_accounts?access_token=${encodeURIComponent(token)}`);
            for (const w of (wabas?.data || [])) wabaIds.push(w.id);
          } catch (e) { console.log(redact(`waba list err: ${e}`)); }
        }
      } catch (e) { console.log(redact(`biz list err: ${e}`)); }
    }

    const enriched: any[] = [];
    for (const wabaId of wabaIds) {
      try {
        // 2. WABA metadata.
        const waba = await fetchJson(`${GRAPH}/${wabaId}?fields=id,name,currency,timezone_id,business_verification_status,message_template_namespace&access_token=${encodeURIComponent(token)}`);
        // 3. Subscribe the app to WABA webhooks (idempotent).
        try {
          await fetch(`${GRAPH}/${wabaId}/subscribed_apps?access_token=${encodeURIComponent(token)}`, { method: 'POST' });
        } catch (e) { console.log(redact(`wa subscribe err: ${e}`)); }
        // 4. Phone numbers.
        const phones = await fetchJson(`${GRAPH}/${wabaId}/phone_numbers?access_token=${encodeURIComponent(token)}`);
        for (const ph of (phones?.data || [])) {
          if (phoneIdHint && ph.id !== phoneIdHint) continue;
          let phoneMeta: any = ph;
          try {
            phoneMeta = await fetchJson(`${GRAPH}/${ph.id}?fields=display_phone_number,verified_name,quality_rating,name_status,code_verification_status&access_token=${encodeURIComponent(token)}`);
          } catch {}
          await admin.from('integration_assets').upsert({
            platform: 'whatsapp',
            asset_type: 'waba_phone',
            asset_id: ph.id,
            parent_id: wabaId,
            display_name: phoneMeta?.display_phone_number || phoneMeta?.verified_name || ph.id,
            access_token: token,
            webhook_subscribed: true,
            health_status: 'connected',
            last_health_check_at: new Date().toISOString(),
            health_detail: {
              waba_name: waba?.name,
              business_verification_status: waba?.business_verification_status,
              message_template_namespace: waba?.message_template_namespace,
              quality_rating: phoneMeta?.quality_rating,
              name_status: phoneMeta?.name_status,
              code_verification_status: phoneMeta?.code_verification_status,
            },
          }, { onConflict: 'platform,asset_id' });
          enriched.push({ phone_id: ph.id, waba_id: wabaId, display: phoneMeta?.display_phone_number });
        }
      } catch (e) { console.log(redact(`waba enrich err: ${e}`)); }
    }

    return new Response(JSON.stringify({ ok: true, count: enriched.length, items: enriched }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'wa_signup_complete_failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
