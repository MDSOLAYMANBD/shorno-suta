// OAuth session manager — tracks active popup sessions per provider, prevents
// duplicate Connect clicks, enforces reconnect cooldown, and cleans up stale
// state on page load.

import type { OAuthPlatform } from './core/types';

export type OAuthPhase =
  | 'idle'
  | 'launching'
  | 'popup_open'
  | 'callback'
  | 'exchanging'
  | 'discovering'
  | 'done'
  | 'error';

export interface OAuthSession {
  id: string;
  provider: OAuthPlatform;
  mode: 'connect' | 'reconnect';
  assetId?: string;
  phase: OAuthPhase;
  startedAt: number;
  updatedAt: number;
  lastError?: string;
  retryCount: number;
}

const KEY = 'oauth:sessions';
const MAX_AGE_MS = 10 * 60 * 1000;
const RECONNECT_COOLDOWN_MS = 60 * 1000;

function readAll(): OAuthSession[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function writeAll(arr: OAuthSession[]) {
  try { sessionStorage.setItem(KEY, JSON.stringify(arr)); } catch {}
}

export function cleanupStale(maxAgeMs = MAX_AGE_MS) {
  const now = Date.now();
  const fresh = readAll().filter(s => now - s.updatedAt < maxAgeMs && s.phase !== 'done');
  writeAll(fresh);
}

export function getActiveSession(provider: OAuthPlatform): OAuthSession | null {
  cleanupStale();
  return readAll().find(s => s.provider === provider && s.phase !== 'done' && s.phase !== 'error') || null;
}

export function isProviderBusy(provider: OAuthPlatform): boolean {
  return !!getActiveSession(provider);
}

export function getCooldownRemainingMs(provider: OAuthPlatform): number {
  const last = readAll()
    .filter(s => s.provider === provider && s.phase === 'error')
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (!last) return 0;
  const elapsed = Date.now() - last.updatedAt;
  return Math.max(0, RECONNECT_COOLDOWN_MS - elapsed);
}

export function beginSession(provider: OAuthPlatform, opts: { mode?: 'connect' | 'reconnect'; assetId?: string } = {}): OAuthSession {
  const existing = getActiveSession(provider);
  if (existing) return existing;
  const s: OAuthSession = {
    id: crypto.randomUUID(),
    provider,
    mode: opts.mode || 'connect',
    assetId: opts.assetId,
    phase: 'launching',
    startedAt: Date.now(),
    updatedAt: Date.now(),
    retryCount: 0,
  };
  const arr = readAll();
  arr.unshift(s);
  writeAll(arr.slice(0, 20));
  return s;
}

export function updatePhase(id: string, phase: OAuthPhase, patch: Partial<OAuthSession> = {}) {
  const arr = readAll();
  const idx = arr.findIndex(s => s.id === id);
  if (idx === -1) return;
  arr[idx] = { ...arr[idx], ...patch, phase, updatedAt: Date.now() };
  writeAll(arr);
}

export function endSession(id: string, status: 'done' | 'error', error?: string) {
  const arr = readAll();
  const idx = arr.findIndex(s => s.id === id);
  if (idx === -1) return;
  arr[idx] = { ...arr[idx], phase: status, lastError: error, updatedAt: Date.now() };
  writeAll(arr);
}

// Auto-cleanup on module load (runs once per browser tab).
try { cleanupStale(); } catch {}
