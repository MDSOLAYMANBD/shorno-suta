import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Loader2, TestTube, Plug, RefreshCw, ExternalLink, AlertTriangle, Instagram, MessageCircle, Clock } from 'lucide-react';

interface StatusData {
  config_checks: Record<string, boolean>;
  messenger: { ready: boolean; page_subscribed: boolean; subscribed_fields: string[]; page_token_valid: boolean; page_token_error: string | null; page_info: any; raw: any };
  instagram: { ready: boolean; linked: boolean; account_id: string | null; token_valid: boolean; token_error: string | null; raw: any };
  whatsapp: { ready: boolean; waba_subscribed: boolean; token_valid: boolean; token_error: string | null; phone_info: any; raw: any };
  missing_steps: string[];
  last_webhook_hit: any;
  inbox_stats: { conversations: number; messages: number };
  webhook_url: string;
  blockers?: { platform: string; code: string; message_bn: string }[];
}

export default function WebhookStatusChecker() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  const invoke = async (action: string, extraBody?: any) => {
    const { data, error } = await supabase.functions.invoke('meta-webhook-test', {
      body: { action, ...extraBody },
    });
    if (error) {
      // Check for auth errors
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        setAuthError(true);
        throw new Error('আপনি লগইন করা নেই। অনুগ্রহ করে আগে লগইন করুন।');
      }
      throw error;
    }
    setAuthError(false);
    return data;
  };

  const checkStatus = async () => {
    setLoading(true);
    try {
      const data = await invoke('status');
      setStatus(data);
      // Also fetch recent webhook logs
      fetchRecentLogs();
    } catch (e: any) {
      toast.error('স্ট্যাটাস চেক ব্যর্থ: ' + (e.message || e));
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentLogs = async () => {
    try {
      const { data } = await supabase
        .from('webhook_event_logs' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      setRecentLogs((data as any[]) || []);
    } catch {}
  };

  const doAction = async (action: string, label: string, extraBody?: any) => {
    setActionLoading(action);
    try {
      const data = await invoke(action, extraBody);
      toast.success(data.message || `${label} সফল!`);
      checkStatus();
    } catch (e: any) {
      toast.error(`${label} ব্যর্থ: ` + (e.message || e));
    } finally {
      setActionLoading(null);
    }
  };

  const StatusIcon = ({ ok }: { ok: boolean }) =>
    ok ? <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" /> : <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />;

  const ReadyBadge = ({ ready, label }: { ready: boolean; label: string }) => (
    <Badge variant={ready ? 'default' : 'destructive'} className="text-[10px]">
      {ready ? '✅' : '❌'} {label}
    </Badge>
  );

  // Compute actionable blockers from status
  const getBlockers = (): { platform: string; message: string; severity: 'error' | 'warning' }[] => {
    if (!status) return [];
    const blockers: { platform: string; message: string; severity: 'error' | 'warning' }[] = [];

    // Messenger/Instagram blockers
    if (!status.config_checks.meta_app_id) blockers.push({ platform: 'Messenger', message: 'Meta App ID সেট করা হয়নি', severity: 'error' });
    if (!status.config_checks.meta_app_secret) blockers.push({ platform: 'Messenger', message: 'App Secret সেট করা হয়নি', severity: 'error' });
    if (!status.config_checks.meta_page_access_token) blockers.push({ platform: 'Messenger', message: 'Page Access Token সেট করা হয়নি', severity: 'error' });
    else if (!status.messenger.page_token_valid) blockers.push({ platform: 'Messenger', message: `Page Token অবৈধ: ${status.messenger.page_token_error || 'নতুন token generate করুন'}`, severity: 'error' });
    if (!status.config_checks.meta_page_id) blockers.push({ platform: 'Messenger', message: 'Page ID সেট করা হয়নি', severity: 'error' });
    if (status.messenger.page_token_valid && !status.messenger.page_subscribed) {
      blockers.push({ platform: 'Messenger', message: '⚠️ Page Subscribe হয়নি! নিচের বাটন চাপুন। Meta App Live মোডে আছে কিনা চেক করুন।', severity: 'error' });
    }

    // Instagram blockers
    if (status.messenger.page_token_valid && !status.instagram.linked) {
      blockers.push({ platform: 'Instagram', message: 'Instagram Business Account Page-এর সাথে link করা নেই। Facebook Page Settings → Instagram → Connect করুন।', severity: 'error' });
    }
    if (status.config_checks.instagram_access_token && !status.instagram.token_valid) {
      blockers.push({ platform: 'Instagram', message: `Instagram Token অবৈধ: ${status.instagram.token_error || 'নতুন token দিন'}`, severity: 'error' });
    }

    // WhatsApp blockers
    if (!status.config_checks.whatsapp_access_token) blockers.push({ platform: 'WhatsApp', message: 'WhatsApp Access Token সেট করা হয়নি', severity: 'error' });
    else if (!status.whatsapp.token_valid) blockers.push({ platform: 'WhatsApp', message: `WhatsApp Token অবৈধ: ${status.whatsapp.token_error || 'নতুন token দিন'}`, severity: 'error' });
    if (!status.config_checks.whatsapp_phone_number_id) blockers.push({ platform: 'WhatsApp', message: 'WhatsApp Phone Number ID সেট করা হয়নি', severity: 'error' });
    if (!status.config_checks.whatsapp_business_account_id) blockers.push({ platform: 'WhatsApp', message: 'WABA ID সেট করা হয়নি', severity: 'error' });
    if (status.whatsapp.token_valid && !status.whatsapp.waba_subscribed) {
      blockers.push({ platform: 'WhatsApp', message: 'WABA Subscribe হয়নি! নিচের বাটন চাপুন।', severity: 'error' });
    }

    // Webhook health — check recent logs
    if (recentLogs.length > 0) {
      const recentInbound = recentLogs.filter((l: any) => l.parsed_count > 0);
      const recentStatusOnly = recentLogs.filter((l: any) => l.parsed_count === 0 && l.status_count > 0);
      if (recentInbound.length === 0 && recentStatusOnly.length > 0) {
        blockers.push({ platform: 'Webhook', message: 'Webhook hit আসছে, কিন্তু শুধু delivery status — কাস্টমারের ইনবাউন্ড মেসেজ parse হচ্ছে না', severity: 'warning' });
      }
      // Check for skipped reasons
      const allSkipped = recentLogs.flatMap((l: any) => l.skipped_reasons || []);
      if (allSkipped.some((s: string) => s?.includes('no_messaging_array'))) {
        blockers.push({ platform: 'Webhook', message: 'Webhook payload-এ messaging array পাওয়া যাচ্ছে না — Page subscription fields চেক করুন', severity: 'warning' });
      }
    } else if (status && !status.last_webhook_hit) {
      blockers.push({ platform: 'Webhook', message: 'কোনো webhook hit আসেনি! Meta Developer Dashboard-এ webhook URL সঠিক আছে কিনা চেক করুন।', severity: 'error' });
    }

    return blockers;
  };

  const blockers = getBlockers();
  const lastHit = status?.last_webhook_hit;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Webhook ডায়াগনস্টিক</h3>
        <Button size="sm" onClick={checkStatus} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          চেক করুন
        </Button>
      </div>

      {authError && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-xs">
          <p className="font-bold text-destructive">🔒 আপনি লগইন করা নেই বা সেশন শেষ হয়ে গেছে।</p>
          <p className="text-destructive/80">ডায়াগনস্টিক চালাতে অ্যাডমিন হিসেবে লগইন করতে হবে।</p>
        </div>
      )}

      {status && (
        <>
          {/* Readiness Overview */}
          <div className="flex flex-wrap gap-2">
            <ReadyBadge ready={status.messenger.ready} label="Messenger" />
            <ReadyBadge ready={status.instagram.ready} label="Instagram" />
            <ReadyBadge ready={status.whatsapp.ready} label="WhatsApp" />
          </div>

          {/* Actionable Blockers */}
          {blockers.length > 0 && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs space-y-1.5">
              <p className="font-semibold text-amber-700 dark:text-amber-400">⚠️ সমস্যা চিহ্নিত হয়েছে:</p>
              {blockers.map((b, i) => (
                <div key={i} className={`flex items-start gap-2 ${b.severity === 'error' ? 'text-destructive' : 'text-amber-700 dark:text-amber-400'}`}>
                  {b.severity === 'error' ? <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                  <span><strong>[{b.platform}]</strong> {b.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* 📘 Messenger + Instagram */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageCircle className="h-4 w-4" /> Messenger + Instagram
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <StatusIcon ok={status.messenger.page_token_valid} />
                <span>Page Token: {status.messenger.page_token_valid ? 'বৈধ ✅' : `অবৈধ — ${status.messenger.page_token_error || 'টোকেন নেই'}`}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <StatusIcon ok={status.messenger.page_subscribed} />
                <span>Page Subscription: {status.messenger.page_subscribed
                  ? `Subscribed (${status.messenger.subscribed_fields.join(', ')})`
                  : 'Not subscribed ❌'}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <StatusIcon ok={status.instagram.linked} />
                <span>Instagram Business Account: {status.instagram.linked
                  ? `Linked ✅ (ID: ${status.instagram.account_id})`
                  : 'Not linked — Facebook Page Settings → Instagram link করুন'}</span>
              </div>
              {status.config_checks.instagram_access_token && (
                <div className="flex items-center gap-2 text-xs">
                  <StatusIcon ok={status.instagram.token_valid} />
                  <span>Instagram Token: {status.instagram.token_valid ? 'বৈধ ✅' : `অবৈধ — ${status.instagram.token_error}`}</span>
                </div>
              )}
              {status.messenger.page_info?.name && (
                <p className="text-xs text-muted-foreground">📘 Page: {status.messenger.page_info.name}</p>
              )}
            </CardContent>
          </Card>

          {/* 💬 WhatsApp */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">💬 WhatsApp</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <StatusIcon ok={status.whatsapp.token_valid} />
                <span>WA Token: {status.whatsapp.token_valid ? 'বৈধ ✅' : `অবৈধ — ${status.whatsapp.token_error || 'টোকেন নেই'}`}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <StatusIcon ok={status.whatsapp.waba_subscribed} />
                <span>WABA: {status.whatsapp.waba_subscribed ? 'Subscribed ✅' : 'Not subscribed ❌'}</span>
              </div>
              {status.whatsapp.phone_info && (
                <div className="flex items-center gap-2 text-xs">
                  <StatusIcon ok={!status.whatsapp.phone_info.error} />
                  <span>Phone: {status.whatsapp.phone_info.display_phone_number || status.whatsapp.phone_info.error?.message || 'N/A'}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Webhook Event Logs */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" /> সাম্প্রতিক Webhook Events
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {recentLogs.length > 0 ? (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {recentLogs.map((log: any, i: number) => (
                    <div key={i} className="text-xs border-b border-border/50 pb-1.5 last:border-0">
                      <div className="flex items-center gap-2">
                        <Badge variant={log.saved_count > 0 ? 'default' : log.status_count > 0 ? 'secondary' : 'destructive'} className="text-[9px] px-1">
                          {log.platform}
                        </Badge>
                        <span className="text-muted-foreground">
                          {new Date(log.created_at).toLocaleString('bn-BD', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                        </span>
                        <span>
                          📨{log.parsed_count} 💾{log.saved_count} 📊{log.status_count}
                        </span>
                      </div>
                      {log.skipped_reasons && log.skipped_reasons.length > 0 && (
                        <p className="text-amber-600 text-[10px] mt-0.5">⚠️ {(log.skipped_reasons as string[]).slice(0, 3).join(', ')}</p>
                      )}
                      {log.error && <p className="text-destructive text-[10px]">❌ {log.error}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">কোনো event log নেই — "চেক করুন" বাটন চাপুন</p>
              )}
            </CardContent>
          </Card>

          {/* Last webhook hit (legacy) */}
          {lastHit && (
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">শেষ Webhook Hit (Legacy)</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="space-y-1 text-xs">
                  <p><strong>সময়:</strong> {lastHit.timestamp}</p>
                  <p><strong>ধরন:</strong> {lastHit.type} | <strong>Object:</strong> {lastHit.objectType || 'N/A'}</p>
                  {lastHit.totalParsed !== undefined && (
                    <p><strong>Parsed/Saved/Statuses:</strong> {lastHit.totalParsed}/{lastHit.totalSaved}/{lastHit.totalStatuses || 0}</p>
                  )}
                  {lastHit.skipped_reasons && lastHit.skipped_reasons.length > 0 && (
                    <p className="text-amber-600">⚠️ Skip: {lastHit.skipped_reasons.join(', ')}</p>
                  )}
                  {lastHit.raw_preview && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-muted-foreground">Raw preview</summary>
                      <pre className="bg-muted p-1.5 rounded text-[10px] mt-1 overflow-auto max-h-20">{lastHit.raw_preview}</pre>
                    </details>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Config checks */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">কনফিগারেশন</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(status.config_checks).map(([key, ok]) => (
                  <div key={key} className="flex items-center gap-1.5 text-xs">
                    <StatusIcon ok={ok} />
                    <span className={ok ? '' : 'text-destructive font-medium'}>
                      {({
                        meta_app_id: 'App ID', meta_app_secret: 'App Secret', meta_verify_token: 'Verify Token',
                        meta_page_access_token: 'Page Token', meta_page_id: 'Page ID',
                        whatsapp_access_token: 'WA Token', whatsapp_phone_number_id: 'WA Phone ID',
                        whatsapp_business_account_id: 'WABA ID', instagram_access_token: 'IG Token',
                      } as Record<string, string>)[key] || key}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">অ্যাকশন</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-2">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => doAction('subscribe_page', 'Page Subscribe')} disabled={!!actionLoading}>
                  {actionLoading === 'subscribe_page' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plug className="h-3 w-3 mr-1" />}
                  Page Subscribe
                </Button>
                <Button size="sm" variant="outline" onClick={() => doAction('subscribe_waba', 'WABA Subscribe')} disabled={!!actionLoading}>
                  {actionLoading === 'subscribe_waba' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plug className="h-3 w-3 mr-1" />}
                  WABA Subscribe
                </Button>
                <Button size="sm" variant="outline" onClick={() => doAction('simulate_test', 'টেস্ট', { platform: 'messenger' })} disabled={!!actionLoading}>
                  {actionLoading === 'simulate_test' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <TestTube className="h-3 w-3 mr-1" />}
                  টেস্ট Messenger
                </Button>
                <Button size="sm" variant="outline" onClick={() => doAction('simulate_test', 'টেস্ট', { platform: 'whatsapp' })} disabled={!!actionLoading}>
                  {actionLoading === 'simulate_test' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <TestTube className="h-3 w-3 mr-1" />}
                  টেস্ট WhatsApp
                </Button>
                <Button size="sm" variant="outline" onClick={() => doAction('simulate_test', 'টেস্ট', { platform: 'instagram' })} disabled={!!actionLoading}>
                  {actionLoading === 'simulate_test' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Instagram className="h-3 w-3 mr-1" />}
                  টেস্ট Instagram
                </Button>
              </div>

              <div className="flex gap-3 pt-2">
                <Badge variant="secondary">{status.inbox_stats.conversations} কথোপকথন</Badge>
                <Badge variant="secondary">{status.inbox_stats.messages} মেসেজ</Badge>
              </div>

              <div className="text-xs text-muted-foreground break-all pt-1">
                <strong>Webhook URL:</strong> {status.webhook_url}
              </div>
            </CardContent>
          </Card>

          {/* Raw API responses */}
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground py-1">Raw API Responses দেখুন</summary>
            <div className="space-y-2 mt-2">
              {status.messenger.raw && (
                <pre className="bg-muted p-2 rounded overflow-auto max-h-32 text-xs">
                  Messenger: {JSON.stringify(status.messenger.raw, null, 2)}
                </pre>
              )}
              {status.instagram.raw && (
                <pre className="bg-muted p-2 rounded overflow-auto max-h-32 text-xs">
                  Instagram: {JSON.stringify(status.instagram.raw, null, 2)}
                </pre>
              )}
              {status.whatsapp.raw && (
                <pre className="bg-muted p-2 rounded overflow-auto max-h-32 text-xs">
                  WhatsApp: {JSON.stringify(status.whatsapp.raw, null, 2)}
                </pre>
              )}
            </div>
          </details>

          {/* Quick links */}
          <Card>
            <CardContent className="px-4 py-3">
              <div className="space-y-1.5">
                <a href="https://supabase.com/dashboard/project/gdwvktufhsbrblzzeiir/functions/meta-webhook/logs" target="_blank" rel="noopener" className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                  <ExternalLink className="h-3 w-3" /> Edge Function Logs
                </a>
                <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener" className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                  <ExternalLink className="h-3 w-3" /> Meta Developer Dashboard
                </a>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
