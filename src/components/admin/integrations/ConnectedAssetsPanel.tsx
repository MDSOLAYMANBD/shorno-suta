import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RotateCw, RefreshCw, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import type { IntegrationAsset } from '@/hooks/useIntegrationHealth';

interface Props {
  assets: IntegrationAsset[];
  loading?: boolean;
  checking?: boolean;
  onReconnect: (asset: IntegrationAsset) => void;
  onSync: (asset: IntegrationAsset) => void;
}

const ASSET_LABEL: Record<string, string> = {
  fb_page: 'Facebook Page',
  ig_business: 'Instagram Business',
  waba_phone: 'WhatsApp Number',
};

const PLATFORM_ORDER = ['messenger', 'instagram', 'whatsapp'];

function relTime(iso: string | null): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function HealthBadge({ status }: { status: IntegrationAsset['health_status'] }) {
  if (status === 'connected') {
    return <Badge variant="outline" className="border-green-500 text-green-700 dark:text-green-400 gap-1"><CheckCircle2 className="h-3 w-3" />connected</Badge>;
  }
  if (status === 'unknown') {
    return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />unknown</Badge>;
  }
  return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />{status.replace('_', ' ')}</Badge>;
}

export function ConnectedAssetsPanel({ assets, checking, onReconnect, onSync }: Props) {
  const grouped = useMemo(() => {
    const g: Record<string, IntegrationAsset[]> = {};
    for (const a of assets) {
      (g[a.platform] ||= []).push(a);
    }
    return g;
  }, [assets]);

  if (assets.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>Connected Assets</span>
          {checking && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {PLATFORM_ORDER.filter(p => grouped[p]?.length).map(platform => (
          <div key={platform} className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {platform === 'messenger' ? 'Facebook Pages' : platform === 'instagram' ? 'Instagram Business' : 'WhatsApp Numbers'}
              <span className="ml-1 text-muted-foreground/60">({grouped[platform].length})</span>
            </div>
            <div className="space-y-1.5">
              {grouped[platform].map(a => (
                <div key={a.id} className="border rounded-md p-2.5 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{a.display_name || a.asset_id}</div>
                    <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-2">
                      <span>{ASSET_LABEL[a.asset_type] || a.asset_type}</span>
                      <span>·</span>
                      <span>id {a.asset_id}</span>
                      {a.webhook_subscribed && <><span>·</span><span>webhook ✓</span></>}
                      <span>·</span>
                      <span>last sync {relTime(a.last_health_check_at)}</span>
                    </div>
                  </div>
                  <HealthBadge status={a.health_status} />
                  <Button size="sm" variant="ghost" onClick={() => onSync(a)} title="Sync now">
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                  {a.health_status !== 'connected' && a.health_status !== 'unknown' && (
                    <Button size="sm" variant="outline" onClick={() => onReconnect(a)}>
                      <RotateCw className="h-3.5 w-3.5 mr-1" /> Reconnect
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
