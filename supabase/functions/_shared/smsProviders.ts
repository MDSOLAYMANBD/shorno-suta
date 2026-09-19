// Centralized SMS provider dispatcher. All edge functions that send SMS go through `sendSmsViaActiveProvider`.
// Adding a new provider = add a new case here + insert a row into public.sms_providers.

export type SmsResult = {
  success: boolean;
  error?: string;
  provider?: string;
  message_id?: string;
  sent_message?: string;
  provider_response?: unknown;
};

export type SmsSendPurpose = "order_confirmation" | "payment_confirmation" | "delivery_thankyou" | "party_ledger" | "admin_manual";

export type SmsSendOptions = {
  purpose?: SmsSendPurpose;
};

const ALLOWED_SMS_PURPOSES: SmsSendPurpose[] = ["order_confirmation", "payment_confirmation", "delivery_thankyou", "party_ledger", "admin_manual"];
const ORDER_CONFIRMATION_PATTERN = /(?:অর্ডার|Order)\s*:\s*SD-\d+/i;
// The post-delivery thank-you/reorder SMS carries no order number by design
// (it's a relationship-building nudge, not a transactional receipt) — the
// site link is what proves it's the real template and not arbitrary text.
// TODO: swap to the real domain once one is set (currently the Vercel placeholder).
const DELIVERY_THANKYOU_PATTERN = /shorno-suta\.vercel\.app/i;
// Accounting party/loan ledger SMS (payment-received notices, work/memo
// account summaries) — narrow, deliberately separate from the general
// "disabled" campaign/manual-send restriction below. Every template these
// callers use signs off with the store name, which doubles as the content
// check; an admin editing the preview text in the SMS dialog must keep it.
const PARTY_LEDGER_PATTERN = /স্বর্ণ\s*সুতা/i;

function assertSmsSendAllowed(message: string, options?: SmsSendOptions): SmsResult | null {
  // Emergency spend guard: the business rule is strict — provider calls may
  // only happen for real order/payment confirmation, post-delivery
  // thank-you, or party/loan ledger SMS, and only for the explicitly allowed
  // purposes below. Campaign/manual/OTP/diagnostic paths can still call this
  // shared helper, but they must never reach Automas.
  // payment_confirmation is additionally gated by an admin toggle
  // (store_settings.payment_sms_confirmation_enabled, default off) at the
  // caller (send-order-notification) before it ever reaches this guard.
  if (!options?.purpose || !ALLOWED_SMS_PURPOSES.includes(options.purpose)) {
    return {
      success: false,
      error: "SMS sending is disabled except for order/payment confirmation SMS.",
    };
  }

  // admin_manual is free-form text by definition (the whole point of a manual
  // send) and is already gated by admin login one layer up, not a fixed
  // template — no content pattern to enforce here.
  if (options.purpose === "admin_manual") return null;

  const pattern = options.purpose === "delivery_thankyou" ? DELIVERY_THANKYOU_PATTERN
    : options.purpose === "party_ledger" ? PARTY_LEDGER_PATTERN
    : ORDER_CONFIRMATION_PATTERN;
  if (!pattern.test(message || "")) {
    return {
      success: false,
      error: "Blocked non-order-confirmation SMS content.",
    };
  }

  return null;
}

export type ProviderRow = {
  provider_name: string;
  api_url: string | null;
  api_key: string | null;
  sender_id: string | null;
  username: string | null;
  password: string | null;
  is_active: boolean;
};

// Normalize to 8801XXXXXXXXX (13 digits)
export function normalizeBdPhone(phone: string): string {
  let p = (phone || "").replace(/[\s-]/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  if (p.startsWith("88")) {
    const local = p.slice(2);
    p = local.startsWith("0") ? "88" + local : "880" + local;
  } else if (p.startsWith("0")) {
    p = "88" + p;
  } else {
    p = "880" + p;
  }
  return p;
}

export function isValidBdMobile(full: string) {
  return /^8801[3-9]\d{8}$/.test(full);
}

// ─── MimSMS ─────────────────────────────────────────────────────────────────
async function sendViaMimSms(
  fullPhone: string,
  message: string,
  cfg: { username: string; apiKey: string; senderId: string }
): Promise<SmsResult> {
  if (!cfg.username || !cfg.apiKey) {
    return { success: false, provider: "mimsms", error: "MimSMS credentials not configured." };
  }
  try {
    const res = await fetch("https://api.mimsms.com/api/SmsSending/SMS", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        UserName: cfg.username,
        Apikey: cfg.apiKey,
        MobileNumber: fullPhone,
        Message: message,
        SenderName: cfg.senderId,
        TransactionType: "T",
      }),
    });
    const text = await res.text();
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch {}
    if (!res.ok) {
      return { success: false, provider: "mimsms", error: `HTTP ${res.status}`, provider_response: parsed || text };
    }
    const sc = String(parsed?.statusCode ?? "").toLowerCase();
    const stat = String(parsed?.status ?? "").toLowerCase();
    const rr = String(parsed?.responseResult ?? "").toLowerCase();
    const failHints = ["fail", "error", "invalid", "insufficient", "blocked", "reject"];
    const hasFail = failHints.some((k) => rr.includes(k) || stat.includes(k));
    const ok = (sc === "200" || sc === "success" || stat === "success") && !hasFail;
    return {
      success: ok,
      provider: "mimsms",
      error: ok ? undefined : (parsed?.responseResult || parsed?.status || "Provider error"),
      provider_response: parsed || text,
    };
  } catch (e) {
    return { success: false, provider: "mimsms", error: String(e) };
  }
}

async function checkMimSmsBalance(cfg: { username: string; apiKey: string }) {
  if (!cfg.username || !cfg.apiKey) return { balance: null as null | string, error: "MimSMS credentials not configured" };
  try {
    const res = await fetch("https://api.mimsms.com/api/SmsSending/balanceCheck", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ UserName: cfg.username, Apikey: cfg.apiKey }),
    });
    const data = await res.json().catch(() => null) as any;
    const balance = data?.responseResult ?? data?.data?.balance ?? null;
    return { balance: balance != null ? String(balance) : null };
  } catch (e) {
    return { balance: null, error: String(e) };
  }
}

// ─── Automas ────────────────────────────────────────────────────────────────
const AUTOMAS_ERRORS: Record<string, string> = {
  "0": "Success",
  "101": "Invalid message length",
  "102": "Sender ID not valid",
  "103": "Authentication failed",
  "104": "Invalid user",
  "105": "Invalid number",
  "106": "Invalid API key",
  "107": "Account suspended",
  "108": "IP not allowed",
  "109": "API access not allowed",
  "110": "DND number",
  "111": "Spam word detected",
  "1000": "Insufficient balance",
  "2300": "Route issue",
  "2400": "Route not permitted",
  "3300": "System error",
};
function automasErrorMessage(code: any) {
  const k = String(code ?? "");
  if (k === "111") {
    return "Automas rejected this exact SMS as spam content. The message was not changed or resent.";
  }
  if (k === "3300") {
    return "Automas rejected this exact Unicode/emoji SMS with a provider system error. The message was not changed or resent.";
  }
  return AUTOMAS_ERRORS[k] || `Automas error code ${k || "unknown"}`;
}

export function detectSmsMeta(msg: string) {
  const isUnicode = /[^\u0000-\u007F]/.test(msg);
  const len = msg.length;
  const perPart = isUnicode ? (len > 70 ? 67 : 70) : (len > 160 ? 153 : 160);
  const parts = Math.max(1, Math.ceil(len / perPart));
  const hasBangla = /[\u0980-\u09FF]/.test(msg);
  return { isUnicode, hasBangla, length: len, parts };
}

function normalizeAutomasMessage(message: string) {
  // Preserve the merchant-authored SMS exactly. Campaign SMS may contain Bangla,
  // English, emoji, coupon codes, percentages, and links; the only frontend-side
  // change allowed is URL shortening before this function is called.
  return String(message ?? "");
}

function makeAutomasSymbolSafeMessage(message: string) {
  return (message || "")
    // Automas accepts normal Bangla/Unicode text, but its route returns 3300
    // for several non-BMP emoji such as 🎁. Keep the meaning instead of
    // stripping campaign text, coupon codes, Bangla digits, or percent signs.
    .replace(/🎁/g, "উপহার");
}

function makeAutomasCouponSafeCode(code: string) {
  // Automas blocks the ASCII token VIP when it appears beside campaign links.
  // Keep the code readable and copyable, but break only the blocked token.
  return String(code || "")
    .replace(/VIP(?=\d|\b)/giu, "V-P")
    .trim();
}

function makeAutomasSpamSafeMessage(message: string) {
  return makeAutomasSymbolSafeMessage(message || "")
    // The Automas campaign route silently rejects `%` when the message also has
    // a link (HTTP 200 + []), and returns 111 for VIP-style coupon words. Order
    // SMS can still contain emojis/Bangla; only provider-blocked ad tokens are
    // rewritten here, without splitting the customer's message into chunks.
    .replace(/\b([A-Za-z]{2,}\d[A-Za-z0-9]*)\b\s*(?:কুপনে|কুপন|coupon|code)?\s*([0-9\u06F0-\u06F9\u09E6-\u09EF]+)\s*%?\s*(?:ছাড়|discount|off)?/giu, (_m, code, percent) => `কোড ${makeAutomasCouponSafeCode(code)} ${percent}`)
    .replace(/\b([A-Za-z]{2,}\d[A-Za-z0-9]*)\b\s*(?:কুপনে|কুপন|coupon|code)\b/giu, (_m, code) => `কোড ${makeAutomasCouponSafeCode(code)}`)
    .replace(/\bVIP(?=\d)/giu, "V-P")
    .replace(/\bVIP\b/giu, "ভিআইপি")
    .replace(/\bOFF\b/giu, "কম")
    .replace(/\bDISCOUNT\b/giu, "কম")
    .replace(/কুপনে|কুপন/giu, "কোড")
    .replace(/ছাড়/giu, "কম")
    .replace(/([0-9\u06F0-\u06F9\u09E6-\u09EF]+)\s*%/gu, "$1")
    .replace(/%/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function stripSmsUrlProtocol(url: string) {
  return (url || "")
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "");
}

function formatAutomasUrls(message: string) {
  const urlRe = /\b((?:https?:\/\/|www\.)[^\s<>'"]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>'"]*)?)/giu;
  return (message || "").replace(urlRe, (match) => {
    const trailing = match.match(/[.,;!?)।]+$/u)?.[0] || "";
    const clean = trailing ? match.slice(0, -trailing.length) : match;
    return stripSmsUrlProtocol(clean) + trailing;
  });
}

function compactCampaignIntro(text: string) {
  return (text || "")
    .replace(/^প্রিয়\s+[^,\n]+,?\s*/iu, "")
    .replace(/স্বর্ণ\s+সুতায়\s+এসেছে\s*/giu, "")
    .replace(/প্রিমিয়াম\s+/giu, "")
    .replace(/পিওর\s+/giu, "")
    .replace(/সুতির/giu, "সুতি")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function takeGraphemes(text: string, maxLen: number) {
  if (maxLen <= 0) return "";
  const units = messageUnits(text);
  let out = "";
  for (const unit of units) {
    if (unitLength(out + unit) > maxLen) break;
    out += unit;
  }
  return out.replace(/[\s,.;।-]+$/u, "").trim();
}

function buildAutomasSingleMessageFallback(message: string) {
  let safe = makeAutomasSpamSafeMessage(formatAutomasUrls(message || ""))
    // Automas rejects the gift-box emoji with 3300 on the Unicode route.
    // Keep an emoji signal using the heart symbol that the route accepts.
    .replace(/🎁/g, "❤️")
    .replace(/\s*(?:ছাড়|discount|off)\s*/giu, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();

  const meta = detectSmsMeta(safe);
  const limit = meta.isUnicode ? 70 : 160;
  if (meta.length <= limit) return safe;

  const urlMatch = safe.match(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>'"]*)?/iu);
  if (!urlMatch) return takeGraphemes(safe, limit);

  const url = urlMatch[0];
  const urlIndex = urlMatch.index ?? 0;
  const beforeUrl = compactCampaignIntro(safe.slice(0, urlIndex));
  const afterUrl = safe.slice(urlIndex + url.length).trim();
  const promoMatch = afterUrl.match(/(?:❤️\s*)?(?:কোড\s*)?[A-Za-z0-9_-]+(?:\s*[0-9\u06F0-\u06F9\u09E6-\u09EF]+)?/iu);
  const promo = promoMatch?.[0]?.trim() || "";
  const required = [url, promo].filter(Boolean).join("\n");
  const requiredLen = unitLength(required);
  const availableIntro = limit - requiredLen - (beforeUrl ? 1 : 0);
  const intro = availableIntro > 6 ? takeGraphemes(beforeUrl, availableIntro) : "";
  safe = [intro, required].filter(Boolean).join("\n").trim();
  return unitLength(safe) <= limit ? safe : required;
}

async function tryAutomasMessage(
  url: string,
  cfg: { apiKey: string; senderId: string },
  local: string,
  message: string,
): Promise<AutomasSingleResult> {
  let result = await sendAutomasSingle(url, cfg, local, message);
  const meta = detectSmsMeta(message);
  if (
    !result.success &&
    meta.isUnicode &&
    (result.empty_response === true || result.status_code === "3300" || result.status_code === "111")
  ) {
    result = await automasUnicodeEncodedOnce(url, cfg, local, message);
  }
  return result;
}

function splitAutomasSpamSafeParts(message: string) {
  const safe = makeAutomasSpamSafeMessage(message);
  const urlRe = /(?:https?:\/\/|www\.)?[^\s/]+\.[^\s]+(?:\/[^\s]*)?/giu;
  const parts: string[] = [];
  let last = 0;
  for (const match of safe.matchAll(urlRe)) {
    const index = match.index ?? 0;
    const before = safe.slice(last, index).trim();
    if (before) parts.push(before);
    if (match[0]) parts.push(match[0].trim());
    last = index + match[0].length;
  }
  const after = safe.slice(last).trim();
  if (after) parts.push(after);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function messageUnits(msg: string) {
  try {
    const Segmenter = (Intl as any).Segmenter;
    if (Segmenter) {
      const segmenter = new Segmenter("bn", { granularity: "grapheme" });
      return Array.from(segmenter.segment(msg), (x: any) => String(x.segment));
    }
  } catch {}
  return [...msg];
}

function unitLength(msg: string) {
  return msg.length;
}

function hardSplitToken(token: string, maxLen: number) {
  const chunks: string[] = [];
  let current = "";
  for (const unit of messageUnits(token)) {
    if (current && unitLength(current + unit) > maxLen) {
      chunks.push(current);
      current = unit;
    } else {
      current += unit;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function splitAutomasMessage(message: string) {
  const meta = detectSmsMeta(message);
  // This Automas sender route silently rejects multipart payloads (HTTP 200 + []).
  // Send only single-part chunks per request so campaigns use the same safe shape
  // as working order-confirmation/test SMS.
  const maxLen = meta.isUnicode ? 70 : 160;
  if (meta.length <= maxLen) return [message];

  const chunks: string[] = [];
  let current = "";
  const tokens = message.match(/\S+\s*/g) || [message];

  for (const token of tokens) {
    if (unitLength(token) > maxLen) {
      if (current.trim()) chunks.push(current.trimEnd());
      current = "";
      chunks.push(...hardSplitToken(token, maxLen).map((x) => x.trim()).filter(Boolean));
      continue;
    }
    if (unitLength(current + token) > maxLen) {
      if (current.trim()) chunks.push(current.trimEnd());
      current = token;
    } else {
      current += token;
    }
  }
  if (current.trim()) chunks.push(current.trimEnd());
  return chunks.length ? chunks : [message];
}

async function automasOnce(
  url: string,
  payload: Record<string, unknown>,
  phoneSuffix: string
) {
  const t0 = Date.now();
  const reqHeaders = { "Content-Type": "application/json" };
  const res = await fetch(url, {
    method: "POST",
    headers: reqHeaders,
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  const tookMs = Date.now() - t0;
  let parsed: any = null;
  try { parsed = JSON.parse(text); } catch {}
  const respHeaders: Record<string, string> = {};
  res.headers.forEach((v, k) => { respHeaders[k] = v; });
  const msg = String(payload.msg ?? "");
  const meta = detectSmsMeta(msg);
  const maskedPayload = { ...payload, api_key: "***MASKED***" };
  const diag = {
    provider: "automas",
    url,
    method: "POST",
    http_status: res.status,
    http_ok: res.ok,
    request_headers: reqHeaders,
    request_payload: maskedPayload,
    sender_id: payload.senderid,
    phone_suffix: phoneSuffix,
    msg_length: meta.length,
    sms_parts: meta.parts,
    is_unicode: meta.isUnicode,
    has_bangla: meta.hasBangla,
    response_headers: respHeaders,
    raw_response: text,
    parsed_response: parsed,
    took_ms: tookMs,
  };
  console.log("[automas:diag]", JSON.stringify(diag));
  return { res, text, parsed, diag };
}

function automasUnicodeGetUrl(apiUrl: string) {
  try {
    const u = new URL(apiUrl || "https://api.automas.com.bd/smsapiv4");
    u.pathname = "/smsapiv3";
    u.search = "";
    return u;
  } catch {
    return new URL("https://api.automas.com.bd/smsapiv3");
  }
}

async function automasUnicodeEncodedOnce(
  apiUrl: string,
  cfg: { apiKey: string; senderId: string },
  local: string,
  message: string,
): Promise<AutomasSingleResult> {
  const url = automasUnicodeGetUrl(apiUrl);
  url.searchParams.set("apikey", cfg.apiKey);
  url.searchParams.set("sender", cfg.senderId);
  url.searchParams.set("msisdn", local);
  url.searchParams.set("smstext", message);
  url.searchParams.set("smsformat", "8");

  const t0 = Date.now();
  const res = await fetch(url.toString(), { method: "GET" });
  const text = await res.text();
  const tookMs = Date.now() - t0;
  let parsed: any = null;
  try { parsed = JSON.parse(text); } catch {}
  const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.response) ? parsed.response : null);
  const first = arr && arr.length > 0 ? arr[0] : null;
  const statusCode = String(first?.status ?? parsed?.status ?? "");
  const ok = res.ok && statusCode === "0";
  const maskedUrl = new URL(url.toString());
  maskedUrl.searchParams.set("apikey", "***MASKED***");
  console.log("[automas:unicode-get]", JSON.stringify({
    provider: "automas",
    url: maskedUrl.toString(),
    http_status: res.status,
    http_ok: res.ok,
    phone_suffix: local.slice(-4),
    msg_length: detectSmsMeta(message).length,
    raw_response: text,
    parsed_response: parsed,
    took_ms: tookMs,
  }));
  return {
    success: ok,
    provider: "automas",
    message_id: first?.id != null ? String(first.id) : first?.sid != null ? String(first.sid) : undefined,
    error: ok ? undefined : (first ? automasErrorMessage(statusCode) : "Provider returned empty response"),
    provider_response: parsed ?? text,
    status_code: statusCode,
    empty_response: res.ok && Array.isArray(parsed) && parsed.length === 0,
  };
}

function buildAutomasPayload(
  cfg: { apiKey: string; senderId: string },
  local: string,
  message: string,
) {
  const meta = detectSmsMeta(message);
  const payload: Record<string, unknown> = {
    api_key: cfg.apiKey,
    senderid: cfg.senderId,
    type: "text",
    scheduledDateTime: "",
    msg: message,
    contacts: local,
  };
  // Automas docs require smsformat=8 for Unicode/Bangla. Without this, long
  // campaign bodies can return provider status 3300 even though short order SMS works.
  if (meta.isUnicode) payload.smsformat = "8";
  return payload;
}

type AutomasSingleResult = SmsResult & { status_code?: string; empty_response?: boolean };

async function sendAutomasSingle(
  url: string,
  cfg: { apiKey: string; senderId: string },
  local: string,
  message: string,
): Promise<AutomasSingleResult> {
  const payload = buildAutomasPayload(cfg, local, message);
  const phoneSuffix = local.slice(-4);
  let attempt = await automasOnce(url, payload, phoneSuffix);
  // Automas occasionally returns HTTP 200 + empty `[]` under concurrent
  // bursts on the same sender ID. Retry once with a small backoff before
  // declaring failure, so we don't lose recipients to silent throttling.
  const isEmptyArray = Array.isArray(attempt.parsed) && attempt.parsed.length === 0;
  if (attempt.res.ok && isEmptyArray) {
    await new Promise((r) => setTimeout(r, 700 + Math.floor(Math.random() * 500)));
    attempt = await automasOnce(url, payload, phoneSuffix);
  }

  const { res, text, parsed } = attempt;
  if (!res.ok) {
    return { success: false, provider: "automas", error: `HTTP ${res.status}: ${text.slice(0, 200)}`, provider_response: parsed || text };
  }
  const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.response) ? parsed.response : null);
  const first = arr && arr.length > 0 ? arr[0] : null;
  if (!first) {
    return {
      success: false,
      provider: "automas",
      error: "Provider returned empty response (likely rate-limit / sender-id throttle). Reduce send concurrency.",
      provider_response: parsed ?? text,
      empty_response: true,
    };
  }
  const statusCode = String(first.status ?? parsed?.status ?? "");
  const ok = statusCode === "0";
  return {
    success: ok,
    provider: "automas",
    message_id: first.id != null ? String(first.id) : undefined,
    error: ok ? undefined : automasErrorMessage(statusCode),
    provider_response: parsed ?? text,
    status_code: statusCode,
  };
}

async function sendViaAutomas(
  fullPhone: string,
  message: string,
  cfg: { apiUrl: string; apiKey: string; senderId: string }
): Promise<SmsResult> {
  if (!cfg.apiKey) {
    return { success: false, provider: "automas", error: "Automas API key not configured." };
  }
  if (!cfg.senderId) {
    return { success: false, provider: "automas", error: "Automas sender ID not configured." };
  }

  const safeMessage = normalizeAutomasMessage(message);
  if (!safeMessage) {
    return { success: false, provider: "automas", error: "SMS message is empty." };
  }

  // First try the exact message body with the required Unicode flag. This keeps
  // campaign sending on the same provider path as working order/test SMS.
  const local = fullPhone.startsWith("88") ? fullPhone.slice(2) : fullPhone;
  const url = cfg.apiUrl || "https://api.automas.com.bd/smsapiv4";
  try {
    const direct = await sendAutomasSingle(url, cfg, local, safeMessage);
    if (direct.success) return { ...direct, sent_message: safeMessage };
    let lastFailure: AutomasSingleResult = direct;

    const safeMeta = detectSmsMeta(safeMessage);
    if (safeMeta.isUnicode && (direct.empty_response === true || direct.status_code === "3300" || direct.status_code === "111")) {
      const encodedUnicode = await automasUnicodeEncodedOnce(url, cfg, local, safeMessage);
      if (encodedUnicode.success) {
        return {
          ...encodedUnicode,
          sent_message: safeMessage,
          provider_response: {
            retried_with_encoded_unicode_route: true,
            first_attempt: direct.provider_response,
            retry: encodedUnicode.provider_response,
          },
        };
      }
      lastFailure = encodedUnicode;
    }

    // Do not rewrite, compact, sanitize, or split one campaign body into multiple
    // SMS requests. If Automas rejects the exact merchant-authored content, return
    // that provider failure instead of sending a changed message to customers.
    return lastFailure || direct;
  } catch (e) {
    return { success: false, provider: "automas", error: `fetch failed: ${String(e)}` };
  }
}

async function checkAutomasBalance(cfg: { apiKey: string }) {
  if (!cfg.apiKey) return { balance: null as null | string, error: "Automas API key not configured" };
  try {
    const url = `https://api.automas.com.bd/getbalancev3?apikey=${encodeURIComponent(cfg.apiKey)}`;
    const res = await fetch(url);
    const text = await res.text();
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch {}
    const balance = parsed?.response ?? parsed?.balance ?? text;
    return { balance: balance != null ? String(balance) : null };
  } catch (e) {
    return { balance: null, error: String(e) };
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────
export async function getActiveSmsProvider(supabase: any): Promise<ProviderRow | null> {
  const { data } = await supabase
    .from("sms_providers")
    .select("provider_name, api_url, api_key, sender_id, username, password, is_active")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  return (data as ProviderRow) || null;
}

export async function getProvider(supabase: any, name: string): Promise<ProviderRow | null> {
  const { data } = await supabase
    .from("sms_providers")
    .select("provider_name, api_url, api_key, sender_id, username, password, is_active")
    .eq("provider_name", name)
    .maybeSingle();
  return (data as ProviderRow) || null;
}

// MimSMS fallback to legacy store_settings + env so existing flows never break.
async function resolveMimSmsConfig(supabase: any, row: ProviderRow | null) {
  let username = row?.username || "";
  let apiKey = row?.api_key || "";
  let senderId = row?.sender_id || "";
  if (!username || !apiKey || !senderId) {
    const { data } = await supabase
      .from("store_settings")
      .select("key, value")
      .in("key", ["mimsms_username", "mimsms_api_key", "mimsms_sender_id"]);
    const map: Record<string, string> = {};
    (data || []).forEach((r: any) => { map[r.key] = r.value; });
    username = username || map.mimsms_username || Deno.env.get("MIMSMS_USERNAME") || "";
    apiKey = apiKey || map.mimsms_api_key || Deno.env.get("MIMSMS_API_KEY") || "";
    senderId = senderId || map.mimsms_sender_id || Deno.env.get("MIMSMS_SENDER_ID") || "";
  }
  return { username, apiKey, senderId };
}

export async function sendSmsWithProvider(
  supabase: any,
  providerName: string,
  phone: string,
  message: string,
  options?: SmsSendOptions
): Promise<SmsResult> {
  const blocked = assertSmsSendAllowed(message, options);
  if (blocked) return blocked;

  const full = normalizeBdPhone(phone);
  if (!isValidBdMobile(full)) {
    return { success: false, error: `Invalid BD mobile number: ${full}` };
  }
  const row = await getProvider(supabase, providerName);
  if (providerName === "mimsms") {
    const cfg = await resolveMimSmsConfig(supabase, row);
    return sendViaMimSms(full, message, cfg);
  }
  if (providerName === "automas") {
    if (!row) return { success: false, error: "Automas provider not configured" };
    return sendViaAutomas(full, message, {
      apiUrl: row.api_url || "https://api.automas.com.bd/smsapiv4",
      apiKey: row.api_key || "",
      senderId: row.sender_id || "",
    });
  }
  return { success: false, error: `Unknown SMS provider: ${providerName}` };
}

export async function sendSmsViaActiveProvider(
  supabase: any,
  phone: string,
  message: string,
  options?: SmsSendOptions
): Promise<SmsResult> {
  const active = await getActiveSmsProvider(supabase);
  const name = active?.provider_name || "mimsms";
  return sendSmsWithProvider(supabase, name, phone, message, options);
}

export async function checkBalanceWithProvider(
  supabase: any,
  providerName: string
): Promise<{ balance: string | null; provider: string; error?: string }> {
  const row = await getProvider(supabase, providerName);
  if (providerName === "mimsms") {
    const cfg = await resolveMimSmsConfig(supabase, row);
    const r = await checkMimSmsBalance({ username: cfg.username, apiKey: cfg.apiKey });
    return { ...r, provider: "mimsms" };
  }
  if (providerName === "automas") {
    const r = await checkAutomasBalance({ apiKey: row?.api_key || "" });
    return { ...r, provider: "automas" };
  }
  return { balance: null, provider: providerName, error: "Unknown provider" };
}
