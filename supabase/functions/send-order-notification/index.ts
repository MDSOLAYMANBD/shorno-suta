import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSmsViaActiveProvider } from "../_shared/smsProviders.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// TODO: update to the real domain once one is set (currently the Vercel placeholder).
const SITE_URL = "https://shorno-suta.vercel.app";
const BRAND_COLOR = "#1a1a2e";
const ACCENT_COLOR = "#e94560";

// ========== EMAIL TEMPLATES (DEFAULTS) ==========

function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="bn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background:#f4f4f7;font-family:'Segoe UI',Arial,sans-serif}
  .container{max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)}
  .header{background:${BRAND_COLOR};padding:28px 24px;text-align:center}
  .header h1{color:#fff;font-size:22px;margin:0;letter-spacing:0.5px}
  .header p{color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px}
  .body{padding:28px 24px}
  .status-badge{display:inline-block;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:600;margin:12px 0}
  .order-box{background:#f8f9fa;border:1px solid #e9ecef;border-radius:10px;padding:16px;margin:16px 0}
  .order-box table{width:100%;border-collapse:collapse;font-size:14px}
  .order-box td{padding:6px 0;vertical-align:top}
  .order-box td:first-child{color:#6c757d;width:40%}
  .order-box td:last-child{font-weight:600;text-align:right}
  .items-table{width:100%;border-collapse:collapse;margin:16px 0;font-size:14px}
  .items-table th{background:#f8f9fa;padding:10px 12px;text-align:left;font-weight:600;border-bottom:2px solid #e9ecef}
  .items-table td{padding:10px 12px;border-bottom:1px solid #f0f0f0}
  .items-table .price{text-align:right;white-space:nowrap}
  .btn{display:inline-block;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin:6px 4px;text-align:center}
  .btn-primary{background:${ACCENT_COLOR};color:#fff!important}
  .btn-secondary{background:#f8f9fa;color:${BRAND_COLOR}!important;border:1px solid #dee2e6}
  .footer{background:#f8f9fa;padding:20px 24px;text-align:center;font-size:12px;color:#6c757d;border-top:1px solid #e9ecef}
  .footer a{color:${ACCENT_COLOR};text-decoration:none}
  .divider{border:0;border-top:1px solid #e9ecef;margin:20px 0}
  @media(max-width:600px){.body{padding:20px 16px}.btn{display:block;margin:8px 0}}
</style></head><body>
<div style="padding:16px;background:#f4f4f7">
<div class="container">
${content}
<div class="footer">
  <p>স্বর্ণ সুতা ❤️</p>
  <p><a href="${SITE_URL}">shorno-suta.vercel.app</a> | <a href="mailto:support@shorno-suta.example">support@shorno-suta.example</a></p>
  <p style="margin-top:8px;font-size:11px;color:#adb5bd">এই ইমেইলটি স্বয়ংক্রিয়ভাবে পাঠানো হয়েছে।</p>
</div>
</div>
</div>
</body></html>`;
}

function itemsTableHtml(items: any[]): string {
  const rows = items.map(i =>
    `<tr>
      <td>${i.product_name}${i.size ? ` <span style="color:#6c757d">(${i.size})</span>` : ""}${i.color ? ` <span style="color:#6c757d">- ${i.color}</span>` : ""}</td>
      <td style="text-align:center">${i.quantity}</td>
      <td class="price">৳${i.price}</td>
    </tr>`
  ).join("");
  return `<table class="items-table">
    <thead><tr><th>পণ্য</th><th style="text-align:center">পরিমাণ</th><th style="text-align:right">মূল্য</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function orderSummaryBox(order: any): string {
  const discountLine = order.discount_note ? `<tr><td>ডিসকাউন্ট:</td><td style="color:${ACCENT_COLOR}">${order.discount_note}</td></tr>` : "";
  return `<div class="order-box"><table>
    <tr><td>অর্ডার নম্বর:</td><td>${order.order_number}</td></tr>
    <tr><td>সাবটোটাল:</td><td>৳${order.subtotal}</td></tr>
    ${discountLine}
    <tr><td>ডেলিভারি চার্জ:</td><td>৳${order.delivery_charge}</td></tr>
    <tr><td style="font-size:16px;font-weight:700">মোট:</td><td style="font-size:16px;font-weight:700;color:${ACCENT_COLOR}">৳${order.total}</td></tr>
  </table></div>`;
}

function trackButton(orderNumber: string): string {
  return `<div style="text-align:center;margin:20px 0">
    <a href="${SITE_URL}/memo/${orderNumber}" class="btn btn-primary">📦 অর্ডার ট্র্যাক করুন</a>
    <a href="${SITE_URL}" class="btn btn-secondary">🛍️ আরও কেনাকাটা</a>
  </div>`;
}

function orderConfirmationEmail(order: any, items: any[]): string {
  return emailWrapper(`
    <div class="header"><h1>স্বর্ণ সুতা ❤️</h1><p>অর্ডার কনফার্মেশন</p></div>
    <div class="body">
      <p style="font-size:16px">প্রিয় <strong>${order.customer_name}</strong>,</p>
      <p>আপনার অর্ডার সফলভাবে গৃহীত হয়েছে! আমরা শীঘ্রই আপনার অর্ডার প্রস্তুত করবো।</p>
      <span class="status-badge" style="background:#fff3cd;color:#856404">⏳ অর্ডার গৃহীত</span>
      ${orderSummaryBox(order)}
      <h3 style="margin:20px 0 8px;font-size:15px">অর্ডার আইটেম</h3>
      ${itemsTableHtml(items)}
      <hr class="divider">
      <p style="font-size:14px"><strong>ডেলিভারি ঠিকানা:</strong><br>${order.customer_address}${order.city ? `, ${order.city}` : ""}</p>
      ${trackButton(order.order_number)}
    </div>
  `);
}

function orderProcessingEmail(order: any, items: any[]): string {
  return emailWrapper(`
    <div class="header"><h1>স্বর্ণ সুতা ❤️</h1><p>অর্ডার আপডেট</p></div>
    <div class="body">
      <p style="font-size:16px">প্রিয় <strong>${order.customer_name}</strong>,</p>
      <p>আপনার অর্ডার এখন প্রস্তুত হচ্ছে। শীঘ্রই ডেলিভারি দেওয়া হবে।</p>
      <span class="status-badge" style="background:#cce5ff;color:#004085">🔄 প্রস্তুত হচ্ছে</span>
      ${orderSummaryBox(order)}
      ${itemsTableHtml(items)}
      ${trackButton(order.order_number)}
    </div>
  `);
}

function orderShippedEmail(order: any, items: any[]): string {
  return emailWrapper(`
    <div class="header"><h1>স্বর্ণ সুতা ❤️</h1><p>অর্ডার শিপড</p></div>
    <div class="body">
      <p style="font-size:16px">প্রিয় <strong>${order.customer_name}</strong>,</p>
      <p>আপনার অর্ডার পাঠানো হয়েছে! 🚚 শীঘ্রই আপনার কাছে পৌঁছে যাবে।</p>
      <span class="status-badge" style="background:#e8daef;color:#6c3483">🚚 শিপড</span>
      ${orderSummaryBox(order)}
      ${order.courier_consignment_id ? `<p style="font-size:14px"><strong>কুরিয়ার ট্র্যাকিং:</strong> ${order.courier_consignment_id}</p>` : ""}
      ${itemsTableHtml(items)}
      ${trackButton(order.order_number)}
    </div>
  `);
}

function orderDeliveredEmail(order: any, items: any[]): string {
  return emailWrapper(`
    <div class="header"><h1>স্বর্ণ সুতা ❤️</h1><p>ডেলিভারি সম্পন্ন</p></div>
    <div class="body">
      <p style="font-size:16px">প্রিয় <strong>${order.customer_name}</strong>,</p>
      <p>আপনার অর্ডার সফলভাবে ডেলিভারি সম্পন্ন হয়েছে! ✅</p>
      <span class="status-badge" style="background:#d4edda;color:#155724">✅ ডেলিভারড</span>
      ${orderSummaryBox(order)}
      ${itemsTableHtml(items)}
      <hr class="divider">
      <div style="text-align:center;background:#fff8e1;border-radius:10px;padding:20px;margin:16px 0">
        <p style="font-size:16px;margin:0 0 8px">⭐ আপনার অভিজ্ঞতা কেমন ছিল?</p>
        <p style="font-size:13px;color:#6c757d;margin:0 0 16px">আপনার মতামত আমাদের জন্য গুরুত্বপূর্ণ</p>
        <a href="${SITE_URL}/memo/${order.order_number}" class="btn btn-primary">রিভিউ দিন</a>
      </div>
      ${trackButton(order.order_number)}
    </div>
  `);
}

function paymentConfirmationEmail(order: any, items: any[]): string {
  return emailWrapper(`
    <div class="header"><h1>স্বর্ণ সুতা ❤️</h1><p>পেমেন্ট কনফার্মেশন</p></div>
    <div class="body">
      <p style="font-size:16px">প্রিয় <strong>${order.customer_name}</strong>,</p>
      <p>আপনার পেমেন্ট সফলভাবে গ্রহণ করা হয়েছে। ধন্যবাদ!</p>
      <span class="status-badge" style="background:#d4edda;color:#155724">💳 পেমেন্ট সফল</span>
      ${orderSummaryBox(order)}
      ${itemsTableHtml(items)}
      ${trackButton(order.order_number)}
    </div>
  `);
}

// ========== TYPE → TEMPLATE KEY MAPPING ==========

const EMAIL_KEY_MAP: Record<string, string> = {
  confirmation: "order_confirmation",
  processing: "order_processing",
  shipped: "order_shipped",
  delivered: "order_delivered",
  payment: "payment_confirmation",
};

const SMS_KEY_MAP: Record<string, string> = {
  confirmation: "sms_order_confirmation",
  processing: "sms_order_processing",
  shipped: "sms_order_shipped",
  delivered: "sms_order_delivered",
  payment: "sms_payment_confirmation",
};

const ORDER_SMS_FRESH_WINDOW_MS = 15 * 60 * 1000;

// ========== SMS TEMPLATE PROCESSING ==========

function processSmsTemplate(template: string, order: any): string {
  return template
    .replace(/\{order_number\}/g, order.order_number || "")
    .replace(/\{total\}/g, String(order.total || 0))
    .replace(/\{customer_name\}/g, order.customer_name || "");
}

// ========== MAIN HANDLER ==========

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // Auth: allow service-role internal calls OR authenticated staff users
    const authHeader = req.headers.get("Authorization")?.replace("Bearer ", "") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    let authorized = false;
    if (authHeader && authHeader === serviceRoleKey) {
      authorized = true;
    } else if (authHeader) {
      const supabaseAuth = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: `Bearer ${authHeader}` } } }
      );
      const { data: claimsData } = await supabaseAuth.auth.getClaims(authHeader);
      if (claimsData?.claims?.sub) {
        const { data: hasAny } = await supabaseAuth.rpc("has_any_role", { _user_id: claimsData.claims.sub });
        if (hasAny === true) authorized = true;
      }
    }
    if (!authorized) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { order_id, type, send_email = true, send_sms = false } = body;

    if (!order_id || !type) return json({ error: "Missing order_id or type" }, 400);

    const validTypes = ["confirmation", "processing", "shipped", "delivered", "payment"];
    if (!validTypes.includes(type)) return json({ error: "Invalid notification type" }, 400);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch order + items + templates + settings in parallel
    const [orderRes, itemsRes, templatesRes, paymentSmsSettingRes] = await Promise.all([
      supabaseAdmin.from("orders").select("*").eq("id", order_id).maybeSingle(),
      supabaseAdmin.from("order_items").select("product_name, quantity, price, size, color").eq("order_id", order_id),
      supabaseAdmin.from("email_templates").select("template_key, subject, html_content, sms_content, is_active, channel"),
      supabaseAdmin.from("store_settings").select("value").eq("key", "payment_sms_confirmation_enabled").maybeSingle(),
    ]);
    const paymentSmsEnabled = paymentSmsSettingRes.data?.value === "true";

    if (orderRes.error || !orderRes.data) return json({ error: "Order not found" }, 404);

    const order = orderRes.data;
    const orderItems = itemsRes.data || [];
    const templates = templatesRes.data || [];

    // Build template lookup
    const tplMap = new Map<string, any>();
    for (const t of templates) tplMap.set(t.template_key, t);

    const results: { email?: string; sms?: string } = {};

    // ─── EMAIL ───
    const emailKey = EMAIL_KEY_MAP[type];
    const emailTpl = emailKey ? tplMap.get(emailKey) : null;
    const emailActive = emailTpl ? emailTpl.is_active !== false : true; // default active if no row

    const customerEmail = order.customer_email;
    if (send_email && emailActive && customerEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      // Use custom HTML from DB if available, else use default
      let html = "";
      let subject = "";

      const customHtml = emailTpl?.html_content?.trim();
      const customSubject = emailTpl?.subject?.trim();

      switch (type) {
        case "confirmation":
          html = customHtml || orderConfirmationEmail(order, orderItems);
          subject = customSubject || `আপনার অর্ডার সফল হয়েছে – ${order.order_number}`;
          break;
        case "processing":
          html = customHtml || orderProcessingEmail(order, orderItems);
          subject = customSubject || `আপনার অর্ডার প্রস্তুত হচ্ছে – ${order.order_number}`;
          break;
        case "shipped":
          html = customHtml || orderShippedEmail(order, orderItems);
          subject = customSubject || `আপনার অর্ডার পাঠানো হয়েছে – ${order.order_number}`;
          break;
        case "delivered":
          html = customHtml || orderDeliveredEmail(order, orderItems);
          subject = customSubject || `আপনার অর্ডার ডেলিভারি সম্পন্ন – ${order.order_number}`;
          break;
        case "payment":
          html = customHtml || paymentConfirmationEmail(order, orderItems);
          subject = customSubject || `পেমেন্ট সফল হয়েছে – ${order.order_number}`;
          break;
      }

      try {
        const emailRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ to: customerEmail, subject, html }),
        });
        const emailResult = await emailRes.text();
        results.email = emailRes.ok ? "sent" : `failed: ${emailResult}`;

        try {
          await supabaseAdmin.from("notification_logs").insert({
            order_id, notification_type: type, channel: "email",
            recipient: customerEmail, status: emailRes.ok ? "sent" : "failed",
            error_message: emailRes.ok ? null : emailResult,
            message_content: subject,
          });
        } catch {}
      } catch (e) {
        results.email = `error: ${e.message}`;
      }
    } else {
      results.email = emailActive ? "skipped" : "disabled";
    }

    // ─── SMS ───
    const smsKey = SMS_KEY_MAP[type];
    const smsTpl = smsKey ? tplMap.get(smsKey) : null;
    const smsActive = smsTpl ? smsTpl.is_active !== false : false; // default inactive if no row

    // SMS is only allowed for two explicitly-approved purposes:
    // 1) a brand-new order confirmation when place-order asks for it (original rule, unchanged), or
    // 2) a payment confirmation, gated behind a dedicated admin toggle
    //    (store_settings.payment_sms_confirmation_enabled, default disabled).
    // Never send SMS by default from any other admin/status path.
    const shouldSendSms =
      send_sms === true &&
      ((type === "confirmation" && smsActive) ||
        (type === "payment" && paymentSmsEnabled) ||
        (type === "delivered" && smsActive));

    if (shouldSendSms && order.customer_phone) {
      // Freshness guard only applies to the "new order" confirmation SMS —
      // a payment can legitimately be verified well after order creation.
      if (type === "confirmation") {
        const orderCreatedAt = new Date(order.created_at || 0).getTime();
        const isFreshOrder = Number.isFinite(orderCreatedAt) && Date.now() - orderCreatedAt <= ORDER_SMS_FRESH_WINDOW_MS;
        if (!isFreshOrder) {
          results.sms = "skipped: not a new order";
          return json({ success: true, results });
        }
      }

      const phone = order.customer_phone.startsWith("88") ? order.customer_phone : `88${order.customer_phone}`;
      const defaultSmsContent = type === "payment"
        ? `স্বর্ণ সুতা ❤️\nপেমেন্ট সফল হয়েছে!\nঅর্ডার: ${order.order_number}\n৳${order.total} পরিশোধ সম্পন্ন।\nshorno-suta.vercel.app/memo/${order.order_number}`
        : type === "delivered"
        ? `স্বর্ণ সুতা ❤️ ধন্যবাদ! আবার কেনাকাটা করুন shorno-suta.vercel.app`
        : `স্বর্ণ সুতা ❤️\nঅর্ডার: ${order.order_number}\n৳${order.total}\nshorno-suta.vercel.app/memo/${order.order_number}`;
      const smsContent = smsTpl?.sms_content?.trim() || defaultSmsContent;
      const smsMessage = processSmsTemplate(smsContent, order);

      try {
        const { data: existingSmsLog } = await supabaseAdmin
          .from("notification_logs")
          .select("id")
          .eq("order_id", order_id)
          .eq("notification_type", type)
          .eq("channel", "sms")
          .eq("status", "sent")
          .maybeSingle();

        if (existingSmsLog) {
          results.sms = "skipped: already sent";
          return json({ success: true, results });
        }

        const smsResult = await sendSmsViaActiveProvider(supabaseAdmin, phone, smsMessage, {
          purpose: type === "payment" ? "payment_confirmation" : type === "delivered" ? "delivery_thankyou" : "order_confirmation",
        });
        results.sms = smsResult.success ? `sent (${smsResult.provider})` : `failed: ${smsResult.error}`;

        try {
          await supabaseAdmin.from("notification_logs").insert({
            order_id, notification_type: type, channel: "sms",
            recipient: phone, status: smsResult.success ? "sent" : "failed",
            error_message: smsResult.success ? null : smsResult.error,
            message_content: smsMessage,
          });
        } catch {}
      } catch (e) {
        results.sms = `error: ${(e as any).message || e}`;
      }
    } else {
      results.sms = smsActive ? "skipped" : "disabled";
    }

    return json({ success: true, results });
  } catch (err) {
    console.error("Notification error:", err);
    return json({ error: "Invalid request" }, 400);
  }
});
