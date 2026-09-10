import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabaseHelpers';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Mail, MessageSquare, Save, Eye, CheckCircle, XCircle, ChevronDown, ChevronUp, Smartphone, Wallet, TrendingUp, CalendarDays, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { format, startOfMonth, startOfYear } from 'date-fns';

const SMS_RATE_PER_UNIT = 0.33;
const SMS_UNITS_PER_SMS = 1; // MimSMS: ১ ইউনিট per SMS segment

/** Unicode SMS: ≤70 char = 1 SMS, >70 char = ceil(len/67) SMS. Each SMS = 3 units (Bangla). */
function calcSmsInfo(len: number) {
  if (len <= 0) return { smsCount: 1, units: SMS_UNITS_PER_SMS, cost: SMS_UNITS_PER_SMS * SMS_RATE_PER_UNIT };
  const smsCount = len <= 70 ? 1 : Math.ceil(len / 67);
  const units = smsCount * SMS_UNITS_PER_SMS;
  const cost = units * SMS_RATE_PER_UNIT;
  return { smsCount, units, cost };
}

const TEMPLATE_LABELS: Record<string, string> = {
  order_confirmation: 'অর্ডার কনফার্মেশন',
  order_processing: 'অর্ডার প্রসেসিং',
  order_shipped: 'অর্ডার শিপড',
  order_delivered: 'অর্ডার ডেলিভারড',
  payment_confirmation: 'পেমেন্ট কনফার্মেশন',
  cart_abandoned: 'কার্ট অ্যাবান্ডনড',
  sms_order_confirmation: 'অর্ডার কনফার্মেশন',
  sms_order_processing: 'অর্ডার প্রসেসিং',
  sms_order_shipped: 'অর্ডার শিপড',
  sms_order_delivered: 'অর্ডার ডেলিভারড',
  // send-order-notification writes notification_logs.notification_type as
  // the bare "type" it was called with (confirmation/processing/shipped/
  // delivered/payment), not the template_key — log rows need these too or
  // they render as raw English strings.
  confirmation: 'অর্ডার কনফার্মেশন',
  processing: 'অর্ডার প্রসেসিং',
  shipped: 'অর্ডার শিপড',
  delivered: 'অর্ডার ডেলিভারড',
  payment: 'পেমেন্ট কনফার্মেশন',
};

const EMAIL_TYPE_LABELS: Record<string, string> = {
  order_confirmation: 'অর্ডার কনফার্মেশন',
  order_processing: 'অর্ডার প্রসেসিং',
  order_shipped: 'অর্ডার শিপড',
  order_delivered: 'অর্ডার ডেলিভারড',
  payment_confirmation: 'পেমেন্ট কনফার্মেশন',
  cart_abandoned: 'কার্ট অ্যাবান্ডনড',
  abandoned_cart: 'কার্ট অ্যাবান্ডনড',
  confirmation: 'অর্ডার কনফার্মেশন',
  processing: 'অর্ডার প্রসেসিং',
  shipped: 'অর্ডার শিপড',
  delivered: 'অর্ডার ডেলিভারড',
  payment: 'পেমেন্ট কনফার্মেশন',
};

// ── Shared hooks ──
function useNotificationLogs(channel: 'sms' | 'email') {
  return useQuery({
    queryKey: ['notification-logs', channel],
    queryFn: async () => {
      return fetchAllRows(() =>
        supabase
          .from('notification_logs')
          .select('*')
          .eq('channel', channel)
          .order('created_at', { ascending: false })
      );
    },
  });
}

function useTemplates(channel: 'sms' | 'email') {
  const qc = useQueryClient();
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['email-templates', channel],
    queryFn: async () => {
      let query = supabase.from('email_templates').select('*').order('created_at');
      if (channel === 'sms') {
        query = query.eq('channel', 'sms');
      } else {
        query = query.or('channel.eq.email,channel.is.null');
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: any) => {
      const { id, ...rest } = updates;
      rest.updated_at = new Date().toISOString();
      const { error } = await supabase.from('email_templates').update(rest).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-templates', channel] });
      toast.success('টেমপ্লেট আপডেট হয়েছে');
    },
  });

  return { templates, isLoading, handleUpdate: (d: any) => updateMutation.mutateAsync(d) };
}

// ── SMS Dashboard Cards ──
function SmsDashboard() {
  const { data: logs = [] } = useNotificationLogs('sms');
  const { data: balanceData, isLoading: balLoading } = useQuery({
    queryKey: ['sms-balance'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('check-sms-balance');
      if (error) throw error;
      return data;
    },
    staleTime: 60000,
  });

  const now = new Date();
  const monthStart = startOfMonth(now).toISOString();
  const yearStart = startOfYear(now).toISOString();

  const stats = useMemo(() => {
    const sentLogs = logs.filter((l: any) => l.status === 'sent');
    const thisMonth = sentLogs.filter((l: any) => l.created_at >= monthStart);
    const thisYear = sentLogs.filter((l: any) => l.created_at >= yearStart);

    const sumCost = (arr: any[]) => arr.reduce((sum, l) => {
      const len = (l.message_content || '').length;
      return sum + calcSmsInfo(len).cost;
    }, 0);
    const sumUnits = (arr: any[]) => arr.reduce((sum, l) => {
      const len = (l.message_content || '').length;
      return sum + calcSmsInfo(len).units;
    }, 0);

    return {
      monthCount: thisMonth.length,
      monthUnits: sumUnits(thisMonth),
      monthCost: sumCost(thisMonth),
      yearCount: thisYear.length,
      yearUnits: sumUnits(thisYear),
      yearCost: sumCost(thisYear),
    };
  }, [logs, monthStart, yearStart]);

  const cards = [
    { label: 'এই মাসে SMS', value: `${stats.monthCount} টি`, sub: `${stats.monthUnits} ইউনিট`, icon: CalendarDays, color: 'text-blue-600' },
    { label: 'এই মাসে খরচ', value: `৳${stats.monthCost.toFixed(2)}`, icon: Wallet, color: 'text-orange-600' },
    { label: 'এই বছরে SMS', value: `${stats.yearCount} টি`, sub: `${stats.yearUnits} ইউনিট`, icon: TrendingUp, color: 'text-green-600' },
    { label: 'এই বছরে খরচ', value: `৳${stats.yearCost.toFixed(2)}`, icon: Wallet, color: 'text-red-600' },
    { label: 'ব্যালেন্স', value: balLoading ? '...' : balanceData?.balance != null ? `৳${Number(balanceData.balance).toFixed(2)}` : 'N/A', icon: Smartphone, color: 'text-primary' },
  ];

  return (
    <div className="sticky top-0 z-10 bg-background pb-2">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-3 text-center">
              <c.icon className={`h-5 w-5 mx-auto mb-1 ${c.color}`} />
              <p className="text-lg font-bold">{c.value}</p>
              {'sub' in c && c.sub && <p className="text-[10px] text-muted-foreground">{c.sub}</p>}
              <p className="text-[11px] text-muted-foreground">{c.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Email Dashboard ──
function EmailDashboard() {
  const { data: logs = [] } = useNotificationLogs('email');
  const now = new Date();
  const monthStart = startOfMonth(now).toISOString();

  const stats = useMemo(() => {
    const sent = logs.filter((l: any) => l.status === 'sent' && l.created_at >= monthStart);
    const byType: Record<string, number> = {};
    sent.forEach((l: any) => {
      const t = l.notification_type || 'other';
      byType[t] = (byType[t] || 0) + 1;
    });
    return { total: sent.length, byType };
  }, [logs, monthStart]);

  return (
    <div className="sticky top-0 z-10 bg-background pb-2">
      <Card>
        <CardContent className="p-3">
          <p className="text-sm font-semibold mb-2">📧 এই মাসে ইমেইল — মোট {stats.total} টি</p>
          {Object.keys(stats.byType).length === 0 ? (
            <p className="text-xs text-muted-foreground">এই মাসে কোনো ইমেইল পাঠানো হয়নি</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(stats.byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between bg-muted/50 rounded-md px-2.5 py-1.5">
                  <span className="text-xs truncate">{EMAIL_TYPE_LABELS[type] || type}</span>
                  <Badge variant="secondary" className="text-[10px] ml-1 shrink-0">{count}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── SMS Template Card ──
function SmsTemplateCard({ t, onUpdate }: { t: any; onUpdate: (data: any) => void }) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(t.sms_content || '');
  const [saving, setSaving] = useState(false);

  const info = calcSmsInfo(content.length);

  const handleSave = async () => {
    setSaving(true);
    await onUpdate({ id: t.id, sms_content: content });
    setSaving(false);
    setEditing(false);
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-green-600 shrink-0" />
            <span className="font-medium text-sm">{TEMPLATE_LABELS[t.template_key] || t.template_key}</span>
            <Badge variant={t.is_active ? 'default' : 'secondary'} className="text-[10px]">
              {t.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
            </Badge>
          </div>
          <Switch checked={t.is_active} onCheckedChange={(checked) => onUpdate({ id: t.id, is_active: checked })} />
        </div>
        {editing ? (
          <div className="space-y-2">
            <Textarea value={content} onChange={e => setContent(e.target.value)} rows={4} className="font-mono text-xs" placeholder="SMS টেক্সট..." />
            <div className="flex items-center justify-between">
              <span className={`text-[11px] ${content.length > 70 ? 'text-orange-500' : 'text-muted-foreground'}`}>
                {content.length} অক্ষর • {info.smsCount} SMS • {info.units} ইউনিট • ৳{info.cost.toFixed(2)}
              </span>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs"><Save className="h-3 w-3 mr-1" /> সেভ</Button>
                <Button size="sm" variant="outline" onClick={() => { setEditing(false); setContent(t.sms_content || ''); }} className="h-7 text-xs">বাতিল</Button>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <pre className="text-xs bg-muted/50 p-2.5 rounded-md whitespace-pre-wrap font-sans text-foreground leading-relaxed">{t.sms_content || '(খালি)'}</pre>
            <div className="flex items-center justify-between mt-2">
              {(() => { const i = calcSmsInfo((t.sms_content || '').length); return (
                <span className="text-[11px] text-muted-foreground">{(t.sms_content || '').length} অক্ষর • {i.smsCount} SMS • {i.units} ইউনিট • ৳{i.cost.toFixed(2)}</span>
              ); })()}
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setEditing(true); setContent(t.sms_content || ''); }}>এডিট</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Email Template Card ──
function EmailTemplateCard({ t, onUpdate }: { t: any; onUpdate: (data: any) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [subject, setSubject] = useState(t.subject);
  const [html, setHtml] = useState(t.html_content || '');
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onUpdate({ id: t.id, subject, html_content: html });
    setSaving(false);
    setExpanded(false);
  };

  return (
    <>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Mail className="h-4 w-4 text-primary shrink-0" />
              <span className="font-medium text-sm truncate">{TEMPLATE_LABELS[t.template_key] || t.template_key}</span>
              <Badge variant={t.is_active ? 'default' : 'secondary'} className="text-[10px] shrink-0">{t.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</Badge>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Switch checked={t.is_active} onCheckedChange={(checked) => onUpdate({ id: t.id, is_active: checked })} />
              {t.html_content && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPreviewHtml(t.html_content)}>
                  <Eye className="h-3 w-3 mr-1" /> প্রিভিউ
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-7 text-xs"
                onClick={() => { setExpanded(!expanded); setSubject(t.subject); setHtml(t.html_content || ''); }}>
                {expanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                {expanded ? 'বন্ধ' : 'এডিট'}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">সাবজেক্ট: {t.subject}</p>
          {!t.html_content && <p className="text-[11px] text-orange-500 mt-1">⚠️ কাস্টম টেমপ্লেট নেই — ডিফল্ট ব্যবহৃত হবে</p>}
          {expanded && (
            <div className="mt-3 space-y-3 border-t pt-3">
              <div><Label className="text-xs">সাবজেক্ট</Label><Input value={subject} onChange={e => setSubject(e.target.value)} className="mt-1" /></div>
              <div><Label className="text-xs">HTML কন্টেন্ট</Label><Textarea value={html} onChange={e => setHtml(e.target.value)} rows={10} className="font-mono text-xs mt-1" placeholder="<html>...</html>" /></div>
              {html && <div><Label className="text-xs mb-1 block">প্রিভিউ</Label><iframe srcDoc={html} sandbox="" className="w-full h-48 border rounded-md bg-white" title="Preview" /></div>}
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} disabled={saving}><Save className="h-3.5 w-3.5 mr-1" /> {saving ? 'সেভ হচ্ছে...' : 'সেভ করুন'}</Button>
                <Button size="sm" variant="outline" onClick={() => setExpanded(false)}>বাতিল</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog open={!!previewHtml} onOpenChange={(o) => { if (!o) setPreviewHtml(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader><DialogTitle>ইমেইল প্রিভিউ</DialogTitle></DialogHeader>
          <iframe srcDoc={previewHtml || ''} sandbox="" className="w-full h-[60vh] border rounded-md bg-white" title="Preview" />
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── SMS Log Card ──
function SmsLogCard({ log }: { log: any }) {
  const len = (log.message_content || '').length;
  const info = calcSmsInfo(len);

  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          {log.status === 'sent' ? <CheckCircle className="h-4 w-4 text-green-500 shrink-0" /> : <XCircle className="h-4 w-4 text-destructive shrink-0" />}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">{TEMPLATE_LABELS[log.notification_type] || log.notification_type}</span>
              <Badge variant="outline" className="text-[9px] h-4">{len} অক্ষর • {info.smsCount} SMS • {info.units} ইউনিট • ৳{info.cost.toFixed(2)}</Badge>
            </div>
            <p className="text-[11px] text-muted-foreground truncate">{log.recipient || '—'}</p>
            {log.error_message && <p className="text-[10px] text-destructive truncate">{log.error_message}</p>}
          </div>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {log.created_at ? format(new Date(log.created_at), 'dd/MM hh:mm a') : ''}
          </span>
        </div>
        {log.message_content && (
          <div className="mt-2 pt-2 border-t">
            <pre className="text-xs bg-muted/50 p-2 rounded-md whitespace-pre-wrap font-sans text-foreground leading-relaxed">{log.message_content}</pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Email Log Card ──
function EmailLogCard({ log }: { log: any }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          {log.status === 'sent' ? <CheckCircle className="h-4 w-4 text-green-500 shrink-0" /> : <XCircle className="h-4 w-4 text-destructive shrink-0" />}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">{EMAIL_TYPE_LABELS[log.notification_type] || log.notification_type}</span>
            </div>
            <p className="text-[11px] text-muted-foreground truncate">{log.recipient || '—'}</p>
            {log.error_message && <p className="text-[10px] text-destructive truncate">{log.error_message}</p>}
          </div>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {log.created_at ? format(new Date(log.created_at), 'dd/MM hh:mm a') : ''}
          </span>
        </div>
        {log.message_content && (
          <div className="mt-2 pt-2 border-t">
            <p className="text-[11px] text-muted-foreground mb-1">📧 সাবজেক্ট:</p>
            <pre className="text-xs bg-muted/50 p-2 rounded-md whitespace-pre-wrap font-sans text-foreground leading-relaxed">{log.message_content}</pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── SMS Tab ──
function SmsTab() {
  const { templates, isLoading: tLoading, handleUpdate } = useTemplates('sms');
  const { data: logs = [], isLoading: lLoading } = useNotificationLogs('sms');
  const [showTemplates, setShowTemplates] = useState(false);

  return (
    <div className="space-y-4">
      <SmsDashboard />

      <Collapsible open={showTemplates} onOpenChange={setShowTemplates}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between h-9 text-xs">
            <span className="flex items-center gap-2"><FileText className="h-3.5 w-3.5" /> 📝 SMS টেমপ্লেট ম্যানেজ করুন</span>
            {showTemplates ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          {tLoading ? <p className="text-sm text-muted-foreground">লোড হচ্ছে...</p> : (
            <div className="space-y-2.5">
              {templates.map((t: any) => <SmsTemplateCard key={t.id} t={t} onUpdate={handleUpdate} />)}
              {templates.length === 0 && <p className="text-xs text-muted-foreground">কোনো SMS টেমপ্লেট নেই</p>}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      <div>
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <MessageSquare className="h-4 w-4 text-green-600" /> SMS লগ
        </h3>
        {lLoading ? <p className="text-sm text-muted-foreground">লোড হচ্ছে...</p> : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">কোনো SMS লগ নেই</p>
        ) : (
          <div className="space-y-1.5">
            {logs.map((log: any) => <SmsLogCard key={log.id} log={log} />)}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Email Tab ──
function EmailTab() {
  const { templates, isLoading: tLoading, handleUpdate } = useTemplates('email');
  const { data: logs = [], isLoading: lLoading } = useNotificationLogs('email');
  const [showTemplates, setShowTemplates] = useState(false);

  return (
    <div className="space-y-4">
      <EmailDashboard />

      <Collapsible open={showTemplates} onOpenChange={setShowTemplates}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between h-9 text-xs">
            <span className="flex items-center gap-2"><FileText className="h-3.5 w-3.5" /> 📝 ইমেইল টেমপ্লেট ম্যানেজ করুন</span>
            {showTemplates ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          {tLoading ? <p className="text-sm text-muted-foreground">লোড হচ্ছে...</p> : (
            <div className="space-y-2.5">
              {templates.map((t: any) => <EmailTemplateCard key={t.id} t={t} onUpdate={handleUpdate} />)}
              {templates.length === 0 && <p className="text-xs text-muted-foreground">কোনো ইমেইল টেমপ্লেট নেই</p>}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      <div>
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <Mail className="h-4 w-4 text-primary" /> ইমেইল লগ
        </h3>
        {lLoading ? <p className="text-sm text-muted-foreground">লোড হচ্ছে...</p> : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">কোনো ইমেইল লগ নেই</p>
        ) : (
          <div className="space-y-1.5">
            {logs.map((log: any) => <EmailLogCard key={log.id} log={log} />)}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──
export default function AdminNotificationManagement() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">SMS ও ইমেইল হিস্ট্রি প্যানেল</h1>
      <Tabs defaultValue="sms">
        <TabsList className="w-full mb-4">
          <TabsTrigger value="sms" className="flex-1 text-xs"><Smartphone className="h-3.5 w-3.5 mr-1" /> 📱 SMS</TabsTrigger>
          <TabsTrigger value="email" className="flex-1 text-xs"><Mail className="h-3.5 w-3.5 mr-1" /> 📧 ইমেইল</TabsTrigger>
        </TabsList>
        <TabsContent value="sms"><SmsTab /></TabsContent>
        <TabsContent value="email"><EmailTab /></TabsContent>
      </Tabs>
    </div>
  );
}
