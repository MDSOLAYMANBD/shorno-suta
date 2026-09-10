import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const SESSION_KEY = 'live_presence_session_id';
const HEARTBEAT_INTERVAL_MS = 45_000;

function getPresenceSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

/**
 * Sends a lightweight "I'm here" heartbeat every ~45s while the tab is
 * visible, powering the live-visitor-count badge (useLiveVisitorCount).
 * No websocket/Realtime channel — a plain upsert against a tiny table,
 * paused whenever the tab is hidden so background tabs don't inflate
 * the count or write unnecessarily.
 */
export function useLivePresence() {
  useEffect(() => {
    const sessionId = getPresenceSessionId();
    let lastBeatAt = 0;
    // Throttle guard: visibilitychange can fire repeatedly in quick succession
    // (switching tabs/apps back and forth, mobile multitasking) — without
    // this, every one of those re-attempts a write against a row that was
    // just touched moments ago, which always loses the INSERT race and
    // falls through to an equally pointless UPDATE. Skip if we already beat
    // well inside the normal heartbeat cadence.
    const MIN_GAP_MS = 20_000;

    const beat = async () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastBeatAt < MIN_GAP_MS) return;
      lastBeatAt = now;
      const nowIso = new Date(now).toISOString();
      // INSERT first, fall back to UPDATE on a duplicate-key conflict.
      // Deliberately not .upsert()/ON CONFLICT DO UPDATE, and not chaining
      // .select() on either statement: both require the caller to be able
      // to see the row via a SELECT policy, and this table has none for
      // anon on purpose (no reason to expose other visitors' session ids).
      // Two plain statements, read only via the error code, avoid that
      // requirement entirely.
      const { error } = await supabase
        .from('live_presence' as any)
        .insert({ session_id: sessionId, last_seen: nowIso } as any);
      if (error && (error as { code?: string }).code === '23505') {
        await supabase.from('live_presence' as any).update({ last_seen: nowIso } as any).eq('session_id', sessionId);
      }
    };

    beat();
    const timer = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    document.addEventListener('visibilitychange', beat);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', beat);
    };
  }, []);
}
