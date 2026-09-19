import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSmsViaActiveProvider, type SmsResult } from "../_shared/smsProviders.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Backward-compatible export used by other edge functions (place-order, notify-customer, etc.).
 * Routes to whichever provider is currently active in `sms_providers`.
 */
export async function sendSms(
  phone: string,
  message: string,
  adminClient?: any
): Promise<SmsResult> {
  const supabase = adminClient || createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  return sendSmsViaActiveProvider(supabase, phone, message);
}

// Direct invocation endpoint — staff-only
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { phone, message, purpose } = await req.json();
    if (!phone || !message) {
      return new Response(JSON.stringify({ error: "phone and message required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Emergency spend guard: this generic endpoint is used by campaigns,
    // inbox/manual sends, and any direct caller. Bulk campaign sends
    // (AdminSmsCampaign, SmsAudienceEngineTab, SmsCampaignHistoryTab) pass no
    // purpose and stay blocked here. Single admin-triggered sends that are
    // already gated by has_any_role above — the manual "send SMS to
    // customer" dialog and inbox replies (purpose: "admin_manual"), plus
    // party/loan ledger SMS (purpose: "party_ledger") — are allowed through.
    const ALLOWED_PURPOSES = new Set(["party_ledger", "admin_manual"]);
    if (!ALLOWED_PURPOSES.has(purpose)) {
      return new Response(JSON.stringify({
        success: false,
        disabled: true,
        error: "Direct SMS sending is disabled. Only order confirmation SMS is allowed.",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const result = await sendSmsViaActiveProvider(adminClient, phone, message, { purpose: "party_ledger" });
    if (!result.success) {
      console.error("[send-sms] provider failed", {
        provider: result.provider,
        error: result.error,
        provider_response: result.provider_response,
        phone_suffix: String(phone).slice(-4),
        msg_len: (message || "").length,
      });
    }
    // Always return 200 so callers (supabase.functions.invoke) receive the
    // structured {success,error,provider_response} body instead of throwing
    // the generic "Edge Function returned a non-2xx status code".
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
