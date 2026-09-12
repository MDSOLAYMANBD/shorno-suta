import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getValidBkashToken, createBkashPayment, type BkashConfig } from "../_shared/bkash-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Rate limiting — same shape/limits as uddoktapay-checkout.
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

const BKASH_SANDBOX_BASE = "https://tokenized.sandbox.bka.sh/v1.2.0-beta";
const BKASH_LIVE_BASE = "https://tokenized.pay.bka.sh/v1.2.0-beta";

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
    const { order_id } = body;

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
    if (amount <= 0) {
      return json({ error: "Invalid order total." }, 400);
    }

    const { data: settingsRows } = await supabaseAdmin
      .from("store_settings")
      .select("key, value")
      .in("key", [
        "payment_bkash_enabled",
        "bkash_app_key",
        "bkash_app_secret",
        "bkash_username",
        "bkash_password",
        "bkash_environment",
        "bkash_id_token",
        "bkash_refresh_token",
        "bkash_token_expires_at",
      ]);

    const settings: Record<string, string> = {};
    settingsRows?.forEach((s: { key: string; value: string }) => {
      settings[s.key] = s.value;
    });

    if (settings.payment_bkash_enabled !== "true") {
      return json({ error: "bKash payment is currently disabled." }, 400);
    }

    if (!settings.bkash_app_key || !settings.bkash_app_secret || !settings.bkash_username || !settings.bkash_password) {
      return json({ error: "bKash is not configured." }, 500);
    }

    const cfg: BkashConfig = {
      appKey: settings.bkash_app_key,
      appSecret: settings.bkash_app_secret,
      username: settings.bkash_username,
      password: settings.bkash_password,
      baseUrl: settings.bkash_environment === "live" ? BKASH_LIVE_BASE : BKASH_SANDBOX_BASE,
    };

    const idToken = await getValidBkashToken(supabaseAdmin, cfg, {
      id_token: settings.bkash_id_token,
      refresh_token: settings.bkash_refresh_token,
      expires_at: settings.bkash_token_expires_at,
    });

    // Callback URL hardcoded — same open-redirect protection as UddoktaPay.
    const callbackURL = "https://www.shornosuta.com/payment-result";

    // bKash's own official sample (createPayment.js) generates a fresh,
    // unique merchantInvoiceNumber on every single Create Payment call
    // rather than reusing a fixed value — matching that: if a customer
    // retries bKash after a failed/cancelled attempt on the same order,
    // this must not resend the same invoice number a second time.
    const attemptSuffix = Date.now().toString(36).slice(-6);
    const merchantInvoiceNumber = `${order.order_number || order_id}-${attemptSuffix}`;
    // Per the official field spec: no <, >, or & characters allowed.
    const stripRestrictedChars = (s: string) => s.replace(/[<>&]/g, "");

    const result = await createBkashPayment(cfg, idToken, {
      amount,
      merchantInvoiceNumber: stripRestrictedChars(merchantInvoiceNumber).slice(0, 255),
      callbackURL,
      payerReference: stripRestrictedChars(order.customer_phone || order.order_number || order_id),
    });

    if (!result.paymentID || !result.bkashURL) {
      console.error("bKash create payment error:", result);
      return json({ error: "Payment initiation failed." }, 500);
    }

    // Audit log + idempotency anchor for this payment attempt.
    // gateway_response is stored unfiltered here deliberately, unlike
    // bkash-verify's Execute/Query responses: Create Payment's response
    // shape (CreatePaymentResult — paymentID, bkashURL, transactionStatus,
    // statusCode, statusMessage) contains no customer-identifying fields
    // (confirmed directly from the official field list; bKash only returns
    // the customer's wallet number on Execute/Query, after the wallet step),
    // and applying bkash-verify's Execute-oriented allowlist here would
    // incorrectly strip legitimate debugging fields like bkashURL.
    const { error: logErr } = await supabaseAdmin.from("payment_transactions").insert({
      gateway: "bkash",
      gateway_payment_id: result.paymentID,
      order_id,
      status: "initiated",
      amount,
      gateway_response: result,
    });
    if (logErr) {
      console.error("bKash payment_transactions insert error:", logErr);
      return json({ error: "Payment initiation failed." }, 500);
    }

    await supabaseAdmin.from("orders").update({ payment_method: "bkash" }).eq("id", order_id);

    return json({ payment_url: result.bkashURL });
  } catch (err) {
    console.error("bKash checkout error:", err);
    return json({ error: "Failed to initiate payment." }, 500);
  }
});
