// Lightweight debounce + dedupe queue for OAuth-related background calls
// (asset discovery, manual sync, post-callback discovery). Prevents Graph
// API spam and duplicate edge-function invocations.

interface Pending {
  timer: number;
  lastRunAt: number;
  inFlight?: Promise<unknown>;
}

const pending = new Map<string, Pending>();

export interface EnqueueOpts {
  /** Debounce window — collapses multiple calls within this window to one. */
  debounceMs?: number;
  /** If a call ran within this window, skip silently (returns last result). */
  dedupeWindowMs?: number;
}

export function enqueue<T>(
  key: string,
  fn: () => Promise<T>,
  opts: EnqueueOpts = {},
): Promise<T> {
  const { debounceMs = 1500, dedupeWindowMs = 8000 } = opts;
  const now = Date.now();
  const existing = pending.get(key);

  if (existing?.lastRunAt && now - existing.lastRunAt < dedupeWindowMs && existing.inFlight) {
    return existing.inFlight as Promise<T>;
  }
  if (existing?.timer) clearTimeout(existing.timer);

  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(async () => {
      const slot = pending.get(key);
      try {
        const p = fn();
        if (slot) slot.inFlight = p;
        const r = await p;
        if (slot) { slot.lastRunAt = Date.now(); slot.inFlight = undefined; }
        resolve(r);
      } catch (e) {
        if (slot) { slot.inFlight = undefined; }
        reject(e);
      }
    }, debounceMs);
    pending.set(key, { timer, lastRunAt: existing?.lastRunAt || 0 });
  });
}

export function clearQueue(key?: string) {
  if (key) {
    const p = pending.get(key);
    if (p?.timer) clearTimeout(p.timer);
    pending.delete(key);
  } else {
    for (const p of pending.values()) if (p.timer) clearTimeout(p.timer);
    pending.clear();
  }
}
