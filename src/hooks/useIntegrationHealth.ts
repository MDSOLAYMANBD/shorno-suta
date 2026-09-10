import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface IntegrationAsset {
  id: string;
  platform: string;
  asset_type: string;
  asset_id: string;
  parent_id: string | null;
  display_name: string | null;
  webhook_subscribed: boolean;
  health_status: 'unknown' | 'connected' | 'token_expired' | 'permission_missing' | 'reconnect_required';
  last_health_check_at: string | null;
  token_expires_at: string | null;
  health_detail?: any;
  scopes?: string[] | null;
}

const POLL_MS = 5 * 60 * 1000;
const EXPIRY_WARN_DAYS = 14;

export function useIntegrationHealth(autoPoll = true) {
  const [assets, setAssets] = useState<IntegrationAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('integration_assets')
        .select('*')
        .order('platform', { ascending: true });
      setAssets((data as IntegrationAsset[] | null) || []);
    } finally {
      setLoading(false);
    }
  }, []);

  const runHealthCheck = useCallback(async (assetId?: string) => {
    setChecking(true);
    try {
      await supabase.functions.invoke('meta-health-check', { body: assetId ? { asset_id: assetId } : {} });
      await refresh();
    } finally {
      setChecking(false);
    }
  }, [refresh]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!autoPoll) return;
    const id = setInterval(() => { runHealthCheck().catch(() => {}); }, POLL_MS);
    return () => clearInterval(id);
  }, [autoPoll, runHealthCheck]);

  const expiringSoon = useMemo(() => {
    const now = Date.now();
    const cutoff = now + EXPIRY_WARN_DAYS * 24 * 3600 * 1000;
    return assets.filter(a => {
      if (!a.token_expires_at) return false;
      const exp = new Date(a.token_expires_at).getTime();
      return exp > now && exp < cutoff;
    });
  }, [assets]);

  const degraded = useMemo(
    () => assets.filter(a => a.health_status && !['connected', 'unknown'].includes(a.health_status)),
    [assets],
  );

  return { assets, loading, checking, refresh, runHealthCheck, expiringSoon, degraded };
}
