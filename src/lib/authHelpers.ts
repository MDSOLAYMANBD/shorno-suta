import { supabase } from '@/integrations/supabase/client';

/**
 * Detects transient auth/network errors that should be retried instead of
 * shown to the user. These are NOT real auth failures — usually mobile
 * Chrome / Android WebView aborting a fetch after backgrounding, or the
 * Supabase auth lock timing out and rejecting with a generic abort.
 *
 * Common surfaces:
 *   - "signal is aborted without reason"
 *   - DOMException name === "AbortError"
 *   - LockAcquireTimeoutError (isAcquireTimeout === true)
 *   - "Failed to fetch" / TypeError on mobile during network handoff
 */
export function isTransientAuthError(err: unknown): boolean {
  if (!err) return false;
  const anyErr = err as any;
  if (anyErr?.isAcquireTimeout) return true;
  if (anyErr?.name === 'AbortError') return true;
  const msg = String(anyErr?.message || anyErr || '').toLowerCase();
  return (
    msg.includes('signal is aborted') ||
    msg.includes('aborted without reason') ||
    msg.includes('aborterror') ||
    msg.includes('lock') && msg.includes('timed out') ||
    msg.includes('failed to fetch') ||
    msg.includes('network request failed') ||
    msg.includes('load failed')
  );
}

/**
 * Wait until the Supabase client has a fresh session with both
 * an access token and a user id. This avoids the mobile race condition
 * where signInWithPassword resolves but the client hasn't propagated
 * the new JWT yet, causing follow-up RPCs to send a stale/empty token
 * and receive "403: invalid claim: missing sub claim".
 */
export async function waitForFreshToken(maxMs = 2500) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token && data.session.user?.id) {
        return data.session;
      }
    } catch {
      // ignore — likely transient on mobile, just retry
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  try {
    const { data } = await supabase.auth.getSession();
    return data.session ?? null;
  } catch {
    return null;
  }
}

/**
 * Call has_any_role with retry + exponential backoff.
 * Resolves to { ok: true, hasRole } on success (even if hasRole=false),
 * or { ok: false, error } if all attempts failed.
 *
 * Backoff schedule: 300ms, 800ms, 2000ms between attempts.
 *
 * AbortError + lock timeouts are treated as transient and silently retried.
 */
export async function checkStaffRoleWithRetry(userId: string, attempts = 3) {
  const delays = [300, 800, 2000];
  let lastError: unknown = null;

  for (let i = 0; i < attempts; i++) {
    await waitForFreshToken(i === 0 ? 2500 : 1500);

    try {
      const { data, error } = await supabase.rpc('has_any_role', {
        _user_id: userId,
      } as any);

      if (!error) {
        return { ok: true as const, hasRole: !!data };
      }
      lastError = error;
    } catch (err) {
      lastError = err;
    }

    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, delays[i]));
    }
  }

  return { ok: false as const, error: lastError };
}
