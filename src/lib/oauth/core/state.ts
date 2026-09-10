// CSRF state generation + verification for OAuth flows.
// Stored in sessionStorage, so it survives the popup → callback round-trip
// within the same browser session, but does NOT leak across tabs/users.

import type { OAuthPlatform } from './types';

const KEY = (platform: OAuthPlatform) => `oauth:state:${platform}`;
const MAX_AGE_MS = 10 * 60 * 1000;

interface StoredState {
  state: string;
  platform: OAuthPlatform;
  ts: number;
  redirect_uri: string;
}

function randomHex(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function generateState(platform: OAuthPlatform, redirectUri: string): string {
  const state = randomHex(32);
  const payload: StoredState = { state, platform, ts: Date.now(), redirect_uri: redirectUri };
  try { sessionStorage.setItem(KEY(platform), JSON.stringify(payload)); } catch {}
  // Encode platform inside state so callback can identify it without a separate lookup.
  return btoa(JSON.stringify({ s: state, p: platform, t: payload.ts }));
}

export interface DecodedState { state: string; platform: OAuthPlatform; ts: number }
export function decodeState(raw: string | null): DecodedState | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(atob(raw));
    if (!obj?.s || !obj?.p || !obj?.t) return null;
    return { state: obj.s, platform: obj.p, ts: obj.t };
  } catch { return null; }
}

export interface VerifyResult { ok: boolean; reason?: string; redirectUri?: string }

export function verifyState(returnedRaw: string | null): VerifyResult {
  const decoded = decodeState(returnedRaw);
  if (!decoded) return { ok: false, reason: 'state_malformed' };
  let stored: StoredState | null = null;
  try {
    const raw = sessionStorage.getItem(KEY(decoded.platform));
    if (raw) stored = JSON.parse(raw);
  } catch {}
  if (!stored) return { ok: false, reason: 'state_missing' };
  if (stored.state !== decoded.state) return { ok: false, reason: 'state_mismatch' };
  if (Date.now() - stored.ts > MAX_AGE_MS) return { ok: false, reason: 'state_expired' };
  // One-shot use.
  try { sessionStorage.removeItem(KEY(decoded.platform)); } catch {}
  return { ok: true, redirectUri: stored.redirect_uri };
}
