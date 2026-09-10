// Consent Mode v2 — client helpers.
//
// Defaults are set as early as possible via `consentBoot` (imported from
// main.tsx) so gtag / GTM / Meta Pixel never fire before consent is known.
// Any UI (or a future cookie banner) can call `updateConsent(...)` to
// promote/demote signals; every change is mirrored server-side via the
// `consent-log` edge function for auditability.

import { supabase } from "@/integrations/supabase/client";

export type ConsentValue = "granted" | "denied";

export interface ConsentState {
  ad_storage: ConsentValue;
  analytics_storage: ConsentValue;
  ad_user_data: ConsentValue;
  ad_personalization: ConsentValue;
}

const STORAGE_KEY = "sd_consent_v2";
const SESSION_KEY = "sd_consent_session";

// Defaults ship "granted" today because there is no cookie banner in place.
// This is intentional and configurable — future consent UI just calls
// `updateConsent(...)` and both browser + server pick it up.
export const DEFAULT_CONSENT: ConsentState = {
  ad_storage: "granted",
  analytics_storage: "granted",
  ad_user_data: "granted",
  ad_personalization: "granted",
};

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
    __META_CONSENT?: boolean;
  }
}

function ensureGtagStub() {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function (...args: any[]) {
      // Push arguments as-is so the real gtag.js picks them up later.
      window.dataLayer!.push(args);
    };
  }
}

function readStored(): ConsentState | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONSENT, ...parsed };
  } catch {
    return null;
  }
}

function writeStored(state: ConsentState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

function sessionId(): string {
  if (typeof sessionStorage === "undefined") return "";
  let sid = sessionStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    try { sessionStorage.setItem(SESSION_KEY, sid); } catch { /* ignore */ }
  }
  return sid;
}

let _current: ConsentState = { ...DEFAULT_CONSENT };

export function getConsent(): ConsentState {
  return { ..._current };
}

/**
 * Push consent defaults into gtag/dataLayer BEFORE any tag loads.
 * Called from `consentBoot.ts` which is imported at the top of main.tsx.
 */
export function initConsentDefaults(overrides?: Partial<ConsentState>) {
  ensureGtagStub();
  const stored = readStored();
  _current = { ...DEFAULT_CONSENT, ...(overrides || {}), ...(stored || {}) };
  window.gtag?.("consent", "default", {
    ..._current,
    wait_for_update: 500,
  });
  window.__META_CONSENT = _current.ad_storage === "granted";
}

/**
 * Update consent both in the browser (gtag) and server-side (audit log).
 * Safe to call fire-and-forget from any consent UI.
 */
export function updateConsent(patch: Partial<ConsentState>, source = "user") {
  ensureGtagStub();
  _current = { ..._current, ...patch };
  writeStored(_current);
  window.gtag?.("consent", "update", _current);
  window.__META_CONSENT = _current.ad_storage === "granted";

  // Fire-and-forget audit log.
  const payload = {
    consent: _current,
    source,
    session_id: sessionId(),
    page_url: typeof window !== "undefined" ? window.location.href : undefined,
  };
  try {
    supabase.functions.invoke("consent-log", { body: payload }).catch(() => { /* ignore */ });
  } catch { /* ignore */ }
}
