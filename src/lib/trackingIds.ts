// Browser helpers to capture tracking identifiers that must be attached to
// every server-side conversion. Values are read from cookies / URL params
// with sensible fallbacks so we never generate a bogus id.

const COOKIE = (name: string): string | undefined => {
  if (typeof document === "undefined") return undefined;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : undefined;
};

/** GA4 client id from the `_ga` cookie (format: GA1.1.<cid>.<ts>). */
export function getGaClientId(): string | undefined {
  const raw = COOKIE("_ga");
  if (!raw) return undefined;
  const parts = raw.split(".");
  if (parts.length >= 4) return `${parts[2]}.${parts[3]}`;
  return raw;
}

/** GA4 session id from any `_ga_<STREAM>` cookie (`GS1.1.<sid>.…`). */
export function getGaSessionId(measurementId?: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const target = measurementId?.replace(/^G-/, "");
  const cookies = document.cookie.split(/;\s*/);
  for (const c of cookies) {
    const [name, val] = c.split("=");
    if (!name?.startsWith("_ga_")) continue;
    if (target && name !== `_ga_${target}`) continue;
    const parts = decodeURIComponent(val || "").split(".");
    if (parts.length >= 3) return parts[2];
  }
  return undefined;
}

/** Meta browser id (_fbp) cookie. */
export function getFbp(): string | undefined {
  return COOKIE("_fbp");
}

/** Meta click id — from _fbc cookie or derived from ?fbclid=... URL param. */
export function getFbc(): string | undefined {
  const c = COOKIE("_fbc");
  if (c) return c;
  if (typeof window === "undefined") return undefined;
  const fbclid = new URL(window.location.href).searchParams.get("fbclid");
  if (!fbclid) return undefined;
  return `fb.1.${Date.now()}.${fbclid}`;
}

/** Google Ads click identifiers from the current URL, persisted for 90 days. */
const CLICK_STORE = "sd_click_ids_v1";
type ClickIds = { gclid?: string; gbraid?: string; wbraid?: string; ts?: number };

export function persistClickIdsFromUrl(): ClickIds {
  if (typeof window === "undefined") return {};
  const url = new URL(window.location.href);
  const fromUrl: ClickIds = {
    gclid: url.searchParams.get("gclid") || undefined,
    gbraid: url.searchParams.get("gbraid") || undefined,
    wbraid: url.searchParams.get("wbraid") || undefined,
  };
  let stored: ClickIds = {};
  try {
    stored = JSON.parse(localStorage.getItem(CLICK_STORE) || "{}");
  } catch { /* ignore */ }
  const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;
  if (stored.ts && Date.now() - stored.ts > NINETY_DAYS) stored = {};
  const merged: ClickIds = {
    gclid: fromUrl.gclid || stored.gclid,
    gbraid: fromUrl.gbraid || stored.gbraid,
    wbraid: fromUrl.wbraid || stored.wbraid,
    ts: fromUrl.gclid || fromUrl.gbraid || fromUrl.wbraid ? Date.now() : stored.ts,
  };
  try {
    if (merged.gclid || merged.gbraid || merged.wbraid) {
      localStorage.setItem(CLICK_STORE, JSON.stringify(merged));
    }
  } catch { /* ignore */ }
  return merged;
}

export function getClickIds(): ClickIds {
  try {
    return JSON.parse(localStorage.getItem(CLICK_STORE) || "{}");
  } catch {
    return {};
  }
}

export interface TrackingContext {
  ga_client_id?: string;
  ga_session_id?: string;
  fbp?: string;
  fbc?: string;
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  user_agent?: string;
  event_source_url?: string;
  consent_snapshot?: Record<string, string>;
}

/**
 * Snapshot everything needed to reconstruct the browser session on the server.
 * Pass the returned object as `tracking_context` on the `place-order` payload.
 */
export function buildTrackingContext(measurementId?: string, consentSnapshot?: Record<string, string> | object): TrackingContext {
  const clicks = getClickIds();
  return {
    ga_client_id: getGaClientId(),
    ga_session_id: getGaSessionId(measurementId),
    fbp: getFbp(),
    fbc: getFbc(),
    gclid: clicks.gclid,
    gbraid: clicks.gbraid,
    wbraid: clicks.wbraid,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    event_source_url: typeof window !== "undefined" ? window.location.href : undefined,
    consent_snapshot: consentSnapshot as Record<string, string> | undefined,
  };
}
