import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function isRateLimited(ip: string): boolean {
  const now = Date.now();
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp)) {
    return json({ error: "Too many requests. Please try again later." }, 429);
  }

  try {
    const body = await req.json();
    const { order_id, customer_email } = body;

    if (!order_id) {
      return json({ error: "Missing required fields." }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch order from DB to get the real total — never trust client-supplied amount
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, total, customer_name, customer_phone")
      .eq("id", order_id)
      .is("deleted_at", null)
      .single();

    if (orderErr || !order) {
      return json({ error: "Order not found." }, 404);
    }

    const amount = Number(order.total);
    const customer_name = order.customer_name;
    const customer_phone = order.customer_phone;
    const order_number = order.order_number;

    if (amount <= 0) {
      return json({ error: "Invalid order total." }, 400);
    }

    // Get UddoktaPay credentials from store_settings
    const { data: settingsRows } = await supabaseAdmin
      .from("store_settings")
      .select("key, value")
      .in("key", ["uddoktapay_api_key", "uddoktapay_base_url"]);

    const settings: Record<string, string> = {};
    settingsRows?.forEach((s: { key: string; value: string }) => {
      settings[s.key] = s.value;
    });

    const apiKey = settings.uddoktapay_api_key;
    const baseUrl = settings.uddoktapay_base_url || "https://sandbox.uddoktapay.com";

    if (!apiKey) {
      return json({ error: "UddoktaPay API key not configured." }, 500);
    }

    // Build redirect URL — hardcoded to prevent open redirect attacks
    const siteUrl = "https://www.shornosuta.com";
    const redirectUrl = `${siteUrl}/payment-result`;
    const cancelUrl = `${siteUrl}/payment-result?status=cancelled`;

    const uddoktaPayload = {
      full_name: customer_name,
      email: body.customer_email || "customer@example.com",
      amount: String(amount),
      metadata: {
        order_id,
        order_number: order_number || "",
      },
      redirect_url: redirectUrl,
      return_type: "GET",
      cancel_url: cancelUrl,
    };

    const uddoktaRes = await fetch(`${baseUrl.replace(/\/$/, "")}/api/checkout-v2`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "RT-UDDOKTAPAY-API-KEY": apiKey,
      },
      body: JSON.stringify(uddoktaPayload),
    });

    const uddoktaData = await uddoktaRes.json();

    if (!uddoktaData.status || !uddoktaData.payment_url) {
      console.error("UddoktaPay error:", uddoktaData);
      return json({ error: "Payment initiation failed." }, 500);
    }

    // Update order with payment method
    await supabaseAdmin
      .from("orders")
      .update({ payment_method: "uddoktapay" })
      .eq("id", order_id);

    return json({ payment_url: uddoktaData.payment_url });
  } catch (err) {
    console.error("UddoktaPay checkout error:", err);
    return json({ error: "Failed to initiate payment." }, 500);
  }
});
