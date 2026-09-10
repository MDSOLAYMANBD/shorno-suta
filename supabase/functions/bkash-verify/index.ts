import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getValidBkashToken, executeBkashPayment, queryBkashPayment, sanitizeBkashResponseForStorage, type BkashConfig } from "../_shared/bkash-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Rate limiting — same shape/limits as uddoktapay-verify.
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

// frozenAmount, when provided, overrides the live-fetched `total` field with
// the amount actually charged by bKash (payment_transactions.amount, frozen
// at Create Payment time). orders.total can drift after checkout (e.g. an
// admin price-reconciliation pass), so the amount reported here — used for
// client-side purchase tracking and the Thank You page — must match what was
// actually charged, not a possibly-stale live re-fetch. subtotal/
// delivery_charge intentionally remain live values; freezing the full price
// breakdown is out of scope for this fix (see implementation plan).
async function buildOrderDetails(supabaseAdmin: any, orderId: string, frozenAmount?: number) {
  const { data: orderRow } = await supabaseAdmin
    .from("orders")
    .select("order_number, customer_name, customer_phone, total, delivery_charge, subtotal")
    .eq("id", orderId)
    .maybeSingle();
  const { data: orderItems } = await supabaseAdmin
    .from("order_items")
    .select("product_id, product_name, quantity, price, size, color")
    .eq("order_id", orderId);
  if (!orderRow) return null;
  return {
    ...orderRow,
    total: frozenAmount ?? orderRow.total,
    items: orderItems || [],
  };
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
    const { payment_id, status: clientStatus } = body;

    if (!payment_id || typeof payment_id !== "string") {
      return json({ error: "Missing payment_id." }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: txRow, error: txErr } = await supabaseAdmin
      .from("payment_transactions")
      .select("*")
      .eq("gateway", "bkash")
      .eq("gateway_payment_id", payment_id)
      .maybeSingle();

    if (txErr || !txRow) {
      return json({ error: "Unknown payment." }, 404);
    }

    // Idempotent short-circuit: already resolved, never re-process.
    if (txRow.status === "paid" || txRow.status === "failed" || txRow.status === "cancelled") {
      const orderDetails = txRow.status === "paid" ? await buildOrderDetails(supabaseAdmin, txRow.order_id, Number(txRow.amount)) : null;
      const { data: orderRow } = await supabaseAdmin.from("orders").select("order_number").eq("id", txRow.order_id).maybeSingle();
      return json({
        payment_status: txRow.status,
        order_id: txRow.order_id,
        order_number: orderRow?.order_number || null,
        transaction_id: txRow.transaction_id || null,
        amount: txRow.amount,
        order_details: orderDetails,
      });
    }

    // Atomic claim — guarantees only one concurrent call ever executes the
    // payment/updates the ledger, even if bKash's redirect or the browser
    // triggers verify more than once for the same payment_id.
    const { data: claimed } = await supabaseAdmin
      .from("payment_transactions")
      .update({ status: "processing" })
      .eq("id", txRow.id)
      .eq("status", "initiated")
      .select("id");

    if (!claimed || claimed.length === 0) {
      // Someone else is already processing this payment right now.
      // Give it a brief moment to finish, then report whatever state exists.
      for (let i = 0; i < 3; i++) {
        await new Promise((r) => setTimeout(r, 700));
        const { data: recheck } = await supabaseAdmin
          .from("payment_transactions")
          .select("status, transaction_id, amount, order_id")
          .eq("id", txRow.id)
          .single();
        if (recheck && (recheck.status === "paid" || recheck.status === "failed" || recheck.status === "cancelled")) {
          const orderDetails = recheck.status === "paid" ? await buildOrderDetails(supabaseAdmin, recheck.order_id, Number(recheck.amount)) : null;
          const { data: orderRow } = await supabaseAdmin.from("orders").select("order_number").eq("id", recheck.order_id).maybeSingle();
          return json({
            payment_status: recheck.status,
            order_id: recheck.order_id,
            order_number: orderRow?.order_number || null,
            transaction_id: recheck.transaction_id || null,
            amount: recheck.amount,
            order_details: orderDetails,
          });
        }
      }
      return json({ payment_status: "processing", order_id: txRow.order_id });
    }

    // Official bKash sample (bKash-HSL/Checkout-URL-Nodejs, bkashController.js)
    // skips calling Execute Payment entirely when the callback's own status
    // isn't "success" — a customer who cancelled/failed at the bKash page
    // never reaches PIN verification, so there is nothing to execute.
    // This is purely an efficiency optimization: clientStatus is NEVER
    // trusted to mark a payment as paid (that always requires a real
    // Execute/Query Payment response from bKash) — it is only ever used to
    // skip an API call we already know will not succeed.
    if (clientStatus && clientStatus !== "success") {
      const finalStatus = /cancel/i.test(clientStatus) ? "cancelled" : "failed";
      await supabaseAdmin.from("payment_transactions").update({
        status: finalStatus,
        failure_reason: `bKash callback status: ${clientStatus}`,
      }).eq("id", txRow.id);
      return json({ payment_status: finalStatus, order_id: txRow.order_id });
    }

    // Everything from here through the Query Payment fallback is "nothing
    // has been charged yet" territory — any failure in this stage is safe
    // to release back to 'initiated' for a retry. Once isPaid is determined
    // true below, that safety property no longer holds (see comment there).
    let execResult: any = null;
    try {
      const { data: settingsRows } = await supabaseAdmin
        .from("store_settings")
        .select("key, value")
        .in("key", [
          "bkash_app_key", "bkash_app_secret", "bkash_username", "bkash_password",
          "bkash_environment", "bkash_id_token", "bkash_refresh_token", "bkash_token_expires_at",
        ]);
      const settings: Record<string, string> = {};
      settingsRows?.forEach((s: { key: string; value: string }) => { settings[s.key] = s.value; });

      if (!settings.bkash_app_key || !settings.bkash_app_secret) {
        // Definitive misconfiguration, not transient — no point retrying.
        await supabaseAdmin.from("payment_transactions").update({
          status: "failed", failure_reason: "bKash not configured",
        }).eq("id", txRow.id);
        return json({ payment_status: "failed", order_id: txRow.order_id });
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

      // Per bKash's official Process Overview PDF: "If there is no response
      // from Execute Payment API, call Query Payment API to know the status
      // of the pending payment." A thrown/network-level failure IS that "no
      // response" case — it must not be treated as "nothing happened".
      try {
        execResult = await executeBkashPayment(cfg, idToken, payment_id);
      } catch (e) {
        console.error("bKash Execute Payment call failed (no response):", e);
        execResult = null;
      }

      // Per the official sample (executePayment.js + bkashController.js): a
      // `message` field on the response, or a missing statusCode, is the
      // documented signal of an ambiguous/error result — also falls back
      // to Query Payment.
      if (!execResult || execResult?.message || !execResult?.statusCode) {
        try {
          execResult = await queryBkashPayment(cfg, idToken, payment_id);
        } catch (e) {
          console.error("bKash Query Payment fallback also failed:", e);
          execResult = null;
        }
      }
    } catch (e) {
      console.error("bKash verify pre-execute step failed:", e);
      execResult = null;
    }

    // Success is determined by statusCode === "0000", matching bKash's own
    // official sample exactly (bkashController.js: `statusCode === '0000'`).
    const isPaid = execResult?.statusCode === "0000";
    const trxId = execResult?.trxID || null;

    if (isPaid) {
      // bKash has now confirmed the charge. From here on the claim must
      // NEVER be released back to "initiated" — a second Execute Payment
      // call against an already-executed paymentID would be rejected by
      // bKash ("permits only one execution attempt") and could be misread
      // as "payment failed" for a customer who was actually charged. Any
      // failure below is a backend reconciliation problem, not something
      // ever shown to the customer as a failure or allowed to repeat-charge.
      try {
        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("id, order_number, total")
          .eq("id", txRow.order_id)
          .single();

        // Fix: prefer the amount frozen at Create Payment time
        // (payment_transactions.amount) over a live re-fetch of
        // orders.total. orders.total is mutable after checkout (e.g. an
        // admin price-reconciliation pass can change it while the customer
        // is mid-flow on bKash's page) — using a live value here could
        // record a paid_amount that doesn't match what bKash actually
        // charged. txRow.amount is fixed at bkash-checkout time and is the
        // correct source of truth; the live order.total is only a fallback
        // for the extremely unlikely case where txRow.amount is missing.
        const paidAmount = Number(txRow.amount ?? order?.total);

        await supabaseAdmin.from("orders").update({
          payment_status: "paid",
          payment_method: "bkash",
          payment_invoice_id: trxId,
          paid_amount: paidAmount,
          due_amount: 0,
          paid_at: new Date().toISOString(),
        }).eq("id", txRow.order_id);

        // Single source of truth for gateway-driven sale entries — see
        // migration 20260802145915 for the ported rule set. The admin
        // panel's own "mark as Paid" flow (officeSellSaleEntry.ts) is
        // untouched and does not call this RPC.
        const { error: saleEntryErr } = await supabaseAdmin.rpc("apply_gateway_sale_entry", {
          p_order_id: txRow.order_id,
          p_amount: paidAmount,
          p_source: "bank",
        });
        if (saleEntryErr) {
          console.error("apply_gateway_sale_entry failed:", saleEntryErr);
        }

        await supabaseAdmin.from("payment_transactions").update({
          status: "paid",
          transaction_id: trxId,
          gateway_response: sanitizeBkashResponseForStorage(execResult),
        }).eq("id", txRow.id);

        // Reuses the existing "payment" notification template/pipeline as-is
        // (already built, never previously invoked). SMS gating for the
        // 'payment' type is admin-configurable, default disabled — decided
        // inside send-order-notification itself.
        try {
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-order-notification`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({ order_id: txRow.order_id, type: "payment", send_sms: true }),
          });
        } catch (e) {
          console.error("bKash payment notification failed:", e);
        }

        const orderDetails = await buildOrderDetails(supabaseAdmin, txRow.order_id, paidAmount);

        return json({
          payment_status: "paid",
          order_id: txRow.order_id,
          order_number: order?.order_number || null,
          transaction_id: trxId,
          amount: paidAmount,
          order_details: orderDetails,
        });
      } catch (postExecuteErr) {
        console.error("CRITICAL: bKash confirmed payment but post-processing failed — needs manual reconciliation.", {
          payment_id, order_id: txRow.order_id, trxId, error: String(postExecuteErr),
        });
        // Best-effort: still record that bKash confirmed the charge even if
        // the order/accounting writes above partially failed, so this is
        // discoverable via payment_transactions rather than silently lost.
        try {
          await supabaseAdmin.from("payment_transactions").update({
            status: "paid",
            transaction_id: trxId,
            gateway_response: sanitizeBkashResponseForStorage(execResult),
            failure_reason: `Post-processing error: ${String(postExecuteErr)}`,
          }).eq("id", txRow.id);
        } catch { /* already logged above; nothing more we can do here */ }
        // bKash charged the customer — never tell them it failed.
        return json({
          payment_status: "paid",
          order_id: txRow.order_id,
          transaction_id: trxId,
          amount: txRow.amount,
          order_details: null,
        });
      }
    }

    // Not paid. Distinguish "bKash gave a definitive non-success answer"
    // (truly over — finalize as failed/cancelled, matching the previous
    // behavior) from "we never got a usable answer at all" (per official
    // guidance: if status is Initiated / unknown, it's safe to retry from
    // Create Payment again — release the claim back to 'initiated' rather
    // than leaving it stuck at 'processing' forever).
    if (!execResult || execResult?.transactionStatus === "Initiated") {
      await supabaseAdmin.from("payment_transactions").update({
        status: "initiated",
        failure_reason: "No confirmed response from bKash — released for retry",
      }).eq("id", txRow.id).eq("status", "processing");
      return json({ payment_status: "processing", order_id: txRow.order_id });
    }

    // Failed or cancelled — orders.payment_status intentionally left
    // 'unpaid' (no new enum value introduced; existing filters/reports
    // keep working unchanged).
    const failureReason = execResult?.statusMessage || execResult?.transactionStatus || "Payment not completed";
    const finalStatus = /cancel/i.test(failureReason) ? "cancelled" : "failed";

    await supabaseAdmin.from("payment_transactions").update({
      status: finalStatus,
      failure_reason: failureReason,
      gateway_response: sanitizeBkashResponseForStorage(execResult),
    }).eq("id", txRow.id);

    return json({ payment_status: finalStatus, order_id: txRow.order_id, reason: failureReason });
  } catch (err) {
    console.error("bKash verify error:", err);
    return json({ error: "Verification failed." }, 500);
  }
});
