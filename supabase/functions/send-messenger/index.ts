import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    const { data: hasRole } = await supabase.rpc("has_any_role", { _user_id: userId });
    if (!hasRole) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { recipient_id, message, platform } = await req.json();
    if (!recipient_id || !message) {
      return new Response(JSON.stringify({ error: "recipient_id and message required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Page Access Token from store_settings
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: settings } = await adminClient
      .from("store_settings")
      .select("key, value")
      .in("key", ["meta_page_access_token", "meta_page_id"]);

    const settingsMap: Record<string, string> = {};
    (settings || []).forEach((s: any) => { settingsMap[s.key] = s.value; });

    const pageAccessToken = settingsMap.meta_page_access_token;
    if (!pageAccessToken) {
      return new Response(JSON.stringify({ error: "Page Access Token not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Both Messenger and Instagram use the same Send API
    // Messenger: recipient is PSID, Instagram: recipient is IGSID
    console.log(`Sending ${platform || 'messenger'} message to recipient ${recipient_id}`);

    const apiBody: any = {
      recipient: { id: recipient_id },
      messaging_type: "RESPONSE",
      message: { text: message },
    };

    const res = await fetch(
      `https://graph.facebook.com/v21.0/me/messages?access_token=${pageAccessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiBody),
      }
    );

    const data = await res.json();
    console.log("Graph API response:", JSON.stringify(data));

    if (!res.ok || data.error) {
      const err = data.error || {};
      const errMsg = err.message || `HTTP ${res.status}`;
      const errorCode = err.code ?? null;
      const errorSubcode = err.error_subcode ?? null;
      // 2018278 = outside 24h window for FB; 10 = permission; 200 = permission
      const isPolicyBlock = errorSubcode === 2018278 || errorCode === 10 || errorCode === 200;
      return new Response(
        JSON.stringify({
          success: false,
          error: errMsg,
          error_code: errorCode,
          error_subcode: errorSubcode,
          policy_blocked: isPolicyBlock,
          details: data,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true, message_id: data.message_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Messenger send error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
