// bKash Tokenized Checkout API client (one-time "Checkout URL" mode 0011,
// not the recurring-agreement mode — no agreementID involved).
// Field names verified against bKash's official developer docs
// (developer.bka.sh/docs/create-payment-1, execute-payment-1,
// token-management-overview-3).

export interface BkashConfig {
  appKey: string;
  appSecret: string;
  username: string;
  password: string;
  baseUrl: string; // e.g. https://tokenized.sandbox.bka.sh/v1.2.0-beta
}

export interface BkashTokenCache {
  id_token?: string;
  refresh_token?: string;
  expires_at?: string; // ISO timestamp
}

interface GrantOrRefreshResponse {
  id_token?: string;
  refresh_token?: string;
  expires_in?: number;
  statusCode?: string;
  statusMessage?: string;
}

async function grantToken(cfg: BkashConfig): Promise<GrantOrRefreshResponse> {
  const res = await fetch(`${cfg.baseUrl}/tokenized/checkout/token/grant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      username: cfg.username,
      password: cfg.password,
    },
    body: JSON.stringify({ app_key: cfg.appKey, app_secret: cfg.appSecret }),
  });
  return await res.json();
}

async function refreshToken(cfg: BkashConfig, refresh_token: string): Promise<GrantOrRefreshResponse> {
  const res = await fetch(`${cfg.baseUrl}/tokenized/checkout/token/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      username: cfg.username,
      password: cfg.password,
    },
    body: JSON.stringify({ app_key: cfg.appKey, app_secret: cfg.appSecret, refresh_token }),
  });
  return await res.json();
}

/**
 * Returns a valid id_token, reusing the cached one from store_settings if it
 * still has >5 minutes of life left, otherwise refreshing/granting a fresh
 * one and persisting it back to store_settings (same caching pattern already
 * used for Pathao's OAuth token in this codebase).
 */
export async function getValidBkashToken(
  supabaseAdmin: any,
  cfg: BkashConfig,
  cached: BkashTokenCache
): Promise<string> {
  const now = Date.now();
  const expiresAt = cached.expires_at ? new Date(cached.expires_at).getTime() : 0;
  const stillFresh = cached.id_token && expiresAt - now > 5 * 60 * 1000;
  if (stillFresh) return cached.id_token!;

  let result: GrantOrRefreshResponse | null = null;

  if (cached.refresh_token) {
    try {
      const r = await refreshToken(cfg, cached.refresh_token);
      if (r.id_token) result = r;
    } catch {
      // fall through to a full grant
    }
  }

  if (!result) {
    result = await grantToken(cfg);
  }

  if (!result?.id_token) {
    throw new Error(`bKash token grant/refresh failed: ${result?.statusMessage || "unknown error"}`);
  }

  const newExpiresAt = new Date(now + (result.expires_in || 3600) * 1000).toISOString();

  await Promise.all([
    upsertSetting(supabaseAdmin, "bkash_id_token", result.id_token),
    upsertSetting(supabaseAdmin, "bkash_refresh_token", result.refresh_token || cached.refresh_token || ""),
    upsertSetting(supabaseAdmin, "bkash_token_expires_at", newExpiresAt),
  ]);

  return result.id_token;
}

async function upsertSetting(supabaseAdmin: any, key: string, value: string) {
  const { data: existing } = await supabaseAdmin.from("store_settings").select("id").eq("key", key).maybeSingle();
  if (existing) {
    await supabaseAdmin.from("store_settings").update({ value }).eq("key", key);
  } else {
    await supabaseAdmin.from("store_settings").insert({ key, value });
  }
}

export interface CreatePaymentParams {
  amount: number;
  merchantInvoiceNumber: string;
  callbackURL: string;
  payerReference: string;
}

export interface CreatePaymentResult {
  paymentID: string;
  bkashURL: string;
  transactionStatus: string;
  statusCode?: string;
  statusMessage?: string;
}

export async function createBkashPayment(
  cfg: BkashConfig,
  idToken: string,
  params: CreatePaymentParams
): Promise<CreatePaymentResult> {
  const res = await fetch(`${cfg.baseUrl}/tokenized/checkout/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: idToken,
      "X-App-Key": cfg.appKey,
    },
    body: JSON.stringify({
      mode: "0011",
      payerReference: params.payerReference.slice(0, 255),
      callbackURL: params.callbackURL,
      amount: params.amount.toFixed(2),
      currency: "BDT",
      intent: "sale",
      merchantInvoiceNumber: params.merchantInvoiceNumber.slice(0, 255),
    }),
  });
  return await res.json();
}

export interface ExecutePaymentResult {
  paymentID?: string;
  trxID?: string;
  transactionStatus?: string;
  amount?: string;
  paymentExecuteTime?: string;
  statusCode?: string;
  statusMessage?: string;
  /** Present on ambiguous/error Execute Payment responses — per bKash's own
   * official sample (bKash-HSL/Checkout-URL-Nodejs), this field's presence,
   * not a missing transactionStatus, is the documented signal to fall back
   * to Query Payment. */
  message?: string;
}

export async function executeBkashPayment(
  cfg: BkashConfig,
  idToken: string,
  paymentID: string
): Promise<ExecutePaymentResult> {
  const res = await fetch(`${cfg.baseUrl}/tokenized/checkout/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: idToken,
      "X-App-Key": cfg.appKey,
    },
    body: JSON.stringify({ paymentID }),
  });
  return await res.json();
}

/** Fallback status check — bKash's own recommended safety net when Execute
 * Payment times out or its response is ambiguous, so we never guess. */
export async function queryBkashPayment(
  cfg: BkashConfig,
  idToken: string,
  paymentID: string
): Promise<ExecutePaymentResult> {
  const res = await fetch(`${cfg.baseUrl}/tokenized/checkout/payment/status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: idToken,
      "X-App-Key": cfg.appKey,
    },
    body: JSON.stringify({ paymentID }),
  });
  return await res.json();
}

// Fields kept when persisting a bKash API response into payment_transactions
// .gateway_response for audit purposes. Deliberately an ALLOWLIST, not a
// denylist of known-PII fields: bKash's Execute/Query Payment response may
// include customer-identifying fields (e.g. a wallet-linked phone number),
// and rather than depend on knowing that exact schema with certainty, only
// fields confirmed safe and operationally necessary (status/debugging
// fields, no customer identifiers) are ever kept. Anything not listed here
// is dropped by construction, regardless of what bKash's response actually
// contains now or adds later. Matches this project's existing redaction
// convention used for conversions_sent (see docs/tracking-architecture.md).
const BKASH_RESPONSE_AUDIT_FIELDS = [
  "paymentID",
  "trxID",
  "transactionStatus",
  "statusCode",
  "statusMessage",
  "amount",
  "currency",
  "paymentExecuteTime",
  "merchantInvoiceNumber",
] as const;

/** Strips any field not on the audit allowlist before a bKash API response
 * is persisted to payment_transactions.gateway_response. */
export function sanitizeBkashResponseForStorage(response: unknown): Record<string, unknown> {
  if (!response || typeof response !== "object") return {};
  const source = response as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};
  for (const field of BKASH_RESPONSE_AUDIT_FIELDS) {
    if (field in source) sanitized[field] = source[field];
  }
  return sanitized;
}
