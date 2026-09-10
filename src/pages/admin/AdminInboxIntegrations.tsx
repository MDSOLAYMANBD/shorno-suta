import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Settings as SettingsIcon, Activity, AlertTriangle, ExternalLink } from 'lucide-react';
import { ChannelCard, type Platform, type ChannelStatus } from '@/components/admin/integrations/ChannelCard';
import { OAuthDiagnostics } from '@/components/admin/integrations/OAuthDiagnostics';
import { RawOAuthUrlInspector } from '@/components/admin/integrations/RawOAuthUrlInspector';
import { DeveloperSettingsDrawer } from '@/components/admin/integrations/DeveloperSettingsDrawer';
import { ReconnectBanner } from '@/components/admin/integrations/ReconnectBanner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { launchOAuth } from '@/lib/oauth/launchOAuth';
import { isCanonicalOrigin, canonicalIntegrationsUrl } from '@/lib/oauth/canonical';
import { useIntegrationHealth, type IntegrationAsset } from '@/hooks/useIntegrationHealth';
import { enqueue } from '@/lib/oauth/core/syncQueue';

const TITLE: Record<Platform, string> = {
  facebook: 'Facebook Messenger',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp Business',
};

const ASSET_PLATFORM_MAP: Record<Platform, string[]> = {
  facebook: ['messenger', 'facebook'],
  instagram: ['instagram'],
  whatsapp: ['whatsapp'],
};

export default function AdminInboxIntegrations() {
  const { data: settings, refetch } = useStoreSettings();
  const s: any = settings || {};

  const appId = s.meta_app_id || '';
  const waConfigId = s.meta_wa_embedded_signup_config_id || '';
  const igConfigId = s.meta_ig_login_config_id || '';
  const igEmbedUrl = s.meta_ig_business_login_url || '';

  const fbConnected = !!s.meta_page_id;
  const igConnected = !!s.instagram_business_account_id;
  const waConnected = !!s.whatsapp_phone_number_id;

  const [statuses, setStatuses] = useState<Partial<Record<Platform, ChannelStatus>>>({});
  const [loadingPlatform, setLoadingPlatform] = useState<Platform | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [diagOpen, setDiagOpen] = useState(false);
  const onCanonical = isCanonicalOrigin();
  const autoOpenRan = useRef(false);
  const handoffRan = useRef(false);
  const { assets, checking, refresh: healthRefresh, runHealthCheck } = useIntegrationHealth(true);

  const assetPlatformToOAuth = (p: string): Platform => (p === 'messenger' ? 'facebook' : (p as Platform));

  const handleAssetReconnect = (a: IntegrationAsset) => startOAuth(assetPlatformToOAuth(a.platform), 'reconnect', a.id);

  const assetsByPlatform = useMemo(() => {
    const map: Record<Platform, IntegrationAsset[]> = { facebook: [], instagram: [], whatsapp: [] };
    for (const a of assets) {
      for (const p of Object.keys(ASSET_PLATFORM_MAP) as Platform[]) {
        if (ASSET_PLATFORM_MAP[p].includes(a.platform)) map[p].push(a);
      }
    }
    return map;
  }, [assets]);

  // Preview → canonical auto-handoff (once per mount).
  useEffect(() => {
    if (onCanonical || handoffRan.current) return;
    handoffRan.current = true;
    const t = setTimeout(() => {
      try { window.open(canonicalIntegrationsUrl(), '_blank', 'noopener'); } catch {}
    }, 700);
    return () => clearTimeout(t);
  }, [onCanonical]);

  useEffect(() => {
    (async () => {
      const platforms: Platform[] = [];
      if (fbConnected) platforms.push('facebook');
      if (igConnected) platforms.push('instagram');
      if (waConnected) platforms.push('whatsapp');
      for (const p of platforms) {
        try {
          const { data } = await supabase.functions.invoke('meta-refresh-status', { body: { platform: p } });
          if (data) setStatuses(prev => ({ ...prev, [p]: data }));
        } catch (_) { /* ignore */ }
      }
    })();
  }, [fbConnected, igConnected, waConnected]);

  const refresh = async (p: Platform) => {
    setLoadingPlatform(p);
    try {
      const { data, error } = await supabase.functions.invoke('meta-refresh-status', { body: { platform: p } });
      if (error) throw error;
      setStatuses(prev => ({ ...prev, [p]: data }));
      toast.success('Status refreshed');
    } catch (e: any) {
      toast.error(e?.message || 'Refresh failed');
    } finally { setLoadingPlatform(null); }
  };

  const disconnect = async (p: Platform) => {
    if (!confirm(`${TITLE[p]} disconnect করতে চান?`)) return;
    setLoadingPlatform(p);
    try {
      const { error } = await supabase.functions.invoke('meta-disconnect', { body: { platform: p } });
      if (error) throw error;
      toast.success('Disconnected');
      await refetch();
      setStatuses(prev => ({ ...prev, [p]: { status: 'disconnected' } }));
    } catch (e: any) {
      toast.error(e?.message || 'Disconnect failed');
    } finally { setLoadingPlatform(null); }
  };

  const startOAuth = useCallback(async (platform: Platform, mode: 'connect' | 'reconnect' = 'connect', assetId?: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('meta-oauth-preflight', { body: {} });
      if (error) throw error;
      const pf = data as any;
      if (!pf?.app_id_set) { setShowSetup(true); toast.error('আগে Meta App ID সেট করুন (Developer Settings)'); return; }
      if (!pf?.app_secret_set) { setDiagOpen(true); toast.error('META_APP_SECRET secret সেট করা নেই'); return; }
      if (platform === 'whatsapp' && !pf?.whatsapp_config_id_set) {
        setShowSetup(true); toast.error('আগে WhatsApp Embedded Signup Config ID সেট করুন'); return;
      }
    } catch (e: any) {
      setDiagOpen(true);
      toast.error(e?.message || 'Preflight failed'); return;
    }

    setLoadingPlatform(platform);
    toast.message(mode === 'reconnect' ? 'Reconnecting…' : 'OAuth window খোলা হচ্ছে…', {
      description: 'Popup blocker থাকলে allow করুন।',
    });

    const result = await launchOAuth({
      platform,
      appId,
      igConfigId,
      igEmbedUrl: platform === 'instagram' ? igEmbedUrl : undefined,
      waConfigId,
      mode,
      assetId,
    });

    setLoadingPlatform(null);

    if (result.ok) {
      toast.success(`${TITLE[platform]} ${mode === 'reconnect' ? 'reconnected' : 'connected'}!`);
      await refetch();
      try {
        const { data } = await supabase.functions.invoke('meta-refresh-status', { body: { platform } });
        if (data) setStatuses(prev => ({ ...prev, [platform]: data }));
      } catch {}
      enqueue(`assets:${platform}`, () => healthRefresh(), { debounceMs: 1500 });
    } else {
      setDiagOpen(true);
      toast.error((result as { error: string }).error);
    }
  }, [appId, igConfigId, igEmbedUrl, waConfigId, refetch, healthRefresh]);

  // Auto-launch OAuth if landed via ?autoOpen=<platform> on the canonical origin.
  useEffect(() => {
    if (autoOpenRan.current) return;
    if (!onCanonical) return;
    if (!appId) return;
    const params = new URLSearchParams(window.location.search);
    const auto = params.get('autoOpen');
    if (auto === 'facebook' || auto === 'instagram' || auto === 'whatsapp') {
      autoOpenRan.current = true;
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
      startOAuth(auto as Platform);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onCanonical, appId]);

  const channels: { id: Platform; connected: boolean; meta?: any }[] = [
    { id: 'facebook', connected: fbConnected, meta: { name: s.meta_page_name, sub: s.meta_page_id } },
    { id: 'instagram', connected: igConnected, meta: { name: s.instagram_username ? '@' + s.instagram_username : '', sub: s.instagram_business_account_id } },
    { id: 'whatsapp', connected: waConnected, meta: { name: s.whatsapp_number, sub: s.whatsapp_phone_number_id } },
  ];

  return (
    <div className="container max-w-3xl py-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Channel Integrations</h1>
          <p className="text-muted-foreground text-sm mt-1">এক-ক্লিকে Facebook, Instagram, WhatsApp connect করুন।</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowSetup(true)} title="Developer Settings">
          <SettingsIcon className="h-4 w-4" />
        </Button>
      </div>

      {!onCanonical && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm flex-1">
            <div className="font-medium">এই preview থেকে Meta connect সম্ভব নয়</div>
            <div className="text-muted-foreground mt-0.5">
              মূল সাইট নতুন ট্যাবে খুলছি — সেখান থেকে Connect করুন।
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open(canonicalIntegrationsUrl(), '_blank', 'noopener')}
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open
          </Button>
        </div>
      )}

      <div className="grid gap-3">
        {channels.map(({ id, connected, meta }) => (
          <ChannelCard
            key={id}
            platform={id}
            connected={connected}
            loading={loadingPlatform === id}
            status={statuses[id]}
            meta={meta}
            assets={assetsByPlatform[id]}
            syncing={checking}
            disabled={!onCanonical}
            disabledReason="মূল সাইট থেকে Connect করুন"
            onConnect={() => startOAuth(id)}
            onRefresh={() => refresh(id)}
            onDisconnect={() => disconnect(id)}
            onAssetReconnect={handleAssetReconnect}
          />
        ))}
      </div>

      <ReconnectBanner assets={assets} onReconnect={handleAssetReconnect} />

      <Collapsible open={diagOpen} onOpenChange={setDiagOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground">
            <Activity className="h-4 w-4 mr-2" />
            {diagOpen ? 'Hide diagnostics' : 'Connection problem? Show diagnostics'}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-3">
          <OAuthDiagnostics onOpenSetup={() => setShowSetup(true)} />
          <RawOAuthUrlInspector />
        </CollapsibleContent>
      </Collapsible>

      <DeveloperSettingsDrawer
        open={showSetup}
        onOpenChange={setShowSetup}
        appId={appId}
        waConfigId={waConfigId}
        igConfigId={igConfigId}
        igEmbedUrl={igEmbedUrl}
        refetch={refetch}
        assets={assets}
        checking={checking}
        onAssetReconnect={handleAssetReconnect}
        onAssetSync={(a) => enqueue(`health:${a.id}`, () => runHealthCheck(a.id), { debounceMs: 800 })}
      />
    </div>
  );
}
