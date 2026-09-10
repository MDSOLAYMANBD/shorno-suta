// react-query keys for the audience engine. Channels share these so SMS,
// WhatsApp, Email, etc. invalidate consistently.

import type { AudienceFilter, PresetId } from './types';

export const audienceKeys = {
  all: ['audience'] as const,
  presetCount: (id: PresetId) => ['audience', 'preset-count', id] as const,
  districtCounts: () => ['audience', 'district-counts'] as const,
  parcelStatusCounts: () => ['audience', 'parcel-status-counts'] as const,
  preview: (filter: AudienceFilter, page: number) =>
    ['audience', 'preview', filter, page] as const,
  summary: (filter: AudienceFilter) =>
    ['audience', 'summary', filter] as const,
  saved: () => ['audience', 'saved'] as const,
};

// Shared options for every audience-related useQuery. Optimized for
// "load once, stay in memory" UX — interactions like tab switching,
// dialog open, column toggle must not trigger a refetch.
import { keepPreviousData } from '@tanstack/react-query';

export const AUDIENCE_CACHE_DEFAULTS = {
  staleTime: 60 * 60_000,
  gcTime: 2 * 60 * 60_000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchOnMount: false,
  retry: 1,
  placeholderData: keepPreviousData,
} as const;

export const DISTRICT_CACHE_DEFAULTS = {
  staleTime: 60 * 60_000,
  gcTime: 2 * 60 * 60_000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchOnMount: false,
  retry: 1,
  placeholderData: keepPreviousData,
} as const;
