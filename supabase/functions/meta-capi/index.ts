import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 15;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  // Cleanup stale entries periodically
  if (rateLimitMap.size > 1000) {
    for (const [key, val] of rateLimitMap) {
      if (now > val.resetAt) rateLimitMap.delete(key);
    }
  }
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") || "unknown";
}

async function sha256(str: string): Promise<string> {
  if (!str) return "";
  const encoded = new TextEncoder().encode(str.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp)) {
    return new Response(JSON.stringify({ error: "Too many requests." }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const {
      event_name,
      event_time,
      event_id,
      user_data = {},
      custom_data = {},
      event_source_url,
    } = body;

    // Validate event_name is a known Meta standard event
    const ALLOWED_EVENTS = [
      "PageView", "ViewContent", "AddToCart", "InitiateCheckout",
      "AddPaymentInfo", "Purchase", "Lead", "CompleteRegistration",
      "Search", "Contact",
    ];
    if (!event_name || typeof event_name !== "string" || !ALLOWED_EVENTS.includes(event_name)) {
      return new Response(JSON.stringify({ error: "Invalid event_name" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get settings from DB
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: settingsRows } = await supabase
      .from("store_settings")
      .select("key, value")
      .in("key", [
        "facebook_pixel_id",
        "meta_capi_access_token",
        "meta_test_event_code",
        "meta_capi_enabled",
      ]);

    const settings: Record<string, string> = {};
    settingsRows?.forEach((r: any) => {
      settings[r.key] = r.value;
    });

    const pixelId = settings.facebook_pixel_id;
    const accessToken = settings.meta_capi_access_token;
    const testEventCode = settings.meta_test_event_code;

    if (!pixelId || !accessToken) {
      return new Response(
        JSON.stringify({ error: "Meta Pixel ID or CAPI token not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build hashed user data — prefer client-sent values, fallback to request headers
    const hashedUserData: Record<string, any> = {
      client_user_agent:
        user_data.client_user_agent ||
        req.headers.get("user-agent") ||
        "",
      client_ip_address:
        user_data.client_ip ||
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        "",
    };

    // Hash PII fields
    if (user_data.em) hashedUserData.em = [await sha256(user_data.em)];
    if (user_data.ph) {
      // Normalize phone: remove +, spaces, dashes before hashing
      const normalizedPhone = user_data.ph.replace(/[\s\-\+]/g, "");
      hashedUserData.ph = [await sha256(normalizedPhone)];
    }
    if (user_data.fn) hashedUserData.fn = [await sha256(user_data.fn)];
    if (user_data.ln) hashedUserData.ln = [await sha256(user_data.ln)];

    const eventPayload: any = {
      event_name,
      event_time: event_time || Math.floor(Date.now() / 1000),
      event_id: event_id || crypto.randomUUID(),
      action_source: "website",
      user_data: hashedUserData,
      custom_data,
    };

    // Add event_source_url if provided
    if (event_source_url) {
      eventPayload.event_source_url = event_source_url;
    }

    const requestBody: any = { data: [eventPayload] };
    if (testEventCode) {
      requestBody.test_event_code = testEventCode;
    }

    const url = `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${accessToken}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Meta CAPI error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
