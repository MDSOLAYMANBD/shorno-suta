// Customer Database status pill — shows cache freshness, lets the user
// trigger a manual refresh, and silently polls in the background so the
// cached dataset stays warm without ever clearing the UI.

import { memo, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCcw, Database, CheckCircle2 } from 'lucide-react';
import { refreshAudienceCache, getCachedCustomers, ensureAudienceCache } from '@/lib/audience/engine';
import { audienceKeys } from '@/lib/audience/cache';

// Silent background refresh disabled — was invalidating queries every 60s
// causing visible re-loads of the entire audience panel. Users can hit the
// manual "Refresh" button when they want fresh data.
const BACKGROUND_REFRESH_MS = 0;
const STATUS_STORAGE_KEY = 'audience.customerDatabaseStatus';

function readStoredStatus(): { count: number; at: number | null } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STATUS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { count?: number; at?: number };
    return {
      count: Number.isFinite(parsed.count) ? Number(parsed.count) : 0,
      at: Number.isFinite(parsed.at) ? Number(parsed.at) : null,
    };
  } catch {
    return null;
  }
}

function writeStoredStatus(count: number, at: number | null) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify({ count, at }));
  } catch {
    // localStorage is best-effort only.
  }
}

function formatAgo(at: number | null): string {
  if (!at) return '—';
  const sec = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.round(min / 60);
  return `${hr} hour${hr === 1 ? '' : 's'} ago`;
}

function CustomerDatabaseStatus() {
  const qc = useQueryClient();
  const initial = getCachedCustomers();
  const stored = !initial ? readStoredStatus() : null;
  const [count, setCount] = useState<number>(initial?.rows.length ?? stored?.count ?? 0);
  const [at, setAt] = useState<number | null>(initial?.at ?? stored?.at ?? null);
  const [refreshing, setRefreshing] = useState(false);
  const [, force] = useState(0); // re-render only this tiny pill for "X minutes ago"
  const mountedRef = useRef(true);

  // Tick every 5 minutes to keep "last sync" readable without causing visible churn.
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 5 * 60_000);
    return () => clearInterval(t);
  }, []);

  const runRefresh = async (opts: { silent: boolean }) => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const res = await refreshAudienceCache();
      if (!mountedRef.current) return;
      setCount(res.currentCount);
      setAt(res.at);
      writeStoredStatus(res.currentCount, res.at);
      if (res.changed) {
        toast.success('Customer database updated.');
        // Invalidate derived caches so previews/summaries quietly re-pull
        // from the fresh in-memory pool. Existing UI stays mounted thanks
        // to `keepPreviousData`.
        qc.invalidateQueries({ queryKey: audienceKeys.all });
        qc.invalidateQueries({ queryKey: ['audience', 'preset-counts-all'] });
        qc.invalidateQueries({ queryKey: ['customer-preview'] });
        qc.invalidateQueries({ queryKey: ['sms-engine-resolve'] });
        qc.invalidateQueries({ queryKey: ['sms-engine-analytics'] });
      } else if (!opts.silent) {
        toast('Database already up to date.');
      }
    } catch (e: any) {
      if (!opts.silent) toast.error(e?.message || 'Refresh failed');
    } finally {
      if (mountedRef.current) setRefreshing(false);
    }
  };

  // Warm cache on first mount only if empty. No background polling —
  // silent refreshes were causing the whole panel to re-render/flicker.
  useEffect(() => {
    mountedRef.current = true;
    if (!getCachedCustomers()) {
      setRefreshing(true);
      ensureAudienceCache()
        .then((res) => {
          if (!mountedRef.current) return;
          setCount(res.currentCount);
          setAt(res.at);
          writeStoredStatus(res.currentCount, res.at);
        })
        .catch(() => {})
        .finally(() => {
          if (mountedRef.current) setRefreshing(false);
        });
    }
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loaded = count > 0;

  return (
    <Card className="px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
      <div className="flex items-center gap-1.5 font-semibold">
        <Database className="h-3.5 w-3.5 text-primary" />
        Customer Database
      </div>
      <Badge
        variant="outline"
        className={
          loaded
            ? 'border-emerald-500/40 text-emerald-600 gap-1'
            : 'border-amber-500/40 text-amber-600 gap-1'
        }
      >
        {loaded ? <CheckCircle2 className="h-3 w-3" /> : <Loader2 className="h-3 w-3 animate-spin" />}
        {loaded ? 'Loaded' : 'Loading'}
      </Badge>
      <div className="font-mono">
        <span className="font-semibold">{count.toLocaleString()}</span>{' '}
        <span className="text-muted-foreground">Customers</span>
      </div>
      <div className="text-muted-foreground">
        Last Sync: <span className="font-mono">{formatAgo(at)}</span>
      </div>
      <div className="ml-auto">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          onClick={() => runRefresh({ silent: false })}
          disabled={refreshing}
        >
          {refreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />}
          Refresh
        </Button>
      </div>
    </Card>
  );
}

export default memo(CustomerDatabaseStatus);
