import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** Polls the current live-visitor count (public.get_live_visitor_count RPC).
 * 30s refetch is plenty fresh for a "people watching now" badge and keeps
 * the request volume trivial — React Query dedupes this across every
 * component that mounts the hook on the same page. */
export function useLiveVisitorCount() {
  return useQuery({
    queryKey: ['live-visitor-count'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_live_visitor_count' as any);
      if (error) throw error;
      return Number(data) || 0;
    },
    staleTime: 25_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}
