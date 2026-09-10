import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabaseHelpers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Send, Users, Loader2, Star, AlertTriangle, UserX, Repeat, Crown, UserPlus, Clock, Copy, MailOpen, Filter } from 'lucide-react';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { bn } from 'date-fns/locale';

// ---------- types ----------
interface CustomerInsight {
  email: string;
  name: string;
  phone: string;
  city: string;
  totalOrders: number;
  confirmed: number;
  delivered: number;
  cancelled: number;
  returned: number;
  totalSpent: number;
  firstOrder: string;
  lastOrder: string;
  daysSinceLast: number;
  cancelRate: number;
  priority: number;
}

type Segment = 'all' | 'vip' | 'new' | 'at_risk' | 'lost' | 'high_cancel' | 'repeat';

const SEGMENT_CONFIG: Record<Segment, { label: string; icon: React.ReactNode; color: string }> = {
  all: { label: 'সবাই', icon: <Users className="h-3.5 w-3.5" />, color: 'bg-muted text-muted-foreground' },
  vip: { label: 'VIP', icon: <Crown className="h-3.5 w-3.5" />, color: 'bg-amber-100 text-amber-800' },
  new: { label: 'নতুন', icon: <UserPlus className="h-3.5 w-3.5" />, color: 'bg-green-100 text-green-800' },
  at_risk: { label: 'ঝুঁকিপূর্ণ', icon: <AlertTriangle className="h-3.5 w-3.5" />, color: 'bg-orange-100 text-orange-800' },
  lost: { label: 'হারানো', icon: <UserX className="h-3.5 w-3.5" />, color: 'bg-red-100 text-red-800' },
  high_cancel: { label: 'ক্যান্সেল বেশি', icon: <AlertTriangle className="h-3.5 w-3.5" />, color: 'bg-rose-100 text-rose-800' },
  repeat: { label: 'রিপিট বায়ার', icon: <Repeat className="h-3.5 w-3.5" />, color: 'bg-blue-100 text-blue-800' },
};

const EMAIL_TEMPLATES = [
  {
    name: '🎁 ডিসকাউন্ট অফার',
    subject: '{{shop_name}} থেকে বিশেষ ডিসকাউন্ট!',
    html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9fafb">
<div style="background:white;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
<h1 style="color:#1f2937;font-size:24px;margin-bottom:8px">🎁 বিশেষ অফার!</h1>
<p style="color:#4b5563;font-size:16px;line-height:1.6">প্রিয় {{customer_name}},</p>
<p style="color:#4b5563;font-size:16px;line-height:1.6">আপনার জন্য আমাদের বিশেষ ডিসকাউন্ট অপেক্ষা করছে! সীমিত সময়ের জন্য <strong>২০% ছাড়</strong> পাচ্ছেন সব প্রোডাক্টে।</p>
<a href="#" style="display:inline-block;background:#2563eb;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">এখনই কিনুন →</a>
<p style="color:#9ca3af;font-size:13px;margin-top:24px">— {{shop_name}}</p>
</div></body></html>`,
  },
  {
    name: '🆕 নতুন প্রোডাক্ট',
    subject: '{{shop_name}} এ নতুন কিছু এসেছে!',
    html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9fafb">
<div style="background:white;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
<h1 style="color:#1f2937;font-size:24px;margin-bottom:8px">🆕 নতুন কালেকশন!</h1>
<p style="color:#4b5563;font-size:16px;line-height:1.6">প্রিয় {{customer_name}},</p>
<p style="color:#4b5563;font-size:16px;line-height:1.6">আমাদের নতুন কালেকশন এসে গেছে! এক্সক্লুসিভ ডিজাইন, প্রিমিয়াম কোয়ালিটি।</p>
<a href="#" style="display:inline-block;background:#059669;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">দেখুন →</a>
<p style="color:#9ca3af;font-size:13px;margin-top:24px">— {{shop_name}}</p>
</div></body></html>`,
  },
  {
    name: '💌 রি-এনগেজমেন্ট',
    subject: '{{customer_name}}, আপনাকে মিস করছি!',
    html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9fafb">
<div style="background:white;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
<h1 style="color:#1f2937;font-size:24px;margin-bottom:8px">💌 আমরা আপনাকে মিস করছি!</h1>
<p style="color:#4b5563;font-size:16px;line-height:1.6">প্রিয় {{customer_name}},</p>
<p style="color:#4b5563;font-size:16px;line-height:1.6">অনেকদিন আপনাকে দেখা যায়নি! আপনার জন্য বিশেষ কিছু রেখেছি — ফিরে আসুন আর দেখুন নতুন কী কী এসেছে।</p>
<a href="#" style="display:inline-block;background:#7c3aed;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">আবার ভিজিট করুন →</a>
<p style="color:#9ca3af;font-size:13px;margin-top:24px">— {{shop_name}}</p>
</div></body></html>`,
  },
  {
    name: '🙏 ধন্যবাদ',
    subject: 'ধন্যবাদ, {{customer_name}}!',
    html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9fafb">
<div style="background:white;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
<h1 style="color:#1f2937;font-size:24px;margin-bottom:8px">🙏 আন্তরিক ধন্যবাদ!</h1>
<p style="color:#4b5563;font-size:16px;line-height:1.6">প্রিয় {{customer_name}},</p>
<p style="color:#4b5563;font-size:16px;line-height:1.6">{{shop_name}} থেকে কেনাকাটা করার জন্য আপনাকে অনেক ধন্যবাদ! আপনার সাপোর্ট আমাদের অনুপ্রেরণা।</p>
<p style="color:#4b5563;font-size:16px;line-height:1.6">পরবর্তী অর্ডারে বিশেষ সুবিধা পেতে আমাদের সাথেই থাকুন।</p>
<p style="color:#9ca3af;font-size:13px;margin-top:24px">ভালোবাসায় — {{shop_name}}</p>
</div></body></html>`,
  },
];

function calcPriority(c: CustomerInsight): number {
  let score = 0;
  score += Math.min(c.totalOrders * 10, 40);
  score += Math.min(c.totalSpent / 500, 30);
  if (c.daysSinceLast <= 7) score += 30;
  else if (c.daysSinceLast <= 30) score += 20;
  else if (c.daysSinceLast <= 60) score += 10;
  if (c.cancelRate > 0.5) score -= 15;
  return Math.round(Math.max(0, Math.min(100, score)));
}

export default function AdminEmailCampaign() {
  const [subject, setSubject] = useState('');
  const [htmlBody, setHtmlBody] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [segment, setSegment] = useState<Segment>('all');
  const [search, setSearch] = useState('');
  const qc = useQueryClient();

  // ---------- fetch orders with emails + signed-up customer profiles ----------
  const { data: customers = [], isLoading: loadingCustomers } = useQuery({
    queryKey: ['email-campaign-customers-v2'],
    queryFn: async () => {
      const [orderData, profileData] = await Promise.all([
        fetchAllRows<any>(() =>
          supabase
            .from('orders')
            .select('customer_email, customer_name, customer_phone, city, status, total, created_at')
            .not('customer_email', 'is', null)
            .not('customer_email', 'eq', '')
        ),
        fetchAllRows<any>(() =>
          supabase
            .from('customer_profiles')
            .select('email, full_name, phone, created_at')
            .not('email', 'is', null)
            .neq('email', '')
            .like('email', '%@%')
        ),
      ]);

      const map = new Map<string, CustomerInsight>();

      for (const o of orderData || []) {
        const email = (o.customer_email || '').trim().toLowerCase();
        if (!email || !email.includes('@')) continue;
        let c = map.get(email);
        if (!c) {
          c = {
            email,
            name: o.customer_name || '',
            phone: o.customer_phone || '',
            city: o.city || '',
            totalOrders: 0,
            confirmed: 0,
            delivered: 0,
            cancelled: 0,
            returned: 0,
            totalSpent: 0,
            firstOrder: o.created_at,
            lastOrder: o.created_at,
            daysSinceLast: 0,
            cancelRate: 0,
            priority: 0,
          };
          map.set(email, c);
        }
        c.totalOrders++;
        c.totalSpent += Number(o.total) || 0;
        if (o.created_at < c.firstOrder) c.firstOrder = o.created_at;
        if (o.created_at > c.lastOrder) c.lastOrder = o.created_at;
        if (o.status === 'confirmed') c.confirmed++;
        if (o.status === 'delivered') c.delivered++;
        if (o.status === 'cancelled') c.cancelled++;
        if (o.status === 'delivery_failed' || o.status === 'paid_return') c.returned++;
      }

      // Merge signed-up customers (Google / phone signup with email)
      for (const p of profileData || []) {
        const email = (p.email || '').trim().toLowerCase();
        if (!email || !email.includes('@')) continue;
        const existing = map.get(email);
        if (existing) {
          if (!existing.name && p.full_name) existing.name = p.full_name;
          if (!existing.phone && p.phone) existing.phone = p.phone;
        } else {
          map.set(email, {
            email,
            name: p.full_name || '',
            phone: p.phone || '',
            city: '',
            totalOrders: 0,
            confirmed: 0,
            delivered: 0,
            cancelled: 0,
            returned: 0,
            totalSpent: 0,
            firstOrder: p.created_at,
            lastOrder: p.created_at,
            daysSinceLast: 0,
            cancelRate: 0,
            priority: 0,
          });
        }
      }

      const now = new Date();
      for (const c of map.values()) {
        c.daysSinceLast = differenceInDays(now, new Date(c.lastOrder));
        c.cancelRate = c.totalOrders > 0 ? c.cancelled / c.totalOrders : 0;
        c.priority = calcPriority(c);
      }

      return Array.from(map.values()).sort((a, b) => b.priority - a.priority);
    },
  });

  // ---------- fetch campaign history ----------
  const { data: campaigns = [] } = useQuery({
    queryKey: ['email-campaigns-history'],
    queryFn: async () => {
      const { data } = await supabase
        .from('email_campaigns' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      return (data || []) as any[];
    },
  });

  // ---------- segmentation ----------
  const filtered = useMemo(() => {
    let list = customers;
    switch (segment) {
      case 'vip': list = list.filter(c => c.totalOrders >= 3 || c.totalSpent >= 5000); break;
      case 'new': list = list.filter(c => c.totalOrders === 1); break;
      case 'at_risk': list = list.filter(c => c.daysSinceLast >= 30 && c.daysSinceLast < 90); break;
      case 'lost': list = list.filter(c => c.daysSinceLast >= 90); break;
      case 'high_cancel': list = list.filter(c => c.cancelRate >= 0.5 && c.totalOrders >= 2); break;
      case 'repeat': list = list.filter(c => c.confirmed + c.delivered >= 2); break;
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.phone.includes(q));
    }
    return list;
  }, [customers, segment, search]);

  const toggleEmail = (email: string) => {
    setSelectedEmails(prev => {
      const next = new Set(prev);
      next.has(email) ? next.delete(email) : next.add(email);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedEmails.size === filtered.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(filtered.map(c => c.email)));
    }
  };

  const applyTemplate = (tpl: typeof EMAIL_TEMPLATES[0]) => {
    setSubject(tpl.subject);
    setHtmlBody(tpl.html);
    toast.success('টেমপ্লেট প্রয়োগ করা হয়েছে');
  };

  const cloneCampaign = (c: any) => {
    setSubject(c.subject || '');
    setHtmlBody(c.html_body || '');
    toast.success('ক্যাম্পেইন ক্লোন করা হয়েছে');
  };

  const handleSend = async () => {
    if (!subject.trim() || !htmlBody.trim()) { toast.error('সাবজেক্ট ও HTML বডি দিতে হবে'); return; }
    const emails = selectedEmails.size > 0
      ? filtered.filter(c => selectedEmails.has(c.email))
      : filtered;
    if (emails.length === 0) { toast.error('কোনো প্রাপক নেই'); return; }

    setSending(true);
    try {
      const recipientList = emails.map(c => ({ email: c.email, name: c.name }));
      const { data, error } = await supabase.functions.invoke('send-bulk-email', {
        body: {
          recipients: recipientList,
          subject,
          html: htmlBody,
          segment: segment,
        },
      });
      if (error) throw error;
      toast.success(`${emails.length} জনকে ইমেইল পাঠানো হচ্ছে`);
      setSubject(''); setHtmlBody(''); setSelectedEmails(new Set());
      qc.invalidateQueries({ queryKey: ['email-campaigns-history'] });
    } catch (err: any) {
      toast.error('ইমেইল পাঠাতে সমস্যা: ' + (err.message || ''));
    } finally { setSending(false); }
  };

  const priorityBadge = (p: number) => {
    if (p >= 70) return <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">🔥 {p}</Badge>;
    if (p >= 40) return <Badge className="bg-amber-100 text-amber-800 text-[10px]">⚡ {p}</Badge>;
    return <Badge className="bg-muted text-muted-foreground text-[10px]">{p}</Badge>;
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">ইমেইল মার্কেটিং</h1>

      <Tabs defaultValue="campaign" className="w-full">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="campaign">📧 ক্যাম্পেইন</TabsTrigger>
          <TabsTrigger value="customers">👥 কাস্টমার ({customers.length})</TabsTrigger>
          <TabsTrigger value="history">📊 হিস্ট্রি</TabsTrigger>
        </TabsList>

        {/* ====== CAMPAIGN TAB ====== */}
        <TabsContent value="campaign" className="space-y-4 mt-4">
          {/* Segment filters */}
          <Card>
            <CardContent className="p-3">
              <p className="text-xs font-medium mb-2 flex items-center gap-1"><Filter className="h-3.5 w-3.5" /> সেগমেন্ট ফিল্টার</p>
              <div className="flex flex-wrap gap-1.5">
                {(Object.entries(SEGMENT_CONFIG) as [Segment, typeof SEGMENT_CONFIG[Segment]][]).map(([key, cfg]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={segment === key ? 'default' : 'outline'}
                    className={`text-xs h-7 gap-1 ${segment === key ? '' : cfg.color}`}
                    onClick={() => { setSegment(key); setSelectedEmails(new Set()); }}
                  >
                    {cfg.icon} {cfg.label}
                    {key !== 'all' && <span className="ml-0.5 opacity-70">
                      ({customers.filter(c => {
                        switch (key) {
                          case 'vip': return c.totalOrders >= 3 || c.totalSpent >= 5000;
                          case 'new': return c.totalOrders === 1;
                          case 'at_risk': return c.daysSinceLast >= 30 && c.daysSinceLast < 90;
                          case 'lost': return c.daysSinceLast >= 90;
                          case 'high_cancel': return c.cancelRate >= 0.5 && c.totalOrders >= 2;
                          case 'repeat': return c.confirmed + c.delivered >= 2;
                          default: return true;
                        }
                      }).length})
                    </span>}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recipients */}
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium flex items-center gap-1"><Users className="h-4 w-4" /> প্রাপক ({filtered.length} জন)</p>
                <div className="flex items-center gap-2">
                  <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="সার্চ..." className="h-7 w-40 text-xs" />
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={selectAll}>
                    {selectedEmails.size === filtered.length ? 'সব বাদ' : 'সব সিলেক্ট'}
                  </Button>
                </div>
              </div>
              {selectedEmails.size > 0 && (
                <p className="text-xs text-primary mb-2">✓ {selectedEmails.size} জন সিলেক্টেড</p>
              )}
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {filtered.slice(0, 200).map(c => (
                  <label key={c.email} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 px-2 py-1 rounded">
                    <input type="checkbox" checked={selectedEmails.has(c.email)} onChange={() => toggleEmail(c.email)} className="rounded" />
                    <span className="truncate min-w-[80px]">{c.name}</span>
                    <span className="text-muted-foreground truncate">{c.email}</span>
                    <span className="ml-auto flex items-center gap-1">
                      {priorityBadge(c.priority)}
                      <Badge variant="outline" className="text-[10px]">{c.totalOrders} অর্ডার</Badge>
                    </span>
                  </label>
                ))}
                {filtered.length === 0 && <p className="text-xs text-muted-foreground py-2 text-center">কোনো কাস্টমার পাওয়া যায়নি</p>}
              </div>
            </CardContent>
          </Card>

          {/* Templates */}
          <Card>
            <CardContent className="p-3">
              <p className="text-xs font-medium mb-2">📋 টেমপ্লেট</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {EMAIL_TEMPLATES.map((tpl, i) => (
                  <Button key={i} variant="outline" size="sm" className="text-xs h-auto py-2 justify-start" onClick={() => applyTemplate(tpl)}>
                    {tpl.name}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Compose */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs">সাবজেক্ট</Label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="ইমেইল সাবজেক্ট... ({{customer_name}}, {{shop_name}} ব্যবহার করুন)" />
            </div>
            <div>
              <Label className="text-xs">HTML বডি</Label>
              <Textarea value={htmlBody} onChange={e => setHtmlBody(e.target.value)} rows={10} className="font-mono text-xs" placeholder="<html>...</html>" />
            </div>
            {htmlBody && (
              <div>
                <Label className="text-xs mb-1 block">প্রিভিউ</Label>
                <iframe srcDoc={htmlBody} sandbox="" className="w-full h-48 border rounded-md bg-white" title="Preview" />
              </div>
            )}
            <Button onClick={handleSend} disabled={sending || !subject.trim() || !htmlBody.trim()} className="w-full sm:w-auto">
              {sending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              {selectedEmails.size > 0 ? `${selectedEmails.size} জনকে পাঠান` : `${filtered.length} জনকে পাঠান`}
            </Button>
          </div>
        </TabsContent>

        {/* ====== CUSTOMERS TAB ====== */}
        <TabsContent value="customers" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">কাস্টমার ইনসাইট</CardTitle>
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="নাম, ইমেইল বা ফোন দিয়ে সার্চ..." className="h-8 text-xs mt-2" />
            </CardHeader>
            <CardContent className="p-0">
              {loadingCustomers ? (
                <p className="p-4 text-sm text-muted-foreground">লোড হচ্ছে...</p>
              ) : (
                <div className="overflow-auto max-h-[60vh]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">নাম</TableHead>
                        <TableHead className="text-xs">ইমেইল</TableHead>
                        <TableHead className="text-xs text-center">অর্ডার</TableHead>
                        <TableHead className="text-xs text-center">✅</TableHead>
                        <TableHead className="text-xs text-center">❌</TableHead>
                        <TableHead className="text-xs text-right">খরচ</TableHead>
                        <TableHead className="text-xs text-center">শেষ অর্ডার</TableHead>
                        <TableHead className="text-xs text-center">স্কোর</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.slice(0, 200).map(c => (
                        <TableRow key={c.email}>
                          <TableCell className="text-xs font-medium py-1.5">
                            <div>{c.name}</div>
                            <div className="text-[10px] text-muted-foreground">{c.phone}</div>
                          </TableCell>
                          <TableCell className="text-xs py-1.5 text-muted-foreground">{c.email}</TableCell>
                          <TableCell className="text-xs text-center py-1.5">{c.totalOrders}</TableCell>
                          <TableCell className="text-xs text-center py-1.5 text-emerald-600">{c.confirmed + c.delivered}</TableCell>
                          <TableCell className="text-xs text-center py-1.5 text-red-500">{c.cancelled}</TableCell>
                          <TableCell className="text-xs text-right py-1.5">৳{c.totalSpent.toLocaleString()}</TableCell>
                          <TableCell className="text-xs text-center py-1.5">
                            <span className={c.daysSinceLast > 60 ? 'text-red-500' : c.daysSinceLast > 30 ? 'text-amber-600' : 'text-muted-foreground'}>
                              {c.daysSinceLast}দিন
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-center py-1.5">{priorityBadge(c.priority)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ====== HISTORY TAB ====== */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">ক্যাম্পেইন হিস্ট্রি</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {campaigns.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">এখনো কোনো ক্যাম্পেইন পাঠানো হয়নি</p>
              ) : (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">তারিখ</TableHead>
                        <TableHead className="text-xs">সাবজেক্ট</TableHead>
                        <TableHead className="text-xs text-center">প্রাপক</TableHead>
                        <TableHead className="text-xs text-center">✅ সেন্ট</TableHead>
                        <TableHead className="text-xs text-center">❌ ফেইল</TableHead>
                        <TableHead className="text-xs text-center">সেগমেন্ট</TableHead>
                        <TableHead className="text-xs"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campaigns.map((c: any) => (
                        <TableRow key={c.id}>
                          <TableCell className="text-xs py-1.5">
                            {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: bn })}
                          </TableCell>
                          <TableCell className="text-xs py-1.5 max-w-[200px] truncate">{c.subject}</TableCell>
                          <TableCell className="text-xs text-center py-1.5">{c.recipient_count}</TableCell>
                          <TableCell className="text-xs text-center py-1.5 text-emerald-600">{c.sent_count}</TableCell>
                          <TableCell className="text-xs text-center py-1.5 text-red-500">{c.failed_count}</TableCell>
                          <TableCell className="text-xs text-center py-1.5">
                            {c.segment_filter?.segment && (
                              <Badge variant="outline" className="text-[10px]">
                                {SEGMENT_CONFIG[c.segment_filter.segment as Segment]?.label || c.segment_filter.segment}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs py-1.5">
                            <Button size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={() => cloneCampaign(c)}>
                              <Copy className="h-3 w-3" /> ক্লোন
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
