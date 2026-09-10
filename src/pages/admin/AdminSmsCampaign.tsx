import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabaseHelpers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  MessageSquare, Users, Send, Sparkles, Loader2, Crown, Repeat, UserPlus,
  AlertTriangle, XCircle, MapPin, Save, Trash2, Eye, History, Zap,
} from 'lucide-react';
import { useAllSettings } from '@/hooks/useAllSettings';
import { format } from 'date-fns';
import SmsAudienceEngineTab, { type SmsAudienceEngineHandle } from '@/components/admin/audience/SmsAudienceEngineTab';
import SmsCampaignHistoryTab from '@/components/admin/audience/SmsCampaignHistoryTab';
import SavedAudiencesTab from '@/components/admin/audience/SavedAudiencesTab';
import AuditLogTab from '@/components/admin/audience/AuditLogTab';
import { FolderOpen, ShieldCheck } from 'lucide-react';
import { formatSmsUrlsForProvider } from '@/lib/sms/shortLinks';

// ─── helpers ──────────────────────────────────────────────────────────────────
function normalizePhone(raw?: string): string | null {
  if (!raw) return null;
  let p = raw.replace(/[\s-+]/g, '');
  if (p.startsWith('88')) p = p.slice(2);
  if (p.startsWith('0')) p = p.slice(1);
  if (!/^1[3-9]\d{8}$/.test(p)) return null;
  return '0' + p;
}
function isUnicode(s: string) { return /[^\x00-\x7F]/.test(s); }
function smsParts(s: string): number {
  if (!s) return 0;
  if (isUnicode(s)) return s.length <= 70 ? 1 : Math.ceil(s.length / 67);
  return s.length <= 160 ? 1 : Math.ceil(s.length / 153);
}
function firstName(name?: string) {
  return (name || '').trim().split(/\s+/)[0] || 'গ্রাহক';
}
function replaceVars(body: string, c: Recipient, shop: string): string {
  return body
    .replace(/\{\{first_name\}\}/g, firstName(c.name))
    .replace(/\{\{name\}\}/g, c.name || 'গ্রাহক')
    .replace(/\{\{order_count\}\}/g, String(c.order_count || 0))
    .replace(/\{\{last_order_date\}\}/g, c.last_order ? format(new Date(c.last_order), 'dd MMM') : '')
    .replace(/\{\{shop\}\}/g, shop);
}

interface Recipient {
  phone: string;
  name: string;
  order_count: number;
  delivered: number;
  cancelled: number;
  last_order: string | null;
  city: string;
}

type Segment = 'all' | 'vip' | 'repeat' | 'new' | 'at_risk' | 'cancel_prone' | 'city' | 'manual';

const SEGMENTS: { id: Segment; label: string; icon: any; color: string }[] = [
  { id: 'all', label: 'সবাই', icon: Users, color: 'bg-slate-100 text-slate-700' },
  { id: 'vip', label: 'VIP (৫+ ডেলিভার্ড)', icon: Crown, color: 'bg-amber-100 text-amber-800' },
  { id: 'repeat', label: 'রিপিট (২+ ডেলিভার্ড)', icon: Repeat, color: 'bg-blue-100 text-blue-800' },
  { id: 'new', label: 'নতুন (৩০ দিন)', icon: UserPlus, color: 'bg-green-100 text-green-800' },
  { id: 'at_risk', label: 'At-Risk (৬০+ দিন)', icon: AlertTriangle, color: 'bg-orange-100 text-orange-800' },
  { id: 'cancel_prone', label: 'ক্যান্সেল-প্রবণ', icon: XCircle, color: 'bg-rose-100 text-rose-800' },
  { id: 'city', label: 'জেলা', icon: MapPin, color: 'bg-purple-100 text-purple-800' },
  { id: 'manual', label: 'ম্যানুয়াল', icon: Eye, color: 'bg-indigo-100 text-indigo-800' },
];

const VARS = [
  { token: '{{first_name}}', label: 'প্রথম নাম' },
  { token: '{{name}}', label: 'পুরো নাম' },
  { token: '{{order_count}}', label: 'অর্ডার সংখ্যা' },
  { token: '{{last_order_date}}', label: 'শেষ অর্ডার' },
  { token: '{{shop}}', label: 'শপ নাম' },
];

export default function AdminSmsCampaign() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: settings } = useAllSettings();
  const shop = settings?.shop_name || 'Shorno Suta';
  const perSmsCost = parseFloat(settings?.mimsms_per_sms_cost || '0.30');

  const [segment, setSegment] = useState<Segment>('all');
  const [cityFilter, setCityFilter] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [manualSelected, setManualSelected] = useState<Set<string>>(new Set());
  const [manualSearch, setManualSearch] = useState('');
  const [extraPhone, setExtraPhone] = useState('');
  const [extraName, setExtraName] = useState('');
  const [extraRecipients, setExtraRecipients] = useState<Recipient[]>([]);
  const [body, setBody] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiTone, setAiTone] = useState('বন্ধুত্বপূর্ণ');
  const [aiLang, setAiLang] = useState('বাংলা');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiVariants, setAiVariants] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ done: 0, total: 0, ok: 0, fail: 0 });
  const [drilldownId, setDrilldownId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const engineRef = useRef<SmsAudienceEngineHandle>(null);
  const TAB_STORAGE_KEY = 'admin.smsCampaign.activeTab';
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window === 'undefined') return 'compose';
    return searchParams.get('tab') || window.localStorage.getItem(TAB_STORAGE_KEY) || 'compose';
  });
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };
  useEffect(() => {
    try { window.localStorage.setItem(TAB_STORAGE_KEY, activeTab); } catch { /* ignore storage errors */ }
  }, [activeTab]);


  // ─── audience pool fetch ──────────────────────────────────────────────────
  const { data: pool = [], isLoading: poolLoading } = useQuery({
    queryKey: ['sms-campaign-pool'],
    queryFn: async () => {
      const orders = await fetchAllRows<any>(() =>
        supabase
          .from('orders')
          .select('customer_phone, customer_name, status, city, created_at')
          .not('customer_phone', 'is', null)
          .neq('customer_phone', '')
          .is('deleted_at', null)
      );
      const map = new Map<string, Recipient>();
      for (const o of orders || []) {
        const ph = normalizePhone(o.customer_phone);
        if (!ph) continue;
        let r = map.get(ph);
        if (!r) {
          r = { phone: ph, name: o.customer_name || '', order_count: 0, delivered: 0, cancelled: 0, last_order: null, city: o.city || '' };
          map.set(ph, r);
        }
        r.order_count++;
        if (o.status === 'delivered' || o.status === 'office_sell') r.delivered++;
        if (o.status === 'cancelled') r.cancelled++;
        if (!r.last_order || o.created_at > r.last_order) r.last_order = o.created_at;
        if (!r.name && o.customer_name) r.name = o.customer_name;
        if (!r.city && o.city) r.city = o.city;
      }
      return Array.from(map.values());
    },
    enabled: activeTab === 'compose',
    staleTime: 60 * 60_000,
    gcTime: 2 * 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  // ─── derived audience ────────────────────────────────────────────────────
  const audience = useMemo<Recipient[]>(() => {
    const now = Date.now();
    const D = (d: string | null) => d ? (now - new Date(d).getTime()) / 86400000 : Infinity;
    switch (segment) {
      case 'all': return pool;
      case 'vip': return pool.filter(r => r.delivered >= 5);
      case 'repeat': return pool.filter(r => r.delivered >= 2);
      case 'new': return pool.filter(r => r.order_count === 1 && D(r.last_order) <= 30);
      case 'at_risk': return pool.filter(r => D(r.last_order) >= 60);
      case 'cancel_prone': return pool.filter(r => r.cancelled >= 3);
      case 'city': return cityFilter ? pool.filter(r => (r.city || '').trim().toLowerCase() === cityFilter.trim().toLowerCase()) : [];
      case 'manual': {
        const fromPool = pool.filter(r => manualSelected.has(r.phone));
        const seen = new Set(fromPool.map(r => r.phone));
        const extras = extraRecipients.filter(r => !seen.has(r.phone));
        return [...fromPool, ...extras];
      }
    }
  }, [pool, segment, cityFilter, manualSelected, extraRecipients]);

  // city aggregation for jela selector
  const cityCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of pool) {
      const c = (r.city || '').trim();
      if (!c) continue;
      m.set(c, (m.get(c) || 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [pool]);

  // manual search filter
  const manualFiltered = useMemo(() => {
    const q = manualSearch.trim().toLowerCase();
    const list = q
      ? pool.filter(r => (r.name || '').toLowerCase().includes(q) || r.phone.includes(q))
      : pool;
    return list.slice(0, 500);
  }, [pool, manualSearch]);


  // ─── stats ───────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const parts = smsParts(body);
    const total = audience.length * parts;
    return { recipients: audience.length, parts, totalSms: total, cost: total * perSmsCost };
  }, [audience, body, perSmsCost]);

  // ─── insert variable at cursor ───────────────────────────────────────────
  const insertVar = (token: string) => {
    const t = textareaRef.current;
    if (!t) { setBody(b => b + token); return; }
    const s = t.selectionStart, e = t.selectionEnd;
    setBody(t.value.slice(0, s) + token + t.value.slice(e));
    setTimeout(() => { t.focus(); t.setSelectionRange(s + token.length, s + token.length); }, 0);
  };

  const addExtraRecipient = () => {
    const ph = normalizePhone(extraPhone);
    if (!ph) { toast.error('সঠিক বাংলাদেশি নম্বর দিন'); return; }
    if (extraRecipients.some(r => r.phone === ph) || pool.some(r => r.phone === ph && manualSelected.has(ph))) {
      toast.info('এই নম্বরটি ইতোমধ্যে যুক্ত আছে'); return;
    }
    const existing = pool.find(r => r.phone === ph);
    setExtraRecipients(prev => [
      ...prev,
      existing
        ? { ...existing }
        : { phone: ph, name: extraName.trim(), order_count: 0, delivered: 0, cancelled: 0, last_order: null, city: '' },
    ]);
    setExtraPhone(''); setExtraName('');
  };


  // ─── AI generate ─────────────────────────────────────────────────────────
  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) { toast.error('প্রম্পট দিন'); return; }
    setAiLoading(true);
    setAiVariants([]);
    try {
      const fullPrompt = `${aiPrompt}
টোন: ${aiTone}, ভাষা: ${aiLang}, শপের নাম: ${shop}
৩টি ভিন্ন SMS লিখো, প্রতিটি ১৬০ অক্ষরের মধ্যে। গ্রাহকের নামের জন্য {{first_name}} ভ্যারিয়েবল ব্যবহার করো।
শুধু JSON অ্যারে ফরম্যাটে দাও: ["sms1", "sms2", "sms3"]। কোনো ব্যাখ্যা বা markdown নয়, শুধু raw JSON array।`;
      const { data, error } = await supabase.functions.invoke('ai-generate', {
        body: { type: 'general', prompt: fullPrompt },
      });
      if (error) throw error;
      let content = (data?.content || '').trim();
      content = content.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
      const m = content.match(/\[[\s\S]*\]/);
      const arr = JSON.parse(m ? m[0] : content);
      if (!Array.isArray(arr)) throw new Error('Invalid response');
      setAiVariants(arr.filter((x: any) => typeof x === 'string').slice(0, 3));
      toast.success(`${arr.length}টি ভ্যারিয়েন্ট তৈরি হয়েছে`);
    } catch (e: any) {
      toast.error(e.message || 'AI জেনারেশনে সমস্যা');
    } finally { setAiLoading(false); }
  };

  // ─── send campaign ───────────────────────────────────────────────────────
  const handleSend = async () => {
    if (sending) return;
    setSending(true);
    setSendProgress({ done: 0, total: audience.length, ok: 0, fail: 0 });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // create campaign
      const { data: campaign, error: cErr } = await supabase
        .from('sms_campaigns' as any)
        .insert({
          name: `${SEGMENTS.find(s => s.id === segment)?.label} — ${format(new Date(), 'dd MMM HH:mm')}`,
          body,
          audience_filter: { segment, city: cityFilter },
          audience_size: audience.length,
          total_parts: stats.totalSms,
          total_cost: stats.cost,
          status: 'sending',
          created_by: user?.id,
        })
        .select()
        .single();
      if (cErr || !campaign) throw cErr || new Error('Failed to create campaign');
      const campaignId = (campaign as any).id;

      let ok = 0, fail = 0, sentParts = 0, totalParts = 0;
      const BATCH = 3;
      for (let i = 0; i < audience.length; i += BATCH) {
        const batch = audience.slice(i, i + BATCH);
        const results = await Promise.all(batch.map(async (r) => {
          const msg = formatSmsUrlsForProvider(replaceVars(body, r, shop));
          const parts = smsParts(msg);
          try {
            const { data: res, error } = await supabase.functions.invoke('send-sms', {
              body: { phone: r.phone, message: msg },
            });
            const success = !error && res?.success;
            await supabase.from('sms_campaign_recipients' as any).insert({
              campaign_id: campaignId,
              customer_name: r.name,
              phone: r.phone,
              message: msg,
              parts,
              status: success ? 'sent' : 'failed',
              error_message: success ? null : (res?.error || error?.message || 'Unknown error'),
              sent_at: new Date().toISOString(),
            });
            return { success, parts };
          } catch (e: any) {
            await supabase.from('sms_campaign_recipients' as any).insert({
              campaign_id: campaignId,
              customer_name: r.name, phone: r.phone, message: msg, parts,
              status: 'failed', error_message: e.message || 'Exception', sent_at: new Date().toISOString(),
            });
            return { success: false, parts };
          }
        }));
        for (const r of results) {
          totalParts += r.parts;
          if (r.success) { ok++; sentParts += r.parts; } else { fail++; }
        }
        setSendProgress({ done: Math.min(i + BATCH, audience.length), total: audience.length, ok, fail });
        await new Promise(r => setTimeout(r, 200));
      }

      const actualCost = +(sentParts * perSmsCost).toFixed(2);
      await supabase.from('sms_campaigns' as any).update({
        sent_count: ok,
        failed_count: fail,
        status: ok > 0 ? 'completed' : 'failed',
        total_parts: totalParts || stats.totalSms,
        actual_cost: actualCost,
        completed_at: new Date().toISOString(),
      }).eq('id', campaignId);

      toast.success(`পাঠানো শেষ! সফল: ${ok}, ব্যর্থ: ${fail}`);
      qc.invalidateQueries({ queryKey: ['sms-campaigns-history'] });
      setConfirmOpen(false);
    } catch (e: any) {
      toast.error(e.message || 'পাঠাতে সমস্যা হয়েছে');
    } finally {
      setSending(false);
    }
  };

  // ─── history ─────────────────────────────────────────────────────────────
  const { data: history = [] } = useQuery({
    queryKey: ['sms-campaigns-history'],
    queryFn: async () => {
      const { data } = await supabase.from('sms_campaigns' as any).select('*').order('created_at', { ascending: false }).limit(50);
      return (data || []) as any[];
    },
  });
  const { data: drilldown = [] } = useQuery({
    queryKey: ['sms-drilldown', drilldownId],
    enabled: !!drilldownId,
    queryFn: async () => {
      const { data } = await supabase.from('sms_campaign_recipients' as any).select('*').eq('campaign_id', drilldownId!).order('created_at');
      return (data || []) as any[];
    },
  });

  // ─── templates ───────────────────────────────────────────────────────────
  const { data: templates = [] } = useQuery({
    queryKey: ['sms-templates'],
    queryFn: async () => {
      const { data } = await supabase.from('sms_templates' as any).select('*').order('created_at', { ascending: false });
      return (data || []) as any[];
    },
  });
  const [tplName, setTplName] = useState('');
  const saveTemplate = async () => {
    if (!tplName.trim() || !body.trim()) { toast.error('নাম ও মেসেজ দিন'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('sms_templates' as any).insert({ name: tplName, body, tone: aiTone, language: aiLang, created_by: user?.id });
    if (error) toast.error(error.message); else {
      toast.success('সেভ হয়েছে');
      setTplName('');
      qc.invalidateQueries({ queryKey: ['sms-templates'] });
    }
  };
  const deleteTemplate = async (id: string) => {
    const { error } = await supabase.from('sms_templates' as any).delete().eq('id', id);
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ['sms-templates'] });
  };

  // ─── preview sample ──────────────────────────────────────────────────────
  const sample = audience[0] || { phone: '01700000000', name: 'রহিম মিয়া', order_count: 2, delivered: 1, cancelled: 0, last_order: new Date().toISOString(), city: '' };
  const previewMsg = body ? replaceVars(body, sample, shop) : '';

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-lg font-bold">SMS ক্যাম্পেইন</h1>
          <p className="text-xs text-muted-foreground">কাস্টমার সেগমেন্ট করে AI দিয়ে SMS পাঠান</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="compose"><Send className="h-3.5 w-3.5 mr-1" /> ক্যাম্পেইন</TabsTrigger>
          <TabsTrigger value="engine"><Zap className="h-3.5 w-3.5 mr-1" /> অডিয়েন্স ইঞ্জিন</TabsTrigger>
          <TabsTrigger value="saved"><FolderOpen className="h-3.5 w-3.5 mr-1" /> সেভড অডিয়েন্স</TabsTrigger>
          <TabsTrigger value="history"><History className="h-3.5 w-3.5 mr-1" /> ইতিহাস</TabsTrigger>
          <TabsTrigger value="templates"><Save className="h-3.5 w-3.5 mr-1" /> টেমপ্লেট</TabsTrigger>
          <TabsTrigger value="audit"><ShieldCheck className="h-3.5 w-3.5 mr-1" /> অডিট লগ</TabsTrigger>
        </TabsList>

        <TabsContent value="engine">
          <SmsAudienceEngineTab
            ref={engineRef}
            templates={templates}
            onInvalidateTemplates={() => qc.invalidateQueries({ queryKey: ['sms-templates'] })}
          />
        </TabsContent>

        <TabsContent value="saved">
          <SavedAudiencesTab onOpen={(f) => { engineRef.current?.loadFilter(f); handleTabChange('engine'); }} />
        </TabsContent>

        <TabsContent value="audit">
          <AuditLogTab />
        </TabsContent>




        {/* ─── compose ─── */}
        <TabsContent value="compose" className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Audience */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> অডিয়েন্স</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {SEGMENTS.map(s => {
                    const I = s.icon;
                    return (
                      <button key={s.id} onClick={() => setSegment(s.id)}
                        className={`px-2.5 py-1 rounded-md text-xs flex items-center gap-1 border transition ${segment === s.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                        <I className="h-3 w-3" /> {s.label}
                      </button>
                    );
                  })}
                </div>

                {segment === 'city' && (
                  <div className="space-y-2">
                    <Input
                      placeholder="জেলা খুঁজুন..."
                      value={citySearch}
                      onChange={e => setCitySearch(e.target.value)}
                      className="h-8 text-sm"
                    />
                    <div className="border rounded-md p-2 max-h-64 overflow-y-auto flex flex-wrap gap-1.5">
                      {cityCounts
                        .filter(([c]) => !citySearch.trim() || c.toLowerCase().includes(citySearch.trim().toLowerCase()))
                        .map(([c, n]) => (
                          <button
                            key={c}
                            onClick={() => setCityFilter(c)}
                            className={`px-2 py-1 rounded-md text-xs border flex items-center gap-1 transition ${
                              cityFilter === c ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50'
                            }`}
                          >
                            <span>{c}</span>
                            <Badge variant="secondary" className="h-4 px-1 text-[10px]">{n}</Badge>
                          </button>
                        ))}
                      {cityCounts.length === 0 && (
                        <p className="text-[11px] text-muted-foreground p-1">কোনো জেলা ডেটা পাওয়া যায়নি</p>
                      )}
                    </div>
                    {cityFilter && (
                      <p className="text-[11px] text-muted-foreground">
                        নির্বাচিত: <span className="font-medium text-foreground">{cityFilter}</span>
                        <button onClick={() => setCityFilter('')} className="ml-2 text-primary underline">পরিষ্কার</button>
                      </p>
                    )}
                  </div>
                )}

                {segment === 'manual' && (
                  <div className="space-y-2">
                    {/* Single number add */}
                    <div className="border rounded-md p-2 bg-muted/30 space-y-1.5">
                      <p className="text-[11px] font-medium">নতুন নম্বর যোগ করুন</p>
                      <div className="flex gap-1.5">
                        <Input
                          placeholder="01XXXXXXXXX"
                          value={extraPhone}
                          onChange={e => setExtraPhone(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addExtraRecipient(); } }}
                          className="h-8 text-sm flex-1"
                          maxLength={15}
                        />
                        <Input
                          placeholder="নাম (অপশনাল)"
                          value={extraName}
                          onChange={e => setExtraName(e.target.value)}
                          className="h-8 text-sm w-32"
                          maxLength={100}
                        />
                        <Button onClick={addExtraRecipient} size="sm" className="h-8">যোগ</Button>
                      </div>
                      {extraRecipients.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {extraRecipients.map(r => (
                            <span key={r.phone} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-[11px]">
                              {r.name ? `${r.name} · ` : ''}{r.phone}
                              <button
                                onClick={() => setExtraRecipients(prev => prev.filter(x => x.phone !== r.phone))}
                                className="text-muted-foreground hover:text-destructive ml-0.5"
                                aria-label="remove"
                              >×</button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Search + list */}
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="নাম বা নম্বর দিয়ে খুঁজুন..."
                        value={manualSearch}
                        onChange={e => setManualSearch(e.target.value)}
                        className="h-8 text-sm flex-1"
                      />
                      <Badge variant="secondary" className="text-[10px]">{manualSelected.size} নির্বাচিত</Badge>
                    </div>
                    <div className="border rounded-md p-2 max-h-64 overflow-y-auto space-y-1">
                      {manualFiltered.map(r => (
                        <label key={r.phone} className="flex items-center gap-2 text-xs py-0.5 hover:bg-muted/30 rounded px-1 cursor-pointer">
                          <Checkbox checked={manualSelected.has(r.phone)} onCheckedChange={(v) => {
                            setManualSelected(p => { const n = new Set(p); if (v) n.add(r.phone); else n.delete(r.phone); return n; });
                          }} />
                          <span className="flex-1 min-w-0 truncate">{r.name || '—'} ({r.phone}){r.city ? ` · ${r.city}` : ''}</span>
                          <span className="text-muted-foreground">{r.delivered}✓</span>
                        </label>
                      ))}
                      {manualFiltered.length === 0 && (
                        <p className="text-[11px] text-muted-foreground p-1">কোনো ফলাফল নেই</p>
                      )}
                      {!manualSearch && pool.length > 500 && (
                        <p className="text-[10px] text-muted-foreground p-1">প্রথম ৫০০ জন · সার্চ করে নির্দিষ্ট গ্রাহক খুঁজুন</p>
                      )}
                    </div>
                  </div>
                )}


                <div className="bg-muted/50 rounded-md p-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span>রিসিপিয়েন্ট:</span><Badge variant="secondary">{poolLoading ? '...' : stats.recipients}</Badge></div>
                  <div className="flex justify-between"><span>SMS পার্ট/জন:</span><span>{stats.parts}</span></div>
                  <div className="flex justify-between"><span>মোট SMS:</span><span>{stats.totalSms}</span></div>
                  <div className="flex justify-between font-semibold"><span>আনুমানিক খরচ:</span><span>৳ {stats.cost.toFixed(2)}</span></div>
                </div>
              </CardContent>
            </Card>

            {/* Composer */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Send className="h-4 w-4" /> মেসেজ</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1">
                  {VARS.map(v => (
                    <button key={v.token} onClick={() => insertVar(v.token)}
                      className="px-2 py-0.5 text-[10px] rounded border bg-muted/50 hover:bg-primary/10 hover:border-primary transition">
                      {v.token}
                    </button>
                  ))}
                </div>
                <Textarea ref={textareaRef} value={body} onChange={e => setBody(e.target.value)} rows={5} placeholder="হ্যালো {{first_name}}, ..." className="text-sm" />
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>{body.length} অক্ষর · {stats.parts} পার্ট{isUnicode(body) ? ' (Unicode 70/67)' : ' (GSM 160/153)'}</span>
                  <Badge variant="outline" className="text-[10px]">প্রিভিউ ↓</Badge>
                </div>
                {previewMsg && (
                  <div className="rounded-md border bg-card p-2.5 text-xs">
                    <p className="text-muted-foreground mb-1">প্রিভিউ ({sample.name || sample.phone}):</p>
                    <p className="whitespace-pre-wrap">{previewMsg}</p>
                  </div>
                )}

                {/* AI generator */}
                <div className="border rounded-md p-2.5 space-y-2 bg-primary/5">
                  <p className="text-xs font-medium flex items-center gap-1"><Sparkles className="h-3 w-3 text-primary" /> AI টেমপ্লেট জেনারেটর</p>
                  <Textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="ঈদ অফার, ২০% ছাড়, কাল শেষ" rows={2} className="text-xs" />
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={aiTone} onValueChange={setAiTone}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="বন্ধুত্বপূর্ণ">বন্ধুত্বপূর্ণ</SelectItem>
                        <SelectItem value="প্রফেশনাল">প্রফেশনাল</SelectItem>
                        <SelectItem value="urgency">Urgency</SelectItem>
                        <SelectItem value="cute">Cute</SelectItem>
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
                    জেনারেট করুন
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

                {/* Save template */}
                <div className="flex gap-2">
                  <Input value={tplName} onChange={e => setTplName(e.target.value)} placeholder="টেমপ্লেট নাম" className="h-8 text-xs" />
                  <Button onClick={saveTemplate} size="sm" variant="outline" className="h-8"><Save className="h-3.5 w-3.5 mr-1" /> সেভ</Button>
                </div>

                <Button onClick={() => setConfirmOpen(true)} disabled={!body.trim() || stats.recipients === 0} className="w-full" size="lg">
                  <Send className="h-4 w-4 mr-2" /> পাঠান ({stats.recipients})
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── history ─── */}
        <TabsContent value="history">
          <SmsCampaignHistoryTab
            onReuseAudience={(f, b) => {
              engineRef.current?.loadFilter(f, b);
              handleTabChange('engine');
            }}
            onFollowup={(phones, opts) => {
              engineRef.current?.loadFollowup(phones, {
                body: opts.body,
                templateName: opts.templateName,
              });
              handleTabChange('engine');
            }}
          />
        </TabsContent>


        {/* ─── templates ─── */}
        <TabsContent value="templates">
          <Card>
            <CardContent className="p-3 space-y-2">
              {templates.map(t => (
                <div key={t.id} className="flex items-start gap-2 p-2 border rounded-md">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{t.body}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setBody(t.body)} className="h-7 text-xs">ব্যবহার</Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteTemplate(t.id)} className="h-7 w-7 p-0"><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
                </div>
              ))}
              {templates.length === 0 && <p className="text-center text-xs text-muted-foreground py-8">কোনো টেমপ্লেট সেভ করা নেই</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── confirm dialog ─── */}
      <Dialog open={confirmOpen} onOpenChange={(o) => !sending && setConfirmOpen(o)}>
        <DialogContent>
          <DialogHeader><DialogTitle>পাঠানো নিশ্চিত করুন</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">রিসিপিয়েন্ট</p><p className="font-semibold">{stats.recipients}</p></div>
              <div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">মোট SMS</p><p className="font-semibold">{stats.totalSms}</p></div>
              <div className="rounded-md border p-2 col-span-2"><p className="text-xs text-muted-foreground">আনুমানিক খরচ</p><p className="font-semibold">৳ {stats.cost.toFixed(2)}</p></div>
            </div>
            <div className="rounded-md border p-2 bg-muted/30">
              <p className="text-xs text-muted-foreground mb-1">প্রিভিউ:</p>
              <p className="text-xs whitespace-pre-wrap">{previewMsg}</p>
            </div>
            {sending && (
              <div className="space-y-1">
                <Progress value={(sendProgress.done / Math.max(sendProgress.total, 1)) * 100} />
                <p className="text-xs text-muted-foreground text-center">{sendProgress.done} / {sendProgress.total} — ✓ {sendProgress.ok} ✗ {sendProgress.fail}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={sending}>বাতিল</Button>
            <Button onClick={handleSend} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
              এখনই পাঠান
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── drilldown ─── */}
      <Dialog open={!!drilldownId} onOpenChange={(o) => !o && setDrilldownId(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>ক্যাম্পেইন ডিটেইল</DialogTitle></DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow><TableHead>নাম</TableHead><TableHead>ফোন</TableHead><TableHead>স্ট্যাটাস</TableHead><TableHead>এরর</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {drilldown.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{r.customer_name || '—'}</TableCell>
                    <TableCell className="text-xs font-mono">{r.phone}</TableCell>
                    <TableCell><Badge variant={r.status === 'sent' ? 'default' : 'destructive'} className="text-[10px]">{r.status}</Badge></TableCell>
                    <TableCell className="text-[10px] text-red-600 max-w-[200px] truncate">{r.error_message || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
