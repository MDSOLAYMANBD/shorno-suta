// Raw OAuth URL Inspector — read-only protocol-level diagnostics for Meta OAuth.
// Three tabs: last launched, dry-run builder, reference comparison.
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, ExternalLink, RefreshCw, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getLastAttempt } from '@/lib/oauth/core/diagnostics';
import { generateState } from '@/lib/oauth/core/state';
import { validateOAuthUrl } from '@/lib/oauth/core/validate';
import { buildMetaProvider } from '@/lib/oauth/providers/meta';
import { buildWhatsAppProvider } from '@/lib/oauth/providers/whatsapp';
import { REFERENCE_OAUTH_SAMPLES } from '@/lib/oauth/core/referenceUrls';
import { META_REDIRECT_URI } from '@/lib/oauth/canonical';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import type { BuiltOAuthUrl, OAuthAttempt, OAuthPlatform, OAuthValidationReport } from '@/lib/oauth/core/types';

function copy(label: string, v: string) {
  navigator.clipboard.writeText(v).then(
    () => toast.success(`${label} কপি হয়েছে`),
    () => toast.error('Copy failed'),
  );
}

function LevelIcon({ level }: { level: 'ok' | 'warn' | 'fail' }) {
  if (level === 'ok') return <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />;
  if (level === 'warn') return <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />;
  return <XCircle className="h-3.5 w-3.5 text-destructive" />;
}

function ParamTable({ built }: { built: BuiltOAuthUrl }) {
  const keys = Object.keys(built.params);
  if (!keys.length) return <div className="text-xs text-muted-foreground">(no params)</div>;
  return (
    <div className="border rounded overflow-hidden text-xs">
      <div className="grid grid-cols-[120px_1fr_1fr] bg-muted/50 px-2 py-1 font-medium">
        <span>Key</span><span>Raw value</span><span>Encoded</span>
      </div>
      {keys.map(k => (
        <div key={k} className="grid grid-cols-[120px_1fr_1fr] px-2 py-1 border-t font-mono break-all">
          <span>{k}</span>
          <span className="truncate" title={built.params[k]}>{built.params[k]}</span>
          <span className="truncate text-muted-foreground" title={built.encodedParams[k]}>{built.encodedParams[k]}</span>
        </div>
      ))}
    </div>
  );
}

function ValidationList({ report }: { report: OAuthValidationReport }) {
  return (
    <div className="space-y-1">
      <div className="flex gap-2 text-xs">
        <Badge variant="secondary">Flow: {report.flow}</Badge>
        <Badge variant="outline" className="text-green-700">{report.summary.ok} ok</Badge>
        {report.summary.warn > 0 && <Badge variant="outline" className="text-amber-700">{report.summary.warn} warn</Badge>}
        {report.summary.fail > 0 && <Badge variant="destructive">{report.summary.fail} fail</Badge>}
      </div>
      <ul className="space-y-1 text-xs">
        {report.issues.map((i, idx) => (
          <li key={idx} className="flex items-start gap-1.5">
            <LevelIcon level={i.level} />
            <div className="flex-1">
              <div>{i.label}</div>
              {i.detail && <div className="text-muted-foreground">{i.detail}</div>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function UrlBlock({ label, url }: { label: string; url: string }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground flex justify-between">
        <span>{label}</span>
        <div className="flex gap-1">
          <button onClick={() => copy(label, url)} className="hover:text-foreground"><Copy className="h-3 w-3" /></button>
          {url && <a href={url} target="_blank" rel="noopener" className="hover:text-foreground"><ExternalLink className="h-3 w-3" /></a>}
        </div>
      </div>
      <code className="block text-[11px] bg-muted rounded px-2 py-1.5 break-all max-h-32 overflow-auto">{url || '—'}</code>
    </div>
  );
}

export function RawOAuthUrlInspector() {
  const [last, setLast] = useState<OAuthAttempt | null>(null);
  const reload = () => setLast(getLastAttempt());
  useEffect(() => { reload(); const id = setInterval(reload, 2000); return () => clearInterval(id); }, []);

  const { data: settings } = useStoreSettings();
  const appId = settings?.meta_app_id || '';
  const waConfigId = settings?.meta_wa_embedded_signup_config_id || '';
  const igConfigId = settings?.meta_ig_login_config_id || '';
  const messengerConfigId = settings?.meta_messenger_config_id || '';
  const igEmbedUrl = settings?.meta_ig_login_embed_url || '';

  const [dryPlatform, setDryPlatform] = useState<OAuthPlatform>('facebook');

  const dryRun = useMemo(() => {
    const state = generateState(dryPlatform, META_REDIRECT_URI);
    let provider;
    if (dryPlatform === 'whatsapp') {
      provider = buildWhatsAppProvider({ appId, configId: waConfigId });
    } else {
      provider = buildMetaProvider(
        { appId, igConfigId, igEmbedUrl, messengerConfigId },
        dryPlatform as 'facebook' | 'instagram',
      );
    }
    const built = provider.buildAuthUrl({ platform: dryPlatform, redirectUri: META_REDIRECT_URI, state });
    const report = validateOAuthUrl(built, dryPlatform);
    return { built, report };
  }, [dryPlatform, appId, waConfigId, igConfigId, igEmbedUrl, messengerConfigId]);

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">Raw OAuth URL Inspector</CardTitle>
        <Button size="sm" variant="ghost" onClick={reload}><RefreshCw className="h-3.5 w-3.5" /></Button>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="last">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="last">Last launched</TabsTrigger>
            <TabsTrigger value="dryrun">Dry-run</TabsTrigger>
            <TabsTrigger value="ref">Reference</TabsTrigger>
          </TabsList>

          <TabsContent value="last" className="space-y-3 pt-3">
            {!last && <div className="text-xs text-muted-foreground">No OAuth attempt yet. Click any Connect button to populate.</div>}
            {last && (
              <>
                <div className="text-xs text-muted-foreground">
                  {new Date(last.ts).toLocaleString()} · {last.platform} · flow={last.flow || '?'}
                </div>
                <UrlBlock label="Generated OAuth URL" url={last.generated_url} />
                {last.params && (
                  <ParamTable built={{
                    url: last.generated_url,
                    base: last.generated_url.split('?')[0],
                    flow: last.flow || 'fb_login_classic',
                    params: last.params,
                    encodedParams: Object.fromEntries(Object.entries(last.params).map(([k, v]) => [k, encodeURIComponent(v)])),
                  }} />
                )}
                {last.validation && <ValidationList report={last.validation} />}
              </>
            )}
          </TabsContent>

          <TabsContent value="dryrun" className="space-y-3 pt-3">
            <div className="flex gap-2">
              {(['facebook', 'instagram', 'whatsapp'] as const).map(p => (
                <Button key={p} size="sm" variant={dryPlatform === p ? 'default' : 'outline'} onClick={() => setDryPlatform(p)}>
                  {p}
                </Button>
              ))}
            </div>
            <div className="text-xs text-muted-foreground">Generated with synthetic state — not launched.</div>
            <UrlBlock label="Dry-run URL" url={dryRun.built.url} />
            <ParamTable built={dryRun.built} />
            <ValidationList report={dryRun.report} />
          </TabsContent>

          <TabsContent value="ref" className="space-y-3 pt-3">
            <div className="text-xs text-muted-foreground">
              Static reference URLs from major inbox platforms — for protocol comparison only.
            </div>
            {REFERENCE_OAUTH_SAMPLES.map(s => (
              <div key={s.vendor} className="space-y-1 border rounded p-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{s.vendor}</span>
                  <Badge variant="secondary">{s.flow}</Badge>
                </div>
                <UrlBlock label="" url={s.url} />
                <ul className="text-[11px] text-muted-foreground list-disc pl-4">
                  {s.notes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
