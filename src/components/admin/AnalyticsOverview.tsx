import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabaseHelpers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { Loader2, Facebook, Globe, MessageCircle, Instagram, Video, Phone, Search, Truck, CalendarIcon } from 'lucide-react';
import { format, subDays, subMonths, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { bn } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

type TabKey = 'today' | 'weekly' | 'monthly' | 'yearly' | 'custom';

function getDateRange(tab: TabKey, selectedMonth?: string, selectedYear?: number, customFrom?: Date, customTo?: Date) {
  const now = new Date();
  switch (tab) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'weekly':
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case 'monthly': {
      if (selectedMonth) {
        const [y, m] = selectedMonth.split('-').map(Number);
        const d = new Date(y, m - 1, 1);
        return { from: startOfMonth(d), to: endOfMonth(d) };
      }
      return { from: startOfMonth(now), to: endOfMonth(now) };
    }
    case 'yearly': {
      if (selectedYear) {
        const d = new Date(selectedYear, 0, 1);
        return { from: startOfYear(d), to: endOfYear(d) };
      }
      return { from: startOfYear(now), to: endOfYear(now) };
    }
    case 'custom': {
      if (customFrom && customTo) {
        return { from: startOfDay(customFrom), to: endOfDay(customTo) };
      }
      return { from: startOfDay(subDays(now, 7)), to: endOfDay(now) };
    }
  }
}

const CONFIRMED_STATUSES = ['confirmed', 'shipped', 'delivered'];

const SOURCE_CONFIG = [
  { key: 'facebook', label: 'Facebook', icon: Facebook, color: '#1877F2' },
  { key: 'google', label: 'Google', icon: Search, color: '#4285F4' },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: '#25D366' },
  { key: 'instagram', label: 'Instagram', icon: Instagram, color: '#E4405F' },
  { key: 'tiktok', label: 'TikTok', icon: Video, color: '#000000' },
  { key: 'messenger', label: 'Messenger', icon: MessageCircle, color: '#0084FF' },
  { key: 'imo', label: 'IMO', icon: MessageCircle, color: '#0078FF' },
  { key: 'website', label: 'Website', icon: Globe, color: 'hsl(var(--primary))' },
  { key: 'manual', label: 'ম্যানুয়াল (কল)', icon: Phone, color: '#F59E0B' },
];

function getMonthOptions() {
  const now = new Date();
  const options: { value: string; label: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = subMonths(now, i);
    options.push({
      value: format(d, 'yyyy-MM'),
      label: format(d, 'MMMM yyyy', { locale: bn }),
    });
  }
  return options;
}

function getYearOptions() {
  const currentYear = new Date().getFullYear();
  const options: { value: number; label: string }[] = [];
  for (let y = currentYear; y >= 2024; y--) {
    options.push({ value: y, label: `${y}` });
  }
  return options;
}

// Scrollable chart wrapper for mobile
function ScrollableChart({ children, dataLength, isMobile, height = 220 }: {
  children: React.ReactNode;
  dataLength: number;
  isMobile: boolean;
  height?: number;
}) {
  if (!isMobile) {
    return (
      <div className="overflow-hidden">
        <ResponsiveContainer width="100%" height={height}>
          {children as any}
        </ResponsiveContainer>
      </div>
    );
  }

  const chartWidth = Math.max(dataLength * 48, 320);
  return (
    <div className="overflow-x-auto -mx-1 pb-1">
      <div style={{ width: chartWidth, height }}>
        {children}
      </div>
    </div>
  );
}

interface AnalyticsOverviewProps {
  onRangeChange?: (range: { from: Date; to: Date }) => void;
}

export default function AnalyticsOverview({ onRangeChange }: AnalyticsOverviewProps = {}) {
  const now = new Date();
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<TabKey>('today');
  const [selectedMonth, setSelectedMonth] = useState(format(now, 'yyyy-MM'));
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [customFrom, setCustomFrom] = useState<Date | undefined>(subDays(now, 7));
  const [customTo, setCustomTo] = useState<Date | undefined>(now);

  const range = useMemo(() => getDateRange(tab, selectedMonth, selectedYear, customFrom, customTo), [tab, selectedMonth, selectedYear, customFrom, customTo]);

  useEffect(() => {
    onRangeChange?.({ from: range.from, to: range.to });
  }, [range.from, range.to, onRangeChange]);

  const { data, isLoading } = useQuery({
    queryKey: ['analytics-overview', tab, selectedMonth, selectedYear, customFrom?.toISOString(), customTo?.toISOString()],
    queryFn: async () => {
      const [list, { count: visitorCount }, courierList] = await Promise.all([
        fetchAllRows(() =>
          supabase
            .from('orders')
            .select('id, total, status, created_at, order_origin')
            .gte('created_at', range.from.toISOString())
            .lte('created_at', range.to.toISOString())
        ),
        supabase
          .from('site_visits')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', range.from.toISOString())
          .lte('created_at', range.to.toISOString()),
        fetchAllRows(() =>
          supabase
            .from('courier_payments')
            .select('id, collected_amount, delivery_bill, cod_charge, receivable_amount, status, date')
            .gte('date', range.from.toISOString())
            .lte('date', range.to.toISOString())
        ),
      ]);
      const totalOrders = list.length;
      const successOrders = list.filter(o => CONFIRMED_STATUSES.includes(o.status)).length;
      const cancelledCount = list.filter(o => o.status === 'cancelled').length;
      const totalRevenue = list.reduce((s, o) => s + Number(o.total), 0);
      const confirmedRevenue = list
        .filter(o => CONFIRMED_STATUSES.includes(o.status))
        .reduce((s, o) => s + Number(o.total), 0);
      const visitors = visitorCount || 0;
      const conversion = visitors > 0 ? (totalOrders / visitors * 100).toFixed(1) : '0';

      const chartData = tab === 'custom'
        ? buildCustomChartData(list, range.from, range.to)
        : buildChartData(list, tab, range.from, selectedMonth, selectedYear);

      const sourceStats: Record<string, { total: number; confirmed: number; cancelled: number }> = {};
      for (const o of list) {
        const origin = (o.order_origin || 'website').toLowerCase();
        const parts = origin.split('+');
        const src = origin === 'manual+facebook'
          ? 'messenger'
          : (parts.length > 1 ? parts[parts.length - 1] : origin);
        if (!sourceStats[src]) sourceStats[src] = { total: 0, confirmed: 0, cancelled: 0 };
        sourceStats[src].total++;
        if (CONFIRMED_STATUSES.includes(o.status)) sourceStats[src].confirmed++;
        if (o.status === 'cancelled') sourceStats[src].cancelled++;
      }

      // Courier analytics
      const courierMetrics = {
        totalCollected: courierList.reduce((s, c) => s + Number(c.collected_amount), 0),
        totalBill: courierList.reduce((s, c) => s + Number(c.delivery_bill), 0),
        totalCOD: courierList.reduce((s, c) => s + Number(c.cod_charge), 0),
        totalReceivable: courierList.reduce((s, c) => s + Number(c.receivable_amount), 0),
        paidCount: courierList.filter(c => c.status === 'Paid').length,
        pendingCount: courierList.filter(c => c.status !== 'Paid').length,
        totalPayments: courierList.length,
      };

      const courierChartData = tab === 'custom'
        ? buildCustomCourierChartData(courierList, range.from, range.to)
        : buildCourierChartData(courierList, tab, range.from, selectedMonth, selectedYear);

      return { totalOrders, successOrders, cancelledCount, totalRevenue, confirmedRevenue, visitors, conversion, chartData, sourceStats, courierMetrics, courierChartData };
    },
    staleTime: 5 * 60 * 1000, // 5 min — analytics aggregates don't need realtime
    gcTime: 60 * 60 * 1000,
  });

  const handleTabChange = (v: string) => {
    setTab(v as TabKey);
  };

  const monthOptions = useMemo(() => getMonthOptions(), []);
  const yearOptions = useMemo(() => getYearOptions(), []);

  const chartDataLength = data?.chartData?.length || 0;
  const courierChartDataLength = data?.courierChartData?.length || 0;

  return (
    <Card>
      <CardHeader className="pb-1 pt-3 px-3">
        <CardTitle className="text-sm font-semibold">এনালিটিক্স ওভারভিউ</CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-1">
        <Tabs value={tab} onValueChange={handleTabChange}>
          <TabsList className="w-full h-8 mb-2">
            <TabsTrigger value="today" className="text-xs flex-1 h-7">আজ</TabsTrigger>
            <TabsTrigger value="weekly" className="text-xs flex-1 h-7">সাপ্তাহিক</TabsTrigger>
            <TabsTrigger value="monthly" className="text-xs flex-1 h-7">মাসিক</TabsTrigger>
            <TabsTrigger value="yearly" className="text-xs flex-1 h-7">বাৎসরিক</TabsTrigger>
            <TabsTrigger value="custom" className="text-xs flex-1 h-7">কাস্টম</TabsTrigger>
          </TabsList>

          {/* Month/Year selector */}
          {tab === 'monthly' && (
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="h-8 text-xs mb-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map(o => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {tab === 'yearly' && (
            <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
              <SelectTrigger className="h-8 text-xs mb-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map(o => (
                  <SelectItem key={o.value} value={String(o.value)} className="text-xs">{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Custom date range picker */}
          {tab === 'custom' && (
            <div className="flex items-center gap-2 mb-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("h-8 text-xs flex-1 justify-start", !customFrom && "text-muted-foreground")}>
                    <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                    {customFrom ? format(customFrom, 'dd MMM yyyy', { locale: bn }) : 'শুরু'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customFrom}
                    onSelect={setCustomFrom}
                    disabled={(date) => date > new Date() || (customTo ? date > customTo : false)}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <span className="text-xs text-muted-foreground">—</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("h-8 text-xs flex-1 justify-start", !customTo && "text-muted-foreground")}>
                    <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                    {customTo ? format(customTo, 'dd MMM yyyy', { locale: bn }) : 'শেষ'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={customTo}
                    onSelect={setCustomTo}
                    disabled={(date) => date > new Date() || (customFrom ? date < customFrom : false)}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <MetricBox label="অর্ডার" value={data?.totalOrders || 0} />
                <MetricBox label="সফল অর্ডার" value={data?.successOrders || 0} />
                <MetricBox label="ক্যান্সেল" value={data?.cancelledCount || 0} />
                <MetricBox label="মোট বিক্রি" value={`৳${(data?.totalRevenue || 0).toLocaleString('bn-BD')}`} small />
                <MetricBox label="কনফার্মড বিক্রি" value={`৳${(data?.confirmedRevenue || 0).toLocaleString('bn-BD')}`} small />
                <MetricBox label="কনভার্সন" value={`${data?.conversion || '0'}%`} sub={`${(data?.visitors || 0).toLocaleString('bn-BD')} ভিজিটর`} />
              </div>

              {/* Chart */}
              <ScrollableChart dataLength={chartDataLength} isMobile={isMobile} height={220}>
                <AreaChart data={data?.chartData || []} width={isMobile ? Math.max(chartDataLength * 48, 320) : undefined} height={220} margin={{ left: -5, right: 5, top: 32, bottom: 0 }}>
                  <defs>
                    <linearGradient id="analyticsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" interval={isMobile ? 0 : 'preserveStartEnd'} />
                  <YAxis width={38} tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                  <Tooltip content={() => null} />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#analyticsGrad)">
                    <LabelList
                      dataKey="revenue"
                      content={({ x, y, value, index }: any) => {
                        const v = Number(value) || 0;
                        const revenueLabel = v >= 1000 ? `৳${(v / 1000).toFixed(1)}k` : `৳${v}`;
                        const orders = (data?.chartData || [])[index]?.orders || 0;
                        return (
                          <g>
                            <text x={x} y={(y || 0) - 18} textAnchor="middle" fontSize={11} fill="hsl(var(--primary))" fontWeight={600}>
                              {revenueLabel}
                            </text>
                            <text x={x} y={(y || 0) - 6} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))" fontWeight={500}>
                              {orders}টি
                            </text>
                          </g>
                        );
                      }}
                    />
                  </Area>
                </AreaChart>
              </ScrollableChart>

              {/* Order Source Breakdown */}
              <SourceBreakdown data={data} />

              {/* Courier Analytics */}
              <CourierAnalytics metrics={data?.courierMetrics} chartData={data?.courierChartData} isMobile={isMobile} courierChartDataLength={courierChartDataLength} />
            </>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}

function CourierAnalytics({ metrics, chartData, isMobile, courierChartDataLength }: {
  metrics?: { totalCollected: number; totalBill: number; totalCOD: number; totalReceivable: number; paidCount: number; pendingCount: number; totalPayments: number };
  chartData?: { label: string; receivable: number; payments: number }[];
  isMobile: boolean;
  courierChartDataLength: number;
}) {
  if (!metrics || metrics.totalPayments === 0) return null;

  const paidPct = metrics.totalPayments > 0 ? ((metrics.paidCount / metrics.totalPayments) * 100).toFixed(0) : '0';
  const pendingPct = metrics.totalPayments > 0 ? ((metrics.pendingCount / metrics.totalPayments) * 100).toFixed(0) : '0';

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-2">
        <Truck className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs font-semibold">কুরিয়ার এনালিটিক্স</p>
        <div className="flex items-center gap-1.5 ml-auto">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-green-500/10 text-green-600 border-green-200">
            Paid: {metrics.paidCount} ({paidPct}%)
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-amber-500/10 text-amber-600 border-amber-200">
            Pending: {metrics.pendingCount} ({pendingPct}%)
          </Badge>
        </div>
      </div>

      {/* Courier Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <MetricBox label="মোট সংগৃহীত" value={`৳${metrics.totalCollected.toLocaleString('bn-BD')}`} small />
        <MetricBox label="ডেলিভারি বিল" value={`৳${metrics.totalBill.toLocaleString('bn-BD')}`} small />
        <MetricBox label="COD চার্জ" value={`৳${metrics.totalCOD.toLocaleString('bn-BD')}`} small />
        <MetricBox label="মোট প্রাপ্য" value={`৳${metrics.totalReceivable.toLocaleString('bn-BD')}`} small />
      </div>

      {/* Courier Chart */}
      {chartData && chartData.length > 0 && (
        <ScrollableChart dataLength={courierChartDataLength} isMobile={isMobile} height={180}>
          <AreaChart data={chartData} width={isMobile ? Math.max(courierChartDataLength * 48, 320) : undefined} height={180} margin={{ left: -5, right: 5, top: 28, bottom: 0 }}>
            <defs>
              <linearGradient id="courierGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.4} />
                <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" interval={isMobile ? 0 : 'preserveStartEnd'} />
            <YAxis width={38} tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
            <Tooltip content={() => null} />
            <Area type="monotone" dataKey="receivable" stroke="hsl(var(--chart-2))" strokeWidth={2.5} fill="url(#courierGrad)">
              <LabelList
                dataKey="receivable"
                content={({ x, y, value, index }: any) => {
                  const v = Number(value) || 0;
                  if (v === 0) return null;
                  const label = v >= 1000 ? `৳${(v / 1000).toFixed(1)}k` : `৳${v}`;
                  const payments = (chartData || [])[index]?.payments || 0;
                  return (
                    <g>
                      <text x={x} y={(y || 0) - 18} textAnchor="middle" fontSize={10} fill="hsl(var(--chart-2))" fontWeight={600}>
                        {label}
                      </text>
                      <text x={x} y={(y || 0) - 6} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))" fontWeight={500}>
                        {payments}টি
                      </text>
                    </g>
                  );
                }}
              />
            </Area>
          </AreaChart>
        </ScrollableChart>
      )}
    </div>
  );
}

function SourceBreakdown({ data }: { data: { totalOrders: number; successOrders: number; cancelledCount: number; sourceStats: Record<string, { total: number; confirmed: number; cancelled: number }> } | undefined }) {
  if (!data) return null;
  const { totalOrders, successOrders, cancelledCount, sourceStats } = data;
  const successPct = totalOrders > 0 ? ((successOrders / totalOrders) * 100).toFixed(1) : '0';
  const cancelPct = totalOrders > 0 ? ((cancelledCount / totalOrders) * 100).toFixed(1) : '0';

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs font-semibold">অর্ডার সোর্স</p>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>মোট: <span className="font-semibold text-foreground">{totalOrders}</span></span>
          <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />{successOrders} ({successPct}%)</span>
          <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />{cancelledCount} ({cancelPct}%)</span>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {SOURCE_CONFIG.filter(s => (sourceStats[s.key]?.total || 0) > 0).map(s => {
          const stats = sourceStats[s.key] || { total: 0, confirmed: 0, cancelled: 0 };
          const pct = totalOrders > 0 ? ((stats.total / totalOrders) * 100).toFixed(1) : '0';
          const confPct = stats.total > 0 ? ((stats.confirmed / stats.total) * 100).toFixed(1) : '0';
          const canPct = stats.total > 0 ? ((stats.cancelled / stats.total) * 100).toFixed(1) : '0';
          return (
            <div key={s.key} className="flex items-center gap-2 rounded-lg border bg-background px-2.5 py-2">
              <div className="h-8 w-8 rounded-md flex items-center justify-center shrink-0 bg-muted/40">
                <s.icon className="h-5 w-5" style={{ color: s.color }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-bold">{stats.total}</span>
                  <span className="text-[9px] text-muted-foreground">({pct}%)</span>
                </div>
                <div className="flex items-center gap-2 text-[9px] text-muted-foreground mt-0.5">
                  <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />{stats.confirmed} ({confPct}%)</span>
                  <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />{stats.cancelled} ({canPct}%)</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricBox({ label, value, small, sub }: { label: string; value: string | number; small?: boolean; sub?: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-2 text-center">
      <p className={`font-bold ${small ? 'text-sm' : 'text-lg'} truncate`}>{value}</p>
      <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
      {sub && <p className="text-[9px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function buildChartData(
  orders: { created_at: string; total: number }[],
  tab: TabKey,
  from: Date,
  selectedMonth?: string,
  selectedYear?: number
) {
  if (tab === 'today') {
    const hours: { label: string; fullLabel: string; revenue: number; orders: number }[] = [];
    for (let i = 0; i < 24; i++) {
      const hStart = new Date(from);
      hStart.setHours(i, 0, 0, 0);
      const hEnd = new Date(hStart);
      hEnd.setHours(i + 1);
      const filtered = orders.filter(o => {
        const d = new Date(o.created_at);
        return d >= hStart && d < hEnd;
      });
      hours.push({
        label: hStart.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }).toLowerCase(),
        fullLabel: format(hStart, 'h:mm a', { locale: bn }),
        revenue: filtered.reduce((s, o) => s + Number(o.total), 0),
        orders: filtered.length,
      });
    }
    return hours;
  }

  if (tab === 'yearly') {
    const months: { label: string; fullLabel: string; revenue: number; orders: number }[] = [];
    const year = selectedYear || new Date().getFullYear();
    for (let m = 0; m < 12; m++) {
      const filtered = orders.filter(o => {
        const od = new Date(o.created_at);
        return od.getMonth() === m && od.getFullYear() === year;
      });
      months.push({
        label: format(new Date(year, m, 1), 'MMM', { locale: bn }),
        fullLabel: format(new Date(year, m, 1), 'MMMM', { locale: bn }),
        revenue: filtered.reduce((s, o) => s + Number(o.total), 0),
        orders: filtered.length,
      });
    }
    return months;
  }

  if (tab === 'monthly' && selectedMonth) {
    const [y, m] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const result: { label: string; fullLabel: string; revenue: number; orders: number }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(y, m - 1, d);
      const dayStr = format(date, 'yyyy-MM-dd');
      const filtered = orders.filter(o => format(new Date(o.created_at), 'yyyy-MM-dd') === dayStr);
      result.push({
        label: `${d}`,
        fullLabel: format(date, 'dd MMMM', { locale: bn }),
        revenue: filtered.reduce((s, o) => s + Number(o.total), 0),
        orders: filtered.length,
      });
    }
    return result;
  }

  // weekly / monthly fallback — day-based
  const days = tab === 'weekly' ? 7 : 30;
  const result: { label: string; fullLabel: string; revenue: number; orders: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = subDays(new Date(), days - 1 - i);
    const dayStr = format(d, 'yyyy-MM-dd');
    const filtered = orders.filter(o => format(new Date(o.created_at), 'yyyy-MM-dd') === dayStr);
    result.push({
      label: format(d, 'dd/MM'),
      fullLabel: format(d, 'dd MMM', { locale: bn }),
      revenue: filtered.reduce((s, o) => s + Number(o.total), 0),
      orders: filtered.length,
    });
  }
  return result;
}

function buildCustomChartData(orders: { created_at: string; total: number }[], from: Date, to: Date) {
  const result: { label: string; fullLabel: string; revenue: number; orders: number }[] = [];
  const current = new Date(from);
  while (current <= to) {
    const dayStr = format(current, 'yyyy-MM-dd');
    const filtered = orders.filter(o => format(new Date(o.created_at), 'yyyy-MM-dd') === dayStr);
    result.push({
      label: format(current, 'dd/MM'),
      fullLabel: format(current, 'dd MMM', { locale: bn }),
      revenue: filtered.reduce((s, o) => s + Number(o.total), 0),
      orders: filtered.length,
    });
    current.setDate(current.getDate() + 1);
  }
  return result;
}

function buildCourierChartData(
  payments: { date: string; receivable_amount: number }[],
  tab: TabKey,
  from: Date,
  selectedMonth?: string,
  selectedYear?: number
) {
  if (tab === 'today') {
    const hours: { label: string; receivable: number; payments: number }[] = [];
    for (let i = 0; i < 24; i++) {
      const hStart = new Date(from);
      hStart.setHours(i, 0, 0, 0);
      const hEnd = new Date(hStart);
      hEnd.setHours(i + 1);
      const filtered = payments.filter(p => {
        const d = new Date(p.date);
        return d >= hStart && d < hEnd;
      });
      hours.push({
        label: hStart.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }).toLowerCase(),
        receivable: filtered.reduce((s, p) => s + Number(p.receivable_amount), 0),
        payments: filtered.length,
      });
    }
    return hours;
  }

  if (tab === 'yearly') {
    const months: { label: string; receivable: number; payments: number }[] = [];
    const year = selectedYear || new Date().getFullYear();
    for (let m = 0; m < 12; m++) {
      const filtered = payments.filter(p => {
        const pd = new Date(p.date);
        return pd.getMonth() === m && pd.getFullYear() === year;
      });
      months.push({
        label: format(new Date(year, m, 1), 'MMM', { locale: bn }),
        receivable: filtered.reduce((s, p) => s + Number(p.receivable_amount), 0),
        payments: filtered.length,
      });
    }
    return months;
  }

  if (tab === 'monthly' && selectedMonth) {
    const [y, m] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const result: { label: string; receivable: number; payments: number }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(y, m - 1, d);
      const dayStr = format(date, 'yyyy-MM-dd');
      const filtered = payments.filter(p => format(new Date(p.date), 'yyyy-MM-dd') === dayStr);
      result.push({
        label: `${d}`,
        receivable: filtered.reduce((s, p) => s + Number(p.receivable_amount), 0),
        payments: filtered.length,
      });
    }
    return result;
  }

  const days = tab === 'weekly' ? 7 : 30;
  const result: { label: string; receivable: number; payments: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = subDays(new Date(), days - 1 - i);
    const dayStr = format(d, 'yyyy-MM-dd');
    const filtered = payments.filter(p => format(new Date(p.date), 'yyyy-MM-dd') === dayStr);
    result.push({
      label: format(d, 'dd/MM'),
      receivable: filtered.reduce((s, p) => s + Number(p.receivable_amount), 0),
      payments: filtered.length,
    });
  }
  return result;
}

function buildCustomCourierChartData(payments: { date: string; receivable_amount: number }[], from: Date, to: Date) {
  const result: { label: string; receivable: number; payments: number }[] = [];
  const current = new Date(from);
  while (current <= to) {
    const dayStr = format(current, 'yyyy-MM-dd');
    const filtered = payments.filter(p => format(new Date(p.date), 'yyyy-MM-dd') === dayStr);
    result.push({
      label: format(current, 'dd/MM'),
      receivable: filtered.reduce((s, p) => s + Number(p.receivable_amount), 0),
      payments: filtered.length,
    });
    current.setDate(current.getDate() + 1);
  }
  return result;
}
