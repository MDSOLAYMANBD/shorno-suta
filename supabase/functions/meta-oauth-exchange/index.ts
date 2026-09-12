// Exchanges short-lived FB user token → long-lived → page access token, subscribes webhook,
// auto-detects Instagram Business Account, persists to store_settings.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const META_APP_SECRET = Deno.env.get("META_APP_SECRET")!;

const GRAPH = "https://graph.facebook.com/v21.0";

async function setSetting(admin: any, key: string, value: string) {
  const { data: existing } = await admin.from("store_settings").select("id").eq("key", key).maybeSingle();
  if (existing) {
    await admin.from("store_settings").update({ value }).eq("key", key);
  } else {
    await admin.from("store_settings").insert({ key, value });
  }
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
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims } = await userClient.auth.getClaims(token);
    if (!claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claims.claims.sub;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
    if (!roleRow || (roleRow.role !== "admin" && roleRow.role !== "editor")) {
      return new Response(JSON.stringify({ error: "Admin role required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const code: string | undefined = body.code;
    const redirectUri: string | undefined = body.redirect_uri;
    const shortToken: string | undefined = body.short_lived_token; // legacy SDK fallback
    const platform: string = body.platform || "facebook"; // 'facebook' | 'instagram'
    const selectedPageId: string | undefined = body.selected_page_id;

    if (!code && !shortToken) {
      return new Response(JSON.stringify({ error: "code or short_lived_token required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Defense in depth: only accept the canonical redirect_uri.
    const CANONICAL_REDIRECT = "https://www.shornosuta.com/admin/oauth/callback";
    if (code && redirectUri && redirectUri !== CANONICAL_REDIRECT) {
      return new Response(JSON.stringify({ error: `redirect_uri must be exactly ${CANONICAL_REDIRECT}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const appId = await getSetting(admin, "meta_app_id");
    if (!appId) {
      return new Response(JSON.stringify({ error: "meta_app_id not configured in settings" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let longUserToken: string;
    let tokenExpiresIn = 60 * 24 * 3600;

    if (code) {
      if (!redirectUri) {
        return new Response(JSON.stringify({ error: "redirect_uri required with code" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // 1a) code → user access token
      const codeRes = await fetch(`${GRAPH}/oauth/access_token?client_id=${appId}&client_secret=${META_APP_SECRET}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${encodeURIComponent(code)}`);
      const codeJson = await codeRes.json();
      if (!codeRes.ok || !codeJson.access_token) {
        const m = codeJson?.error?.message || "Code exchange failed";
        const c = codeJson?.error?.code;
        const sc = codeJson?.error?.error_subcode;
        return new Response(JSON.stringify({ error: `Meta: ${m}${c ? ` (code ${c}${sc ? `/${sc}` : ''})` : ''}`, details: codeJson }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const userToken = codeJson.access_token as string;
      // 1b) upgrade to long-lived
      const llRes = await fetch(`${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${META_APP_SECRET}&fb_exchange_token=${userToken}`);
      const llJson = await llRes.json();
      if (!llRes.ok || !llJson.access_token) {
        // fall back to short user token if long-lived fails
        longUserToken = userToken;
      } else {
        longUserToken = llJson.access_token;
        tokenExpiresIn = llJson.expires_in || tokenExpiresIn;
      }
    } else {
      const llRes = await fetch(`${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${META_APP_SECRET}&fb_exchange_token=${shortToken}`);
      const llJson = await llRes.json();
      if (!llRes.ok || !llJson.access_token) {
        const m = llJson?.error?.message || "Long-lived token exchange failed";
        return new Response(JSON.stringify({ error: `Meta: ${m}`, details: llJson }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      longUserToken = llJson.access_token;
      tokenExpiresIn = llJson.expires_in || tokenExpiresIn;
    }

    // 2) Fetch user's pages
    const pagesRes = await fetch(`${GRAPH}/me/accounts?fields=id,name,access_token,picture{url},tasks&access_token=${longUserToken}`);
    const pagesJson = await pagesRes.json();
    if (!pagesRes.ok) {
      const m = pagesJson?.error?.message || "Pages fetch failed";
      return new Response(JSON.stringify({ error: `Meta: ${m}`, details: pagesJson }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const pages = pagesJson.data || [];
    if (pages.length === 0) {
      return new Response(JSON.stringify({ error: "এই Facebook user-এর কোনো manageable Page নেই। Page Admin/Editor হিসেবে login করুন।" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // If no page selected and >1, return list for picker
    if (!selectedPageId && pages.length > 1) {
      return new Response(JSON.stringify({ needs_page_selection: true, pages: pages.map((p: any) => ({ id: p.id, name: p.name, picture: p.picture?.data?.url })) }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const page = selectedPageId ? pages.find((p: any) => p.id === selectedPageId) : pages[0];
    if (!page) {
      return new Response(JSON.stringify({ error: "Selected page not in user's pages" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3) Subscribe page to webhook
    const subFields = "messages,messaging_postbacks,feed,message_reactions,message_deliveries,message_reads";
    const subRes = await fetch(`${GRAPH}/${page.id}/subscribed_apps?subscribed_fields=${subFields}&access_token=${page.access_token}`, { method: "POST" });
    const subJson = await subRes.json();
    if (!subRes.ok) {
      const m = subJson?.error?.message || "Subscribe failed";
      return new Response(JSON.stringify({ error: `Webhook subscribe failed: ${m}`, details: subJson }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const expiresAt = new Date(Date.now() + tokenExpiresIn * 1000).toISOString();

    // 4) Persist FB
    await setSetting(admin, "meta_page_id", page.id);
    await setSetting(admin, "meta_page_access_token", page.access_token);
    await setSetting(admin, "meta_page_name", page.name || "");
    await setSetting(admin, "meta_page_picture", page.picture?.data?.url || "");
    await setSetting(admin, "meta_token_expires_at", expiresAt);

    // 5) Instagram detection — only persist if found; for instagram platform require it
    let igInfo: any = null;
    const igRes = await fetch(`${GRAPH}/${page.id}?fields=instagram_business_account{id,username,profile_picture_url}&access_token=${page.access_token}`);
    const igJson = await igRes.json();
    const ig = igJson?.instagram_business_account;
    if (ig?.id) {
      await setSetting(admin, "instagram_business_account_id", ig.id);
      await setSetting(admin, "instagram_username", ig.username || "");
      await setSetting(admin, "instagram_access_token", page.access_token);
      igInfo = ig;
    } else if (platform === "instagram") {
      return new Response(JSON.stringify({
        error: `Page "${page.name}" এর সাথে কোনো Instagram Business Account লিঙ্ক করা নেই। Facebook Page Settings → Linked Accounts → Instagram-এ Business/Creator account connect করুন, তারপর আবার চেষ্টা করুন।`,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Activity log (best-effort)
    try {
      await admin.from("activity_logs").insert({
        user_id: userId,
        action_type: "meta_connect",
        entity_type: "integration",
        entity_id: page.id,
        description: `Connected ${platform} page: ${page.name}`,
        metadata: { platform, page_id: page.id, ig: igInfo?.id || null },
      });
    } catch (_) { /* ignore */ }

    return new Response(JSON.stringify({
      ok: true,
      page: { id: page.id, name: page.name, picture: page.picture?.data?.url },
      instagram: igInfo,
      token_expires_at: expiresAt,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
