// Live counts for the audience UI. All counts come from existing tables.
// Pure read hooks — no business logic in UI.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { countPreset, getDistrictBuckets, computeAllPresetCounts } from '@/lib/audience/engine';
import {
  audienceKeys,
  AUDIENCE_CACHE_DEFAULTS,
  DISTRICT_CACHE_DEFAULTS,
} from '@/lib/audience/cache';
import { PRESETS } from '@/lib/audience/presets';
import { PARCEL_STATUSES } from '@/lib/audience/parcelStatuses';
import type { PresetId } from '@/lib/audience/types';

export function usePresetCount(id: PresetId, enabled = true) {
  return useQuery({
    queryKey: audienceKeys.presetCount(id),
    queryFn: () => countPreset(id),
    enabled,
    ...AUDIENCE_CACHE_DEFAULTS,
  });
}

export function useAllPresetCounts(enabled = true) {
  return useQuery({
    queryKey: ['audience', 'preset-counts-all'],
    queryFn: async () => {
      try {
        return await computeAllPresetCounts(PRESETS.map((p) => p.id));
      } catch {
        return Object.fromEntries(PRESETS.map((p) => [p.id, 0])) as Record<PresetId, number>;
      }
    },
    enabled,
    ...AUDIENCE_CACHE_DEFAULTS,
  });
}

export function useDistrictCounts(enabled = true) {
  return useQuery({
    queryKey: audienceKeys.districtCounts(),
    queryFn: getDistrictBuckets,
    enabled,
    ...DISTRICT_CACHE_DEFAULTS,
  });
}

// Pull live counts grouped by `orders.status`. We count orders (not customers)
// because grouped-distinct is not pushdownable via PostgREST; an order-grouped
// view is sufficient for UI badges.
export function useParcelStatusCounts(enabled = true) {
  return useQuery({
    queryKey: audienceKeys.parcelStatusCounts(),
    queryFn: async () => {
      const results = await Promise.all(
        PARCEL_STATUSES.map(async (def) => {
          let q: any = supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .is('deleted_at', null);
          q = def.orderStatusValues.length === 1
            ? q.eq('status', def.orderStatusValues[0])
            : q.in('status', def.orderStatusValues);
          const { count } = await q;
          return [def.id, count || 0] as const;
        }),
      );
      return Object.fromEntries(results) as Record<string, number>;
    },
    enabled,
    ...AUDIENCE_CACHE_DEFAULTS,
  });
}
