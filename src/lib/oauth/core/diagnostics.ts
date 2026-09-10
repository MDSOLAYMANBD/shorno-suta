// Persists last 20 OAuth attempts in localStorage for debugging.
import type { OAuthAttempt, OAuthPlatform } from './types';

const KEY = 'oauth:history';
const MAX = 20;

function read(): OAuthAttempt[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function write(arr: OAuthAttempt[]) {
  try { localStorage.setItem(KEY, JSON.stringify(arr.slice(0, MAX))); } catch {}
}

export function getHistory(): OAuthAttempt[] { return read(); }
export function clearHistory() { try { localStorage.removeItem(KEY); } catch {} }

export function recordLaunch(a: Omit<OAuthAttempt, 'id' | 'ts'> & Partial<Pick<OAuthAttempt, 'id' | 'ts'>>): string {
  const id = a.id || crypto.randomUUID();
  const entry: OAuthAttempt = {
    id,
    ts: a.ts || Date.now(),
    platform: a.platform,
    origin: a.origin,
    redirect_uri: a.redirect_uri,
    generated_url: a.generated_url,
    popup_blocked: a.popup_blocked,
    callback_status: 'pending',
    exchange_status: 'pending',
  };
  const arr = [entry, ...read()];
  write(arr);
  try { sessionStorage.setItem('oauth:last_id', id); } catch {}
  return id;
}

export function updateAttempt(id: string, patch: Partial<OAuthAttempt>) {
  const arr = read();
  const idx = arr.findIndex(a => a.id === id);
  if (idx === -1) return;
  arr[idx] = { ...arr[idx], ...patch };
  write(arr);
}

export function getLastAttempt(): OAuthAttempt | null {
  const arr = read();
  return arr[0] || null;
}

export function findLatestForPlatform(platform: OAuthPlatform): OAuthAttempt | null {
  return read().find(a => a.platform === platform) || null;
}
