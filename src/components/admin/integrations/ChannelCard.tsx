import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { CheckCircle2, Loader2, Plug, MoreHorizontal, RefreshCw, Trash2, AlertTriangle } from 'lucide-react';
import type { IntegrationAsset } from '@/hooks/useIntegrationHealth';

export type Platform = 'facebook' | 'instagram' | 'whatsapp';
export type ChannelStatus = { status?: string; webhook_healthy?: boolean; token_expires_at?: string | null; error?: string };

const ICONS: Record<Platform, string> = {
  facebook: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/messenger.svg',
  instagram: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/instagram.svg',
  whatsapp: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/whatsapp.svg',
};
const BG: Record<Platform, string> = { facebook: 'bg-blue-50', instagram: 'bg-pink-50', whatsapp: 'bg-green-50' };
const DOT: Record<Platform, string> = { facebook: 'bg-[#1877F2]', instagram: 'bg-[#DD2A7B]', whatsapp: 'bg-[#25D366]' };
const BTN: Record<Platform, string> = {
  facebook: 'bg-[#1877F2] hover:bg-[#166fe0] text-white',
  instagram: 'bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#8134AF] hover:opacity-90 text-white',
  whatsapp: 'bg-[#25D366] hover:bg-[#20bf5b] text-white',
};
const TITLE: Record<Platform, string> = {
  facebook: 'Facebook Messenger',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp Business',
};
const SUBTITLE: Record<Platform, string> = {
  facebook: 'Page DM ও Comment Smart Inbox-এ',
  instagram: 'Connect via Facebook (Business Account দরকার)',
  whatsapp: 'WhatsApp Cloud API চ্যাট inbox-এ',
};

function StatusPill({ s, connecting, syncing, expiringSoon }: { s?: ChannelStatus; connecting?: boolean; syncing?: boolean; expiringSoon?: boolean }) {
  if (connecting)
    return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 gap-1"><Loader2 className="h-3 w-3 animate-spin" />Connecting…</Badge>;
  if (s?.status === 'expired')
    return <Badge variant="destructive">Token expired</Badge>;
  if (s?.status === 'connected' && s.webhook_healthy === false)
    return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 gap-1"><AlertTriangle className="h-3 w-3" />Needs reconnect</Badge>;
  if (expiringSoon)
    return <Badge variant="outline" className="border-amber-500 text-amber-700">Expiring soon</Badge>;
  if (syncing)
    return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 gap-1"><Loader2 className="h-3 w-3 animate-spin" />Syncing…</Badge>;
  if (s?.status === 'connected')
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 gap-1"><CheckCircle2 className="h-3 w-3" />Connected</Badge>;
  return null;
}

type Props = {
  platform: Platform;
  connected: boolean;
  loading: boolean;
  status?: ChannelStatus;
  meta?: { name?: string; sub?: string };
  assets?: IntegrationAsset[];
  syncing?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onConnect: () => void;
  onRefresh: () => void;
  onDisconnect: () => void;
  onAssetReconnect?: (a: IntegrationAsset) => void;
};

export function ChannelCard({ platform, connected, loading, status, meta, assets = [], syncing, disabled, disabledReason, onConnect, onRefresh, onDisconnect, onAssetReconnect }: Props) {
  const expiringSoon = !!(status?.token_expires_at
    && new Date(status.token_expires_at).getTime() - Date.now() < 7 * 24 * 3600 * 1000);
  const connecting = loading && !connected;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center gap-4 flex-wrap">
          <div className={`w-14 h-14 rounded-2xl ${BG[platform]} flex items-center justify-center shrink-0`}>
            <img src={ICONS[platform]} alt={TITLE[platform]} className="w-8 h-8" loading="lazy" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="font-semibold">{TITLE[platform]}</div>
              <StatusPill s={status} connecting={connecting} syncing={syncing && connected} expiringSoon={connected && expiringSoon} />
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 truncate">
              {connected ? (meta?.name || meta?.sub || '') : SUBTITLE[platform]}
            </div>
            {status?.error && <div className="text-xs text-destructive mt-1">{status.error}</div>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!connected ? (
              <Button
                className={BTN[platform]}
                disabled={loading || disabled}
                onClick={onConnect}
                title={disabled ? disabledReason : undefined}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plug className="h-4 w-4 mr-2" />}
                Connect
              </Button>
            ) : (
              <>
                {(status?.status === 'expired' || expiringSoon || status?.webhook_healthy === false) && (
                  <Button size="sm" variant="outline" onClick={onConnect} disabled={disabled} title={disabled ? disabledReason : undefined}>Reconnect</Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" disabled={loading}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onRefresh}><RefreshCw className="h-4 w-4 mr-2" />Refresh status</DropdownMenuItem>
                    <DropdownMenuItem onClick={onConnect} disabled={disabled}><Plug className="h-4 w-4 mr-2" />Reconnect</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onDisconnect} className="text-destructive focus:text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" />Disconnect
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>

        {connected && assets.length > 0 && (
          <div className="mt-3 pl-[72px] flex flex-wrap gap-1.5">
            {assets.map(a => {
              const broken = a.health_status !== 'connected' && a.health_status !== 'unknown';
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => broken && onAssetReconnect?.(a)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs border transition ${
                    broken
                      ? 'border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10 cursor-pointer'
                      : 'border-border bg-secondary text-secondary-foreground cursor-default'
                  }`}
                  title={broken ? 'Click to reconnect' : (a.display_name || a.asset_id)}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${broken ? 'bg-destructive' : DOT[platform]}`} />
                  <span className="truncate max-w-[180px]">{a.display_name || a.asset_id}</span>
                  {broken && <AlertTriangle className="h-3 w-3" />}
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
