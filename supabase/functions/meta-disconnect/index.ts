import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GRAPH = "https://graph.facebook.com/v21.0";

const FB_KEYS = ["meta_page_id", "meta_page_access_token", "meta_page_name", "meta_page_picture", "meta_token_expires_at"];
const IG_KEYS = ["instagram_business_account_id", "instagram_username", "instagram_access_token"];
const WA_KEYS = ["whatsapp_phone_number_id", "whatsapp_business_account_id", "whatsapp_access_token", "whatsapp_number", "whatsapp_token_expires_at"];

async function getSetting(admin: any, key: string) {
  const { data } = await admin.from("store_settings").select("value").eq("key", key).maybeSingle();
  return data?.value ?? null;
}
async function clearKeys(admin: any, keys: string[]) {
  await admin.from("store_settings").delete().in("key", keys);
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
    const userId = claims.claims.sub;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
    if (!roleRow || roleRow.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin role required" }), { status: 403, headers: corsHeaders });
    }

    const { platform } = await req.json();
    if (!["facebook", "instagram", "whatsapp"].includes(platform)) {
      return new Response(JSON.stringify({ error: "Invalid platform" }), { status: 400, headers: corsHeaders });
    }

    if (platform === "whatsapp") {
      const wabaId = await getSetting(admin, "whatsapp_business_account_id");
      const waToken = await getSetting(admin, "whatsapp_access_token");
      if (wabaId && waToken) {
        try {
          await fetch(`${GRAPH}/${wabaId}/subscribed_apps?access_token=${waToken}`, { method: "DELETE" });
        } catch (_) { /* ignore */ }
      }
      await clearKeys(admin, WA_KEYS);
    } else {
      const pageId = await getSetting(admin, "meta_page_id");
      const pageToken = await getSetting(admin, "meta_page_access_token");
      if (platform === "facebook") {
        if (pageId && pageToken) {
          try {
            await fetch(`${GRAPH}/${pageId}/subscribed_apps?access_token=${pageToken}`, { method: "DELETE" });
          } catch (_) { /* ignore */ }
        }
        await clearKeys(admin, [...FB_KEYS, ...IG_KEYS]); // disconnecting FB also unlinks IG
      } else {
        // instagram only
        await clearKeys(admin, IG_KEYS);
      }
    }

    try {
      await admin.from("activity_logs").insert({
        user_id: userId,
        action_type: "meta_disconnect",
        entity_type: "integration",
        entity_id: platform,
        description: `Disconnected ${platform}`,
        metadata: { platform },
      });
    } catch (_) { /* ignore */ }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
