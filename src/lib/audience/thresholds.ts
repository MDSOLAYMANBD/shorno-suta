// Configurable thresholds — stored in `store_settings` so admins can tune
// them without code changes. All engine logic reads through `getThresholds()`.

import { supabase } from '@/integrations/supabase/client';

export interface AudienceThresholds {
  highSpend: number;
  lowSpend: number;
  wholesale: number;   // total_spent >= this counts as wholesale
  retail: number;      // total_spent <  this counts as retail
}

export const DEFAULT_THRESHOLDS: AudienceThresholds = {
  highSpend: 5000,
  lowSpend: 1000,
  wholesale: 20000,
  retail: 20000,
};

const SETTING_KEY = 'audience_thresholds';

let _cache: Promise<AudienceThresholds> | null = null;

export function invalidateThresholds() { _cache = null; }

export function getThresholds(): Promise<AudienceThresholds> {
  if (_cache) return _cache;
  _cache = (async () => {
    try {
      const { data } = await supabase
        .from('store_settings')
        .select('value')
        .eq('key', SETTING_KEY)
        .maybeSingle();
      if (!data?.value) return DEFAULT_THRESHOLDS;
      const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      return { ...DEFAULT_THRESHOLDS, ...parsed };
    } catch {
      return DEFAULT_THRESHOLDS;
    }
  })();
  return _cache;
}

export async function saveThresholds(t: AudienceThresholds) {
  const { error } = await supabase
    .from('store_settings')
    .upsert({ key: SETTING_KEY, value: JSON.stringify(t) }, { onConflict: 'key' });
  if (error) throw error;
  invalidateThresholds();
}
