// CRM Audience Engine — single source of truth across channels.
// Strategy: fetch a candidate customer pool (with cheap SQL pushdown), then
// apply full filter logic in JS (AND / OR, joined presets, districts,
// manual excludes). This guarantees correct counts for every preset card
// instead of silently falling back to total customers.

import { supabase } from '@/integrations/supabase/client';
import type {
  AudienceFilter,
  AudienceCustomer,
  AudienceSummary,
  PresetId,
  IncludeMode,
} from './types';
import { detectDistrict } from './districts';
import { dedupePhones, normalizeBdPhone, smsParts, estimateSmsCost } from './helpers';
import { getThresholds, type AudienceThresholds } from './thresholds';
import { JOINED_PRESET_IDS, getJoinedPresetPhones } from './joinedPresets';

const MAX_ROWS = 50_000;
const PAGE = 1000;

const DHAKA_START = () => {
  const d = new Date();
  const utc = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }));
  utc.setHours(0, 0, 0, 0);
  return utc;
};
const daysAgo = (n: number) => { const d = DHAKA_START(); d.setDate(d.getDate() - n); return d; };
const daysAgoISO = (n: number) => daysAgo(n).toISOString();

// ─── per-row preset evaluation (single source of truth) ────────────────
function rowMatchesPreset(
  r: { total_orders: number; delivered_orders: number; total_spent: number;
       last_order_date: string | null; created_at?: string | null; address: string },
  id: PresetId,
  thresholds: AudienceThresholds,
  joined: Map<PresetId, Set<string>>,
  phone: string,
): boolean {
  const orders = r.total_orders || 0;
  const delivered = r.delivered_orders || 0;
  const spent = Number(r.total_spent || 0);
  const last = r.last_order_date ? new Date(r.last_order_date) : null;
  const created = r.created_at ? new Date(r.created_at) : null;
  const addr = (r.address || '').toLowerCase();
  switch (id) {
    case 'all':            return true;
    case 'vip':            return delivered >= 5 || spent >= 10000;
    case 'repeat':         return delivered >= 2;
    case 'new':            return !!created && created >= daysAgo(30);
    case 'today':          return !!last && last >= daysAgo(0);
    case 'yesterday':      return !!last && last >= daysAgo(1) && last < daysAgo(0);
    case 'last_7d':        return !!last && last >= daysAgo(7);
    case 'last_30d':       return !!last && last >= daysAgo(30);
    case 'last_90d':       return !!last && last >= daysAgo(90);
    case 'no_order_30d':   return !last || last < daysAgo(30);
    case 'no_order_90d':   return !last || last < daysAgo(90);
    case 'orders_1':       return orders === 1;
    case 'orders_2_plus':  return orders >= 2;
    case 'orders_3_plus':  return orders >= 3;
    case 'orders_5_plus':  return orders >= 5;
    case 'orders_10_plus': return orders >= 10;
    case 'high_spend':     return spent >= thresholds.highSpend;
    case 'low_spend':      return spent <  thresholds.lowSpend;
    case 'inside_dhaka':   return addr.includes('dhaka');
    case 'outside_dhaka':  return !!addr && !addr.includes('dhaka');
    case 'at_risk':        return delivered >= 1 && (!last || last < daysAgo(60));
    case 'cod': case 'prepaid': case 'refunded':
    case 'blacklist': case 'wholesale': case 'retail':
      return !!joined.get(id)?.has(phone);
    default: return false;
  }
}

// Pre-resolve any joined preset sets referenced by the filter.
async function resolveJoinedSets(filter: AudienceFilter): Promise<Map<PresetId, Set<string>>> {
  const ids = new Set<PresetId>();
  for (const i of [...filter.include, ...filter.exclude]) {
    if (JOINED_PRESET_IDS.has(i)) ids.add(i);
  }
  const out = new Map<PresetId, Set<string>>();
  await Promise.all(Array.from(ids).map(async (id) => {
    out.set(id, await getJoinedPresetPhones(id));
  }));
  return out;
}

// ─── candidate pool ────────────────────────────────────────────────────
// Cached full-table fetch shared across counts/preview/summary so that 25+
// parallel preset count queries don't each pull 50k rows.
let _allCustomersCache: { rows: any[]; at: number } | null = null;
let _allCustomersPromise: Promise<any[]> | null = null;
const ALL_CUSTOMERS_TTL = 60 * 60_000;
const IDB_NAME = 'shorno-suta-audience-cache';
const IDB_STORE = 'kv';
const IDB_VERSION = 1;
const CUSTOMER_CACHE_KEY = 'customers:v2';

export function invalidateAudienceMemoryCache() {
  _allCustomersCache = null;
  _allCustomersPromise = null;
}

/** Returns currently cached pool without triggering a fetch. */
export function getCachedCustomers(): { rows: any[]; at: number } | null {
  return _allCustomersCache;
}

function canUseIndexedDb() {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

function openAudienceDb(): Promise<IDBDatabase | null> {
  if (!canUseIndexedDb()) return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

async function readPersistedCustomerCache(): Promise<{ rows: any[]; at: number } | null> {
  const db = await openAudienceDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(CUSTOMER_CACHE_KEY);
    req.onsuccess = () => {
      const value = req.result as { rows?: any[]; at?: number } | undefined;
      if (!value?.rows?.length || !value.at || Date.now() - value.at >= ALL_CUSTOMERS_TTL) {
        resolve(null);
        return;
      }
      resolve({ rows: value.rows, at: value.at });
    };
    req.onerror = () => resolve(null);
  });
}

async function writePersistedCustomerCache(cache: { rows: any[]; at: number }) {
  try {
    const db = await openAudienceDb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(cache, CUSTOMER_CACHE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Persistent cache is best-effort only.
  }
}

async function clearPersistedCustomerCache() {
  try {
    const db = await openAudienceDb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(CUSTOMER_CACHE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Persistent cache is best-effort only.
  }
}

/**
 * Force-refresh the in-memory customer pool. Returns previous/current row
 * count and a `changed` flag so the caller can surface a toast. Does not
 * mutate any business logic.
 */
export async function refreshAudienceCache(): Promise<{
  previousCount: number;
  currentCount: number;
  changed: boolean;
  at: number;
}> {
  const prev = _allCustomersCache?.rows.length ?? 0;
  invalidateAudienceMemoryCache();
  await clearPersistedCustomerCache();
  const rows = await fetchAllCustomersFromDb();
  return {
    previousCount: prev,
    currentCount: rows.length,
    changed: prev > 0 && prev !== rows.length,
    at: _allCustomersCache?.at ?? Date.now(),
  };
}

/** Warm the cache without forcing a network refresh. Used on page mount. */
export async function ensureAudienceCache(): Promise<{ currentCount: number; at: number }> {
  const rows = await fetchAllCustomersCached();
  return { currentCount: rows.length, at: _allCustomersCache?.at ?? Date.now() };
}

const SELECT_COLS = 'phone, name, address, total_orders, delivered_orders, total_spent, last_order_date, created_at';

async function fetchAllCustomersFromDb(): Promise<any[]> {
  const all: any[] = [];
  let from = 0;
  while (from < MAX_ROWS) {
    const { data, error } = await supabase.from('customers').select(SELECT_COLS).range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  const cache = { rows: all, at: Date.now() };
  _allCustomersCache = cache;
  void writePersistedCustomerCache(cache);
  return all;
}

async function fetchAllCustomersCached(): Promise<any[]> {
  if (_allCustomersCache && Date.now() - _allCustomersCache.at < ALL_CUSTOMERS_TTL) {
    return _allCustomersCache.rows;
  }
  if (_allCustomersPromise) return _allCustomersPromise;

  _allCustomersPromise = (async () => {
    const persisted = await readPersistedCustomerCache();
    if (persisted) {
      _allCustomersCache = persisted;
      return persisted.rows;
    }
    return fetchAllCustomersFromDb();
  })().finally(() => {
    _allCustomersPromise = null;
  });

  return _allCustomersPromise;
}


async function fetchCandidates(filter: AudienceFilter): Promise<any[]> {
  const mode: IncludeMode = filter.includeMode || 'AND';
  const sqlIncludes = filter.include.filter((i) => !JOINED_PRESET_IDS.has(i));
  const hasManualInclude = (filter.manualInclude?.length || 0) > 0;
  // When a manual phone allow-list is present we MUST scan the full pool —
  // SQL pushdown could otherwise drop those rows.
  if (hasManualInclude || mode !== 'AND' || sqlIncludes.length === 0) return fetchAllCustomersCached();
  const all: any[] = [];
  let from = 0;
  while (from < MAX_ROWS) {
    let q: any = supabase.from('customers').select(SELECT_COLS);
    for (const id of sqlIncludes) q = applyCheapPushdown(q, id);
    q = q.range(from, from + PAGE - 1);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

// Cheap pushdowns — must be perfectly equivalent to rowMatchesPreset.
function applyCheapPushdown(q: any, id: PresetId): any {
  switch (id) {
    case 'repeat':         return q.gte('delivered_orders', 2);
    case 'orders_1':       return q.eq('total_orders', 1);
    case 'orders_2_plus':  return q.gte('total_orders', 2);
    case 'orders_3_plus':  return q.gte('total_orders', 3);
    case 'orders_5_plus':  return q.gte('total_orders', 5);
    case 'orders_10_plus': return q.gte('total_orders', 10);
    case 'inside_dhaka':   return q.ilike('address', '%dhaka%');
    case 'outside_dhaka':  return q.not('address', 'ilike', '%dhaka%');
    case 'last_7d':        return q.gte('last_order_date', daysAgoISO(7));
    case 'last_30d':       return q.gte('last_order_date', daysAgoISO(30));
    case 'last_90d':       return q.gte('last_order_date', daysAgoISO(90));
    default:               return q;
  }
}

// ─── main filter ───────────────────────────────────────────────────────
export interface FilteredResult {
  rows: AudienceCustomer[];          // matched, with matchedBy
  excluded: number;                  // by exclude-preset OR manual
  invalid: number;
  phantomPhones: Set<string>;        // manualInclude phones NOT present in DB
  manualSeenInDb: Set<string>;       // manualInclude phones that DID hit DB rows
}

export async function applyAudienceFilter(filter: AudienceFilter): Promise<FilteredResult> {
  const [candidates, joined, thresholds] = await Promise.all([
    fetchCandidates(filter),
    resolveJoinedSets(filter),
    getThresholds(),
  ]);
  const districts = new Set(filter.districts);
  const manualExclude = new Set(filter.manualExclude);
  const manualInclude = new Set(
    (filter.manualInclude || [])
      .map((p) => normalizeBdPhone(p))
      .filter((p): p is string => !!p),
  );
  const mode: IncludeMode = filter.includeMode || 'AND';
  const hasManualInclude = manualInclude.size > 0;
  const seenManual = new Set<string>();

  const out: AudienceCustomer[] = [];
  let invalid = 0;
  let excludedCount = 0;

  for (const r of candidates) {
    const phone = normalizeBdPhone(r.phone);
    if (!phone) { invalid++; continue; }

    const isManuallyIncluded = manualInclude.has(phone);
    if (isManuallyIncluded) seenManual.add(phone);

    // include logic — manualInclude unions with preset includes.
    let matched: PresetId[] = [];
    if (isManuallyIncluded) {
      matched = filter.include.length
        ? filter.include.filter((id) => rowMatchesPreset(r, id, thresholds, joined, phone))
        : [];
    } else if (filter.include.length === 0) {
      if (hasManualInclude) continue; // restrict to manual list when no presets selected
      matched = [];
    } else {
      matched = filter.include.filter((id) => rowMatchesPreset(r, id, thresholds, joined, phone));
      const pass = mode === 'AND'
        ? matched.length === filter.include.length
        : matched.length > 0;
      if (!pass) continue;
    }

    // exclude logic (any match → drop)
    if (filter.exclude.some((id) => rowMatchesPreset(r, id, thresholds, joined, phone))) {
      excludedCount++;
      continue;
    }

    // manual exclude
    if (manualExclude.has(phone)) { excludedCount++; continue; }

    // district
    const d = detectDistrict(r.address);
    if (districts.size && (!d || !districts.has(d.name))) continue;

    out.push({
      phone,
      name: r.name || '',
      address: r.address || '',
      district: d?.name || null,
      upazila: null,
      area: null,
      total_orders: r.total_orders || 0,
      delivered_orders: r.delivered_orders || 0,
      total_spent: Number(r.total_spent || 0),
      last_order_date: r.last_order_date,
      customer_type:
        (r.delivered_orders || 0) >= 5 ? 'VIP' :
        (r.delivered_orders || 0) >= 2 ? 'Repeat' : 'New',
      tags: [],
      matchedBy: matched.length ? matched : (isManuallyIncluded ? (['manual'] as unknown as PresetId[]) : (filter.include.length === 0 ? (['all'] as PresetId[]) : [])),
    });
  }

  // Add phantom rows for manualInclude phones not found in customers table
  // (e.g. SMS recipients that aren't in the CRM yet). They still need to be
  // included so the follow-up SMS reaches them.
  const phantomPhones = new Set<string>();
  if (hasManualInclude) {
    for (const p of manualInclude) {
      if (seenManual.has(p)) continue;
      if (manualExclude.has(p)) { excludedCount++; continue; }
      phantomPhones.add(p);
      out.push({
        phone: p, name: '', address: '',
        district: null, upazila: null, area: null,
        total_orders: 0, delivered_orders: 0, total_spent: 0,
        last_order_date: null, customer_type: 'New', tags: [],
        matchedBy: ['manual'] as unknown as PresetId[],
      });
    }
  }

  return { rows: out, excluded: excludedCount, invalid, phantomPhones, manualSeenInDb: seenManual };
}

// ─── count + buckets ───────────────────────────────────────────────────
export async function countPreset(id: PresetId): Promise<number> {
  if (JOINED_PRESET_IDS.has(id)) {
    const set = await getJoinedPresetPhones(id);
    return set.size;
  }
  // SQL pushdown path (head-only count)
  let q: any = supabase.from('customers').select('phone', { count: 'exact', head: true });
  q = applyCheapPushdown(q, id);
  // If pushdown is partial (e.g. 'vip','today','at_risk','new','no_order_*','yesterday','high_spend','low_spend')
  // we approximate using rowMatchesPreset over a candidate pool.
  const pushdownCovers = new Set<PresetId>([
    'repeat','orders_1','orders_2_plus','orders_3_plus','orders_5_plus','orders_10_plus',
    'inside_dhaka','outside_dhaka','last_7d','last_30d','last_90d',
  ]);
  if (id === 'all') {
    const { count } = await supabase.from('customers').select('phone', { count: 'exact', head: true });
    return count || 0;
  }
  if (pushdownCovers.has(id)) {
    const { count, error } = await q;
    if (error) throw error;
    return count || 0;
  }
  // Fallback: client-side evaluation.
  const result = await applyAudienceFilter({
    include: [id], exclude: [], districts: [], parcelStatuses: [], manualExclude: [], includeMode: 'AND',
  });
  return result.rows.length;
}

// One-pass counts for every preset id. Uses the cached customer pool plus
// joined preset sets, then evaluates rowMatchesPreset per row. This replaces
// 25 parallel countPreset calls (each scanning the same 50k rows) with one
// shared scan.
export async function computeAllPresetCounts(ids: PresetId[]): Promise<Record<PresetId, number>> {
  const [candidates, thresholds] = await Promise.all([fetchAllCustomersCached(), getThresholds()]);
  const joined = new Map<PresetId, Set<string>>();
  await Promise.all(ids.filter((i) => JOINED_PRESET_IDS.has(i)).map(async (id) => {
    joined.set(id, await getJoinedPresetPhones(id));
  }));
  const counts: Record<string, number> = {};
  for (const id of ids) counts[id] = 0;
  for (const r of candidates) {
    const phone = normalizeBdPhone(r.phone);
    if (!phone) continue;
    for (const id of ids) {
      if (id === 'all') { counts[id]++; continue; }
      if (rowMatchesPreset(r, id, thresholds, joined, phone)) counts[id]++;
    }
  }
  return counts as Record<PresetId, number>;
}

export async function getDistrictBuckets(): Promise<Record<string, number>> {
  const buckets: Record<string, number> = {};
  const rows = await fetchAllCustomersCached();
  for (const row of rows as Array<{ address: string | null }>) {
    const d = detectDistrict(row.address);
    const key = d ? d.name : 'Unknown';
    buckets[key] = (buckets[key] || 0) + 1;
  }
  return buckets;
}

// ─── preview + resolve ─────────────────────────────────────────────────
export interface PreviewPage {
  rows: AudienceCustomer[];
  total: number;
  page: number;
  pageSize: number;
}

export async function previewAudience(
  filter: AudienceFilter,
  page = 0,
  pageSize = 50,
): Promise<PreviewPage> {
  const { rows } = await applyAudienceFilter(filter);
  rows.sort((a, b) => {
    const at = a.last_order_date ? +new Date(a.last_order_date) : 0;
    const bt = b.last_order_date ? +new Date(b.last_order_date) : 0;
    return bt - at;
  });
  const from = page * pageSize;
  return { rows: rows.slice(from, from + pageSize), total: rows.length, page, pageSize };
}

export async function resolveAudiencePhones(
  filter: AudienceFilter,
  message: string,
): Promise<{
  phones: string[];
  summary: AudienceSummary;
  customers: AudienceCustomer[];
  duplicateGroups: Array<{ phone: string; count: number; names: string[]; matched: PresetId[] }>;
}> {
  const { rows, excluded, invalid, phantomPhones, manualSeenInDb } = await applyAudienceFilter(filter);

  // Manual paste-box stats — counted separately so the UI can show
  // "Manual Numbers / Invalid / Duplicate Removed" cards.
  let manualInvalid = 0;
  const manualSeen = new Set<string>();
  for (const p of filter.manualInclude || []) {
    const n = normalizeBdPhone(p);
    if (!n) { manualInvalid++; continue; }
    manualSeen.add(n);
  }
  const manualCount = manualSeen.size;

  // Build duplicate groups across matched rows (same phone appearing twice
  // happens when customers table has duplicates; tracked explicitly).
  const groupMap = new Map<string, { count: number; names: Set<string>; matched: Set<PresetId> }>();
  for (const r of rows) {
    const g = groupMap.get(r.phone);
    if (g) {
      g.count++;
      if (r.name) g.names.add(r.name);
      for (const m of r.matchedBy || []) g.matched.add(m);
    } else {
      groupMap.set(r.phone, {
        count: 1,
        names: new Set(r.name ? [r.name] : []),
        matched: new Set(r.matchedBy || []),
      });
    }
  }
  const duplicateGroups = Array.from(groupMap.entries())
    .filter(([, v]) => v.count > 1)
    .map(([phone, v]) => ({
      phone, count: v.count,
      names: Array.from(v.names),
      matched: Array.from(v.matched),
    }));

  // Unique phones list (db ∪ manual phantom rows live in `rows`)
  const uniquePhonesList = Array.from(groupMap.keys());
  const manualExclude = new Set(filter.manualExclude);
  const finalList = uniquePhonesList.filter((p) => !manualExclude.has(p));

  // database vs manual breakdown
  const databaseCount = uniquePhonesList.length - phantomPhones.size; // unique DB phones
  const manualOverlap = manualSeenInDb.size;                          // appear in both
  const intraDbDupes = rows.length - uniquePhonesList.length;         // intra-DB clones

  // Stats
  let totalOrders = 0, totalSpent = 0, deliveredCount = 0;
  const seenForStats = new Set<string>();
  for (const r of rows) {
    if (seenForStats.has(r.phone)) continue;
    seenForStats.add(r.phone);
    totalOrders += r.total_orders;
    totalSpent += r.total_spent;
    if (r.delivered_orders > 0) deliveredCount++;
  }

  const parts = smsParts(message || '');
  const matchedCustomers = rows.length;
  const uniquePhones = uniquePhonesList.length;
  const duplicatePhones = matchedCustomers - uniquePhones;
  const finalCount = finalList.length;

  const source: import('./types').AudienceSource =
    databaseCount > 0 && manualCount > 0 ? 'mixed'
    : manualCount > 0 ? 'manual'
    : databaseCount > 0 ? 'database'
    : 'none';

  const summary: AudienceSummary = {
    matchedCustomers,
    uniqueCustomers: uniquePhones,
    uniquePhones,
    duplicatePhones,
    excluded,
    invalid,
    finalCount,
    smsParts: parts,
    estimatedCost: estimateSmsCost(parts, finalCount),
    averageOrders: uniquePhones ? +(totalOrders / uniquePhones).toFixed(2) : 0,
    averageSpend: uniquePhones ? +(totalSpent / uniquePhones).toFixed(2) : 0,
    codPercent: 0,
    prepaidPercent: 0,
    deliveredPercent: uniquePhones ? +((deliveredCount / uniquePhones) * 100).toFixed(1) : 0,
    databaseCount,
    manualCount,
    manualInvalid,
    manualOverlap,
    duplicatesRemoved: manualOverlap + intraDbDupes,
    source,
    recipients: matchedCustomers,
  };

  // Map to unique customer rows for downstream consumers (first occurrence)
  const seen = new Set<string>();
  const customers = rows.filter((r) => (seen.has(r.phone) ? false : (seen.add(r.phone), true)));

  return { phones: finalList, summary, customers, duplicateGroups };
}

export async function buildAudience(filter: AudienceFilter, message = '') {
  return resolveAudiencePhones(filter, message);
}

// Backwards-compat aliases (old code calls these names)
export { dedupePhones };

// ─── developer diagnostics ─────────────────────────────────────────────
// Instrumented re-run of applyAudienceFilter that returns per-stage removal
// counters. Used ONLY by the Dev Verification Panel.
export interface AudienceDiagnostics {
  totalCustomers: number;     // rows in DB
  fetched: number;            // candidate pool size after SQL pushdown
  invalidPhones: number;      // dropped — invalid BD phone
  removedByInclude: number;   // failed include presets (AND/OR)
  removedByExclude: number;   // matched an exclude preset
  removedByManual: number;    // in manualExclude set
  removedByDistrict: number;  // failed district filter
  matched: number;            // surviving rows (pre-dedupe)
  uniquePhones: number;
  duplicatePhones: number;
  finalCount: number;         // unique minus manualExclude
}

export async function diagnoseAudienceFilter(filter: AudienceFilter): Promise<AudienceDiagnostics> {
  const [candidates, joined, thresholds, totalRes] = await Promise.all([
    fetchCandidates(filter),
    resolveJoinedSets(filter),
    getThresholds(),
    supabase.from('customers').select('id', { count: 'exact', head: true }),
  ]);
  const districts = new Set(filter.districts);
  const manualExclude = new Set(filter.manualExclude);
  const mode: IncludeMode = filter.includeMode || 'AND';

  let invalidPhones = 0, removedByInclude = 0, removedByExclude = 0;
  let removedByManual = 0, removedByDistrict = 0;
  const matchedPhones: string[] = [];

  for (const r of candidates) {
    const phone = normalizeBdPhone(r.phone);
    if (!phone) { invalidPhones++; continue; }
    if (filter.include.length > 0) {
      const matched = filter.include.filter((id) => rowMatchesPreset(r, id, thresholds, joined, phone));
      const pass = mode === 'AND' ? matched.length === filter.include.length : matched.length > 0;
      if (!pass) { removedByInclude++; continue; }
    }
    if (filter.exclude.some((id) => rowMatchesPreset(r, id, thresholds, joined, phone))) { removedByExclude++; continue; }
    if (manualExclude.has(phone)) { removedByManual++; continue; }
    if (districts.size) {
      const d = detectDistrict(r.address);
      if (!d || !districts.has(d.name)) { removedByDistrict++; continue; }
    }
    matchedPhones.push(phone);
  }

  const uniqueSet = new Set(matchedPhones);
  const uniquePhones = uniqueSet.size;
  const matched = matchedPhones.length;
  const finalCount = Array.from(uniqueSet).filter((p) => !manualExclude.has(p)).length;

  return {
    totalCustomers: totalRes.count || 0,
    fetched: candidates.length,
    invalidPhones,
    removedByInclude,
    removedByExclude,
    removedByManual,
    removedByDistrict,
    matched,
    uniquePhones,
    duplicatePhones: matched - uniquePhones,
    finalCount,
  };
}

// Human-readable source description for each preset card. Used by the
// Dev Verification Panel only.
export function describePresetSource(id: PresetId, thresholds?: AudienceThresholds): string {
  const t = thresholds;
  switch (id) {
    case 'all':            return 'customers (all rows)';
    case 'vip':            return 'delivered_orders >= 5 OR total_spent >= 10000';
    case 'repeat':         return 'delivered_orders >= 2';
    case 'new':            return 'created_at >= now() - 30 days';
    case 'today':          return 'last_order_date >= today (Asia/Dhaka)';
    case 'yesterday':      return 'last_order_date in [yesterday, today)';
    case 'last_7d':        return 'last_order_date >= now() - 7 days';
    case 'last_30d':       return 'last_order_date >= now() - 30 days';
    case 'last_90d':       return 'last_order_date >= now() - 90 days';
    case 'no_order_30d':   return 'last_order_date IS NULL OR < now() - 30 days';
    case 'no_order_90d':   return 'last_order_date IS NULL OR < now() - 90 days';
    case 'orders_1':       return 'total_orders = 1';
    case 'orders_2_plus':  return 'total_orders >= 2';
    case 'orders_3_plus':  return 'total_orders >= 3';
    case 'orders_5_plus':  return 'total_orders >= 5';
    case 'orders_10_plus': return 'total_orders >= 10';
    case 'high_spend':     return `total_spent >= ${t?.highSpend ?? '(threshold)'}`;
    case 'low_spend':      return `total_spent <  ${t?.lowSpend ?? '(threshold)'}`;
    case 'inside_dhaka':   return "address ILIKE '%dhaka%'";
    case 'outside_dhaka':  return "address NOT ILIKE '%dhaka%'";
    case 'at_risk':        return 'delivered_orders >= 1 AND last_order_date < now() - 60 days';
    case 'cod':            return 'orders.payment_method = cod  (joined preset)';
    case 'prepaid':        return 'orders.payment_method IN (bkash, nagad, card, online)';
    case 'refunded':       return 'orders.status IN (returned, refunded)';
    case 'blacklist':      return 'fraud_blocklist phone match';
    case 'wholesale':      return `total_spent >= ${t?.wholesale ?? '(threshold)'}`;
    case 'retail':         return `total_spent < ${t?.retail ?? '(threshold)'}`;
    default:               return '—';
  }
}
