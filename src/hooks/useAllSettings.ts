import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
// Master settings hook — consolidates all store_settings queries into one

/**
 * Master hook: fetches ALL store_settings in a single query.
 * All other settings hooks derive from this to avoid duplicate round-trips.
 */
export function useAllSettings() {
  return useQuery({
    queryKey: ['all-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_settings')
        .select('key, value');
      if (error) throw error;
      const map: Record<string, string> = {};
      data?.forEach((s: any) => { map[s.key] = s.value; });
      return map;
    },
    staleTime: 30 * 1000,        // 30s — keeps shipping/pricing changes fresh across customer browsers
    gcTime: 10 * 60 * 1000,      // 10 min garbage collection
    refetchOnWindowFocus: true,  // refresh when user returns to tab
  });
}
