import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabaseHelpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SmartRangeCalendar } from '@/components/ui/smart-range-calendar';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, ExternalLink, Globe, ShoppingCart, DollarSign, Target, CalendarIcon, X, LayoutGrid, Users, TrendingUp, Sparkles } from 'lucide-react';
import AiGenerateWizard from '@/components/admin/landing-ai/AiGenerateWizard';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';
import { Settings } from 'lucide-react';

interface LPForm {
  title: string;
  slug: string;
  meta_title: string;
  meta_description: string;
  is_active: boolean;
}

const emptyForm: LPForm = { title: '', slug: '', meta_title: '', meta_description: '', is_active: true };

export default function AdminLandingPages() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<LPForm>(emptyForm);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 6),
    to: new Date(),
  });

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ['admin-landing-pages'],
    queryFn: async () => {
      const { data, error } = await supabase.from('landing_pages').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const activePageCount = useMemo(() => pages.filter((p: any) => p.is_active).length, [pages]);

  const { data: lpOrders = [] } = useQuery({
    queryKey: ['lp-orders-overview', dateRange.from?.toISOString(), dateRange.to?.toISOString()],
    queryFn: async () => {
      return await fetchAllRows(() => {
        let q = supabase
          .from('orders')
          .select('total, source_landing_page_id, created_at')
          .not('source_landing_page_id', 'is', null);
        if (dateRange.from) q = q.gte('created_at', startOfDay(dateRange.from).toISOString());
        if (dateRange.to) q = q.lte('created_at', endOfDay(dateRange.to).toISOString());
        return q;
      });
    },
  });

  const slugs = useMemo(() => pages.map((p: any) => p.slug), [pages]);

  const { data: visitData = [] } = useQuery({
    queryKey: ['lp-visits', slugs],
    queryFn: async () => {
      if (slugs.length === 0) return [];
      const orFilter = slugs.flatMap((s: string) => [`page_path.eq./lp/${s}`, `page_path.eq./${s}`]).join(',');
      return await fetchAllRows(() => supabase.from('site_visits').select('page_path').or(orFilter));
    },
    enabled: slugs.length > 0,
  });

  const { overallStats, perPageStats, dailyData } = useMemo(() => {
    const perPage: Record<string, { count: number; revenue: number }> = {};
    let totalOrders = 0, totalRevenue = 0;
    const dailyMap: Record<string, number> = {};

    for (const o of lpOrders) {
      const pid = o.source_landing_page_id!;
      if (!perPage[pid]) perPage[pid] = { count: 0, revenue: 0 };
      perPage[pid].count++;
      perPage[pid].revenue += Number(o.total) || 0;
      totalOrders++;
      totalRevenue += Number(o.total) || 0;

      const day = format(new Date(o.created_at), 'yyyy-MM-dd');
      dailyMap[day] = (dailyMap[day] || 0) + (Number(o.total) || 0);
    }

    // Build daily chart data with all days in range
    const days = dateRange.from && dateRange.to
      ? eachDayOfInterval({ start: dateRange.from, end: dateRange.to })
      : [];
    const daily = days.map(d => {
      const key = format(d, 'yyyy-MM-dd');
      return { date: format(d, 'MMM d'), revenue: dailyMap[key] || 0 };
    });

    return {
      overallStats: { totalOrders, totalRevenue, avg: totalOrders ? Math.round(totalRevenue / totalOrders) : 0 },
      perPageStats: perPage,
      dailyData: daily,
    };
  }, [lpOrders, dateRange]);

  const visitorsBySlug = useMemo(() => {
    const map: Record<string, number> = {};
    for (const v of visitData) {
      const path = v.page_path || '';
      // match slug from /lp/{slug} or /{slug}
      const match = path.match(/^\/(?:lp\/)?(.+)$/);
      if (match) {
        const slug = match[1];
        map[slug] = (map[slug] || 0) + 1;
      }
    }
    return map;
  }, [visitData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        title: form.title,
        slug: form.slug,
        meta_title: form.meta_title || null,
        meta_description: form.meta_description || null,
        is_active: form.is_active,
      };
      if (editing) {
        const { error } = await supabase.from('landing_pages').update(payload).eq('id', editing);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('landing_pages').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-landing-pages'] });
      toast.success(editing ? 'আপডেট হয়েছে' : 'তৈরি হয়েছে');
      setOpen(false); setEditing(null); setForm(emptyForm);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('landing_pages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-landing-pages'] }); toast.success('ডিলিট হয়েছে'); },
  });

  const openEdit = (p: any) => {
    setEditing(p.id);
    setForm({ title: p.title, slug: p.slug, meta_title: p.meta_title || '', meta_description: p.meta_description || '', is_active: p.is_active });
    setOpen(true);
  };

  const u = (key: keyof LPForm, val: any) => setForm(prev => ({ ...prev, [key]: val }));

  const overviewStats = [
    { label: 'মোট সেল', value: `৳${overallStats.totalRevenue.toLocaleString('bn-BD')}`, icon: DollarSign, color: 'text-orange-500', border: 'border-l-orange-500' },
    { label: 'মোট অর্ডার', value: overallStats.totalOrders.toLocaleString('bn-BD'), icon: ShoppingCart, color: 'text-blue-500', border: 'border-l-blue-500' },
    { label: 'গড় অর্ডার ভ্যালু', value: `৳${overallStats.avg.toLocaleString('bn-BD')}`, icon: Target, color: 'text-green-500', border: 'border-l-green-500' },
    { label: 'সক্রিয় পেজ', value: activePageCount.toLocaleString('bn-BD'), icon: LayoutGrid, color: 'text-purple-500', border: 'border-l-purple-500' },
  ];

  const dateLabel = dateRange.from && dateRange.to
    ? `${format(dateRange.from, 'MMM d, yyyy')} - ${format(dateRange.to, 'MMM d, yyyy')}`
    : 'তারিখ নির্বাচন করুন';

  return (
    <div>
      {/* Overview Section */}
      <Card className="mb-6">
        <CardContent className="p-4 sm:p-6">
          {/* Header with date picker */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
            <h2 className="text-lg font-bold">Overview</h2>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs gap-1.5">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {dateLabel}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <SmartRangeCalendar
                    value={dateRange}
                    onChange={setDateRange}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
              {dateRange.from && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDateRange({ from: subDays(new Date(), 6), to: new Date() })}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Stats + Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
            {/* Left: stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
              {overviewStats.map(s => (
                <div key={s.label} className={`border-l-4 ${s.border} rounded-lg border bg-card p-3`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-muted-foreground">{s.label}</p>
                      <p className="text-lg font-bold mt-0.5">{s.value}</p>
                    </div>
                    <s.icon className={`h-6 w-6 ${s.color} opacity-70`} />
                  </div>
                </div>
              ))}
            </div>

            {/* Right: area chart */}
            <div className="rounded-lg border bg-card p-3 min-h-[220px]">
              <p className="text-xs text-muted-foreground mb-2">দৈনিক রেভিনিউ</p>
              {dailyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={dailyData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="lpRevGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `৳${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                    <Tooltip
                      formatter={(val: number) => [`৳${val.toLocaleString('bn-BD')}`, 'রেভিনিউ']}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2} fill="url(#lpRevGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">
                  এই সময়ে কোনো ডেটা নেই
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Brand Defaults Link */}
      <Link to="/admin/landing-pages/brand-defaults">
        <Card className="mb-6 hover:bg-accent/50 transition-colors cursor-pointer">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Settings className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">ব্র্যান্ড ডিফল্ট সেটিংস</p>
              <p className="text-xs text-muted-foreground">সব ল্যান্ডিং পেজের গ্লোবাল সেটিংস</p>
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* Landing Pages List */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">ল্যান্ডিং পেজ</h1>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setAiOpen(true)} className="border-primary/40 text-primary hover:bg-primary/5">
            <Sparkles className="h-4 w-4 mr-1" /> AI জেনারেট
          </Button>
          <Dialog open={open} onOpenChange={v => { if (!v) { setEditing(null); setForm(emptyForm); } setOpen(v); }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> নতুন পেজ</Button>
            </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>{editing ? 'পেজ এডিট' : 'নতুন ল্যান্ডিং পেজ'}</DialogTitle></DialogHeader>
            <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-3">
              <div><Label>টাইটেল</Label><Input value={form.title} onChange={e => u('title', e.target.value)} required /></div>
              <div><Label>Slug</Label><Input value={form.slug} onChange={e => u('slug', e.target.value)} required placeholder="my-landing-page" /></div>
              <div><Label>Meta Title</Label><Input value={form.meta_title} onChange={e => u('meta_title', e.target.value)} /></div>
              <div><Label>Meta Description</Label><Input value={form.meta_description} onChange={e => u('meta_description', e.target.value)} /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={e => u('is_active', e.target.checked)} /> সক্রিয়</label>
              <Button type="submit" className="w-full" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'সেভ হচ্ছে...' : 'সেভ'}</Button>
            </form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <AiGenerateWizard open={aiOpen} onOpenChange={setAiOpen} />

      {isLoading ? <p className="text-muted-foreground">Loading...</p> : (
        <div className="space-y-2">
          {pages.map((p: any) => (
            <Card key={p.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Globe className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{p.title}</p>
                    <p className="text-xs text-muted-foreground">/lp/{p.slug}</p>
                    {perPageStats[p.id] && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {perPageStats[p.id].count} অর্ডার · ৳{perPageStats[p.id].revenue.toLocaleString('bn-BD')}
                      </p>
                    )}
                    {(() => {
                      const visitors = visitorsBySlug[p.slug] || 0;
                      const orders = perPageStats[p.id]?.count || 0;
                      const conversion = visitors > 0 ? ((orders / visitors) * 100).toFixed(1) : '0';
                      return visitors > 0 ? (
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <Users className="h-3 w-3" /> {visitors} ভিজিটর · <TrendingUp className="h-3 w-3" /> {conversion}%
                        </p>
                      ) : null;
                    })()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={p.is_active ? 'default' : 'secondary'}>{p.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</Badge>
                  <Button variant="ghost" size="icon" asChild>
                    <Link to={`/admin/landing-pages/${p.id}`}><Pencil className="h-4 w-4" /></Link>
                  </Button>
                  <Button variant="ghost" size="icon" asChild>
                    <a href={`/lp/${p.slug}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm('ডিলিট করবেন?')) deleteMutation.mutate(p.id); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {pages.length === 0 && <p className="text-muted-foreground">কোনো ল্যান্ডিং পেজ নেই</p>}
        </div>
      )}
    </div>
  );
}
