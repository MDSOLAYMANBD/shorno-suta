// Preflight diagnostics for Meta OAuth: returns config presence + helpful URLs.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const META_APP_SECRET = Deno.env.get("META_APP_SECRET");
const META_VERIFY_TOKEN = Deno.env.get("META_VERIFY_TOKEN");

const SUPABASE_REF = (SUPABASE_URL || "").match(/https:\/\/([^.]+)/)?.[1] || "";
const WEBHOOK_URL = `https://${SUPABASE_REF}.supabase.co/functions/v1/meta-webhook`;
// TODO: update to the real domain once one is set (currently the Vercel placeholder).
const REDIRECT_URI = "https://shorno-suta.vercel.app/admin/oauth/callback";
const APP_DOMAINS = ["shorno-suta.vercel.app"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claims.claims.sub;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
    if (!roleRow || (roleRow.role !== "admin" && roleRow.role !== "editor")) {
      return new Response(JSON.stringify({ error: "Admin role required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: rows } = await admin.from("store_settings").select("key,value").in("key", [
      "meta_app_id",
      "meta_wa_embedded_signup_config_id",
      "meta_ig_login_config_id",
      "meta_messenger_config_id",
    ]);
    const map = Object.fromEntries((rows || []).map((r: any) => [r.key, r.value]));

    // Best-effort app type detection (requires META_APP_SECRET app access token).
    let app_type: string | null = null;
    let app_type_error: string | null = null;
    if (map.meta_app_id && META_APP_SECRET) {
      try {
        const appAccess = `${map.meta_app_id}|${META_APP_SECRET}`;
        const r = await fetch(`https://graph.facebook.com/v21.0/${map.meta_app_id}?fields=name,app_type,category&access_token=${encodeURIComponent(appAccess)}`);
        const j = await r.json();
        if (j.error) app_type_error = j.error.message;
        else app_type = j.app_type || j.category || null;
      } catch (e) { app_type_error = String((e as any)?.message || e); }
    }

    const redirectHost = new URL(REDIRECT_URI).host;
    const redirect_host_in_app_domains = APP_DOMAINS.some(d => redirectHost.endsWith(d));

    return new Response(JSON.stringify({
      ok: true,
      app_id_set: !!map.meta_app_id,
      app_secret_set: !!META_APP_SECRET,
      verify_token_set: !!META_VERIFY_TOKEN,
      whatsapp_config_id_set: !!map.meta_wa_embedded_signup_config_id,
      instagram_config_id_set: !!map.meta_ig_login_config_id,
      messenger_config_id_set: !!map.meta_messenger_config_id,
      app_type,
      app_type_error,
      redirect_host_in_app_domains,
      redirect_uri: REDIRECT_URI,
      app_domains: APP_DOMAINS,
      webhook_url: WEBHOOK_URL,
      fb_login_for_business_setup_url: map.meta_app_id
        ? `https://developers.facebook.com/apps/${map.meta_app_id}/fb-login-for-business/`
        : null,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
