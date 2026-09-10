import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const { phone, message } = await req.json();
    if (!phone || !message) {
      return new Response(JSON.stringify({ error: "phone and message required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get WhatsApp credentials from store_settings
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: settings } = await adminClient
      .from("store_settings")
      .select("key, value")
      .in("key", ["whatsapp_access_token", "whatsapp_phone_number_id"]);

    const settingsMap: Record<string, string> = {};
    (settings || []).forEach((s: any) => { settingsMap[s.key] = s.value; });

    const accessToken = settingsMap.whatsapp_access_token;
    const phoneNumberId = settingsMap.whatsapp_phone_number_id;

    if (!accessToken || !phoneNumberId) {
      return new Response(JSON.stringify({ error: "WhatsApp credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Format phone: remove leading 0, add 880 prefix
    let formattedPhone = phone.replace(/[\s-]/g, "");
    if (formattedPhone.startsWith("+")) formattedPhone = formattedPhone.slice(1);
    if (formattedPhone.startsWith("0")) formattedPhone = "880" + formattedPhone.slice(1);
    if (!formattedPhone.startsWith("880")) formattedPhone = "880" + formattedPhone;

    console.log(`Sending WhatsApp to ${formattedPhone} via phone_number_id ${phoneNumberId}`);

    // Send via WhatsApp Cloud API
    const waRes = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: formattedPhone,
          type: "text",
          text: { body: message },
        }),
      }
    );

    const waData = await waRes.json();
    console.log("WhatsApp API response:", JSON.stringify(waData));

    if (!waRes.ok || waData.error) {
      const err = waData.error || {};
      const errMsg = err.message || `HTTP ${waRes.status}`;
      const errorCode = err.code ?? null;
      const errorSubcode = err.error_subcode ?? null;
      const errorDetails = err.error_data?.details || null;
      // 131047 = re-engagement window (24h rule); 131051 = unsupported message type
      const isPolicyBlock = errorCode === 131047 || errorCode === 131051 || errorCode === 131026;
      return new Response(
        JSON.stringify({
          success: false,
          error: errMsg,
          error_code: errorCode,
          error_subcode: errorSubcode,
          error_details: errorDetails,
          policy_blocked: isPolicyBlock,
          details: waData,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message_id: waData.messages?.[0]?.id,
        wa_id: waData.contacts?.[0]?.wa_id || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("WhatsApp send error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
