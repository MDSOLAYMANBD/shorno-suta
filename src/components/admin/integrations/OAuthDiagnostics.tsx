import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, XCircle, Loader2, RefreshCw, Copy, ExternalLink, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  META_CANONICAL_ORIGIN,
  META_REDIRECT_URI,
  META_INTEGRATIONS_PATH,
  isCanonicalOrigin,
} from '@/lib/oauth/canonical';
import { OAUTH_LAST_URL_KEY, OAUTH_LAST_REDIRECT_KEY } from '@/lib/oauth/launchOAuth';
import { getHistory, clearHistory } from '@/lib/oauth/core/diagnostics';
import { redact } from '@/lib/oauth/core/redact';
import type { OAuthAttempt } from '@/lib/oauth/core/types';

type Preflight = {
  app_id_set: boolean;
  app_secret_set: boolean;
  verify_token_set: boolean;
  whatsapp_config_id_set: boolean;
  instagram_config_id_set: boolean;
  messenger_config_id_set?: boolean;
  app_type?: string | null;
  app_type_error?: string | null;
  redirect_host_in_app_domains?: boolean;
  redirect_uri: string;
  app_domains: string[];
  webhook_url: string;
  fb_login_for_business_setup_url?: string | null;
};

function Row({ ok, label, hint }: { ok: boolean; label: string; hint?: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      {ok
        ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
        : <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />}
      <div className="flex-1">
        <div className={ok ? '' : 'text-destructive'}>{label}</div>
        {!ok && hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
      </div>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} কপি হয়েছে`);
  };
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex gap-2 mt-0.5">
        <code className="flex-1 min-w-0 text-xs bg-muted rounded px-2 py-1 truncate" title={value}>{value || '—'}</code>
        <Button size="sm" variant="outline" onClick={copy} disabled={!value}>
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function OAuthDiagnostics({ onOpenSetup }: { onOpenSetup: () => void }) {
  const [data, setData] = useState<Preflight | null>(null);
  const [loading, setLoading] = useState(true);

  // Live origin info
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  let topOrigin = '';
  try { topOrigin = window.top?.location?.origin || '(same)'; } catch { topOrigin = '(cross-origin / iframe)'; }
  const canonical = isCanonicalOrigin();

  // Last launched OAuth URL + popup/callback origin (set by callback via postMessage)
  const [lastUrl, setLastUrl] = useState<string>('');
  const [lastRedirect, setLastRedirect] = useState<string>('');
  const [popupOrigin, setPopupOrigin] = useState<string>('');
  const [callbackOrigin, setCallbackOrigin] = useState<string>('');

  useEffect(() => {
    try {
      setLastUrl(sessionStorage.getItem(OAUTH_LAST_URL_KEY) || '');
      setLastRedirect(sessionStorage.getItem(OAUTH_LAST_REDIRECT_KEY) || META_REDIRECT_URI);
    } catch {}
    const onMsg = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== 'object') return;
      if ((e.data as any).type === 'oauth:diag') {
        setPopupOrigin((e.data as any).popup_origin || '');
        setCallbackOrigin((e.data as any).callback_origin || '');
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('meta-oauth-preflight', { body: {} });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setData(data as Preflight);
    } catch (e: any) {
      toast.error(e?.message || 'Diagnostics failed');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  return (
    <Card className="bg-muted/30">
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">OAuth Diagnostics</CardTitle>
        <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Origin enforcement */}
        <Row
          ok={canonical}
          label={canonical ? `Canonical origin OK (${META_CANONICAL_ORIGIN})` : `Not on canonical origin — running from ${currentOrigin}`}
          hint={!canonical ? `Connect button will hand off to ${META_CANONICAL_ORIGIN} automatically.` : undefined}
        />
        {!canonical && (
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => window.open(`${META_CANONICAL_ORIGIN}${META_INTEGRATIONS_PATH}`, '_blank', 'noopener')}
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            Open canonical version
          </Button>
        )}

        {/* Server-side preflight */}
        {data && (
          <div className="space-y-2 pt-2 border-t">
            <Row ok={data.app_id_set} label="Meta App ID configured" hint="Developer Settings → Meta App ID" />
            <Row ok={data.app_secret_set} label="META_APP_SECRET secret set" hint="Edge function secret missing" />
            <Row ok={data.verify_token_set} label="META_VERIFY_TOKEN secret set" />
            <Row ok={data.whatsapp_config_id_set} label="WhatsApp Embedded Signup Config ID" hint="WhatsApp connect-এর জন্য দরকার" />
            <Row ok={!!data.messenger_config_id_set} label="Messenger FB-Login-for-Business Config ID" hint="Optional — enables config_id flow for Messenger" />
            <Row ok={data.app_type === 'BUSINESS'} label={`App type: ${data.app_type || 'unknown'}`} hint={data.app_type_error || 'Meta requires Business type for FB Login for Business'} />
            <Row ok={!!data.redirect_host_in_app_domains} label="redirect_uri host whitelisted in App Domains" hint="Add shornosuta.com under App Settings → Basic → App Domains" />
            {data.fb_login_for_business_setup_url && (
              <Button size="sm" variant="outline" className="w-full" asChild>
                <a href={data.fb_login_for_business_setup_url} target="_blank" rel="noopener">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open Facebook Login for Business setup
                </a>
              </Button>
            )}
          </div>
        )}

        {/* Live URLs */}
        <div className="space-y-2 pt-2 border-t">
          <CopyRow label="Canonical redirect_uri" value={META_REDIRECT_URI} />
          <CopyRow label="Last redirect_uri sent to Meta" value={lastRedirect} />
          <CopyRow label="Last generated OAuth URL" value={lastUrl} />
          <CopyRow label="Current window.origin" value={currentOrigin} />
          <CopyRow label="window.top origin" value={topOrigin} />
          <CopyRow label="Popup origin (last run)" value={popupOrigin} />
          <CopyRow label="Callback origin (last run)" value={callbackOrigin} />
          {data && (
            <>
              <CopyRow label="Webhook URL" value={data.webhook_url} />
              <CopyRow label="App Domains (server)" value={data.app_domains.join(', ')} />
            </>
          )}
        </div>

        {/* Copy debug bundle */}
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={async () => {
            const bundle = redact({
              ts: new Date().toISOString(),
              ua: navigator.userAgent,
              canonical: isCanonicalOrigin(),
              currentOrigin,
              topOrigin,
              popupOrigin,
              callbackOrigin,
              redirect_uri: META_REDIRECT_URI,
              lastUrl,
              lastRedirect,
              preflight: data,
              history: getHistory(),
            });
            try {
              await navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
              toast.success('Debug bundle copied (secrets redacted)');
            } catch { toast.error('Copy failed'); }
          }}
        >
          <FileDown className="h-3.5 w-3.5 mr-1.5" /> Copy debug bundle
        </Button>

        {/* History */}
        <HistoryPanel />

        {data && !data.app_id_set && (
          <Button size="sm" variant="outline" className="w-full" onClick={onOpenSetup}>
            Open Developer Settings
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function HistoryPanel() {
  const [items, setItems] = useState<OAuthAttempt[]>([]);
  const [open, setOpen] = useState(false);
  const reload = () => setItems(getHistory());
  useEffect(() => { reload(); const id = setInterval(reload, 3000); return () => clearInterval(id); }, []);
  if (items.length === 0) return null;
  return (
    <div className="pt-2 border-t space-y-2">
      <div className="flex items-center justify-between">
        <button className="text-xs font-medium underline" onClick={() => setOpen(o => !o)}>
          {open ? 'Hide' : 'Show'} history ({items.length})
        </button>
        <button className="text-xs text-muted-foreground hover:text-destructive" onClick={() => { clearHistory(); reload(); }}>
          Clear
        </button>
      </div>
      {open && (
        <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
          {items.map(a => (
            <div key={a.id} className="text-[11px] border rounded p-2 bg-background">
              <div className="flex justify-between gap-2">
                <span className="font-mono">{new Date(a.ts).toLocaleTimeString()}</span>
                <span className="font-medium">{a.platform}</span>
                <span className={
                  a.exchange_status === 'success' ? 'text-green-600' :
                  a.exchange_status === 'error' ? 'text-destructive' : 'text-muted-foreground'
                }>
                  {a.popup_blocked ? 'popup-blocked' : a.exchange_status || a.callback_status || 'pending'}
                </span>
              </div>
              {a.error_message && <div className="text-destructive mt-0.5 break-words">{a.error_message}</div>}
              <div className="text-muted-foreground truncate" title={a.generated_url}>{a.generated_url}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
