// Server-side paginated customer preview with debounced search and sort.
// Reusable across CRM, Marketing, and Orders modules.

import { useEffect, useMemo, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { detectDistrict } from '@/lib/audience/districts';
import { normalizeBdPhone } from '@/lib/audience/helpers';
import type { AudienceCustomer, AudienceFilter } from '@/lib/audience/types';
import { previewAudience, getCachedCustomers } from '@/lib/audience/engine';


export type SortField = 'name' | 'total_orders' | 'total_spent' | 'last_order_date' | 'created_at';

export interface PreviewOptions {
  filter: AudienceFilter;
  search: string;
  sortBy: SortField;
  sortDir: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export function useCustomerPreview(opts: PreviewOptions) {
  const debouncedSearch = useDebounced(opts.search, 350);
  const filterIsEmpty =
    opts.filter.include.length +
    opts.filter.exclude.length +
    opts.filter.districts.length +
    opts.filter.parcelStatuses.length +
    (opts.filter.manualInclude?.length || 0) === 0;

  const queryKey = useMemo(
    () => ['customer-preview', opts.filter, debouncedSearch, opts.sortBy, opts.sortDir, opts.page, opts.pageSize],
    [opts.filter, debouncedSearch, opts.sortBy, opts.sortDir, opts.page, opts.pageSize],
  );

  return useQuery({
    queryKey,
    placeholderData: keepPreviousData,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: 1,
    queryFn: async () => {
      // When a search term is present, prefer the already-cached customer pool
      // (loaded by the Audience Engine) so keystrokes do NOT hit the database.
      // Only fall back to a server query if no in-memory cache exists yet.
      if (debouncedSearch.trim()) {
        const term = debouncedSearch.trim().toLowerCase();
        const isDigits = /^\d+$/.test(term);
        const cached = getCachedCustomers();
        if (cached?.rows?.length) {
          const matches = cached.rows.filter((r: any) => {
            if (isDigits) return (r.phone || '').toLowerCase().includes(term);
            return (
              (r.name || '').toLowerCase().includes(term) ||
              (r.address || '').toLowerCase().includes(term)
            );
          });
          // sort in-memory
          matches.sort((a: any, b: any) => {
            const va = a[opts.sortBy];
            const vb = b[opts.sortBy];
            if (va == null && vb == null) return 0;
            if (va == null) return 1;
            if (vb == null) return -1;
            if (va < vb) return opts.sortDir === 'asc' ? -1 : 1;
            if (va > vb) return opts.sortDir === 'asc' ? 1 : -1;
            return 0;
          });
          const from = opts.page * opts.pageSize;
          const slice = matches.slice(from, from + opts.pageSize);
          const rows: AudienceCustomer[] = slice.map(mapCustomer);
          return { rows, total: matches.length, page: opts.page, pageSize: opts.pageSize };
        }
        // Fallback (cache not warm yet) — query DB once.
        const from = opts.page * opts.pageSize;
        const to = from + opts.pageSize - 1;
        let q: any = supabase
          .from('customers')
          .select(
            'phone, name, address, total_orders, delivered_orders, total_spent, last_order_date, created_at',
            { count: 'exact' },
          );
        if (isDigits) {
          q = q.ilike('phone', `%${term}%`);
        } else {
          q = q.or(`name.ilike.%${term}%,address.ilike.%${term}%`);
        }
        q = q.order(opts.sortBy, { ascending: opts.sortDir === 'asc', nullsFirst: false }).range(from, to);
        const { data, count, error } = await q;
        if (error) throw error;
        const rows: AudienceCustomer[] = (data || []).map((r: any) => mapCustomer(r));
        return { rows, total: count || 0, page: opts.page, pageSize: opts.pageSize };
      }

      // No search → respect active filter via engine
      if (filterIsEmpty) {
        return { rows: [], total: 0, page: opts.page, pageSize: opts.pageSize };
      }
      return previewAudience(opts.filter, opts.page, opts.pageSize);
    },

  });
}

function mapCustomer(r: any): AudienceCustomer {
  const phone = normalizeBdPhone(r.phone) || r.phone;
  const d = detectDistrict(r.address);
  return {
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
    customer_type: r.delivered_orders >= 5 ? 'VIP' : r.delivered_orders >= 2 ? 'Repeat' : 'New',
    tags: [],
    matchedBy: [],
  };
}
