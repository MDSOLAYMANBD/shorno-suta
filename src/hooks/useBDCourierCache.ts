import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = 'https://gdwvktufhsbrblzzeiir.supabase.co';

export interface CourierBreakdown {
  key: string;
  name: string;
  logo: string;
  totalParcel: number;
  successParcel: number;
  cancelledParcel: number;
  successRate: number;
}

export interface CourierCacheResult {
  successRate: number | null;
  totalParcel: number;
  successParcel: number;
  cancelledParcel: number;
  courierBreakdown: CourierBreakdown[];
  status: 'loading' | 'success' | 'error' | 'no-data';
}

// ── Module-level persistent cache ──
const STORAGE_KEY = 'bd_courier_cache';
const memoryCache = new Map<string, any>();
let dbLoaded = false;
let dbLoadPromise: Promise<void> | null = null;

// ── Global listener pattern for cross-component sync ──
const listeners = new Set<() => void>();
function notifyAll() { listeners.forEach(fn => fn()); }

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, any>;
      for (const [k, v] of Object.entries(parsed)) {
        if (!memoryCache.has(k)) memoryCache.set(k, v);
      }
    }
  } catch { /* ignore */ }
}
loadFromStorage();

function saveToStorage() {
  try {
    const obj: Record<string, any> = {};
    memoryCache.forEach((v, k) => { obj[k] = v; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch { /* ignore */ }
}

async function loadFromDB() {
  if (dbLoaded) return;
  if (dbLoadPromise) return dbLoadPromise;
  
  dbLoadPromise = (async () => {
    try {
      const { data } = await supabase
        .from('customers')
        .select('phone, courier_data')
        .not('courier_data', 'is', null);
      
      if (data) {
        for (const row of data) {
          if (row.phone && row.courier_data && !memoryCache.has(row.phone)) {
            memoryCache.set(row.phone, row.courier_data);
          }
        }
        saveToStorage();
      }
    } catch { /* ignore */ }
    dbLoaded = true;
  })();
  
  return dbLoadPromise;
}

async function saveToDB(phone: string, courierData: any) {
  try {
    await (supabase as any)
      .from('customers')
      .update({ 
        courier_data: courierData, 
        courier_checked_at: new Date().toISOString() 
      })
      .eq('phone', phone);
  } catch { /* ignore */ }
}

const KNOWN_COURIERS = ['steadfast', 'pathao', 'redx', 'paperfly', 'carrybee', 'parceldex', 'sundarban', 'janani', 'pidex', 'barahi'];

function parseCourierResult(source: any): CourierCacheResult {
  if (source?.status === 'success' && source?.data?.summary) {
    const s = source.data.summary;
    const breakdown: CourierBreakdown[] = [];
    
    // Parse per-courier data
    for (const key of KNOWN_COURIERS) {
      const c = source.data?.[key];
      if (c && c.total_parcel > 0) {
        breakdown.push({
          key,
          name: c.name || key,
          logo: c.logo || '',
          totalParcel: c.total_parcel ?? 0,
          successParcel: c.success_parcel ?? 0,
          cancelledParcel: c.cancelled_parcel ?? 0,
          successRate: c.success_ratio != null ? parseFloat(c.success_ratio) : 0,
        });
      }
    }
    
    // Also check any unknown courier keys
    if (source.data) {
      for (const [key, val] of Object.entries(source.data)) {
        if (key === 'summary' || KNOWN_COURIERS.includes(key) || typeof val !== 'object' || val === null) continue;
        const c = val as any;
        if (c.total_parcel > 0) {
          breakdown.push({
            key,
            name: c.name || key,
            logo: c.logo || '',
            totalParcel: c.total_parcel ?? 0,
            successParcel: c.success_parcel ?? 0,
            cancelledParcel: c.cancelled_parcel ?? 0,
            successRate: c.success_ratio != null ? parseFloat(c.success_ratio) : 0,
          });
        }
      }
    }
    
    // Sort by total parcels descending
    breakdown.sort((a, b) => b.totalParcel - a.totalParcel);

    return {
      successRate: s.success_ratio != null ? parseFloat(s.success_ratio) : null,
      totalParcel: s.total_parcel ?? 0,
      successParcel: s.success_parcel ?? 0,
      cancelledParcel: s.cancelled_parcel ?? 0,
      courierBreakdown: breakdown,
      status: 'success',
    };
  }
  return { successRate: null, totalParcel: 0, successParcel: 0, cancelledParcel: 0, courierBreakdown: [], status: 'no-data' };
}

export function useBDCourierCache() {
  const [, setTick] = useState(0);

  // Register as global listener for cross-component updates
  useEffect(() => {
    const tick = () => setTick(t => t + 1);
    listeners.add(tick);
    return () => { listeners.delete(tick); };
  }, []);

  const getCourierData = useCallback((phone: string): CourierCacheResult | null => {
    if (!phone) return null;
    const cached = memoryCache.get(phone);
    if (!cached) return null;
    return parseCourierResult(cached);
  }, []);

  // Targeted refresh for exactly the phones currently on screen — unlike
  // loadFromDB/preloadFromDB (gated by a one-time `dbLoaded` flag, so a check
  // that completed after the page was first opened never showed up without a
  // hard reload), this re-queries every time it's called, so a list of
  // orders that keeps auto-checking new phones in the background stays current.
  const preloadPhones = useCallback(async (phones: string[]) => {
    const toFetch = Array.from(new Set(phones.filter(p => p && !memoryCache.has(p))));
    if (toFetch.length === 0) return;
    try {
      const { data } = await supabase.from('customers').select('phone, courier_data').in('phone', toFetch).not('courier_data', 'is', null);
      if (data && data.length > 0) {
        for (const row of data) {
          if (row.phone && row.courier_data) memoryCache.set(row.phone, row.courier_data);
        }
        saveToStorage();
        notifyAll();
      }
    } catch { /* ignore */ }
  }, []);

  const fetchPhone = useCallback(async (phone: string): Promise<CourierCacheResult> => {
    if (!phone) return { successRate: null, totalParcel: 0, successParcel: 0, cancelledParcel: 0, courierBreakdown: [], status: 'no-data' };

    if (memoryCache.has(phone)) {
      return parseCourierResult(memoryCache.get(phone));
    }

    await loadFromDB();
    if (memoryCache.has(phone)) {
      notifyAll();
      return parseCourierResult(memoryCache.get(phone));
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Not authenticated');

    const res = await fetch(`${SUPABASE_URL}/functions/v1/bd-courier-check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ phone }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'API error');

    memoryCache.set(phone, data);
    saveToStorage();
    saveToDB(phone, data);

    notifyAll();
    return parseCourierResult(data);
  }, []);

  const refreshPhone = useCallback(async (phone: string): Promise<CourierCacheResult> => {
    if (!phone) return { successRate: null, totalParcel: 0, successParcel: 0, cancelledParcel: 0, courierBreakdown: [], status: 'no-data' };
    memoryCache.delete(phone);
    saveToStorage();
    return fetchPhone(phone);
  }, [fetchPhone]);

  const preloadFromDB = useCallback(async () => {
    await loadFromDB();
    notifyAll();
  }, []);

  return { getCourierData, fetchPhone, refreshPhone, preloadFromDB, preloadPhones };
}
