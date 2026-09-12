// WhatsApp Embedded Signup callback handler.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const META_APP_SECRET = Deno.env.get("META_APP_SECRET")!;

const GRAPH = "https://graph.facebook.com/v21.0";

async function setSetting(admin: any, key: string, value: string) {
  const { data: existing } = await admin.from("store_settings").select("id").eq("key", key).maybeSingle();
  if (existing) await admin.from("store_settings").update({ value }).eq("key", key);
  else await admin.from("store_settings").insert({ key, value });
}
async function getSetting(admin: any, key: string): Promise<string | null> {
  const { data } = await admin.from("store_settings").select("value").eq("key", key).maybeSingle();
  return data?.value ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims } = await userClient.auth.getClaims(token);
    if (!claims?.claims?.sub) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: corsHeaders });
    const userId = claims.claims.sub;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
    if (!roleRow || roleRow.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin role required" }), { status: 403, headers: corsHeaders });
    }

    const body = await req.json();
    const code: string | undefined = body.code;
    const redirectUri: string | undefined = body.redirect_uri;
    let wabaId: string | undefined = body.waba_id;
    let phoneNumberId: string | undefined = body.phone_number_id;

    if (!code) {
      return new Response(JSON.stringify({ error: "code required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Defense in depth: only accept the canonical redirect_uri.
    const CANONICAL_REDIRECT = "https://www.shornosuta.com/admin/oauth/callback";
    if (redirectUri && redirectUri !== CANONICAL_REDIRECT) {
      return new Response(JSON.stringify({ error: `redirect_uri must be exactly ${CANONICAL_REDIRECT}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const appId = await getSetting(admin, "meta_app_id");
    if (!appId) {
      return new Response(JSON.stringify({ error: "meta_app_id not configured" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Exchange code → access token
    const redirectParam = redirectUri ? `&redirect_uri=${encodeURIComponent(redirectUri)}` : "";
    const tokRes = await fetch(`${GRAPH}/oauth/access_token?client_id=${appId}&client_secret=${META_APP_SECRET}${redirectParam}&code=${encodeURIComponent(code)}`);
    const tokJson = await tokRes.json();
    if (!tokRes.ok || !tokJson.access_token) {
      const m = tokJson?.error?.message || "WA token exchange failed";
      const c = tokJson?.error?.code;
      return new Response(JSON.stringify({ error: `Meta: ${m}${c ? ` (code ${c})` : ''}`, details: tokJson }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const accessToken = tokJson.access_token as string;

    // Auto-discover WABA + phone if not provided
    if (!wabaId) {
      try {
        const bizRes = await fetch(`${GRAPH}/me/businesses?access_token=${accessToken}`);
        const bizJson = await bizRes.json();
        for (const biz of (bizJson?.data || [])) {
          const wabaRes = await fetch(`${GRAPH}/${biz.id}/owned_whatsapp_business_accounts?access_token=${accessToken}`);
          const wabaJson = await wabaRes.json();
          const candidate = wabaJson?.data?.[0]?.id;
          if (candidate) { wabaId = candidate; break; }
        }
      } catch (_) { /* ignore */ }
    }
    if (wabaId && !phoneNumberId) {
      try {
        const pnsRes = await fetch(`${GRAPH}/${wabaId}/phone_numbers?access_token=${accessToken}`);
        const pnsJson = await pnsRes.json();
        phoneNumberId = pnsJson?.data?.[0]?.id;
      } catch (_) { /* ignore */ }
    }
    if (!wabaId || !phoneNumberId) {
      return new Response(JSON.stringify({ error: "WhatsApp Business Account বা Phone Number পাওয়া যায়নি। Embedded Signup flow শেষ করুন এবং নিশ্চিত করুন আপনি ঐ Business-এর Admin।", details: { wabaId, phoneNumberId } }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Subscribe WABA to our app
    const subRes = await fetch(`${GRAPH}/${wabaId}/subscribed_apps?access_token=${accessToken}`, { method: "POST" });
    const subJson = await subRes.json();
    if (!subRes.ok) {
      return new Response(JSON.stringify({ error: "WABA subscribe failed", details: subJson }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch phone display number
    let displayNumber = "";
    try {
      const pnRes = await fetch(`${GRAPH}/${phoneNumberId}?fields=display_phone_number,verified_name&access_token=${accessToken}`);
      const pnJson = await pnRes.json();
      displayNumber = pnJson?.display_phone_number || "";
    } catch (_) { /* ignore */ }

    const expiresAt = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString();

    await setSetting(admin, "whatsapp_phone_number_id", phoneNumberId);
    await setSetting(admin, "whatsapp_business_account_id", wabaId);
    await setSetting(admin, "whatsapp_access_token", accessToken);
    if (displayNumber) await setSetting(admin, "whatsapp_number", displayNumber);
    await setSetting(admin, "whatsapp_token_expires_at", expiresAt);

    try {
      await admin.from("activity_logs").insert({
        user_id: userId,
        action_type: "whatsapp_connect",
        entity_type: "integration",
        entity_id: wabaId,
        description: `Connected WhatsApp ${displayNumber || phoneNumberId}`,
        metadata: { waba_id: wabaId, phone_number_id: phoneNumberId },
      });
    } catch (_) { /* ignore */ }

    return new Response(JSON.stringify({ ok: true, phone_number_id: phoneNumberId, waba_id: wabaId, display_number: displayNumber, token_expires_at: expiresAt }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
