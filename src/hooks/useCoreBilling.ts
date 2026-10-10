import { useQuery } from '@tanstack/react-query';
import { getCoreStatus, type CoreStatus } from '@/lib/coreConnect';

/** This site's bill, package and lock at CORE (src/lib/coreConnect.ts). */
export function useCoreBilling(enabled = true) {
  return useQuery<CoreStatus>({
    queryKey: ['core-billing'],
    queryFn: getCoreStatus,
    enabled,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: false,
  });
}
