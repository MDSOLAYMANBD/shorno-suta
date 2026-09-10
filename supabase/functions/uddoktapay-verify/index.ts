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
    const { invoice_id } = body;

    if (!invoice_id || typeof invoice_id !== "string") {
      return json({ error: "Missing invoice_id." }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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

    // Verify payment with UddoktaPay
    const verifyRes = await fetch(`${baseUrl.replace(/\/$/, "")}/api/verify-payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "RT-UDDOKTAPAY-API-KEY": apiKey,
      },
      body: JSON.stringify({ invoice_id }),
    });

    const verifyData = await verifyRes.json();

    if (!verifyData.status) {
      console.error("UddoktaPay verify error:", verifyData);
      return json({ error: "Verification failed.", payment_status: "failed" }, 400);
    }

    const paymentStatus = verifyData.status === "COMPLETED" ? "paid" : "failed";
    const orderId = verifyData.metadata?.order_id;
    const orderNumber = verifyData.metadata?.order_number;

    if (orderId) {
      await supabaseAdmin
        .from("orders")
        .update({
          payment_status: paymentStatus,
          payment_invoice_id: invoice_id,
        })
        .eq("id", orderId);
    }

    // Fetch order details for tracking (items, customer info, totals)
    let orderDetails: any = null;
    if (orderId && paymentStatus === "paid") {
      const { data: orderRow } = await supabaseAdmin
        .from("orders")
        .select("order_number, customer_name, customer_phone, total, delivery_charge, subtotal")
        .eq("id", orderId)
        .maybeSingle();

      const { data: orderItems } = await supabaseAdmin
        .from("order_items")
        .select("product_id, product_name, quantity, price, size, color")
        .eq("order_id", orderId);

      if (orderRow) {
        orderDetails = {
          ...orderRow,
          items: orderItems || [],
        };
      }
    }

    return json({
      payment_status: paymentStatus,
      order_id: orderId,
      order_number: orderNumber,
      transaction_id: verifyData.transaction_id || null,
      amount: verifyData.amount || null,
      order_details: orderDetails,
    });
  } catch (err) {
    console.error("UddoktaPay verify error:", err);
    return json({ error: "Verification failed." }, 500);
  }
});
