// track-conversion — server-side dispatcher for a single order/stage across
// Meta CAPI, GA4 Measurement Protocol, and Google Ads (offline conversions).
//
// Called by `place-order` (stage=purchase) and later by order-status flows
// (stage=confirmed|shipped|delivered|cancelled|returned).
//
// Storage contract: every attempt is upserted into `conversions_sent` with
// hashed-only PII in `request_payload` (see `redactForLog`). Raw PII never
// touches the DB.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ChannelResult = { ok: boolean; status?: number; body?: unknown; error?: string };

async function sha256Hex(s: string): Promise<string> {
  if (!s) return "";
  const buf = new TextEncoder().encode(s.trim().toLowerCase());
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normPhone(p: string): string {
  return (p || "").replace(/[^0-9]/g, "").replace(/^0/, "88");
}

// Multiple Google Ads accounts can run ads for the same site at once.
// Setting is one "ID:LABEL" pair per line (or comma-separated).
function parseGoogleAdsAccounts(raw?: string): Array<{ id: string; label: string }> {
  if (!raw) return [];
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => {
      const [id, label] = pair.split(":").map((p) => p?.trim() || "");
      return { id, label };
    })
    .filter((a) => a.id && a.label);
}

// Redact any raw PII fields — only hashed identifiers and non-PII may be stored.
function redactForLog(payload: any): any {
  if (!payload || typeof payload !== "object") return payload;
  const RAW_KEYS = new Set([
    "em", "ph", "fn", "ln", "ct", "st", "zp", "country",
    "email", "phone", "first_name", "last_name",
    "address", "customer_name", "customer_phone", "customer_email",
    "client_ip_address", "client_ip", "user_agent", "client_user_agent",
  ]);
  const walk = (v: any): any => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const out: any = {};
      for (const [k, val] of Object.entries(v)) {
        if (RAW_KEYS.has(k)) continue; // drop raw
        out[k] = walk(val);
      }
      return out;
    }
    return v;
  };
  return walk(payload);
}

async function loadSettings(supabase: any, keys: string[]) {
  const { data } = await supabase.from("store_settings").select("key,value").in("key", keys);
  const map: Record<string, string> = {};
  for (const r of data || []) map[r.key] = r.value ?? "";
  return map;
}

async function upsertConversion(
  supabase: any,
  row: {
    order_id: string;
    channel: string;
    stage: string;
    event_id: string;
    event_name: string;
    status: string;
    request_payload: any;
    response_body?: any;
    error?: string | null;
  },
) {
  const now = new Date().toISOString();
  try {
    // Try to increment attempt count on existing row
    const { data: existing } = await supabase
      .from("conversions_sent")
      .select("id, attempt_count")
      .eq("order_id", row.order_id)
      .eq("channel", row.channel)
      .eq("stage", row.stage)
      .maybeSingle();

    const base = {
      order_id: row.order_id,
      channel: row.channel,
      stage: row.stage,
      event_id: row.event_id,
      event_name: row.event_name,
      status: row.status,
      request_payload: row.request_payload,
      response_body: row.response_body ?? null,
      error: row.error ?? null,
      sent_at: row.status === "success" ? now : null,
    };

    if (existing?.id) {
      await supabase
        .from("conversions_sent")
        .update({ ...base, attempt_count: (existing.attempt_count || 0) + 1 })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("conversions_sent")
        .insert({ ...base, attempt_count: 1 });
    }
  } catch (e) {
    console.error("upsertConversion failed", e);
  }
}

// ---- Meta CAPI ------------------------------------------------------------
async function sendMetaCapi(cfg: {
  pixelId: string;
  accessToken: string;
  testEventCode?: string;
  eventName: string;
  eventId: string;
  eventSourceUrl?: string;
  raw: { em?: string; ph?: string; fn?: string; ln?: string };
  clientIp?: string;
  userAgent?: string;
  fbp?: string;
  fbc?: string;
  customData: any;
}): Promise<{ result: ChannelResult; payloadForLog: any }> {
  const user_data: Record<string, any> = {};
  if (cfg.raw.em) user_data.em = [await sha256Hex(cfg.raw.em)];
  if (cfg.raw.ph) user_data.ph = [await sha256Hex(normPhone(cfg.raw.ph))];
  if (cfg.raw.fn) user_data.fn = [await sha256Hex(cfg.raw.fn)];
  if (cfg.raw.ln) user_data.ln = [await sha256Hex(cfg.raw.ln)];
  if (cfg.clientIp) user_data.client_ip_address = cfg.clientIp;
  if (cfg.userAgent) user_data.client_user_agent = cfg.userAgent;
  if (cfg.fbp) user_data.fbp = cfg.fbp;
  if (cfg.fbc) user_data.fbc = cfg.fbc;

  const eventPayload: any = {
    event_name: cfg.eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: cfg.eventId,
    action_source: "website",
    user_data,
    custom_data: cfg.customData,
  };
  if (cfg.eventSourceUrl) eventPayload.event_source_url = cfg.eventSourceUrl;

  const body: any = { data: [eventPayload] };
  if (cfg.testEventCode) body.test_event_code = cfg.testEventCode;

  const url = `https://graph.facebook.com/v21.0/${cfg.pixelId}/events?access_token=${cfg.accessToken}`;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    return {
      result: { ok: r.ok, status: r.status, body: j, error: r.ok ? undefined : JSON.stringify(j).slice(0, 500) },
      payloadForLog: redactForLog({ ...eventPayload, user_data }),
    };
  } catch (e) {
    return {
      result: { ok: false, error: String(e).slice(0, 500) },
      payloadForLog: redactForLog(eventPayload),
    };
  }
}

// ---- GA4 Measurement Protocol --------------------------------------------
async function sendGA4(cfg: {
  measurementId: string;
  apiSecret: string;
  clientId: string;
  sessionId?: string;
  eventName: string;
  eventId: string;
  params: any;
  userData?: { sha256_email?: string; sha256_phone_number?: string };
}): Promise<{ result: ChannelResult; payloadForLog: any }> {
  const params: any = {
    ...cfg.params,
    // GA4 dedup key — must match browser purchase transaction_id
    transaction_id: cfg.params?.transaction_id ?? cfg.eventId,
  };
  if (cfg.sessionId) params.session_id = cfg.sessionId;
  // engagement_time_msec is required for the session to count.
  params.engagement_time_msec = 100;

  const body = {
    client_id: cfg.clientId,
    ...(cfg.userData ? { user_data: cfg.userData } : {}),
    events: [{ name: cfg.eventName, params }],
  };

  const url =
    `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(cfg.measurementId)}` +
    `&api_secret=${encodeURIComponent(cfg.apiSecret)}`;

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return {
      result: { ok: r.ok, status: r.status, body: r.ok ? { ok: true } : await r.text().catch(() => "") },
      payloadForLog: redactForLog(body),
    };
  } catch (e) {
    return { result: { ok: false, error: String(e).slice(0, 500) }, payloadForLog: redactForLog(body) };
  }
}

// ---- Google Ads (server stub) --------------------------------------------
// Real Google Ads offline/enhanced-conversion upload requires an OAuth
// refresh token + developer token + customer ID. We record intent + hashed
// payload so the future "offline uploader" can replay it once credentials
// are configured. If a Google Ads webhook URL is provided in store_settings
// we forward the hashed payload to it.
async function sendGoogleAds(cfg: {
  conversionId: string;
  conversionLabel: string;
  webhookUrl?: string;
  eventId: string;
  value: number;
  currency: string;
  orderId: string;
  raw: { em?: string; ph?: string };
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
}): Promise<{ result: ChannelResult; payloadForLog: any }> {
  const hashed_email = cfg.raw.em ? await sha256Hex(cfg.raw.em) : undefined;
  const hashed_phone = cfg.raw.ph ? await sha256Hex(normPhone(cfg.raw.ph)) : undefined;

  const payload = {
    conversion_action: `AW-${cfg.conversionId}/${cfg.conversionLabel}`,
    conversion_id: cfg.eventId,
    order_id: cfg.orderId,
    value: cfg.value,
    currency_code: cfg.currency,
    ...(cfg.gclid ? { gclid: cfg.gclid } : {}),
    ...(cfg.gbraid ? { gbraid: cfg.gbraid } : {}),
    ...(cfg.wbraid ? { wbraid: cfg.wbraid } : {}),
    user_identifiers: [
      ...(hashed_email ? [{ hashed_email }] : []),
      ...(hashed_phone ? [{ hashed_phone_number: hashed_phone }] : []),
    ],
  };

  if (!cfg.webhookUrl) {
    // No transport configured yet — record as pending for offline replay.
    return {
      result: { ok: false, error: "no_transport_configured" },
      payloadForLog: payload,
    };
  }

  try {
    const r = await fetch(cfg.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return {
      result: { ok: r.ok, status: r.status, body: r.ok ? { ok: true } : await r.text().catch(() => "") },
      payloadForLog: payload,
    };
  } catch (e) {
    return { result: { ok: false, error: String(e).slice(0, 500) }, payloadForLog: payload };
  }
}

// ---- Handler --------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const orderId: string | undefined = body?.order_id;
    const stage: string = body?.stage || "purchase";
    if (!orderId) {
      return new Response(JSON.stringify({ error: "order_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    // Load order + items
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select(
        "id, order_number, total, subtotal, delivery_charge, customer_name, customer_phone, customer_email, customer_address, ga_client_id, ga_session_id, fbp, fbc, gclid, gbraid, wbraid, client_ip, user_agent, event_source_url, consent_snapshot",
      )
      .eq("id", orderId)
      .maybeSingle();
    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "order_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: items } = await supabase
      .from("order_items")
      .select("product_id, product_name, price, quantity")
      .eq("order_id", orderId);

    // Load tracking settings
    const s = await loadSettings(supabase, [
      "facebook_pixel_id",
      "meta_capi_access_token",
      "meta_test_event_code",
      "meta_capi_enabled",
      "ga4_measurement_id",
      "ga4_api_secret",
      "google_ads_accounts",
      "google_ads_webhook_url",
      "store_currency",
    ]);
    const currency = s.store_currency || "BDT";

    const consent = (order.consent_snapshot as any) || {};
    const analyticsAllowed = consent.analytics_storage !== "denied";
    const adAllowed = consent.ad_storage !== "denied";

    const eventName = stage === "purchase" ? "Purchase" : `Order${stage.charAt(0).toUpperCase()}${stage.slice(1)}`;
    const ga4EventName = stage === "purchase" ? "purchase" : `order_${stage}`;
    const eventIdBase = `${stage}_${order.order_number || orderId}`;

    const value = Number(order.total) || 0;
    const contents = (items || []).map((it: any) => ({
      id: it.product_id,
      quantity: it.quantity,
      item_price: Number(it.price) || 0,
    }));
    const content_ids = (items || []).map((it: any) => it.product_id).filter(Boolean);
    const ga4Items = (items || []).map((it: any, i: number) => ({
      item_id: it.product_id,
      item_name: it.product_name,
      price: Number(it.price) || 0,
      quantity: Number(it.quantity) || 1,
      index: i,
    }));

    const results: Record<string, ChannelResult> = {};

    // 1. Meta CAPI ------------------------------------------------------------
    if (adAllowed && s.meta_capi_enabled === "true" && s.facebook_pixel_id && s.meta_capi_access_token) {
      const eventId = eventIdBase; // matches browser `purchase_${orderNumber}`
      const custom_data: any = {
        currency,
        value,
        content_ids,
        contents,
        content_type: "product",
        num_items: contents.length,
        order_id: order.order_number,
      };
      const nameParts = (order.customer_name || "").trim().split(/\s+/);
      const { result, payloadForLog } = await sendMetaCapi({
        pixelId: s.facebook_pixel_id,
        accessToken: s.meta_capi_access_token,
        testEventCode: s.meta_test_event_code || undefined,
        eventName,
        eventId,
        eventSourceUrl: order.event_source_url || undefined,
        raw: {
          em: order.customer_email || undefined,
          ph: order.customer_phone || undefined,
          fn: nameParts[0] || undefined,
          ln: nameParts.slice(1).join(" ") || undefined,
        },
        clientIp: order.client_ip || undefined,
        userAgent: order.user_agent || undefined,
        fbp: order.fbp || undefined,
        fbc: order.fbc || undefined,
        customData: custom_data,
      });
      results.meta = result;
      await upsertConversion(supabase, {
        order_id: orderId,
        channel: "meta",
        stage,
        event_id: eventId,
        event_name: eventName,
        status: result.ok ? "success" : "failed",
        request_payload: payloadForLog,
        response_body: result.body ?? null,
        error: result.ok ? null : (result.error || "unknown"),
      });
    }

    // 2. GA4 Measurement Protocol --------------------------------------------
    if (analyticsAllowed && s.ga4_measurement_id && s.ga4_api_secret && order.ga_client_id) {
      const eventId = eventIdBase;
      const params: any = {
        currency,
        value,
        transaction_id: order.order_number,
        shipping: Number(order.delivery_charge) || 0,
        items: ga4Items,
      };
      const userData: any = {};
      if (order.customer_email) userData.sha256_email = await sha256Hex(order.customer_email);
      if (order.customer_phone) userData.sha256_phone_number = await sha256Hex(normPhone(order.customer_phone));

      const { result, payloadForLog } = await sendGA4({
        measurementId: s.ga4_measurement_id,
        apiSecret: s.ga4_api_secret,
        clientId: order.ga_client_id,
        sessionId: order.ga_session_id || undefined,
        eventName: ga4EventName,
        eventId,
        params,
        userData: Object.keys(userData).length ? userData : undefined,
      });
      results.ga4 = result;
      await upsertConversion(supabase, {
        order_id: orderId,
        channel: "ga4",
        stage,
        event_id: eventId,
        event_name: ga4EventName,
        status: result.ok ? "success" : "failed",
        request_payload: payloadForLog,
        response_body: result.body ?? null,
        error: result.ok ? null : (result.error || "unknown"),
      });
    }

    // 3. Google Ads — one attempt per configured account -----------------------
    // Purchase-only: this submits a "Purchase" conversion action, so firing it
    // again for confirmed/cancelled/etc. would misrepresent conversion counts.
    // Confirm/cancel signals for Google Ads need the Conversion Adjustments API
    // (retract/restate) — a separate integration requiring OAuth + developer
    // token, not yet wired up.
    if (adAllowed && stage === "purchase") {
      const accounts = parseGoogleAdsAccounts(s.google_ads_accounts);
      for (const acc of accounts) {
        const eventId = eventIdBase;
        const { result, payloadForLog } = await sendGoogleAds({
          conversionId: acc.id,
          conversionLabel: acc.label,
          webhookUrl: s.google_ads_webhook_url || undefined,
          eventId,
          value,
          currency,
          orderId: order.order_number || orderId,
          raw: {
            em: order.customer_email || undefined,
            ph: order.customer_phone || undefined,
          },
          gclid: order.gclid || undefined,
          gbraid: order.gbraid || undefined,
          wbraid: order.wbraid || undefined,
        });
        results[`google_ads:${acc.id}`] = result;
        await upsertConversion(supabase, {
          order_id: orderId,
          // Disambiguated per account so multiple Google Ads accounts don't
          // overwrite each other's row (conversions_sent is unique on
          // order_id+channel+stage).
          channel: `google_ads:${acc.id}`,
          stage,
          event_id: eventId,
          event_name: eventName,
          status: result.ok ? "success" : (result.error === "no_transport_configured" ? "pending" : "failed"),
          request_payload: payloadForLog,
          response_body: result.body ?? null,
          error: result.ok ? null : (result.error || "unknown"),
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("track-conversion error", e);
    return new Response(JSON.stringify({ error: "internal" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
