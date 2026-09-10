// ───────────────────────────────────────────────────────────────────────────
//  Phase 4 — SMS Audience Engine tab.
//  Drop-in tab for AdminSmsCampaign that uses the new CRM Audience Engine
//  to resolve recipients, then sends through the EXISTING `send-sms` edge
//  function + `sms_campaigns` / `sms_campaign_recipients` pipeline.
//  Backward compatible: nothing in the legacy flow is touched.
// ───────────────────────────────────────────────────────────────────────────

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from 'sonner';
import { Sparkles, Loader2, Save, Send, Users } from 'lucide-react';
import { format } from 'date-fns';
import {
  AudiencePresetGrid, LocationPicker, DeliveryStatusPicker, IncludeExcludePanel,
  ManualExcludeBox, ManualIncludeBox, AudienceSummary, CustomerPreviewTable, AudienceConfirmDialog, ExportMenu,
  IncludeModeToggle, DuplicatePhonesDialog, ThresholdsCard,
} from '@/components/admin/audience';
import AudienceAnalyticsPanel from '@/components/admin/audience/AudienceAnalyticsPanel';
import DevVerificationPanel from '@/components/admin/audience/DevVerificationPanel';
import SelectedDrawer from '@/components/admin/audience/SelectedDrawer';
import CustomerDatabaseStatus from '@/components/admin/audience/CustomerDatabaseStatus';

import { useCrossPageSelection } from '@/hooks/useCrossPageSelection';
import { Eraser, ListChecks, Users2 } from 'lucide-react';
import { EMPTY_FILTER, type AudienceFilter, type PresetId, type ParcelStatus } from '@/lib/audience/types';
import { resolveAudiencePhones, computeAllPresetCounts, getDistrictBuckets } from '@/lib/audience/engine';
import { audienceKeys, AUDIENCE_CACHE_DEFAULTS, DISTRICT_CACHE_DEFAULTS } from '@/lib/audience/cache';
import { PRESETS } from '@/lib/audience/presets';
import { fetchAudienceForExport } from '@/lib/audience/export';
import { resolveTemplate, SAMPLE_CUSTOMER, VARIABLES } from '@/lib/audience/templates';
import { estimateSmsCost, smsParts } from '@/lib/audience/helpers';
import { useAllSettings } from '@/hooks/useAllSettings';
import { useSavedAudiences } from '@/hooks/useSavedAudiences';
import { computeAudienceStats } from '@/lib/audience/analytics';
import { logAudit } from '@/lib/audience/audit';
import { friendlyError, withRetry } from '@/lib/audience/errors';
import { extractUrls, formatSmsUrlsForProvider, rewriteBodyForRecipient } from '@/lib/sms/shortLinks';


interface Props {
  templates: any[];
  onInvalidateTemplates: () => void;
}

export interface SmsAudienceEngineHandle {
  loadFilter: (filter: AudienceFilter, body?: string) => void;
  loadFollowup: (
    phones: string[],
    opts?: { body?: string; templateName?: string | null },
  ) => void;
}

const SmsAudienceEngineTab = forwardRef<SmsAudienceEngineHandle, Props>(function SmsAudienceEngineTab(
  { templates, onInvalidateTemplates }: Props, ref,
) {
  const qc = useQueryClient();
  const { data: settings } = useAllSettings();
  const shop = settings?.shop_name || 'Shadamon';

  const [filter, setFilter] = useState<AudienceFilter>(EMPTY_FILTER);
  const [body, setBody] = useState('');
  const [templateId, setTemplateId] = useState<string>('');
  const [tplName, setTplName] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiTone, setAiTone] = useState('বন্ধুত্বপূর্ণ');
  const [aiLang, setAiLang] = useState('বাংলা');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiVariants, setAiVariants] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, ok: 0, fail: 0 });
  const [saveAudOpen, setSaveAudOpen] = useState(false);
  const [audName, setAudName] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const saved = useSavedAudiences('sms');

  // Single source of truth for customer selection (cross-page).
  const selection = useCrossPageSelection();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);

  // Reset selection when the audience definition itself changes (not when
  // manualExclude changes — those stem from removing selected rows).
  const audienceKey = useMemo(
    () => JSON.stringify({
      i: filter.include, e: filter.exclude, m: filter.includeMode,
      d: filter.districts, p: filter.parcelStatuses,
    }),
    [filter.include, filter.exclude, filter.includeMode, filter.districts, filter.parcelStatuses],
  );
  useEffect(() => { selection.clear(); }, [audienceKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Warm the shared cache once on mount so first interactions are instant.
  useEffect(() => {
    qc.prefetchQuery({
      queryKey: ['audience', 'preset-counts-all'],
      queryFn: () => computeAllPresetCounts(PRESETS.map((p) => p.id)),
      ...AUDIENCE_CACHE_DEFAULTS,
    });
    qc.prefetchQuery({
      queryKey: audienceKeys.districtCounts(),
      queryFn: getDistrictBuckets,
      ...DISTRICT_CACHE_DEFAULTS,
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectAllMatching = async () => {
    setSelectingAll(true);
    try {
      const n = await selection.selectAllMatching(filter);
      toast.success(`${n.toLocaleString()} জন সিলেক্ট হয়েছে`);
    } catch (e: any) {
      toast.error(e?.message || 'সিলেক্ট ব্যর্থ');
    } finally { setSelectingAll(false); }
  };

  const handleRemovePhone = (phone: string) => {
    selection.removeMany([phone]);
    setFilter((f) => ({ ...f, manualExclude: Array.from(new Set([...f.manualExclude, phone])) }));
  };


  useImperativeHandle(ref, () => ({
    loadFilter: (f: AudienceFilter, b?: string) => {
      setFilter(f);
      if (typeof b === 'string') setBody(b);
    },
    loadFollowup: (phones, opts) => {
      setFilter({ ...EMPTY_FILTER, manualInclude: Array.from(new Set(phones)) });
      if (typeof opts?.body === 'string') setBody(opts.body);
      if (opts?.templateName) {
        const t = templates.find((x: any) => x.name === opts.templateName);
        if (t) setTemplateId(t.id);
      }
    },
  }), [templates]);

  // Live resolve — runs whenever filter or message changes so summary,
  // duplicate dialog, and confirm dialog share the same dataset.
  const filterIsEmpty = (filter.include.length + filter.exclude.length + filter.districts.length + filter.parcelStatuses.length + (filter.manualInclude?.length || 0)) === 0;
  const parts = smsParts(body);
  const { data: resolved, isFetching: resolving, refetch: refetchResolved } = useQuery({
    queryKey: ['sms-engine-resolve', filter],
    queryFn: () => resolveAudiencePhones(filter, ''),
    enabled: !filterIsEmpty,
    staleTime: 60 * 60_000,
    gcTime: 2 * 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: 1,
    placeholderData: (prev: any) => prev,
  });

  // Light analytics on the currently filtered customers (debounced through the export fetcher cache).
  const { data: analyticsCustomers } = useQuery({
    queryKey: ['sms-engine-analytics', filter],
    queryFn: () => fetchAudienceForExport(filter),
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: 1,
    placeholderData: (prev: any) => prev,
    enabled: !filterIsEmpty,
  });
  const stats = useMemo(() => computeAudienceStats(analyticsCustomers || []), [analyticsCustomers]);

  const summary = useMemo(() => {
    if (!resolved?.summary) return undefined;
    return {
      ...resolved.summary,
      smsParts: parts,
      estimatedCost: estimateSmsCost(parts, resolved.summary.finalCount),
    };
  }, [resolved?.summary, parts]);
  const duplicateGroups = resolved?.duplicateGroups || [];
  const previewMsg = body ? resolveTemplate(body, SAMPLE_CUSTOMER, { shop }) : '';

  const setIncludeMode = (m: 'AND' | 'OR') => setFilter((f) => ({ ...f, includeMode: m }));

  const resolveDuplicates = (mode: 'first' | 'latest' | 'remove', phones?: string[]) => {
    // Strategy: push the duplicate phones into manualExclude, leaving one survivor.
    // "first" and "latest" both keep one row — we cannot distinguish without ordering metadata,
    // so we treat them identically (the engine already keeps the first encountered row).
    if (mode === 'remove' && phones?.length) {
      setFilter((f) => ({ ...f, manualExclude: Array.from(new Set([...f.manualExclude, ...phones])) }));
      return;
    }
    // For first/latest we don't need to do anything — the engine deduplicates by phone already.
    // Close dialog after acknowledgement.
    setDuplicatesOpen(false);
  };


  // ─── filter helpers ────────────────────────────────────────────────────
  const togglePreset = (id: PresetId) => setFilter((f) => ({
    ...f,
    include: f.include.includes(id) ? f.include.filter((x) => x !== id) : [...f.include, id],
    exclude: f.exclude.filter((x) => x !== id),
  }));
  const toggleDistrict = (name: string) => setFilter((f) => ({
    ...f, districts: f.districts.includes(name) ? f.districts.filter((d) => d !== name) : [...f.districts, name],
  }));
  const toggleParcel = (id: ParcelStatus) => setFilter((f) => ({
    ...f, parcelStatuses: f.parcelStatuses.includes(id) ? f.parcelStatuses.filter((x) => x !== id) : [...f.parcelStatuses, id],
  }));
  const moveToExclude = (id: PresetId) => setFilter((f) => ({
    ...f, include: f.include.filter((x) => x !== id), exclude: [...f.exclude, id],
  }));
  const moveToInclude = (id: PresetId) => setFilter((f) => ({
    ...f, exclude: f.exclude.filter((x) => x !== id), include: [...f.include, id],
  }));

  // ─── composer ──────────────────────────────────────────────────────────
  const insertVar = (token: string) => {
    const t = textareaRef.current;
    if (!t) { setBody((b) => b + token); return; }
    const s = t.selectionStart, e = t.selectionEnd;
    setBody(t.value.slice(0, s) + token + t.value.slice(e));
    setTimeout(() => { t.focus(); t.setSelectionRange(s + token.length, s + token.length); }, 0);
  };

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t) setBody(t.body);
  };

  const saveTemplate = async () => {
    if (!tplName.trim() || !body.trim()) { toast.error('নাম ও মেসেজ দিন'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('sms_templates' as any).insert({
      name: tplName, body, tone: aiTone, language: aiLang, created_by: user?.id,
    });
    if (error) toast.error(error.message);
    else { toast.success('সেভ হয়েছে'); setTplName(''); onInvalidateTemplates(); }
  };

  // ─── AI ────────────────────────────────────────────────────────────────
  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) { toast.error('প্রম্পট দিন'); return; }
    setAiLoading(true); setAiVariants([]);
    try {
      const fullPrompt = `${aiPrompt}
টোন: ${aiTone}, ভাষা: ${aiLang}, শপের নাম: ${shop}
৩টি ভিন্ন SMS লিখো, প্রতিটি ১৬০ অক্ষরের মধ্যে। গ্রাহকের নামের জন্য {{first_name}} ভ্যারিয়েবল ব্যবহার করো।
শুধু JSON অ্যারে ফরম্যাটে দাও: ["sms1","sms2","sms3"]। কোনো ব্যাখ্যা বা markdown নয়।`;
      const { data, error } = await supabase.functions.invoke('ai-generate', {
        body: { type: 'general', prompt: fullPrompt },
      });
      if (error) throw error;
      const content = (data?.content || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
      const m = content.match(/\[[\s\S]*\]/);
      const arr = JSON.parse(m ? m[0] : content);
      if (!Array.isArray(arr)) throw new Error('Invalid response');
      setAiVariants(arr.filter((x: any) => typeof x === 'string').slice(0, 3));
      toast.success(`${arr.length}টি ভ্যারিয়েন্ট তৈরি`);
    } catch (e: any) {
      toast.error(e?.message || 'AI জেনারেশনে সমস্যা');
    } finally { setAiLoading(false); }
  };

  // ─── saved audience ────────────────────────────────────────────────────
  const handleSaveAudience = async () => {
    if (!audName.trim()) { toast.error('নাম দিন'); return; }
    try {
      const customer_count = analyticsCustomers?.length ?? 0;
      const res: any = await saved.save.mutateAsync({ name: audName, filters: filter, channel_hint: 'sms' });
      try {
        if (res?.id) {
          await (supabase.from('crm_saved_audiences' as any) as any)
            .update({ customer_count, last_used_at: new Date().toISOString() })
            .eq('id', res.id);
          await logAudit('audience_created', 'saved_audience', res.id, { name: audName, customer_count });
        }
      } catch {
        // Saving the audience itself succeeded; metadata update is best-effort.
      }
      toast.success('অডিয়েন্স সেভ হয়েছে');
      setAudName(''); setSaveAudOpen(false);
    } catch (e: any) { toast.error(friendlyError(e)); }
  };

  const loadSaved = (id: string) => {
    const a = (saved.list.data || []).find((x) => x.id === id);
    if (a) {
      setFilter(a.filters);
      (supabase.from('crm_saved_audiences' as any) as any)
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', id)
        .then(() => {}, () => {});
    }
  };

  // ─── send (reuses legacy `send-sms` + `sms_campaigns` pipeline) ───────
  const handleSend = async (opts: { dryRun: boolean } = { dryRun: false }) => {
    if (sending) return;
    if (!body.trim()) { toast.error('মেসেজ লিখুন'); return; }
    const result = resolved || (await refetchResolved()).data;
    if (!result || result.phones.length === 0) { toast.error('কোনো রিসিপিয়েন্ট নেই'); return; }

    setSending(true);
    setProgress({ done: 0, total: result.phones.length, ok: 0, fail: 0 });

    const customers = await fetchAudienceForExport(filter);
    const byPhone = new Map(customers.map((c) => [c.phone, c]));
    const phoneList = result.phones;
    const sendSummary = {
      ...result.summary,
      smsParts: parts,
      estimatedCost: estimateSmsCost(parts, result.summary.finalCount),
    };

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const campaignName = `${opts.dryRun ? '[DRY] ' : ''}Audience Engine — ${format(new Date(), 'dd MMM HH:mm')}`;
      const { data: campaign, error: cErr } = await supabase
        .from('sms_campaigns' as any)
        .insert({
          name: campaignName,
          body,
          audience_filter: filter as any,
          audience_filters: filter as any,
          audience_size: sendSummary.recipients,
          final_count: sendSummary.finalCount,
          duplicates_removed: sendSummary.duplicatesRemoved,
          excluded_count: sendSummary.excluded,
          total_parts: parts * sendSummary.finalCount,
          total_cost: sendSummary.estimatedCost,
          template_name: templates.find((t) => t.id === templateId)?.name || null,
          sender_name: settings?.shop_name || null,
          status: opts.dryRun ? 'dry_run' : 'sending',
          audience_source: sendSummary.source,
          manual_count: sendSummary.manualCount,
          database_count: sendSummary.databaseCount,
          created_by: user?.id,
          created_by_email: user?.email ?? null,
        })
        .select()
        .single();
      if (cErr || !campaign) throw cErr || new Error('Failed to create campaign');
      const campaignId = (campaign as any).id;

      if (opts.dryRun) {
        await logAudit('sms_dry_run', 'sms_campaign', campaignId, {
          final: sendSummary.finalCount,
          estimated_cost: sendSummary.estimatedCost,
          parts,
        });
        toast.success(`ড্রাই রান সম্পন্ন — ${sendSummary.finalCount} রিসিপিয়েন্ট, আনুমানিক ৳${sendSummary.estimatedCost.toFixed(2)}`);
        qc.invalidateQueries({ queryKey: ['sms-campaigns-full-history'] });
        setConfirmOpen(false);
        return;
      }

      // Snapshot for historical accuracy (frozen at send time)
      await supabase.from('sms_campaigns' as any).update({
        final_body: body,
        snapshot: {
          body,
          template_name: templates.find((t) => t.id === templateId)?.name || null,
          sender_name: settings?.shop_name || null,
          audience_filter: filter,
          summary: sendSummary,
          frozen_at: new Date().toISOString(),
        },
      }).eq('id', campaignId);

      const shortBase: string =
        (settings as any)?.sms_short_link_base || 'https://shorno-suta.vercel.app/s';
      const expiryDays = Number((settings as any)?.sms_short_link_default_expiry_days || 30);
      const expiresAt = new Date(Date.now() + expiryDays * 86400_000).toISOString();
      const hasUrls = extractUrls(body).length > 0;

      let ok = 0, fail = 0, sentParts = 0, totalParts = 0;
      const perSmsCost = parseFloat((settings as any)?.mimsms_per_sms_cost || '0.30');
      const BATCH = 1; // Automas silently rejects parallel campaign sends on the same sender ID (returns []).
      for (let i = 0; i < phoneList.length; i += BATCH) {
        const batch = phoneList.slice(i, i + BATCH);
        const results = await Promise.all(batch.map(async (phone) => {
          const cust = byPhone.get(phone) || { ...SAMPLE_CUSTOMER, phone, name: '', district: null, upazila: null };
          const baseMsg = resolveTemplate(body, cust as any, { shop });
          const local = phone.startsWith('880') ? '0' + phone.slice(3) : phone;
          // 1. Insert recipient row to get its id
          const { data: recRow } = await supabase.from('sms_campaign_recipients' as any).insert({
            campaign_id: campaignId,
            customer_name: cust.name || '',
            phone: local,
            message: baseMsg,
            parts: smsParts(baseMsg),
            status: 'pending',
            sent_at: new Date().toISOString(),
          }).select('id').single();
          const recipientId = (recRow as any)?.id as string | undefined;

          // 2. Rewrite URLs into short-links scoped to this recipient
          let finalMsg = baseMsg;
          if (hasUrls && recipientId) {
            finalMsg = await rewriteBodyForRecipient({
              campaignId, recipientId, body: baseMsg, base: shortBase, expiresAt,
            });
          }
          finalMsg = formatSmsUrlsForProvider(finalMsg);
          const finalParts = smsParts(finalMsg);

          // 3. Send via existing pipeline
          try {
            const res: any = await withRetry(async () => {
              const { data, error } = await supabase.functions.invoke('send-sms', { body: { phone: local, message: finalMsg } });
              if (error) throw error;
              return data;
            }, { retries: 1, delayMs: 500 });
            const success = !!res?.success;
            const deliveredMsg = typeof res?.sent_message === 'string' && res.sent_message.trim()
              ? res.sent_message
              : finalMsg;
            const deliveredParts = smsParts(deliveredMsg);
            if (recipientId) {
              await supabase.from('sms_campaign_recipients' as any).update({
                message: baseMsg,
                final_message: deliveredMsg,
                parts: deliveredParts,
                status: success ? 'sent' : 'failed',
                error_message: success ? null : (res?.error || 'Unknown error'),
                sent_at: new Date().toISOString(),
              }).eq('id', recipientId);
            }
            return { success, parts: deliveredParts };
          } catch (e: any) {
            if (recipientId) {
              await supabase.from('sms_campaign_recipients' as any).update({
                status: 'failed', error_message: friendlyError(e),
              }).eq('id', recipientId);
            }
            return { success: false, parts: finalParts };
          }
        }));
        for (const r of results) {
          totalParts += r.parts;
          if (r.success) { ok++; sentParts += r.parts; } else { fail++; }
        }
        setProgress({ done: Math.min(i + BATCH, phoneList.length), total: phoneList.length, ok, fail });
        await new Promise((r) => setTimeout(r, 700));
      }


      // Actual cost = parts ACTUALLY sent × per-SMS rate (matches legacy AdminSmsCampaign formula).
      const actualCost = +(sentParts * perSmsCost).toFixed(2);
      await supabase.from('sms_campaigns' as any).update({
        sent_count: ok,
        failed_count: fail,
        status: ok > 0 ? 'completed' : 'failed',
        total_parts: totalParts || (parts * phoneList.length),
        actual_cost: actualCost,
        completed_at: new Date().toISOString(),
      }).eq('id', campaignId);

      await logAudit('sms_sent', 'sms_campaign', campaignId, { ok, fail, total: phoneList.length });
      toast.success(`পাঠানো শেষ — সফল ${ok}, ব্যর্থ ${fail}`);
      qc.invalidateQueries({ queryKey: ['sms-campaigns-history'] });
      qc.invalidateQueries({ queryKey: ['sms-campaigns-full-history'] });
      setConfirmOpen(false);
    } catch (e: any) {
      toast.error(friendlyError(e));
    } finally { setSending(false); }
  };


  return (
    <div className="space-y-4">
      <CustomerDatabaseStatus />
      <DevVerificationPanel filter={filter} summary={summary} />
      <div className="grid lg:grid-cols-3 gap-4">

        {/* ───── left: filters ───── */}
        <div className="lg:col-span-2 space-y-3">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> অডিয়েন্স তৈরি করুন</CardTitle>
              <div className="flex gap-2">
                <ExportMenu filter={filter} filenameBase="sms-audience" />
                <Button size="sm" variant="outline" onClick={() => setSaveAudOpen((v) => !v)}>
                  <Save className="h-3.5 w-3.5 mr-1" /> Save Audience
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {saveAudOpen && (
                <div className="flex gap-2">
                  <Input value={audName} onChange={(e) => setAudName(e.target.value)} placeholder="অডিয়েন্স নাম" className="h-8 text-sm" />
                  <Button size="sm" onClick={handleSaveAudience} disabled={saved.save.isPending}>সেভ</Button>
                </div>
              )}

              {(saved.list.data?.length || 0) > 0 && (
                <Select onValueChange={loadSaved}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="সেভড অডিয়েন্স লোড করুন" /></SelectTrigger>
                  <SelectContent>
                    {saved.list.data!.map((a) => (
                      <SelectItem key={a.id} value={a.id} className="text-xs">{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <IncludeModeToggle mode={filter.includeMode || 'AND'} onChange={setIncludeMode} />

              {duplicateGroups.length > 0 && (
                <button
                  type="button"
                  onClick={() => setDuplicatesOpen(true)}
                  className="w-full text-left rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs hover:bg-amber-100/60 transition"
                >
                  <span className="font-semibold text-amber-700">⚠ {duplicateGroups.length} ডুপ্লিকেট ফোন</span>
                  <span className="text-muted-foreground"> — দেখুন ও রেজোলিউশন করুন</span>
                </button>
              )}

              <Accordion type="multiple" defaultValue={['presets']} className="border rounded-md">
                <AccordionItem value="presets">
                  <AccordionTrigger className="text-xs px-3 py-2">প্রিসেট কার্ড</AccordionTrigger>
                  <AccordionContent className="px-3">
                    <AudiencePresetGrid selected={filter.include} onToggle={togglePreset} />
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="district">
                  <AccordionTrigger className="text-xs px-3 py-2">জেলা ({filter.districts.length})</AccordionTrigger>
                  <AccordionContent className="px-3">
                    <LocationPicker selectedDistricts={filter.districts} onToggleDistrict={toggleDistrict} />
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="parcel">
                  <AccordionTrigger className="text-xs px-3 py-2">পার্সেল স্ট্যাটাস ({filter.parcelStatuses.length})</AccordionTrigger>
                  <AccordionContent className="px-3">
                    <DeliveryStatusPicker selected={filter.parcelStatuses} onToggle={toggleParcel} />
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="manual">
                  <AccordionTrigger className="text-xs px-3 py-2">ম্যানুয়াল এক্সক্লুড ({filter.manualExclude.length})</AccordionTrigger>
                  <AccordionContent className="px-3">
                    <ManualExcludeBox value={filter.manualExclude} onChange={(phones) => setFilter((f) => ({ ...f, manualExclude: phones }))} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <IncludeExcludePanel
                include={filter.include}
                exclude={filter.exclude}
                districts={filter.districts}
                onRemoveInclude={(id) => setFilter((f) => ({ ...f, include: f.include.filter((x) => x !== id) }))}
                onRemoveExclude={(id) => setFilter((f) => ({ ...f, exclude: f.exclude.filter((x) => x !== id) }))}
                onRemoveDistrict={(name) => setFilter((f) => ({ ...f, districts: f.districts.filter((d) => d !== name) }))}
                onMoveToExclude={moveToExclude}
                onMoveToInclude={moveToInclude}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-sm">গ্রাহক প্রিভিউ</CardTitle>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="text-[10px] font-mono">
                  Selected {selection.count.toLocaleString()}
                </Badge>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                  onClick={handleSelectAllMatching} disabled={selectingAll || filterIsEmpty}>
                  {selectingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <ListChecks className="h-3 w-3" />}
                  Select All Matching{resolved?.summary?.finalCount ? ` (${resolved.summary.finalCount.toLocaleString()})` : ''}
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                  onClick={() => selection.clear()} disabled={selection.count === 0}>
                  <Eraser className="h-3 w-3" /> Clear
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                  onClick={() => setDrawerOpen(true)} disabled={selection.count === 0}>
                  <Users2 className="h-3 w-3" /> Drawer
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <CustomerPreviewTable
                filter={filter}
                selected={selection.selected}
                onToggleSelect={selection.toggle}
                onSelectMany={selection.addMany}
                onUnselectMany={selection.removeMany}
                onRemove={handleRemovePhone}
                prefKey="sms-engine"
              />
            </CardContent>
          </Card>

          <SelectedDrawer
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            phones={Array.from(selection.selected)}
            onRemove={handleRemovePhone}
            onClear={() => selection.clear()}
          />

        </div>

        {/* ───── right: composer + summary ───── */}
        <div className="space-y-3">
          <AudienceSummary filter={filter} message={body} summary={summary} resolving={resolving} />
          {analyticsCustomers && analyticsCustomers.length > 0 && (
            <AudienceAnalyticsPanel stats={stats} />
          )}
          <ThresholdsCard />

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" /> ম্যানুয়াল নাম্বার
                {(filter.manualInclude?.length || 0) > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] font-mono">
                    {filter.manualInclude!.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ManualIncludeBox
                value={filter.manualInclude || []}
                onChange={(phones) => setFilter((f) => ({ ...f, manualInclude: phones }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Send className="h-4 w-4" /> মেসেজ</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {templates.length > 0 && (
                <Select value={templateId} onValueChange={applyTemplate}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="টেমপ্লেট লোড করুন" /></SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className="flex flex-wrap gap-1">
                {VARIABLES.map((v) => (
                  <button key={v.token} type="button" onClick={() => insertVar(v.token)}
                    className="px-2 py-0.5 text-[10px] rounded border bg-muted/50 hover:bg-primary/10 hover:border-primary transition">
                    {v.token}
                  </button>
                ))}
              </div>
              <Textarea ref={textareaRef} value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="হ্যালো {{first_name}}, ..." className="text-sm" />

              {/* Resolved audience binding — single source of truth */}
              <div className="rounded-md border bg-muted/40 px-2.5 py-2 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[9px] uppercase tracking-wide text-muted-foreground">রিসিপিয়েন্ট</div>
                  <div className="text-sm font-mono font-semibold text-emerald-600">
                    {resolving && !summary ? '…' : (summary?.finalCount ?? 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wide text-muted-foreground">SMS Parts</div>
                  <div className="text-sm font-mono font-semibold">{parts}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wide text-muted-foreground">মোট SMS</div>
                  <div className="text-sm font-mono font-semibold">
                    {((summary?.finalCount ?? 0) * parts).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground">{body.length} অক্ষর · {parts} পার্ট</div>

              {previewMsg && (
                <div className="rounded-md border bg-card p-2.5 text-xs">
                  <p className="text-muted-foreground mb-1">প্রিভিউ:</p>
                  <p className="whitespace-pre-wrap">{previewMsg}</p>
                </div>
              )}

              <div className="border rounded-md p-2.5 space-y-2 bg-primary/5">
                <p className="text-xs font-medium flex items-center gap-1"><Sparkles className="h-3 w-3 text-primary" /> AI টেমপ্লেট</p>
                <Textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="ঈদ অফার, ২০% ছাড়" rows={2} className="text-xs" />
                <div className="grid grid-cols-2 gap-2">
                  <Select value={aiTone} onValueChange={setAiTone}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="বন্ধুত্বপূর্ণ">বন্ধুত্বপূর্ণ</SelectItem>
                      <SelectItem value="প্রফেশনাল">প্রফেশনাল</SelectItem>
                      <SelectItem value="urgency">Urgency</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={aiLang} onValueChange={setAiLang}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="বাংলা">বাংলা</SelectItem>
                      <SelectItem value="English">English</SelectItem>
                      <SelectItem value="মিক্স">মিক্স</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAiGenerate} disabled={aiLoading} size="sm" className="w-full h-8">
                  {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                  জেনারেট
                </Button>
                {aiVariants.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {aiVariants.map((v, i) => (
                      <button key={i} onClick={() => setBody(v)} className="w-full text-left text-xs p-2 rounded border bg-background hover:border-primary hover:bg-primary/5 transition">
                        <span className="text-muted-foreground text-[10px] block mb-0.5">ভ্যারিয়েন্ট {i + 1} ({smsParts(v)} পার্ট)</span>
                        {v}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="টেমপ্লেট নাম" className="h-8 text-xs" />
                <Button onClick={saveTemplate} size="sm" variant="outline" className="h-8"><Save className="h-3.5 w-3.5 mr-1" /> সেভ</Button>
              </div>

              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={!body.trim() || (summary?.finalCount ?? 0) === 0 || resolving}
                className="w-full"
                size="lg"
              >
                <Send className="h-4 w-4 mr-2" />
                রিভিউ ও পাঠান{summary?.finalCount ? ` (${summary.finalCount.toLocaleString()})` : ''}
              </Button>
              {!body.trim() && (
                <p className="text-[11px] text-amber-600 text-center">⚠ মেসেজ লিখুন</p>
              )}
              {body.trim() && (summary?.finalCount ?? 0) === 0 && !resolving && (
                <p className="text-[11px] text-rose-600 text-center">⚠ অডিয়েন্স ফিল্টার সিলেক্ট করুন — কোনো রিসিপিয়েন্ট নেই</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AudienceConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        summary={summary}
        previewMessage={previewMsg}
        sending={sending || resolving}
        progress={progress}
        onConfirm={(opts) => handleSend(opts)}
      />

      <DuplicatePhonesDialog
        open={duplicatesOpen}
        onOpenChange={setDuplicatesOpen}
        groups={duplicateGroups}
        onResolve={resolveDuplicates}
      />
    </div>
  );
});

export default SmsAudienceEngineTab;

