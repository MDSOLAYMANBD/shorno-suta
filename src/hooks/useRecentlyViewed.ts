import { useEffect, useState, useCallback } from 'react';

const KEY = 'recently_viewed_products';
const MAX = 12;

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids.slice(0, MAX)));
    window.dispatchEvent(new Event('recently-viewed-change'));
  } catch {}
}

export function addRecentlyViewed(productId: string) {
  if (!productId) return;
  const cur = read().filter((id) => id !== productId);
  cur.unshift(productId);
  write(cur);
}

export function clearRecentlyViewed() {
  write([]);
}

export function useRecentlyViewed() {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    setIds(read());
    const handler = () => setIds(read());
    window.addEventListener('recently-viewed-change', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('recently-viewed-change', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const clear = useCallback(() => clearRecentlyViewed(), []);
  return { ids, clear };
}
