import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Truck, Pencil, Trash2, BarChart3, Calendar, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import type { FreeShippingCampaign, FreeShippingRuleType, FreeShippingStatus } from '@/lib/freeShipping';
import { FreeShippingTeaser } from '@/components/freeShipping/FreeShippingProgress';
import { FreeShippingDebugPanel } from '@/components/freeShipping/FreeShippingDebugPanel';

const RULE_LABELS: Record<FreeShippingRuleType, string> = {
  amount: 'কার্ট অ্যামাউন্ট ভিত্তিক',
  quantity: 'প্রোডাক্ট কোয়ান্টিটি ভিত্তিক',
  category_quantity: 'ক্যাটাগরি + কোয়ান্টিটি',
  product_quantity: 'নির্দিষ্ট প্রোডাক্ট + কোয়ান্টিটি',
  product_amount: 'নির্দিষ্ট প্রোডাক্ট + অ্যামাউন্ট',
  combo: 'কম্বো (কোয়ান্টিটি + অ্যামাউন্ট)',
};

const STATUS_LABELS: Record<FreeShippingStatus, string> = {
  active: 'চালু',
  draft: 'ড্রাফট',
  scheduled: 'সময় নির্ধারিত',
  expired: 'মেয়াদ শেষ',
};

const STATUS_VARIANTS: Record<FreeShippingStatus, string> = {
  active: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40',
  draft: 'bg-muted text-muted-foreground border-border',
  scheduled: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40',
  expired: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/40',
};

function emptyCampaign(): Partial<FreeShippingCampaign> {
  return {
    name: '',
    description: '',
    banner_image: '',
    status: 'draft',
    start_date: null,
    end_date: null,
    priority: 0,
    rule_type: 'amount',
    combine_logic: 'and',
    min_quantity: null,
    max_quantity: null,
    min_amount: null,
    max_amount: null,
    applicable_category_ids: [],
    applicable_product_ids: [],
    excluded_product_ids: [],
    coupon_code: null,
  };
}

async function fetchCampaigns(): Promise<FreeShippingCampaign[]> {
  const { data, error } = await supabase
    .from('free_shipping_campaigns' as any)
    .select('*')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as any[]) as FreeShippingCampaign[];
}

async function fetchStats(): Promise<Array<{ campaign_id: string; orders_count: number; revenue: number; free_shipping_cost: number }>> {
  const { data, error } = await supabase
    .from('free_shipping_campaign_stats' as any)
    .select('*');
  if (error) return [];
  return (data as any[]) || [];
}

export default function AdminFreeShipping() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'campaigns' | 'analytics' | 'debug'>('campaigns');
  const [editing, setEditing] = useState<Partial<FreeShippingCampaign> | null>(null);
  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['admin-free-shipping-campaigns'],
    queryFn: fetchCampaigns,
  });
  const { data: stats = [] } = useQuery({
    queryKey: ['admin-free-shipping-stats'],
    queryFn: fetchStats,
  });

  const statsByCampaign = useMemo(() => {
    const map = new Map<string, { orders_count: number; revenue: number; free_shipping_cost: number }>();
    stats.forEach((s) => map.set(s.campaign_id, s));
    return map;
  }, [stats]);

  async function save(c: Partial<FreeShippingCampaign>) {
    const payload: any = {
      name: c.name?.trim() || 'Untitled campaign',
      description: c.description ?? null,
      banner_image: c.banner_image ?? null,
      status: c.status || 'draft',
      start_date: c.start_date || null,
      end_date: c.end_date || null,
      priority: c.priority ?? 0,
      rule_type: c.rule_type || 'amount',
      combine_logic: c.combine_logic || 'and',
      min_quantity: c.min_quantity ?? null,
      max_quantity: c.max_quantity ?? null,
      min_amount: c.min_amount ?? null,
      max_amount: c.max_amount ?? null,
      applicable_category_ids: c.applicable_category_ids ?? [],
      applicable_product_ids: c.applicable_product_ids ?? [],
      excluded_product_ids: c.excluded_product_ids ?? [],
      coupon_code: c.coupon_code?.trim() ? c.coupon_code.trim().toUpperCase() : null,
    };
    let res;
    if (c.id) {
      res = await supabase.from('free_shipping_campaigns' as any).update(payload).eq('id', c.id);
    } else {
      res = await supabase.from('free_shipping_campaigns' as any).insert(payload);
    }
    if (res.error) {
      toast.error('সংরক্ষণ ব্যর্থ', { description: res.error.message });
      return;
    }
    toast.success('সফলভাবে সংরক্ষণ হয়েছে');
    setEditing(null);
    qc.invalidateQueries({ queryKey: ['admin-free-shipping-campaigns'] });
    qc.invalidateQueries({ queryKey: ['free-shipping-campaigns', 'active'] });
  }

  async function remove(id: string) {
    if (!confirm('আপনি কি এই ক্যাম্পেইন মুছতে চান?')) return;
    const { error } = await supabase.from('free_shipping_campaigns' as any).delete().eq('id', id);
    if (error) {
      toast.error('মুছতে ব্যর্থ', { description: error.message });
      return;
    }
    // verify deletion (silent RLS safety)
    const { data: still } = await supabase.from('free_shipping_campaigns' as any).select('id').eq('id', id).maybeSingle();
    if (still) {
      toast.error('অনুমতি নেই — মুছা যায়নি');
      return;
    }
    toast.success('মুছে ফেলা হয়েছে');
    qc.invalidateQueries({ queryKey: ['admin-free-shipping-campaigns'] });
    qc.invalidateQueries({ queryKey: ['free-shipping-campaigns', 'active'] });
  }

  const totalOrders = stats.reduce((s, x) => s + (x.orders_count || 0), 0);
  const totalRevenue = stats.reduce((s, x) => s + Number(x.revenue || 0), 0);
  const totalCost = stats.reduce((s, x) => s + Number(x.free_shipping_cost || 0), 0);
  const roi = totalCost > 0 ? ((totalRevenue - totalCost) / totalCost) * 100 : 0;
  const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const activeCount = campaigns.filter((c) => c.status === 'active').length;
  const topCampaign = useMemo(() => {
    let best: { c: FreeShippingCampaign; revenue: number } | null = null;
    campaigns.forEach((c) => {
      const r = Number(statsByCampaign.get(c.id)?.revenue || 0);
      if (!best || r > best.revenue) best = { c, revenue: r };
    });
    return best;
  }, [campaigns, statsByCampaign]);

  return (
    <div className="container py-4 sm:py-6 space-y-4 max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/customers')} className="md:hidden">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Truck className="h-6 w-6 text-emerald-600" />
              ফ্রি ডেলিভারি সিস্টেম
            </h1>
            <p className="text-sm text-muted-foreground">কনভার্সন বাড়াতে ফ্রি ডেলিভারি ক্যাম্পেইন তৈরি ও পরিচালনা করুন</p>
          </div>
        </div>
        <Button onClick={() => setEditing(emptyCampaign())} className="gap-2">
          <Plus className="h-4 w-4" /> নতুন ক্যাম্পেইন
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="campaigns">ক্যাম্পেইন</TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1"><BarChart3 className="h-3 w-3" /> অ্যানালিটিক্স</TabsTrigger>
          <TabsTrigger value="debug">🧪 Debug</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-3 mt-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">লোড হচ্ছে…</div>
          ) : campaigns.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center space-y-3">
                <Truck className="h-10 w-10 mx-auto text-muted-foreground" />
                <div className="font-medium">কোনো ফ্রি ডেলিভারি ক্যাম্পেইন নেই</div>
                <p className="text-sm text-muted-foreground">প্রথম ক্যাম্পেইন তৈরি করে কাস্টমারদের আরো বেশি কিনতে উৎসাহিত করুন।</p>
                <Button onClick={() => setEditing(emptyCampaign())} className="gap-2">
                  <Plus className="h-4 w-4" /> নতুন ক্যাম্পেইন
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {campaigns.map((c) => {
                const s = statsByCampaign.get(c.id);
                return (
                  <Card key={c.id} className="overflow-hidden">
                    {c.banner_image && (
                      <div className="aspect-[21/9] bg-muted overflow-hidden">
                        <img src={c.banner_image} alt={c.name} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base">{c.name}</CardTitle>
                        <Badge className={STATUS_VARIANTS[c.status]} variant="outline">{STATUS_LABELS[c.status]}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">{RULE_LABELS[c.rule_type]}</div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <FreeShippingTeaser campaign={c} />
                      {(c.start_date || c.end_date) && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {c.start_date ? new Date(c.start_date).toLocaleDateString('bn-BD') : '—'}
                          {' → '}
                          {c.end_date ? new Date(c.end_date).toLocaleDateString('bn-BD') : '∞'}
                        </div>
                      )}
                      {s && s.orders_count > 0 && (
                        <div className="grid grid-cols-3 gap-1 text-center text-xs bg-muted/50 rounded p-2">
                          <div>
                            <div className="font-semibold">{s.orders_count}</div>
                            <div className="text-muted-foreground">অর্ডার</div>
                          </div>
                          <div>
                            <div className="font-semibold">৳{Math.round(Number(s.revenue))}</div>
                            <div className="text-muted-foreground">আয়</div>
                          </div>
                          <div>
                            <div className="font-semibold">৳{Math.round(Number(s.free_shipping_cost))}</div>
                            <div className="text-muted-foreground">কস্ট</div>
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => setEditing(c)}>
                          <Pencil className="h-3 w-3" /> এডিট
                        </Button>
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => remove(c.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="মোট ক্যাম্পেইন" value={campaigns.length} />
            <StatCard label="সক্রিয়" value={activeCount} />
            <StatCard label="মোট অর্ডার" value={totalOrders} />
            <StatCard label="মোট আয়" value={`৳${Math.round(totalRevenue).toLocaleString('bn-BD')}`} />
            <StatCard label="ফ্রি শিপিং কস্ট" value={`৳${Math.round(totalCost).toLocaleString('bn-BD')}`} />
            <StatCard label="গড় অর্ডার মূল্য (AOV)" value={`৳${Math.round(aov).toLocaleString('bn-BD')}`} />
            <StatCard label="ROI" value={`${roi.toFixed(1)}%`} />
            <StatCard label="সবচেয়ে সফল" value={topCampaign?.c.name || '—'} small />
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">ক্যাম্পেইন পারফর্মেন্স</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {campaigns.map((c) => {
                  const s = statsByCampaign.get(c.id);
                  return (
                    <div key={c.id} className="flex items-center justify-between border-b pb-2 text-sm">
                      <div className="flex-1">
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{RULE_LABELS[c.rule_type]}</div>
                      </div>
                      <div className="text-right text-xs">
                        <div>{s?.orders_count || 0} অর্ডার · ৳{Math.round(Number(s?.revenue || 0))}</div>
                        <div className="text-muted-foreground">কস্ট: ৳{Math.round(Number(s?.free_shipping_cost || 0))}</div>
                      </div>
                    </div>
                  );
                })}
                {campaigns.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-6">এখনো কোনো ডেটা নেই</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="debug" className="mt-4">
          <FreeShippingDebugPanel campaigns={campaigns} />
        </TabsContent>
      </Tabs>

      {editing && (
        <CampaignEditor
          value={editing}
          onChange={setEditing}
          onSave={save}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, small }: { label: string; value: any; small?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={small ? 'text-sm font-semibold mt-1 truncate' : 'text-xl font-bold mt-1'}>{value}</div>
      </CardContent>
    </Card>
  );
}

function CampaignEditor({
  value,
  onChange,
  onSave,
  onCancel,
}: {
  value: Partial<FreeShippingCampaign>;
  onChange: (v: Partial<FreeShippingCampaign>) => void;
  onSave: (v: Partial<FreeShippingCampaign>) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [cats, setCats] = useState<Array<{ id: string; name: string }>>([]);
  const [productSearch, setProductSearch] = useState('');
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    supabase.from('categories').select('id, name').order('name').then(({ data }) => {
      setCats((data as any[]) || []);
    });
  }, []);

  useEffect(() => {
    if (productSearch.length < 2) {
      setProducts([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name')
        .ilike('name', `%${productSearch}%`)
        .limit(20);
      if (!cancelled) setProducts((data as any[]) || []);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [productSearch]);

  const set = (patch: Partial<FreeShippingCampaign>) => onChange({ ...value, ...patch });

  // Decompose rule_type into two independent dimensions:
  //  - scope:       all | category | product
  //  - measurement: amount | quantity | both
  type Scope = 'all' | 'category' | 'product';
  type Measurement = 'amount' | 'quantity' | 'both';

  const deriveScope = (): Scope => {
    if ((value.applicable_product_ids || []).length > 0) return 'product';
    if ((value.applicable_category_ids || []).length > 0) return 'category';
    const rt = value.rule_type;
    if (rt === 'product_amount' || rt === 'product_quantity') return 'product';
    if (rt === 'category_quantity') return 'category';
    return 'all';
  };
  const deriveMeasurement = (): Measurement => {
    const rt = value.rule_type;
    if (rt === 'combo') return 'both';
    if (rt === 'amount' || rt === 'product_amount') return 'amount';
    return 'quantity';
  };
  const scope: Scope = deriveScope();
  const measurement: Measurement = deriveMeasurement();

  const composeRuleType = (s: Scope, m: Measurement): FreeShippingRuleType => {
    if (m === 'both') return 'combo';
    if (s === 'product') return m === 'amount' ? 'product_amount' : 'product_quantity';
    if (s === 'category') return m === 'amount' ? 'amount' : 'category_quantity';
    return m === 'amount' ? 'amount' : 'quantity';
  };

  const setScope = (s: Scope) => {
    const next: Partial<FreeShippingCampaign> = { rule_type: composeRuleType(s, measurement) };
    if (s !== 'category') next.applicable_category_ids = [];
    if (s !== 'product') next.applicable_product_ids = [];
    set(next);
  };
  const setMeasurement = (m: Measurement) => {
    const patch: Partial<FreeShippingCampaign> = { rule_type: composeRuleType(scope, m) };
    if (m === 'amount') { patch.min_quantity = null; patch.max_quantity = null; }
    if (m === 'quantity') { patch.min_amount = null; patch.max_amount = null; }
    set(patch);
  };

  const showQty = measurement === 'quantity' || measurement === 'both';
  const showAmount = measurement === 'amount' || measurement === 'both';
  const showCategory = scope === 'category';
  const showProduct = scope === 'product';

  function toggleArr(field: 'applicable_category_ids' | 'applicable_product_ids' | 'excluded_product_ids', id: string) {
    const cur = (value[field] || []) as string[];
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    set({ [field]: next } as any);
  }

  async function handleSave() {
    setBusy(true);
    await onSave(value);
    setBusy(false);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{value.id ? 'ক্যাম্পেইন এডিট' : 'নতুন ফ্রি ডেলিভারি ক্যাম্পেইন'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>ক্যাম্পেইন নাম *</Label>
              <Input value={value.name || ''} onChange={(e) => set({ name: e.target.value })} placeholder="যেমন: ৳১০০০ অর্ডারে ফ্রি ডেলিভারি" />
            </div>
            <div className="col-span-2">
              <Label>বিবরণ</Label>
              <Textarea value={value.description || ''} onChange={(e) => set({ description: e.target.value })} rows={2} />
            </div>
            <div className="col-span-2">
              <Label>ব্যানার ইমেজ URL</Label>
              <Input value={value.banner_image || ''} onChange={(e) => set({ banner_image: e.target.value })} placeholder="https://..." />
            </div>
            <div>
              <Label>স্ট্যাটাস</Label>
              <Select value={value.status || 'draft'} onValueChange={(v) => set({ status: v as FreeShippingStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['active', 'draft', 'scheduled', 'expired'] as const).map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>প্রায়োরিটি</Label>
              <Input type="number" value={value.priority ?? 0} onChange={(e) => set({ priority: Number(e.target.value) })} />
            </div>
            <div>
              <Label>শুরুর তারিখ</Label>
              <Input type="datetime-local" value={value.start_date ? value.start_date.slice(0, 16) : ''} onChange={(e) => set({ start_date: e.target.value || null })} />
            </div>
            <div>
              <Label>শেষের তারিখ</Label>
              <Input type="datetime-local" value={value.end_date ? value.end_date.slice(0, 16) : ''} onChange={(e) => set({ end_date: e.target.value || null })} />
            </div>
          </div>

          <div className="border-t pt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>কোন আইটেমে প্রযোজ্য *</Label>
                <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">পুরো স্টোর (সব প্রোডাক্ট)</SelectItem>
                    <SelectItem value="category">নির্দিষ্ট ক্যাটাগরি</SelectItem>
                    <SelectItem value="product">নির্দিষ্ট প্রোডাক্ট</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>শর্তের ধরন *</Label>
                <Select value={measurement} onValueChange={(v) => setMeasurement(v as Measurement)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="amount">অ্যামাউন্ট (৳)</SelectItem>
                    <SelectItem value="quantity">কোয়ান্টিটি (পিস)</SelectItem>
                    <SelectItem value="both">দুটোই (অ্যামাউন্ট + কোয়ান্টিটি)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {measurement === 'both' && (
              <div className="flex items-center gap-3">
                <Label>কম্বো লজিক:</Label>
                <Select value={value.combine_logic || 'and'} onValueChange={(v) => set({ combine_logic: v as 'and' | 'or' })}>
                  <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="and">AND (দুটোই পূরণ করতে হবে)</SelectItem>
                    <SelectItem value="or">OR (যেকোনো একটি)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {showQty && (
                <>
                  <div>
                    <Label>মিনিমাম কোয়ান্টিটি</Label>
                    <Input type="number" min={0} value={value.min_quantity ?? ''} onChange={(e) => set({ min_quantity: e.target.value ? Number(e.target.value) : null })} />
                  </div>
                  <div>
                    <Label>ম্যাক্সিমাম কোয়ান্টিটি (অপশনাল)</Label>
                    <Input type="number" min={0} value={value.max_quantity ?? ''} onChange={(e) => set({ max_quantity: e.target.value ? Number(e.target.value) : null })} />
                  </div>
                </>
              )}
              {showAmount && (
                <>
                  <div>
                    <Label>মিনিমাম অ্যামাউন্ট (৳)</Label>
                    <Input type="number" min={0} value={value.min_amount ?? ''} onChange={(e) => set({ min_amount: e.target.value ? Number(e.target.value) : null })} />
                  </div>
                  <div>
                    <Label>ম্যাক্সিমাম অ্যামাউন্ট (অপশনাল)</Label>
                    <Input type="number" min={0} value={value.max_amount ?? ''} onChange={(e) => set({ max_amount: e.target.value ? Number(e.target.value) : null })} />
                  </div>
                </>
              )}
            </div>

            {showCategory && (
              <div>
                <Label>প্রযোজ্য ক্যাটাগরি</Label>
                <div className="flex flex-wrap gap-1 mt-1 max-h-32 overflow-y-auto border rounded p-2">
                  {cats.map((c) => {
                    const sel = (value.applicable_category_ids || []).includes(c.id);
                    return (
                      <Badge
                        key={c.id}
                        variant={sel ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => toggleArr('applicable_category_ids', c.id)}
                      >
                        {c.name}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            {showProduct && (
              <ProductPickerField
                label="প্রযোজ্য প্রোডাক্ট"
                selected={value.applicable_product_ids || []}
                onToggle={(id) => toggleArr('applicable_product_ids', id)}
                search={productSearch}
                setSearch={setProductSearch}
                results={products}
              />
            )}

            <ProductPickerField
              label="বাদ দেওয়া প্রোডাক্ট"
              selected={value.excluded_product_ids || []}
              onToggle={(id) => toggleArr('excluded_product_ids', id)}
              search={productSearch}
              setSearch={setProductSearch}
              results={products}
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>কুপন কোড (অপশনাল)</Label>
                <Input value={value.coupon_code || ''} onChange={(e) => set({ coupon_code: e.target.value })} placeholder="FREESHIP" />
                <p className="text-xs text-muted-foreground mt-1">কোড দিলে শুধুমাত্র সেই কোড অ্যাপ্লাই করা কাস্টমারদের জন্য কাজ করবে</p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} disabled={busy}>বাতিল</Button>
          <Button onClick={handleSave} disabled={busy}>{busy ? 'সংরক্ষণ হচ্ছে…' : 'সংরক্ষণ'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProductPickerField({
  label, selected, onToggle, search, setSearch, results,
}: {
  label: string;
  selected: string[];
  onToggle: (id: string) => void;
  search: string;
  setSearch: (s: string) => void;
  results: Array<{ id: string; name: string }>;
}) {
  const [selectedNames, setSelectedNames] = useState<Record<string, string>>({});
  useEffect(() => {
    if (selected.length === 0) return;
    const missing = selected.filter((id) => !selectedNames[id]);
    if (missing.length === 0) return;
    supabase.from('products').select('id, name').in('id', missing).then(({ data }) => {
      const next = { ...selectedNames };
      (data as any[] || []).forEach((p) => { next[p.id] = p.name; });
      setSelectedNames(next);
    });
  }, [selected, selectedNames]);

  return (
    <div>
      <Label>{label}</Label>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="প্রোডাক্ট সার্চ করুন…"
        className="mt-1"
      />
      {results.length > 0 && (
        <div className="border rounded mt-1 max-h-32 overflow-y-auto">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted flex items-center justify-between"
              onClick={() => onToggle(p.id)}
            >
              <span className="truncate">{p.name}</span>
              {selected.includes(p.id) && <span className="text-xs text-emerald-600">✓ যুক্ত</span>}
            </button>
          ))}
        </div>
      )}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selected.map((id) => (
            <Badge key={id} variant="secondary" className="cursor-pointer" onClick={() => onToggle(id)}>
              {selectedNames[id] || id.slice(0, 8)} ×
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
