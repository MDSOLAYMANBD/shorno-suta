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
const META_VERIFY_TOKEN = Deno.env.get("META_VERIFY_TOKEN") || "";
const GRAPH = "https://graph.facebook.com/v21.0";

async function getSetting(admin: any, key: string) {
  const { data } = await admin.from("store_settings").select("value").eq("key", key).maybeSingle();
  return data?.value ?? null;
}
async function setSetting(admin: any, key: string, value: string) {
  const { data: existing } = await admin.from("store_settings").select("id").eq("key", key).maybeSingle();
  if (existing) await admin.from("store_settings").update({ value }).eq("key", key);
  else await admin.from("store_settings").insert({ key, value });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims } = await userClient.auth.getClaims(token);
    if (!claims?.claims?.sub) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: corsHeaders });
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const platform: string = body.platform || "facebook";

    const result: Record<string, any> = { platform, last_checked_at: new Date().toISOString() };

    // Webhook health: GET our public webhook with the verify token; expect 200 + challenge
    try {
      const challenge = "ping_" + Math.random().toString(36).slice(2, 8);
      const url = `${SUPABASE_URL}/functions/v1/meta-webhook?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(META_VERIFY_TOKEN)}&hub.challenge=${challenge}`;
      const wh = await fetch(url);
      const text = await wh.text();
      result.webhook_healthy = wh.ok && text === challenge;
    } catch (_) {
      result.webhook_healthy = false;
    }

    if (platform === "facebook" || platform === "instagram") {
      const pageId = await getSetting(admin, "meta_page_id");
      const pageToken = await getSetting(admin, "meta_page_access_token");
      if (!pageId || !pageToken) {
        result.status = "disconnected";
        return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Validate via /me
      const meRes = await fetch(`${GRAPH}/${pageId}?fields=id,name,picture{url}&access_token=${pageToken}`);
      const meJson = await meRes.json();
      if (!meRes.ok || !meJson.id) {
        result.status = "expired";
        result.error = meJson?.error?.message || "Token invalid";
      } else {
        result.status = "connected";
        result.page = { id: meJson.id, name: meJson.name, picture: meJson.picture?.data?.url };
        // Refresh saved name/picture
        if (meJson.name) await setSetting(admin, "meta_page_name", meJson.name);
        if (meJson.picture?.data?.url) await setSetting(admin, "meta_page_picture", meJson.picture.data.url);
      }
      // Token debug
      try {
        const dbg = await fetch(`${GRAPH}/debug_token?input_token=${pageToken}&access_token=${Deno.env.get("META_APP_SECRET") ? `${pageId}|${META_APP_SECRET}` : pageToken}`);
        const dbgJson = await dbg.json();
        const expires = dbgJson?.data?.expires_at;
        if (expires && expires > 0) {
          const iso = new Date(expires * 1000).toISOString();
          result.token_expires_at = iso;
          await setSetting(admin, "meta_token_expires_at", iso);
        } else {
          result.token_expires_at = null; // never-expires page token
        }
      } catch (_) { /* ignore */ }

      // Instagram link check
      if (platform === "instagram") {
        const igRes = await fetch(`${GRAPH}/${pageId}?fields=instagram_business_account{id,username}&access_token=${pageToken}`);
        const igJson = await igRes.json();
        result.instagram = igJson?.instagram_business_account || null;
      }
    } else if (platform === "whatsapp") {
      const wabaId = await getSetting(admin, "whatsapp_business_account_id");
      const waToken = await getSetting(admin, "whatsapp_access_token");
      const phoneId = await getSetting(admin, "whatsapp_phone_number_id");
      if (!wabaId || !waToken || !phoneId) {
        result.status = "disconnected";
        return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const pnRes = await fetch(`${GRAPH}/${phoneId}?fields=display_phone_number,verified_name,quality_rating&access_token=${waToken}`);
      const pnJson = await pnRes.json();
      if (!pnRes.ok) {
        result.status = "expired";
        result.error = pnJson?.error?.message || "Token invalid";
      } else {
        result.status = "connected";
        result.phone = pnJson;
      }
    }

    return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
