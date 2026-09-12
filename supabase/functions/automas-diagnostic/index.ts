// Automas provider-level diagnostic.
// Runs three controlled tests (A: plain, B: + google url, C: + branded short-link)
// against the live Automas API and returns full request/response details for
// side-by-side comparison with Order Confirmation / Test SMS / Campaign payloads.
//
// Usage:
//   POST { phone: "017XXXXXXXX", senderId?: "ShadamonShop",
//          extraPayloads?: [{ label, message }] }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { normalizeBdPhone, isValidBdMobile, detectSmsMeta, getProvider } from "../_shared/smsProviders.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type DiagResult = {
  label: string;
  message: string;
  request: {
    url: string;
    method: "POST" | "GET";
    headers: Record<string, string>;
    payload_masked: Record<string, unknown>;
    sender_id: string;
    phone_normalized: string;
    phone_local: string;
    msg_length: number;
    sms_parts: number;
    is_unicode: boolean;
    has_bangla: boolean;
    contains_url: boolean;
  };
  response: {
    http_status: number;
    http_ok: boolean;
    headers: Record<string, string>;
    raw_body: string;
    parsed: unknown;
    timing_ms: {
      connect_and_ttfb: number; // DNS + TCP + TLS + request + first byte (Deno fetch can't split these)
      response_read: number;
      total: number;
    };
  };
  outcome: { success: boolean; status_code?: string; message_id?: string; note?: string; result: "PASS" | "FAIL" };
};

async function runOne(url: string, apiKey: string, senderId: string, phoneFull: string, message: string, label: string): Promise<DiagResult> {
  const local = phoneFull.startsWith("88") ? phoneFull.slice(2) : phoneFull;
  const payload: Record<string, unknown> = {
    api_key: apiKey,
    senderid: senderId,
    type: "text",
    scheduledDateTime: "",
    msg: message,
    contacts: local,
  };
  const meta = detectSmsMeta(message);
  if (meta.isUnicode) payload.smsformat = "8";
  const reqHeaders = { "Content-Type": "application/json" };
  const t0 = performance.now();
  const res = await fetch(url, { method: "POST", headers: reqHeaders, body: JSON.stringify(payload) });
  const t1 = performance.now();
  const raw = await res.text();
  const t2 = performance.now();
  let parsed: any = null;
  try { parsed = JSON.parse(raw); } catch {}
  const respHeaders: Record<string, string> = {};
  res.headers.forEach((v, k) => { respHeaders[k] = v; });
  const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.response) ? parsed.response : null);
  const first = arr && arr.length > 0 ? arr[0] : null;
  const statusCode = first?.status != null ? String(first.status) : undefined;
  const success = statusCode === "0";
  const outcome = {
    success,
    status_code: statusCode,
    message_id: first?.id != null ? String(first.id) : undefined,
    note: !first
      ? (Array.isArray(parsed) && parsed.length === 0
          ? "EMPTY ARRAY — provider silently rejected (rate-limit / sender throttle / blocked content)"
          : "No response item returned")
      : undefined,
    result: (success ? "PASS" : "FAIL") as "PASS" | "FAIL",
  };
  return {
    label,
    message,
    request: {
      url, method: "POST", headers: reqHeaders,
      payload_masked: { ...payload, api_key: "***MASKED***" },
      sender_id: senderId,
      phone_normalized: phoneFull,
      phone_local: local,
      msg_length: meta.length,
      sms_parts: meta.parts,
      is_unicode: meta.isUnicode,
      has_bangla: meta.hasBangla,
      contains_url: /\b((?:https?:\/\/|www\.)[^\s<>'"]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>'"]*)?)/i.test(message),
    },
    response: {
      http_status: res.status, http_ok: res.ok, headers: respHeaders, raw_body: raw, parsed,
      timing_ms: {
        connect_and_ttfb: Math.round(t1 - t0),
        response_read: Math.round(t2 - t1),
        total: Math.round(t2 - t0),
      },
    },
    outcome,
  };
}

function unicodeGetUrl(apiUrl: string) {
  try {
    const u = new URL(apiUrl || "https://api.automas.com.bd/smsapiv4");
    u.pathname = "/smsapiv3";
    u.search = "";
    return u;
  } catch {
    return new URL("https://api.automas.com.bd/smsapiv3");
  }
}

function manyUrl(apiUrl: string) {
  try {
    const u = new URL(apiUrl || "https://api.automas.com.bd/smsapiv4");
    u.pathname = "/smsapimany";
    u.search = "";
    return u.toString();
  } catch {
    return "https://api.automas.com.bd/smsapimany";
  }
}

async function runOneMany(apiUrl: string, apiKey: string, senderId: string, phoneFull: string, message: string, label: string): Promise<DiagResult> {
  const local = phoneFull.startsWith("88") ? phoneFull.slice(2) : phoneFull;
  const meta = detectSmsMeta(message);
  const url = manyUrl(apiUrl);
  const payload: Record<string, unknown> = {
    apikey: apiKey,
    sender: senderId,
    messages: [{ id: 1, msisdn: local, smstext: message }],
  };
  if (meta.isUnicode) payload.smsformat = "8";
  const reqHeaders = { "Content-Type": "application/json" };
  const t0 = performance.now();
  const res = await fetch(url, { method: "POST", headers: reqHeaders, body: JSON.stringify(payload) });
  const t1 = performance.now();
  const raw = await res.text();
  const t2 = performance.now();
  let parsed: any = null;
  try { parsed = JSON.parse(raw); } catch {}
  const respHeaders: Record<string, string> = {};
  res.headers.forEach((v, k) => { respHeaders[k] = v; });
  const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.response) ? parsed.response : null);
  const first = arr && arr.length > 0 ? arr[0] : null;
  const statusCode = first?.status != null ? String(first.status) : undefined;
  const success = statusCode === "0";
  return {
    label,
    message,
    request: {
      url, method: "POST", headers: reqHeaders,
      payload_masked: { ...payload, apikey: "***MASKED***" },
      sender_id: senderId,
      phone_normalized: phoneFull,
      phone_local: local,
      msg_length: meta.length,
      sms_parts: meta.parts,
      is_unicode: meta.isUnicode,
      has_bangla: meta.hasBangla,
      contains_url: /\b((?:https?:\/\/|www\.)[^\s<>'"]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>'"]*)?)/i.test(message),
    },
    response: {
      http_status: res.status, http_ok: res.ok, headers: respHeaders, raw_body: raw, parsed,
      timing_ms: {
        connect_and_ttfb: Math.round(t1 - t0),
        response_read: Math.round(t2 - t1),
        total: Math.round(t2 - t0),
      },
    },
    outcome: {
      success,
      status_code: statusCode,
      message_id: first?.sid != null ? String(first.sid) : first?.id != null ? String(first.id) : undefined,
      note: !first ? "No response item returned" : undefined,
      result: (success ? "PASS" : "FAIL") as "PASS" | "FAIL",
    },
  };
}

async function runOneGet(apiUrl: string, apiKey: string, senderId: string, phoneFull: string, message: string, label: string): Promise<DiagResult> {
  const local = phoneFull.startsWith("88") ? phoneFull.slice(2) : phoneFull;
  const meta = detectSmsMeta(message);
  const url = unicodeGetUrl(apiUrl);
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("sender", senderId);
  url.searchParams.set("msisdn", local);
  url.searchParams.set("smstext", message);
  if (meta.isUnicode) url.searchParams.set("smsformat", "8");

  const maskedUrl = new URL(url.toString());
  maskedUrl.searchParams.set("apikey", "***MASKED***");
  const t0 = performance.now();
  const res = await fetch(url.toString(), { method: "GET" });
  const t1 = performance.now();
  const raw = await res.text();
  const t2 = performance.now();
  let parsed: any = null;
  try { parsed = JSON.parse(raw); } catch {}
  const respHeaders: Record<string, string> = {};
  res.headers.forEach((v, k) => { respHeaders[k] = v; });
  const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.response) ? parsed.response : null);
  const first = arr && arr.length > 0 ? arr[0] : null;
  const statusCode = first?.status != null ? String(first.status) : undefined;
  const success = statusCode === "0";
  return {
    label,
    message,
    request: {
      url: maskedUrl.toString(), method: "GET", headers: {},
      payload_masked: { url: maskedUrl.toString() },
      sender_id: senderId,
      phone_normalized: phoneFull,
      phone_local: local,
      msg_length: meta.length,
      sms_parts: meta.parts,
      is_unicode: meta.isUnicode,
      has_bangla: meta.hasBangla,
      contains_url: /\b((?:https?:\/\/|www\.)[^\s<>'"]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>'"]*)?)/i.test(message),
    },
    response: {
      http_status: res.status, http_ok: res.ok, headers: respHeaders, raw_body: raw, parsed,
      timing_ms: {
        connect_and_ttfb: Math.round(t1 - t0),
        response_read: Math.round(t2 - t1),
        total: Math.round(t2 - t0),
      },
    },
    outcome: {
      success,
      status_code: statusCode,
      message_id: first?.id != null ? String(first.id) : first?.sid != null ? String(first.sid) : undefined,
      note: !first ? "No response item returned" : undefined,
      result: (success ? "PASS" : "FAIL") as "PASS" | "FAIL",
    },
  };
}

function diff(results: DiagResult[]) {
  const fields = ["sender_id", "phone_local", "msg_length", "sms_parts", "is_unicode", "has_bangla", "contains_url"] as const;
  const out: Record<string, Record<string, unknown>> = {};
  for (const f of fields) {
    const row: Record<string, unknown> = {};
    for (const r of results) row[r.label] = (r.request as any)[f];
    const values = Object.values(row);
    const allEqual = values.every((v) => JSON.stringify(v) === JSON.stringify(values[0]));
    out[f] = { ...row, _differs: !allEqual };
  }
  // message body is always different — list it explicitly
  const msgRow: Record<string, unknown> = {};
  for (const r of results) msgRow[r.label] = r.message;
  out.message = { ...msgRow, _differs: true };
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  return new Response(JSON.stringify({
    success: false,
    disabled: true,
    error: "Automas diagnostic sending is disabled. Only order confirmation SMS is allowed.",
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  try {
    const body = await req.json().catch(() => ({}));
    const phoneInput: string = body.phone || "01700000000";
    const phone = normalizeBdPhone(phoneInput);
    if (!isValidBdMobile(phone)) {
      return new Response(JSON.stringify({ error: `Invalid BD mobile: ${phone}` }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const row = await getProvider(supabase, "automas");
    if (!row || !row.api_key) {
      return new Response(JSON.stringify({ error: "Automas provider not configured (api_key missing)" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const url = row.api_url || "https://api.automas.com.bd/smsapiv4";
    const senderId = (body.senderId as string) || row.sender_id || "";

    // Default 4-test suite covering plain/url × short/long-multipart
    const longBody =
      "Shorno Suta — long multipart diagnostic message. " +
      "This text is intentionally extended past 160 GSM-7 characters so the provider " +
      "must concatenate it into multiple SMS parts. Verifying multipart delivery behavior now.";
    const defaultTests: { label: string; message: string }[] = [
      { label: "1_plain", message: "Shadamon test 1: plain text only." },
      { label: "2_plain_url", message: "Shadamon test 2: visit https://www.shornosuta.com" },
      { label: "3_long_multipart", message: longBody },
      { label: "4_long_multipart_url", message: longBody + " More info: https://www.shornosuta.com/s/test123" },
    ];
    const tests = Array.isArray(body.tests) && body.tests.length
      ? body.tests.filter((t: any) => t?.label && typeof t.message === "string")
      : defaultTests;
    if (Array.isArray(body.extraPayloads)) {
      for (const e of body.extraPayloads) {
        if (e?.label && typeof e.message === "string") tests.push({ label: e.label, message: e.message });
      }
    }

    const testMode: boolean = body.testMode === true;
    const results: DiagResult[] = [];
    for (const t of tests) {
      if (testMode) {
        // Test Mode: build payload + meta but do NOT send. Useful to inspect what would be sent.
        const meta = detectSmsMeta(t.message);
        const local = phone.slice(2);
        const payload: Record<string, unknown> = { api_key: "***MASKED***", senderid: senderId, type: "text", scheduledDateTime: "", msg: t.message, contacts: local };
        if (meta.isUnicode) payload.smsformat = "8";
        results.push({
          label: t.label, message: t.message,
          request: {
            url, method: "POST", headers: { "Content-Type": "application/json" },
            payload_masked: payload,
            sender_id: senderId, phone_normalized: phone, phone_local: local,
            msg_length: meta.length, sms_parts: meta.parts, is_unicode: meta.isUnicode, has_bangla: meta.hasBangla,
            contains_url: /\b((?:https?:\/\/|www\.)[^\s<>'"]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>'"]*)?)/i.test(t.message),
          },
          response: { http_status: 0, http_ok: false, headers: {}, raw_body: "[test mode — not sent]", parsed: null,
            timing_ms: { connect_and_ttfb: 0, response_read: 0, total: 0 } },
          outcome: { success: false, note: "test mode (dry-run)", result: "FAIL" },
        });
        continue;
      }
      try {
        const method = (t as any).method || body.method;
        results.push(method === "GET"
          ? await runOneGet(url, row.api_key, senderId, phone, t.message, t.label)
          : method === "MANY"
            ? await runOneMany(url, row.api_key, senderId, phone, t.message, t.label)
            : await runOne(url, row.api_key, senderId, phone, t.message, t.label));
      } catch (e) {
        results.push({
          label: t.label, message: t.message,
          request: { url, method: "POST", headers: { "Content-Type": "application/json" },
            payload_masked: { api_key: "***MASKED***", senderid: senderId, contacts: phone.slice(2), msg: t.message, type: "text" },
            sender_id: senderId, phone_normalized: phone, phone_local: phone.slice(2),
            msg_length: t.message.length, sms_parts: 1, is_unicode: false, has_bangla: false, contains_url: /https?:\/\//i.test(t.message) },
          response: { http_status: 0, http_ok: false, headers: {}, raw_body: String(e), parsed: null,
            timing_ms: { connect_and_ttfb: 0, response_read: 0, total: 0 } },
          outcome: { success: false, note: `fetch threw: ${String(e)}`, result: "FAIL" },
        });
      }
      // small gap to avoid burst-rejection while diagnosing
      await new Promise((r) => setTimeout(r, 600));
    }

    const comparison = diff(results);
    const summary = results.map((r) => ({
      label: r.label,
      success: r.outcome.success,
      status_code: r.outcome.status_code,
      note: r.outcome.note,
      raw: r.response.raw_body.slice(0, 200),
    }));

    return new Response(
      JSON.stringify({ phone_normalized: phone, sender_id: senderId, url, summary, comparison, results }, null, 2),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
