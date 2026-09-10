/**
 * Performance optimization feature toggles
 * Persisted in localStorage so admin settings survive reloads
 */

const STORAGE_KEY = 'perf_config';

export interface PerformanceConfig {
  codeSplitting: boolean;
  lazyImages: boolean;
  dnsPrefetch: boolean;
  cacheOptimization: boolean;
  imageOptimization: boolean;
}

const DEFAULTS: PerformanceConfig = {
  codeSplitting: true,
  lazyImages: true,
  dnsPrefetch: true,
  cacheOptimization: true,
  imageOptimization: true,
};

export function getPerformanceConfig(): PerformanceConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULTS };
}

export function setPerformanceConfig(config: Partial<PerformanceConfig>): PerformanceConfig {
  const current = getPerformanceConfig();
  const updated = { ...current, ...config };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function clearAllCaches() {
  // Clear React Query cache (caller should use queryClient.clear())
  // Clear localStorage cache entries
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('rq-') || key.startsWith('REACT_QUERY'))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));

  // Clear sessionStorage
  sessionStorage.clear();
}
