// Joined / external-source presets. Each returns a Set of normalized phones
// that the engine intersects with the customer query result.
//
// Cached per page-load via module-level promises; reset by invalidating
// react-query's 'audience' keys (the engine is the consumer).

import { supabase } from '@/integrations/supabase/client';
import { normalizeBdPhone } from './helpers';
import { getThresholds } from './thresholds';
import type { PresetId } from './types';

export const JOINED_PRESET_IDS = new Set<PresetId>([
  'cod', 'prepaid', 'refunded', 'blacklist', 'wholesale', 'retail',
]);

const cache = new Map<PresetId, Promise<Set<string>>>();

export function invalidateJoinedPresets() { cache.clear(); }

export function getJoinedPresetPhones(id: PresetId): Promise<Set<string>> {
  if (cache.has(id)) return cache.get(id)!;
  const p = loadPhones(id);
  cache.set(id, p);
  return p;
}

async function loadPhones(id: PresetId): Promise<Set<string>> {
  switch (id) {
    case 'blacklist': return loadBlacklist();
    case 'cod':       return loadByOrders((q) => q.eq('payment_method', 'cod'));
    case 'prepaid':   return loadByOrders((q) => q.neq('payment_method', 'cod').not('payment_method', 'is', null));
    case 'refunded':  return loadByOrders((q) => q.in('status', ['returned', 'refunded', 'paid_return']));
    case 'wholesale': {
      const t = await getThresholds();
      return loadByCustomers((q) => q.gte('total_spent', t.wholesale));
    }
    case 'retail': {
      const t = await getThresholds();
      return loadByCustomers((q) => q.lt('total_spent', t.retail));
    }
    default: return new Set();
  }
}

async function loadBlacklist(): Promise<Set<string>> {
  const set = new Set<string>();
  try {
    const { data } = await supabase
      .from('store_settings')
      .select('value')
      .eq('key', 'blocked_phones')
      .maybeSingle();
    const raw = data?.value;
    if (!raw) return set;
    const arr: string[] = typeof raw === 'string' ? JSON.parse(raw) : raw;
    for (const p of arr || []) {
      const n = normalizeBdPhone(p);
      if (n) set.add(n);
    }
  } catch { /* ignore */ }
  return set;
}

async function loadByOrders(apply: (q: any) => any): Promise<Set<string>> {
  const set = new Set<string>();
  const pageSize = 1000;
  let from = 0;
  while (from < 100_000) {
    let q: any = supabase.from('orders').select('phone').is('deleted_at', null);
    q = apply(q).range(from, from + pageSize - 1);
    const { data, error } = await q;
    if (error || !data || data.length === 0) break;
    for (const r of data as any[]) {
      const n = normalizeBdPhone(r.phone);
      if (n) set.add(n);
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return set;
}

async function loadByCustomers(apply: (q: any) => any): Promise<Set<string>> {
  const set = new Set<string>();
  const pageSize = 1000;
  let from = 0;
  while (from < 100_000) {
    let q: any = supabase.from('customers').select('phone');
    q = apply(q).range(from, from + pageSize - 1);
    const { data, error } = await q;
    if (error || !data || data.length === 0) break;
    for (const r of data as any[]) {
      const n = normalizeBdPhone(r.phone);
      if (n) set.add(n);
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return set;
}
