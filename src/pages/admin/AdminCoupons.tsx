import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActivityLog } from '@/hooks/useActivityLog';
import { fetchAllRows } from '@/lib/supabaseHelpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Tag, Copy, ClipboardCopy, BarChart3, Calendar, Users, TrendingUp, Clock, Filter, Phone, MapPin, Package, RotateCw, Search, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getOrderDiscount } from '@/lib/orderDiscount';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { bn } from 'date-fns/locale';

interface CouponForm {
  code: string;
  discount_type: string;
  discount_value: string;
  min_order_amount: string;
  max_uses: string;
  max_discount_amount: string;
  is_active: boolean;
  expires_at: string;
}

const emptyForm: CouponForm = {
  code: '', discount_type: 'fixed', discount_value: '0', min_order_amount: '0',
  max_uses: '', max_discount_amount: '', is_active: true, expires_at: '',
};

type FilterType = 'all' | 'active' | 'inactive' | 'expired';

export default function AdminCoupons() {
  const qc = useQueryClient();
  const { logActivity } = useActivityLog();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<CouponForm>(emptyForm);
  const [filter, setFilter] = useState<FilterType>('all');
  const [analyticsCode, setAnalyticsCode] = useState<string | null>(null);
  const [analyticsSearch, setAnalyticsSearch] = useState('');

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ['admin-coupons'],
    queryFn: async () => {
      const { data, error } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch orders with discount_note for analytics
  const { data: discountOrders = [] } = useQuery({
    queryKey: ['coupon-orders'],
    queryFn: async () => {
      return await fetchAllRows(() =>
        supabase
          .from('orders')
          .select('id, order_number, customer_name, customer_phone, customer_address, status, created_at, total, subtotal, delivery_charge, discount_note, free_shipping')
          .not('discount_note', 'is', null)
          .neq('discount_note', '')
          .order('created_at', { ascending: false })
      );
    },
  });

  // Fetch order items for the selected coupon's orders
  const { data: couponOrderItems = [] } = useQuery({
    queryKey: ['coupon-order-items', analyticsCode],
    enabled: !!analyticsCode,
    queryFn: async () => {
      if (!analyticsCode) return [];
      const orderIds = discountOrders
        .filter(o => o.discount_note?.toUpperCase().includes(analyticsCode.toUpperCase()))
        .map(o => o.id);
      if (orderIds.length === 0) return [];
      // Batch fetch in chunks of 50
      const allItems: any[] = [];
      for (let i = 0; i < orderIds.length; i += 50) {
        const batch = orderIds.slice(i, i + 50);
        const { data, error } = await supabase
          .from('order_items')
          .select('order_id, product_name, quantity, price, size, color')
          .in('order_id', batch);
        if (error) throw error;
        if (data) allItems.push(...data);
      }
      return allItems;
    },
  });

  // Summary stats
  const stats = useMemo(() => {
    const activeCoupons = coupons.filter((c: any) => c.is_active).length;
    const totalUsage = coupons.reduce((sum: number, c: any) => sum + (c.used_count || 0), 0);
    const totalDiscount = discountOrders.reduce((sum, o) => sum + getOrderDiscount(o), 0);
    const avgDiscount = discountOrders.length > 0 ? Math.round(totalDiscount / discountOrders.length) : 0;
    return { activeCoupons, totalUsage, totalDiscount, avgDiscount };
  }, [coupons, discountOrders]);

  // Filter coupons
  const filteredCoupons = useMemo(() => {
    const now = new Date();
    return coupons.filter((c: any) => {
      if (filter === 'active') return c.is_active && (!c.expires_at || !isPast(new Date(c.expires_at)));
      if (filter === 'inactive') return !c.is_active;
      if (filter === 'expired') return c.expires_at && isPast(new Date(c.expires_at));
      return true;
    });
  }, [coupons, filter]);

  // Orders for a specific coupon
  const couponOrders = useMemo(() => {
    if (!analyticsCode) return [];
    return discountOrders.filter(o =>
      o.discount_note?.toUpperCase().includes(analyticsCode.toUpperCase())
    );
  }, [analyticsCode, discountOrders]);

  const couponAnalytics = useMemo(() => {
    const totalRevenue = couponOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const totalDiscount = couponOrders.reduce((sum, o) => sum + getOrderDiscount(o), 0);
    const uniquePhones = new Set(couponOrders.map(o => o.customer_phone).filter(Boolean));
    const phoneCounts: Record<string, number> = {};
    couponOrders.forEach(o => { if (o.customer_phone) phoneCounts[o.customer_phone] = (phoneCounts[o.customer_phone] || 0) + 1; });
    const deliveredCount = couponOrders.filter(o => o.status === 'delivered').length;
    const conversionRate = couponOrders.length > 0 ? Math.round((deliveredCount / couponOrders.length) * 100) : 0;
    return { totalRevenue, totalDiscount, orderCount: couponOrders.length, uniqueCustomers: uniquePhones.size, phoneCounts, deliveredCount, conversionRate };
  }, [couponOrders]);

  // Group order items by order_id
  const itemsByOrder = useMemo(() => {
    const map: Record<string, any[]> = {};
    couponOrderItems.forEach(item => {
      if (!map[item.order_id]) map[item.order_id] = [];
      map[item.order_id].push(item);
    });
    return map;
  }, [couponOrderItems]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        code: form.code.toUpperCase().trim(),
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        min_order_amount: Number(form.min_order_amount),
        max_uses: form.max_uses ? Number(form.max_uses) : null,
        max_discount_amount: form.max_discount_amount ? Number(form.max_discount_amount) : null,
        is_active: form.is_active,
        expires_at: form.expires_at || null,
      };
      if (editing) {
        const { error } = await supabase.from('coupons').update(payload).eq('id', editing);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('coupons').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-coupons'] });
      logActivity(editing ? 'coupon_edit' : 'coupon_create', 'coupon', editing, editing ? 'কুপন এডিট করা হয়েছে' : 'কুপন তৈরি করা হয়েছে');
      toast.success(editing ? 'কুপন আপডেট হয়েছে' : 'কুপন যোগ হয়েছে');
      setOpen(false); setEditing(null); setForm(emptyForm);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('coupons').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-coupons'] }); toast.success('কুপন ডিলিট হয়েছে'); },
  });

  const openEdit = (c: any) => {
    setEditing(c.id);
    setForm({
      code: c.code, discount_type: c.discount_type, discount_value: String(c.discount_value),
      min_order_amount: String(c.min_order_amount), max_uses: c.max_uses ? String(c.max_uses) : '',
      max_discount_amount: c.max_discount_amount ? String(c.max_discount_amount) : '',
      is_active: c.is_active, expires_at: c.expires_at ? c.expires_at.split('T')[0] : '',
    });
    setOpen(true);
  };

  const duplicateCoupon = (c: any) => {
    setEditing(null);
    setForm({
      code: c.code + '_COPY', discount_type: c.discount_type, discount_value: String(c.discount_value),
      min_order_amount: String(c.min_order_amount), max_uses: c.max_uses ? String(c.max_uses) : '',
      max_discount_amount: c.max_discount_amount ? String(c.max_discount_amount) : '',
      is_active: true, expires_at: '',
    });
    setOpen(true);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('কোড কপি হয়েছে');
  };

  const u = (key: keyof CouponForm, val: any) => setForm(prev => ({ ...prev, [key]: val }));

  const getExpiryInfo = (expires_at: string | null) => {
    if (!expires_at) return null;
    const d = new Date(expires_at);
    if (isPast(d)) return { label: 'মেয়াদ শেষ', color: 'text-destructive' };
    return { label: formatDistanceToNow(d, { addSuffix: true }) + ' বাকি', color: 'text-muted-foreground' };
  };

  const getCouponDiscountTotal = (code: string) => {
    return discountOrders
      .filter(o => o.discount_note?.toUpperCase().includes(code.toUpperCase()))
      .reduce((sum, o) => sum + getOrderDiscount(o), 0);
  };

  // Filter coupon orders by search
  const filteredCouponOrders = useMemo(() => {
    if (!analyticsSearch.trim()) return couponOrders;
    const q = analyticsSearch.toLowerCase();
    return couponOrders.filter(o =>
      o.customer_name?.toLowerCase().includes(q) ||
      o.customer_phone?.includes(q) ||
      o.order_number?.toLowerCase().includes(q)
    );
  }, [couponOrders, analyticsSearch]);

  const filterButtons: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'সব' },
    { key: 'active', label: 'সক্রিয়' },
    { key: 'inactive', label: 'নিষ্ক্রিয়' },
    { key: 'expired', label: 'মেয়াদ শেষ' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">কুপন ম্যানেজমেন্ট</h1>
        <Dialog open={open} onOpenChange={v => { if (!v) { setEditing(null); setForm(emptyForm); } setOpen(v); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> কুপন যোগ</Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>{editing ? 'কুপন এডিট' : 'নতুন কুপন'}</DialogTitle></DialogHeader>
            <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-3">
              <div><Label>কোড</Label><Input value={form.code} onChange={e => u('code', e.target.value)} required placeholder="SAVE20" /></div>
              <div><Label>ডিসকাউন্ট টাইপ</Label>
                <select value={form.discount_type} onChange={e => u('discount_type', e.target.value)} className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background">
                  <option value="fixed">Fixed (৳)</option>
                  <option value="percentage">Percentage (%)</option>
                </select>
              </div>
              <div><Label>ডিসকাউন্ট ভ্যালু</Label><Input type="number" value={form.discount_value} onChange={e => u('discount_value', e.target.value)} required /></div>
              {form.discount_type === 'percentage' && (
                <div><Label>সর্বোচ্চ ডিসকাউন্ট ক্যাপ (৳)</Label><Input type="number" value={form.max_discount_amount} onChange={e => u('max_discount_amount', e.target.value)} placeholder="যেমন: 500" /></div>
              )}
              <div><Label>সর্বনিম্ন অর্ডার</Label><Input type="number" value={form.min_order_amount} onChange={e => u('min_order_amount', e.target.value)} /></div>
              <div><Label>সর্বোচ্চ ব্যবহার (খালি = আনলিমিটেড)</Label><Input type="number" value={form.max_uses} onChange={e => u('max_uses', e.target.value)} /></div>
              <div><Label>মেয়াদ শেষ (ঐচ্ছিক)</Label><Input type="date" value={form.expires_at} onChange={e => u('expires_at', e.target.value)} /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={e => u('is_active', e.target.checked)} /> সক্রিয়</label>
              <Button type="submit" className="w-full" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'সেভ হচ্ছে...' : 'সেভ'}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Tag className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.activeCoupons}</p>
              <p className="text-xs text-muted-foreground">সক্রিয় কুপন</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalUsage}</p>
              <p className="text-xs text-muted-foreground">মোট ব্যবহার</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">৳{stats.totalDiscount.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">মোট ডিসকাউন্ট</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-secondary-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">৳{stats.avgDiscount}</p>
              <p className="text-xs text-muted-foreground">গড় ডিসকাউন্ট</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        <Filter className="h-4 w-4 mt-1.5 text-muted-foreground" />
        {filterButtons.map(f => (
          <Button key={f.key} size="sm" variant={filter === f.key ? 'default' : 'outline'} onClick={() => setFilter(f.key)} className="text-xs h-7">
            {f.label}
          </Button>
        ))}
      </div>

      {/* Coupons List */}
      {isLoading ? <p className="text-muted-foreground">Loading...</p> : (
        <div className="space-y-3">
          {filteredCoupons.map((c: any) => {
            const expiry = getExpiryInfo(c.expires_at);
            const usagePercent = c.max_uses ? Math.min(100, Math.round((c.used_count / c.max_uses) * 100)) : null;
            const totalSaved = getCouponDiscountTotal(c.code);
            const isExpired = c.expires_at && isPast(new Date(c.expires_at));

            return (
              <Card key={c.id} className={isExpired ? 'opacity-60' : ''}>
                <CardContent className="p-4 space-y-3">
                  {/* Top Row */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Tag className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-mono font-bold text-sm">{c.code}</p>
                          <button onClick={() => copyCode(c.code)} className="p-0.5 hover:bg-muted rounded transition-colors" title="কপি">
                            <ClipboardCopy className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {c.discount_type === 'percentage'
                            ? `${c.discount_value}% ছাড়${c.max_discount_amount ? ` (সর্বোচ্চ ৳${c.max_discount_amount})` : ''}`
                            : `৳${c.discount_value} ছাড়`}
                          {c.min_order_amount > 0 && ` · মিন ৳${c.min_order_amount}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant={c.is_active && !isExpired ? 'default' : 'secondary'} className="text-[10px]">
                        {isExpired ? 'মেয়াদ শেষ' : c.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                      </Badge>
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="text-lg font-bold">{c.used_count || 0}</p>
                      <p className="text-[10px] text-muted-foreground">ব্যবহার</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="text-lg font-bold">৳{totalSaved}</p>
                      <p className="text-[10px] text-muted-foreground">মোট সেভ</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="text-lg font-bold">{expiry ? (isExpired ? '—' : expiry.label.replace(' বাকি', '')) : '∞'}</p>
                      <p className="text-[10px] text-muted-foreground">{isExpired ? 'মেয়াদ শেষ' : 'বাকি সময়'}</p>
                    </div>
                  </div>

                  {/* Usage Progress */}
                  {usagePercent !== null && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>ব্যবহার সীমা</span>
                        <span>{c.used_count}/{c.max_uses}</span>
                      </div>
                      <Progress value={usagePercent} className="h-1.5" />
                    </div>
                  )}

                  {/* Actions Row */}
                  <div className="flex items-center justify-between border-t pt-2">
                    <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => setAnalyticsCode(c.code)}>
                      <BarChart3 className="h-3.5 w-3.5" /> অ্যানালিটিক্স
                    </Button>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => duplicateCoupon(c)} title="ডুপ্লিকেট">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)} title="এডিট">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { if (confirm('ডিলিট করবেন?')) deleteMutation.mutate(c.id); }} title="ডিলিট">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filteredCoupons.length === 0 && <p className="text-muted-foreground text-center py-8">কোনো কুপন নেই</p>}
        </div>
      )}

      {/* Analytics Dialog */}
      <Dialog open={!!analyticsCode} onOpenChange={v => { if (!v) { setAnalyticsCode(null); setAnalyticsSearch(''); } }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              কুপন অ্যানালিটিক্স — <span className="font-mono">{analyticsCode}</span>
            </DialogTitle>
          </DialogHeader>

          {/* Analytics Summary */}
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div className="bg-primary/5 rounded-lg p-3 text-center">
              <p className="text-xl font-bold">{couponAnalytics.orderCount}</p>
              <p className="text-[10px] text-muted-foreground">কুপন অ্যাপ্লাই</p>
            </div>
            <div className="bg-primary/5 rounded-lg p-3 text-center">
              <p className="text-xl font-bold">{couponAnalytics.uniqueCustomers}</p>
              <p className="text-[10px] text-muted-foreground">ইউনিক কাস্টমার</p>
            </div>
            <div className="bg-primary/5 rounded-lg p-3 text-center">
              <p className="text-xl font-bold">৳{couponAnalytics.totalRevenue.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">মোট রেভিনিউ</p>
            </div>
            <div className="bg-destructive/5 rounded-lg p-3 text-center">
              <p className="text-xl font-bold">৳{couponAnalytics.totalDiscount.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">মোট ডিসকাউন্ট</p>
            </div>
          </div>

          {/* Conversion Stats */}
          <div className="bg-muted/50 rounded-lg p-3 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-sm font-bold">{couponAnalytics.deliveredCount}</p>
                <p className="text-[10px] text-muted-foreground flex items-center gap-0.5"><CheckCircle2 className="h-3 w-3" /> ডেলিভারড</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold">{couponAnalytics.orderCount - couponAnalytics.deliveredCount}</p>
                <p className="text-[10px] text-muted-foreground">অন্যান্য</p>
              </div>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-primary">{couponAnalytics.conversionRate}%</p>
              <p className="text-[10px] text-muted-foreground">কনভার্সন রেট</p>
            </div>
          </div>

          {/* Customer Orders List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">কাস্টমার ও অর্ডার তালিকা</h3>
              <span className="text-xs text-muted-foreground">{filteredCouponOrders.length} টি</span>
            </div>
            {couponOrders.length > 0 && (
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="নাম, ফোন বা অর্ডার নম্বর দিয়ে সার্চ..."
                  value={analyticsSearch}
                  onChange={e => setAnalyticsSearch(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
            )}
            {filteredCouponOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{couponOrders.length === 0 ? 'এই কুপন দিয়ে কোনো অর্ডার পাওয়া যায়নি' : 'সার্চে কিছু পাওয়া যায়নি'}</p>
            ) : (
              <div className="space-y-3">
                {filteredCouponOrders.map(o => {
                  const isRepeat = couponAnalytics.phoneCounts[o.customer_phone] > 1;
                  const items = itemsByOrder[o.id] || [];
                  const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
                    pending: { label: 'পেন্ডিং', variant: 'outline' },
                    confirmed: { label: 'কনফার্মড', variant: 'default' },
                    shipped: { label: 'শিপড', variant: 'secondary' },
                    delivered: { label: 'ডেলিভারড', variant: 'default' },
                    cancelled: { label: 'ক্যান্সেলড', variant: 'destructive' },
                    delivery_failed: { label: 'ফেইলড', variant: 'destructive' },
                  };
                  const st = statusMap[o.status] || { label: o.status, variant: 'outline' as const };

                  return (
                    <Card key={o.id} className="overflow-hidden">
                      <CardContent className="p-3 space-y-2">
                        {/* Customer Info */}
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm">{o.customer_name}</p>
                              {isRepeat && (
                                <Badge variant="outline" className="text-[9px] gap-0.5 h-4 px-1">
                                  <RotateCw className="h-2.5 w-2.5" /> রিপিট
                                </Badge>
                              )}
                            </div>
                            <button
                              onClick={() => { navigator.clipboard.writeText(o.customer_phone); toast.success('ফোন কপি হয়েছে'); }}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Phone className="h-3 w-3" /> {o.customer_phone}
                            </button>
                            {o.customer_address && (
                              <p className="flex items-start gap-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3 mt-0.5 shrink-0" /> <span className="line-clamp-2">{o.customer_address}</span>
                              </p>
                            )}
                          </div>
                          <Badge variant={st.variant} className="text-[10px] shrink-0">{st.label}</Badge>
                        </div>

                        {/* Order Info */}
                        <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
                          <span className="font-mono">{o.order_number}</span>
                          <span>{format(new Date(o.created_at), 'dd MMM yyyy')}</span>
                        </div>

                        {/* Order Items */}
                        {items.length > 0 && (
                          <div className="bg-muted/50 rounded-md p-2 space-y-1">
                            {items.map((item: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1.5">
                                  <Package className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <span className="line-clamp-1">{item.product_name} × {item.quantity}</span>
                                  {(item.size || item.color) && (
                                    <span className="text-muted-foreground">
                                      ({[item.size, item.color].filter(Boolean).join(', ')})
                                    </span>
                                  )}
                                </div>
                                <span className="font-medium shrink-0">৳{(item.price * item.quantity).toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Total & Discount */}
                        <div className="flex items-center justify-between text-sm border-t pt-2">
                          <span className="font-medium">৳{Number(o.total).toLocaleString()}</span>
                          <span className="text-xs text-destructive font-medium">-৳{getOrderDiscount(o).toLocaleString()}</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
