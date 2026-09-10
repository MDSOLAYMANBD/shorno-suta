import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized — no token" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace("Bearer ", "");
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claimsData, error: claimsErr } = await authClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized — invalid token" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const body = await req.json().catch(() => ({}));
  const action = body.action || "status";

  // Fetch all meta-related settings
  const { data: settings } = await supabase
    .from("store_settings").select("key, value")
    .in("key", [
      "meta_app_id", "meta_app_secret", "meta_verify_token",
      "meta_page_access_token", "meta_page_id",
      "whatsapp_access_token", "whatsapp_phone_number_id", "whatsapp_business_account_id",
      "instagram_access_token",
    ]);

  const s: Record<string, string> = {};
  settings?.forEach((r: any) => { s[r.key] = r.value; });

  const json = (data: any, status = 200) =>
    new Response(JSON.stringify(data), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  // ===== STATUS =====
  if (action === "status") {
    const config_checks: Record<string, boolean> = {};
    for (const k of [
      "meta_app_id", "meta_app_secret", "meta_verify_token",
      "meta_page_access_token", "meta_page_id",
      "whatsapp_access_token", "whatsapp_phone_number_id", "whatsapp_business_account_id",
      "instagram_access_token",
    ]) {
      config_checks[k] = !!s[k];
    }

    // Page subscription check
    let page_subscription: any = null;
    let page_subscribed = false;
    let page_subscribed_fields: string[] = [];
    if (s.meta_page_id && s.meta_page_access_token) {
      try {
        const res = await fetch(`https://graph.facebook.com/v21.0/${s.meta_page_id}/subscribed_apps?access_token=${s.meta_page_access_token}`);
        page_subscription = await res.json();
        if (page_subscription?.data?.length > 0) {
          page_subscribed = true;
          page_subscribed_fields = page_subscription.data[0]?.subscribed_fields || [];
        }
      } catch (e) { page_subscription = { error: String(e) }; }
    }

    // WABA subscription check
    let waba_subscription: any = null;
    let waba_subscribed = false;
    if (s.whatsapp_business_account_id && s.whatsapp_access_token) {
      try {
        const res = await fetch(`https://graph.facebook.com/v21.0/${s.whatsapp_business_account_id}/subscribed_apps?access_token=${s.whatsapp_access_token}`);
        waba_subscription = await res.json();
        if (waba_subscription?.data?.length > 0) waba_subscribed = true;
      } catch (e) { waba_subscription = { error: String(e) }; }
    }

    // WhatsApp phone info
    let wa_phone_info: any = null;
    if (s.whatsapp_phone_number_id && s.whatsapp_access_token) {
      try {
        const res = await fetch(`https://graph.facebook.com/v21.0/${s.whatsapp_phone_number_id}?access_token=${s.whatsapp_access_token}`);
        wa_phone_info = await res.json();
      } catch (e) { wa_phone_info = { error: String(e) }; }
    }

    // Page token validation
    let page_token_valid = false;
    let page_token_error: string | null = null;
    let page_info: any = null;
    if (s.meta_page_access_token) {
      try {
        const res = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${s.meta_page_access_token}`);
        page_info = await res.json();
        if (page_info.id) page_token_valid = true;
        else page_token_error = page_info.error?.message || "Unknown error";
      } catch (e) { page_token_error = String(e); }
    }

    // Instagram linked to page check
    let instagram_linked = false;
    let instagram_account_id: string | null = null;
    let instagram_info: any = null;
    if (s.meta_page_id && s.meta_page_access_token) {
      try {
        const res = await fetch(`https://graph.facebook.com/v21.0/${s.meta_page_id}?fields=instagram_business_account&access_token=${s.meta_page_access_token}`);
        const data = await res.json();
        if (data.instagram_business_account?.id) {
          instagram_linked = true;
          instagram_account_id = data.instagram_business_account.id;
        }
        instagram_info = data;
      } catch (e) { instagram_info = { error: String(e) }; }
    }

    // Instagram token validation (if separate token provided)
    let instagram_token_valid = false;
    let instagram_token_error: string | null = null;
    if (s.instagram_access_token) {
      try {
        const res = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${s.instagram_access_token}`);
        const me = await res.json();
        if (me.id) instagram_token_valid = true;
        else instagram_token_error = me.error?.message || "Unknown error";
      } catch (e) { instagram_token_error = String(e); }
    }

    // WhatsApp token validation
    let wa_token_valid = false;
    let wa_token_error: string | null = null;
    if (s.whatsapp_access_token) {
      try {
        const res = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${s.whatsapp_access_token}`);
        const me = await res.json();
        if (me.id) wa_token_valid = true;
        else wa_token_error = me.error?.message || "Unknown error";
      } catch (e) { wa_token_error = String(e); }
    }

    // Last webhook hit
    let last_webhook_hit: any = null;
    try {
      const { data: auditRows } = await supabase
        .from("store_settings").select("value").eq("key", "meta_webhook_last_hit").single();
      if (auditRows?.value) last_webhook_hit = JSON.parse(auditRows.value);
    } catch {}

    // Inbox stats
    const { count: convCount } = await supabase.from("inbox_conversations").select("*", { count: "exact", head: true });
    const { count: msgCount } = await supabase.from("inbox_messages").select("*", { count: "exact", head: true });

    // Build readiness summary
    const messenger_ready = page_token_valid && page_subscribed && !!s.meta_app_id && !!s.meta_app_secret;
    const instagram_ready = messenger_ready && instagram_linked;
    const whatsapp_ready = wa_token_valid && waba_subscribed && !!s.whatsapp_phone_number_id;

    const missing_steps: string[] = [];
    if (!s.meta_app_id) missing_steps.push("Meta App ID দিন");
    if (!s.meta_app_secret) missing_steps.push("App Secret দিন");
    if (!s.meta_verify_token) missing_steps.push("Verify Token দিন");
    if (!s.meta_page_access_token) missing_steps.push("Page Access Token দিন");
    else if (!page_token_valid) missing_steps.push("Page Access Token অবৈধ — নতুন token generate করুন");
    if (!s.meta_page_id) missing_steps.push("Page ID দিন");
    if (!page_subscribed && s.meta_page_id && page_token_valid) missing_steps.push("Page Subscribe করুন (নিচের বাটন চাপুন)");
    if (!instagram_linked && s.meta_page_id && page_token_valid) missing_steps.push("Facebook Page-এ Instagram Business Account link করুন");
    if (page_token_valid && !page_subscribed) missing_steps.push("⚠️ Meta App কি Live/Published মোডে আছে? Development মোডে Messenger/Instagram webhook verify হয় না");

    return json({
      config_checks,
      messenger: {
        ready: messenger_ready,
        page_subscribed,
        subscribed_fields: page_subscribed_fields,
        page_token_valid,
        page_token_error,
        page_info,
        raw: page_subscription,
      },
      instagram: {
        ready: instagram_ready,
        linked: instagram_linked,
        account_id: instagram_account_id,
        token_valid: instagram_token_valid,
        token_error: instagram_token_error,
        raw: instagram_info,
      },
      whatsapp: {
        ready: whatsapp_ready,
        waba_subscribed,
        token_valid: wa_token_valid,
        token_error: wa_token_error,
        phone_info: wa_phone_info,
        raw: waba_subscription,
      },
      missing_steps,
      last_webhook_hit,
      inbox_stats: { conversations: convCount || 0, messages: msgCount || 0 },
      webhook_url: `${SUPABASE_URL}/functions/v1/meta-webhook`,
    });
  }

  // ===== SUBSCRIBE PAGE =====
  if (action === "subscribe_page") {
    if (!s.meta_page_id || !s.meta_page_access_token) {
      return json({ error: "meta_page_id এবং meta_page_access_token দরকার" }, 400);
    }
    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/${s.meta_page_id}/subscribed_apps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscribed_fields: "messages,messaging_postbacks,messaging_optins,message_deliveries,message_reads,feed",
          access_token: s.meta_page_access_token,
        }),
      });
      const result = await res.json();
      return json({ success: true, result });
    } catch (e) {
      return json({ error: String(e) }, 500);
    }
  }

  // ===== SUBSCRIBE WABA =====
  if (action === "subscribe_waba") {
    if (!s.whatsapp_business_account_id || !s.whatsapp_access_token) {
      return json({ error: "WABA ID এবং WhatsApp Access Token দরকার" }, 400);
    }
    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/${s.whatsapp_business_account_id}/subscribed_apps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: s.whatsapp_access_token }),
      });
      const result = await res.json();
      return json({ success: true, result });
    } catch (e) {
      return json({ error: String(e) }, 500);
    }
  }

  // ===== SIMULATE TEST =====
  if (action === "simulate_test") {
    const platform = body.platform || "messenger";
    const testMsg = {
      platform,
      senderId: `TEST_${platform.toUpperCase()}_${Date.now()}`,
      senderName: "টেস্ট ইউজার",
      text: `🧪 টেস্ট (${platform}) — ${new Date().toLocaleString("bn-BD")}`,
      imageUrl: null,
    };

    const { data: existing } = await supabase
      .from("inbox_conversations").select("id, unread_count")
      .eq("platform", testMsg.platform).eq("platform_conversation_id", testMsg.senderId).single();

    let conv = existing;
    if (!conv) {
      const { data: created } = await supabase
        .from("inbox_conversations")
        .insert({
          platform: testMsg.platform, platform_conversation_id: testMsg.senderId,
          customer_name: testMsg.senderName, status: "open", unread_count: 0,
        })
        .select("id, unread_count").single();
      conv = created;
    }

    if (conv) {
      await supabase.from("inbox_messages").insert({
        conversation_id: conv.id, message: testMsg.text,
        sender_type: "customer", sender_name: testMsg.senderName, is_read: false,
      });
      await supabase.from("inbox_conversations").update({
        last_message: testMsg.text, last_message_at: new Date().toISOString(),
        unread_count: (conv.unread_count || 0) + 1,
      }).eq("id", conv.id);
    }

    return json({ success: true, message: `${platform} টেস্ট মেসেজ সেভ হয়েছে` });
  }

  return json({ error: "Unknown action" }, 400);
});
