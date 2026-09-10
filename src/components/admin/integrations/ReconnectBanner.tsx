import { AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { IntegrationAsset } from '@/hooks/useIntegrationHealth';

interface Props {
  assets: IntegrationAsset[];
  onReconnect: (asset: IntegrationAsset) => void;
}

export function ReconnectBanner({ assets, onReconnect }: Props) {
  const degraded = assets.filter(a => a.health_status && !['connected', 'unknown'].includes(a.health_status));
  if (degraded.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
      <div className="flex-1 text-sm">
        <div className="font-medium">{degraded.length} connection{degraded.length > 1 ? 's' : ''} need reconnecting</div>
        <div className="text-muted-foreground mt-0.5">
          {degraded.slice(0, 3).map(a => a.display_name || a.asset_id).join(', ')}
          {degraded.length > 3 ? ` +${degraded.length - 3} more` : ''}
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={() => onReconnect(degraded[0])}>
        <RotateCw className="h-3.5 w-3.5 mr-1.5" />
        Reconnect
      </Button>
    </div>
  );
}
