// Phase 5 — Campaign History tab.
// Read-only view of `sms_campaigns` with search, date filter, drilldown, and
// reuse actions (duplicate, reuse audience, export recipients).
// Adds SMS short-link analytics: KPIs, per-link report, per-recipient report,
// timeline of clicks, and one-click follow-up audience actions.

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabaseHelpers';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { rewriteBodyForRecipient, extractUrls, formatSmsUrlsForProvider } from '@/lib/sms/shortLinks';
import { smsParts } from '@/lib/audience/helpers';
import { useAllSettings } from '@/hooks/useAllSettings';
import { friendlyError, withRetry } from '@/lib/audience/errors';
import { RefreshCw, Send as SendIcon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Copy, Download, Repeat2, Eye, Search } from 'lucide-react';
import { toast } from 'sonner';
import type { AudienceFilter } from '@/lib/audience/types';

interface Campaign {
  id: string;
  name: string;
  body: string;
  audience_filter: any;
  audience_filters: any;
  audience_size: number;
  final_count: number | null;
  duplicates_removed: number | null;
  excluded_count: number | null;
  total_parts: number;
  total_cost: number;
  actual_cost: number | null;
  sent_count: number;
  failed_count: number;
  status: string;
  template_name: string | null;
  sender_name: string | null;
  created_by: string | null;
  created_by_email: string | null;
  created_at: string;
  completed_at: string | null;
  audience_id: string | null;
}

interface Props {
  onReuseAudience?: (filter: AudienceFilter, body: string) => void;
  onFollowup?: (
    phones: string[],
    opts: { body: string; templateName?: string | null; senderName?: string | null },
  ) => void;
}

export default function SmsCampaignHistoryTab({ onReuseAudience, onFollowup }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [detail, setDetail] = useState<Campaign | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ['sms-campaigns-full-history'],
    queryFn: async (): Promise<Campaign[]> => {
      const rows = await fetchAllRows<Campaign>(
        () => (supabase.from('sms_campaigns' as any) as any).select('*').order('created_at', { ascending: false }) as any,
      );
      return rows as any;
    },
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const from = fromDate ? new Date(fromDate).getTime() : 0;
    const to = toDate ? new Date(toDate).getTime() + 86399999 : Infinity;
    return data.filter((c) => {
      const t = new Date(c.created_at).getTime();
      if (t < from || t > to) return false;
      if (!s) return true;
      return (
        c.name?.toLowerCase().includes(s) ||
        c.body?.toLowerCase().includes(s) ||
        c.template_name?.toLowerCase().includes(s) ||
        c.created_by_email?.toLowerCase().includes(s)
      );
    });
  }, [data, search, fromDate, toDate]);

  const exportRecipients = async (id: string, name: string) => {
    try {
      const rows = await fetchAllRows<any>(
        () => (supabase.from('sms_campaign_recipients' as any) as any).select('*').eq('campaign_id', id) as any,
      );
      const headers = ['phone', 'customer_name', 'status', 'parts', 'message', 'error_message', 'sent_at'];
      const lines = [headers.join(',')];
      for (const r of rows as any[]) {
        lines.push(headers.map((h) => {
          const v = r[h];
          if (v == null) return '';
          const s = String(v).replace(/"/g, '""');
          return /[",\n]/.test(s) ? `"${s}"` : s;
        }).join(','));
      }
      const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name.replace(/[^\w-]+/g, '_')}-recipients.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: any) {
      toast.error(e?.message || 'এক্সপোর্ট ব্যর্থ');
    }
  };

  const reuse = (c: Campaign) => {
    const f = (c.audience_filters || c.audience_filter) as AudienceFilter | null;
    if (!f) { toast.error('এই ক্যাম্পেইনের অডিয়েন্স ফিল্টার নেই'); return; }
    onReuseAudience?.(f, c.body);
    toast.success('অডিয়েন্স ও মেসেজ অডিয়েন্স ইঞ্জিন ট্যাবে লোড হয়েছে');
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="h-8 pl-7 text-sm" placeholder="নাম, মেসেজ, টেমপ্লেট..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Input type="date" className="h-8 text-xs w-auto" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        <span className="text-xs text-muted-foreground">→</span>
        <Input type="date" className="h-8 text-xs w-auto" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        <Badge variant="secondary" className="text-[10px]">{filtered.length} / {data.length}</Badge>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ক্যাম্পেইন</TableHead>
                  <TableHead>তারিখ</TableHead>
                  <TableHead>তৈরি করেছেন</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Final</TableHead>
                  <TableHead className="text-right">পার্ট</TableHead>
                  <TableHead className="text-right">খরচ</TableHead>
                  <TableHead>স্ট্যাটাস</TableHead>
                  <TableHead className="text-right">অ্যাকশন</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={9} className="text-center text-xs py-6">লোড হচ্ছে...</TableCell></TableRow>}
                {!isLoading && filtered.map((c) => (
                  <TableRow key={c.id} className="hover:bg-muted/40">
                    <TableCell className="text-xs">
                      <div className="font-medium">{c.name}</div>
                      {c.template_name && <div className="text-[10px] text-muted-foreground">📝 {c.template_name}</div>}
                    </TableCell>
                    <TableCell className="text-xs">{format(new Date(c.created_at), 'dd MMM HH:mm')}</TableCell>
                    <TableCell className="text-xs">{c.created_by_email || '—'}</TableCell>
                    <TableCell className="text-xs text-right">{c.audience_size}</TableCell>
                    <TableCell className="text-xs text-right font-medium">{c.final_count ?? c.sent_count}</TableCell>
                    <TableCell className="text-xs text-right">{c.total_parts}</TableCell>
                    <TableCell className="text-xs text-right">৳{Number(c.actual_cost ?? c.total_cost ?? 0).toFixed(2)}</TableCell>
                    <TableCell><Badge variant={c.status === 'completed' ? 'default' : c.status === 'dry_run' ? 'outline' : 'secondary'} className="text-[10px]">{c.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setDetail(c)}><Eye className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => reuse(c)} title="অডিয়েন্স রিইউজ"><Repeat2 className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => exportRecipients(c.id, c.name)} title="এক্সপোর্ট"><Download className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => reuse(c)} title="ডুপ্লিকেট"><Copy className="h-3 w-3" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center text-xs text-muted-foreground py-8">কোনো ক্যাম্পেইন নেই</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="w-[520px] sm:w-[640px] overflow-y-auto">
          <SheetHeader><SheetTitle>{detail?.name}</SheetTitle></SheetHeader>
          {detail && <CampaignDetail campaign={detail} onClose={() => setDetail(null)} onFollowup={onFollowup} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2 border-b pb-1">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium text-right">{v}</span>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card p-2.5">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="text-lg font-bold">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function CampaignDetail({ campaign, onClose, onFollowup }: {
  campaign: Campaign;
  onClose: () => void;
  onFollowup?: Props['onFollowup'];
}) {
  const qc = useQueryClient();
  const { data: settings } = useAllSettings();

  const [resendOpen, setResendOpen] = useState(false);
  const [resendFresh, setResendFresh] = useState(false);
  const [resending, setResending] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [resendProgress, setResendProgress] = useState({ done: 0, total: 0, ok: 0, fail: 0 });

  const { data: report } = useQuery({
    queryKey: ['sms-campaign-report', campaign.id],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('sms_campaign_report', { p_campaign_id: campaign.id });
      if (error) throw error;
      return data as { kpi: any; links: any[]; snapshot: any; source: string };
    },
  });

  const { data: recipients = [] } = useQuery({
    queryKey: ['sms-campaign-recipients', campaign.id],
    queryFn: async () => {
      const rows = await fetchAllRows<any>(
        () => (supabase.from('sms_campaign_recipients' as any) as any)
          .select('id,customer_name,phone,status,parts,click_count,last_clicked_at,click_status,order_id,sent_at,message,final_message')
          .eq('campaign_id', campaign.id)
          .order('click_count', { ascending: false }) as any,
      );
      return rows as any[];
    },
  });

  const { data: clicks = [] } = useQuery({
    queryKey: ['sms-campaign-clicks', campaign.id],
    queryFn: async () => {
      const rows = await fetchAllRows<any>(
        () => (supabase.from('sms_short_link_clicks' as any) as any)
          .select('id,phone,is_unique,created_at,short_link_id,referer')
          .eq('campaign_id', campaign.id)
          .order('created_at', { ascending: false }) as any,
      );
      return rows as any[];
    },
  });

  const kpi = report?.kpi || {};

  type FollowupBehavior = 'not_clicked' | 'clicked_no_order' | 'ordered' | 'multi_clicked' | 'clicked_once';

  const fetchFollowupPhones = async (behavior: FollowupBehavior): Promise<string[]> => {
    if (behavior === 'clicked_once') {
      // "Clicked Once" is not provided by the RPC — derive client-side.
      const rows = await fetchAllRows<any>(
        () => (supabase.from('sms_campaign_recipients' as any) as any)
          .select('phone')
          .eq('campaign_id', campaign.id)
          .eq('click_count', 1)
          .not('phone', 'is', null) as any,
      );
      return Array.from(new Set((rows as any[]).map((r) => r.phone).filter(Boolean)));
    }
    const { data, error } = await (supabase.rpc as any)('sms_followup_audience_phones', {
      p_campaign_id: campaign.id, p_behavior: behavior,
    });
    if (error) throw error;
    return (data || []) as string[];
  };

  const runFollowup = async (behavior: FollowupBehavior) => {
    try {
      const phones = await fetchFollowupPhones(behavior);
      if (phones.length === 0) { toast.info('এই সেগমেন্টে কোনো রিসিপিয়েন্ট নেই'); return; }
      if (onFollowup) {
        onFollowup(phones, {
          body: campaign.body,
          templateName: campaign.template_name,
          senderName: campaign.sender_name,
        });
        toast.success(`${phones.length} জন ফোন অডিয়েন্স ইঞ্জিনে লোড হয়েছে`);
        onClose();
        return;
      }
      // Fallback: CSV export
      const blob = new Blob([phones.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${campaign.name.replace(/[^\w-]+/g, '_')}-followup-${behavior}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`${phones.length} জন রিসিপিয়েন্ট এক্সপোর্ট হয়েছে`);
    } catch (e: any) {
      toast.error(e?.message || 'ফলো-আপ লোড ব্যর্থ');
    }
  };

  const duplicate = async () => {
    try {
      const { data, error } = await (supabase.rpc as any)('sms_duplicate_campaign', { p_id: campaign.id });
      if (error) throw error;
      toast.success('ক্যাম্পেইন ডুপ্লিকেট হয়েছে (ড্রাফট হিসেবে)');
      qc.invalidateQueries({ queryKey: ['sms-campaigns-full-history'] });
      onClose();
    } catch (e: any) {
      toast.error(e?.message || 'ডুপ্লিকেট ব্যর্থ');
    }
  };

  // ─── Retry Failed / Resend Campaign ────────────────────────────────
  const shortBase: string =
    (settings as any)?.sms_short_link_base || 'https://www.shornosuta.com/s';
  const expiryDays = Number((settings as any)?.sms_short_link_default_expiry_days || 30);

  const sendToRecipients = async (
    targets: any[],
    opts: { freshLinks: boolean },
    label: string,
  ) => {
    if (targets.length === 0) { toast.info(`${label} করার মতো কোনো রিসিপিয়েন্ট নেই`); return; }
    const expiresAt = new Date(Date.now() + expiryDays * 86400_000).toISOString();
    const hasUrls = extractUrls(campaign.body).length > 0;
    let ok = 0, fail = 0;
    setResendProgress({ done: 0, total: targets.length, ok: 0, fail: 0 });
    const BATCH = 1;
    for (let i = 0; i < targets.length; i += BATCH) {
      const batch = targets.slice(i, i + BATCH);
      const results = await Promise.all(batch.map(async (r) => {
        try {
          const baseMsg = r.message || campaign.body;
          let finalMsg = (!opts.freshLinks && r.final_message) ? r.final_message : baseMsg;
          if (hasUrls && (opts.freshLinks || !r.final_message)) {
            finalMsg = await rewriteBodyForRecipient({
              campaignId: campaign.id,
              recipientId: r.id,
              body: baseMsg,
              base: shortBase,
              expiresAt,
              forceNew: opts.freshLinks,
            });
          }
          finalMsg = formatSmsUrlsForProvider(finalMsg);
          const res: any = await withRetry(async () => {
            const { data, error } = await supabase.functions.invoke('send-sms', {
              body: { phone: r.phone, message: finalMsg },
            });
            if (error) throw error;
            return data;
          }, { retries: 1, delayMs: 500 });
          const success = !!res?.success;
          const deliveredMsg = typeof res?.sent_message === 'string' && res.sent_message.trim()
            ? res.sent_message
            : finalMsg;
          const deliveredParts = smsParts(deliveredMsg);
          await supabase.from('sms_campaign_recipients' as any).update({
            final_message: deliveredMsg,
            parts: deliveredParts,
            status: success ? 'sent' : 'failed',
            error_message: success ? null : (res?.error || 'Unknown error'),
            sent_at: new Date().toISOString(),
          }).eq('id', r.id);
          return success;
        } catch (e: any) {
          await supabase.from('sms_campaign_recipients' as any).update({
            status: 'failed', error_message: friendlyError(e),
          }).eq('id', r.id);
          return false;
        }
      }));
      for (const s of results) { if (s) ok++; else fail++; }
      setResendProgress({ done: Math.min(i + BATCH, targets.length), total: targets.length, ok, fail });
      await new Promise((res) => setTimeout(res, 700));
    }
    // Refresh aggregate counts on the campaign row
    const { data: agg } = await (supabase.from('sms_campaign_recipients' as any) as any)
      .select('status')
      .eq('campaign_id', campaign.id);
    if (Array.isArray(agg)) {
      const sent = agg.filter((x: any) => x.status === 'sent').length;
      const failed = agg.filter((x: any) => x.status === 'failed').length;
      await supabase.from('sms_campaigns' as any).update({
        sent_count: sent, failed_count: failed, status: sent > 0 ? 'completed' : 'failed',
        completed_at: new Date().toISOString(),
      }).eq('id', campaign.id);
    }
    qc.invalidateQueries({ queryKey: ['sms-campaign-recipients', campaign.id] });
    qc.invalidateQueries({ queryKey: ['sms-campaign-report', campaign.id] });
    qc.invalidateQueries({ queryKey: ['sms-campaigns-full-history'] });
    toast.success(`${label} সম্পন্ন — সফল ${ok}, ব্যর্থ ${fail}`);
  };

  const retryFailed = async () => {
    if (retrying) return;
    const failed = recipients.filter((r: any) => r.status === 'failed' && r.phone);
    if (failed.length === 0) { toast.info('কোনো ব্যর্থ রিসিপিয়েন্ট নেই'); return; }
    setRetrying(true);
    try { await sendToRecipients(failed, { freshLinks: false }, 'রিট্রাই'); }
    finally { setRetrying(false); setResendProgress({ done: 0, total: 0, ok: 0, fail: 0 }); }
  };

  const resendCampaign = async () => {
    if (resending) return;
    const targets = recipients.filter((r: any) => r.phone);
    setResending(true);
    try { await sendToRecipients(targets, { freshLinks: resendFresh }, 'রিসেন্ড'); setResendOpen(false); }
    finally { setResending(false); setResendProgress({ done: 0, total: 0, ok: 0, fail: 0 }); }
  };

  const failedCount = recipients.filter((r: any) => r.status === 'failed').length;


  return (
    <div className="mt-3">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid grid-cols-5 h-8 text-[11px]">
          <TabsTrigger value="overview">ওভারভিউ</TabsTrigger>
          <TabsTrigger value="links">লিংক</TabsTrigger>
          <TabsTrigger value="recipients">রিসিপিয়েন্ট</TabsTrigger>
          <TabsTrigger value="timeline">টাইমলাইন</TabsTrigger>
          <TabsTrigger value="followup">ফলো-আপ</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-3 mt-3 text-xs">
          <div className="grid grid-cols-3 gap-2">
            <Kpi label="Sent" value={kpi.sent ?? campaign.sent_count} />
            <Kpi label="Delivered" value={kpi.delivered ?? '—'} />
            <Kpi label="Clicks" value={kpi.clicks ?? 0} hint={`${kpi.unique_clicks ?? 0} unique`} />
            <Kpi label="CTR" value={`${kpi.ctr_pct ?? 0}%`} />
            <Kpi label="Conv." value={`${kpi.conversion_pct ?? 0}%`} />
            <Kpi label="Repeat Clicks" value={kpi.repeat_clicks ?? 0} />
            <Kpi label="Orders" value={kpi.orders ?? 0} />
            <Kpi label="Revenue" value={`৳${Number(kpi.revenue ?? 0).toFixed(0)}`} />
            <Kpi label="AOV" value={`৳${Number(kpi.aov ?? 0).toFixed(0)}`} />
          </div>
          <div className="space-y-1.5">
            <Row k="তৈরি" v={format(new Date(campaign.created_at), 'dd MMM yyyy HH:mm')} />
            <Row k="তৈরি করেছেন" v={campaign.created_by_email || campaign.created_by || '—'} />
            <Row k="টেমপ্লেট" v={campaign.template_name || '—'} />
            <Row k="প্রেরক" v={campaign.sender_name || '—'} />
            <Row k="মোট কাস্টমার" v={String(campaign.audience_size)} />
            <Row k="Final" v={String(campaign.final_count ?? campaign.sent_count)} />
            <Row k="SMS পার্ট" v={String(campaign.total_parts)} />
            <Row k="প্রকৃত খরচ" v={campaign.actual_cost != null ? `৳${Number(campaign.actual_cost).toFixed(2)}` : '—'} />
            <Row k="স্ট্যাটাস" v={campaign.status} />
            {report?.source && <Row k="ডেটা উৎস" v={report.source} />}
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground mb-1">মেসেজ</p>
            <div className="rounded border bg-muted/30 p-2 whitespace-pre-wrap">{campaign.body}</div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button size="sm" variant="outline" onClick={duplicate}><Copy className="h-3 w-3 mr-1" />ডুপ্লিকেট</Button>
            <Button size="sm" variant="outline" onClick={retryFailed} disabled={retrying || failedCount === 0}>
              {retrying ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}রিট্রাই ব্যর্থ ({failedCount})
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setResendFresh(false); setResendOpen(true); }} disabled={resending || recipients.length === 0}>
              <SendIcon className="h-3 w-3 mr-1" />রিসেন্ড ক্যাম্পেইন
            </Button>
          </div>
          {(retrying || resending) && resendProgress.total > 0 && (
            <div className="space-y-1 pt-1">
              <Progress value={(resendProgress.done / resendProgress.total) * 100} className="h-1.5" />
              <p className="text-[10px] text-muted-foreground">
                {resendProgress.done}/{resendProgress.total} — সফল {resendProgress.ok}, ব্যর্থ {resendProgress.fail}
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="links" className="mt-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">টোকেন</TableHead>
                <TableHead className="text-xs">URL</TableHead>
                <TableHead className="text-xs text-right">ক্লিক</TableHead>
                <TableHead className="text-xs text-right">ইউনিক</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(report?.links || []).map((l: any) => (
                <TableRow key={l.short_link_id}>
                  <TableCell className="text-xs font-mono">{l.token}</TableCell>
                  <TableCell className="text-xs truncate max-w-[220px]" title={l.original_url}>{l.original_url}</TableCell>
                  <TableCell className="text-xs text-right">{l.clicks}</TableCell>
                  <TableCell className="text-xs text-right">{l.unique_clicks}</TableCell>
                </TableRow>
              ))}
              {(report?.links || []).length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-6">কোনো শর্ট-লিংক নেই</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="recipients" className="mt-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">নাম / ফোন</TableHead>
                <TableHead className="text-xs">স্ট্যাটাস</TableHead>
                <TableHead className="text-xs text-right">ক্লিক</TableHead>
                <TableHead className="text-xs">অর্ডার</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recipients.slice(0, 200).map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">
                    <div className="font-medium">{r.customer_name || '—'}</div>
                    <div className="text-[10px] text-muted-foreground">{r.phone}</div>
                  </TableCell>
                  <TableCell className="text-xs">
                    <Badge variant="outline" className="text-[10px]">{r.click_status || r.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-right">{r.click_count || 0}</TableCell>
                  <TableCell className="text-xs">{r.order_id ? <Badge className="text-[10px]">✓</Badge> : '—'}</TableCell>
                </TableRow>
              ))}
              {recipients.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-6">কোনো রিসিপিয়েন্ট নেই</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          {recipients.length > 200 && (
            <p className="text-[10px] text-muted-foreground text-center mt-2">প্রথম 200 জন দেখানো হচ্ছে। সম্পূর্ণ তালিকার জন্য Export ব্যবহার করুন।</p>
          )}
        </TabsContent>

        <TabsContent value="timeline" className="mt-3 space-y-1.5">
          {clicks.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">কোনো ক্লিক রেকর্ড নেই</p>}
          {clicks.slice(0, 100).map((c: any) => (
            <div key={c.id} className="flex items-center justify-between text-xs border-b pb-1">
              <div>
                <span className="font-mono text-[10px]">{c.phone || 'অজানা'}</span>
                {c.is_unique && <Badge variant="secondary" className="ml-1 text-[9px]">unique</Badge>}
              </div>
              <span className="text-[10px] text-muted-foreground">{format(new Date(c.created_at), 'dd MMM HH:mm:ss')}</span>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="followup" className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            {onFollowup
              ? 'একটি সেগমেন্ট বেছে নিন — ফোনগুলো অডিয়েন্স ইঞ্জিনে লোড হবে (মেসেজ, টেমপ্লেট ও সেন্ডার preserved)।'
              : 'আচরণ অনুযায়ী ফলো-আপ অডিয়েন্স এক্সপোর্ট করুন।'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="outline" onClick={() => runFollowup('not_clicked')}>ক্লিক করেনি</Button>
            <Button size="sm" variant="outline" onClick={() => runFollowup('clicked_once')}>একবার ক্লিক</Button>
            <Button size="sm" variant="outline" onClick={() => runFollowup('multi_clicked')}>একাধিক ক্লিক</Button>
            <Button size="sm" variant="outline" onClick={() => runFollowup('clicked_no_order')}>ক্লিক করেছে, অর্ডার নেই</Button>
            <Button size="sm" variant="outline" onClick={() => runFollowup('ordered')}>অর্ডার দিয়েছে</Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* ─── Resend dialog ─── */}
      <Dialog open={resendOpen} onOpenChange={(o) => !resending && setResendOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ক্যাম্পেইন রিসেন্ড করুন</DialogTitle>
            <DialogDescription>
              {recipients.length} জন রিসিপিয়েন্টের কাছে এই ক্যাম্পেইনটি আবার পাঠানো হবে।
              শর্ট-লিংক পদ্ধতি বেছে নিন:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <label className="flex items-start gap-2 cursor-pointer rounded border p-2 hover:bg-muted/40">
              <input type="radio" checked={!resendFresh} onChange={() => setResendFresh(false)} className="mt-0.5" />
              <div>
                <div className="font-medium">বিদ্যমান শর্ট-লিংক পুনঃব্যবহার করুন</div>
                <div className="text-[11px] text-muted-foreground">আগের ক্লিক/অ্যাট্রিবিউশন ডেটা সংরক্ষিত থাকবে।</div>
              </div>
            </label>
            <label className="flex items-start gap-2 cursor-pointer rounded border p-2 hover:bg-muted/40">
              <input type="radio" checked={resendFresh} onChange={() => setResendFresh(true)} className="mt-0.5" />
              <div>
                <div className="font-medium">নতুন শর্ট-লিংক তৈরি করুন</div>
                <div className="text-[11px] text-muted-foreground">প্রতিটি রিসিপিয়েন্টের জন্য সম্পূর্ণ নতুন টোকেন; নতুন ট্র্যাকিং সেশন।</div>
              </div>
            </label>
          </div>
          {resending && resendProgress.total > 0 && (
            <div className="space-y-1">
              <Progress value={(resendProgress.done / resendProgress.total) * 100} className="h-1.5" />
              <p className="text-[10px] text-muted-foreground text-center">
                {resendProgress.done}/{resendProgress.total} — সফল {resendProgress.ok}, ব্যর্থ {resendProgress.fail}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setResendOpen(false)} disabled={resending}>বাতিল</Button>
            <Button size="sm" onClick={resendCampaign} disabled={resending}>
              {resending ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <SendIcon className="h-3 w-3 mr-1" />}
              রিসেন্ড করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

