import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { SERIES, gridProps, xAxisProps, yAxisProps, barHover, barProps, compact, TipBox, Key } from '@/components/admin/chartKit';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, subDays, startOfDay } from 'date-fns';
import { Activity, TrendingUp, Clock, Target, Flame, CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChartData {
  label: string;
  count: number;
}

interface Props {
  dailyData: ChartData[];
  monthlyData: ChartData[];
  logs: any[];
  selectedDate?: Date;
  onDateChange?: (date: Date) => void;
}

const ACTION_LABELS: Record<string, string> = {
  order_place: 'অর্ডার প্লেস',
  order_status_change: 'স্ট্যাটাস চেঞ্জ',
  order_edit: 'অর্ডার এডিট',
  note_added: 'নোট যোগ',
  item_added: 'আইটেম যোগ',
  item_deleted: 'আইটেম ডিলিট',
  order_delete: 'অর্ডার ডিলিট',
  product_create: 'প্রোডাক্ট যোগ',
  product_edit: 'প্রোডাক্ট এডিট',
  product_delete: 'প্রোডাক্ট ডিলিট',
  category_create: 'ক্যাটেগরি তৈরি',
  category_edit: 'ক্যাটেগরি এডিট',
  category_delete: 'ক্যাটেগরি ডিলিট',
  coupon_create: 'কুপন তৈরি',
  settings_change: 'সেটিংস',
  chat_reply: 'চ্যাট রিপ্লাই',
  call_action: 'কল অ্যাকশন',
  payment_update: 'পেমেন্ট আপডেট',
};

// The seven kinds of work, each with its fixed colour slot (chartKit), in stack order.
const ACTIVITY_SERIES = [
  { key: 'orderPlace', label: 'অর্ডার প্লেস' },
  { key: 'statusChange', label: 'স্ট্যাটাস চেঞ্জ' },
  { key: 'edits', label: 'এডিট' },
  { key: 'notes', label: 'নোট' },
  { key: 'calls', label: 'কল' },
  { key: 'payments', label: 'পেমেন্ট' },
  { key: 'others', label: 'অন্যান্য' },
].map((s, i) => ({ ...s, color: SERIES[i] }));

const DAILY_TARGET = 50;

export default function EmployeeActivityChart({ dailyData, monthlyData, logs, selectedDate, onDateChange }: Props) {
  const now = new Date();
  const chartDate = selectedDate || now;

  // --- Hourly stacked data for selected date (10–23) ---
  const hourlyData = useMemo(() => {
    const dayStart = startOfDay(chartDate);
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    const dayLogs = logs.filter(l => {
      const d = new Date(l.created_at);
      return d >= dayStart && d < dayEnd;
    });
    return Array.from({ length: 14 }, (_, i) => {
      const h = i + 10;
      const hLogs = dayLogs.filter(l => new Date(l.created_at).getHours() === h);
      const orderPlace = hLogs.filter(l => l.action_type === 'order_place').length;
      const statusChange = hLogs.filter(l => l.action_type === 'order_status_change').length;
      const edits = hLogs.filter(l => ['order_edit', 'product_edit', 'category_edit'].includes(l.action_type)).length;
      const notes = hLogs.filter(l => l.action_type === 'note_added').length;
      const calls = hLogs.filter(l => l.action_type === 'call_action').length;
      const payments = hLogs.filter(l => l.action_type === 'payment_update').length;
      const others = hLogs.length - orderPlace - statusChange - edits - notes - calls - payments;
      return {
        label: `${h}:00`,
        hour: h,
        orderPlace,
        statusChange,
        edits,
        notes,
        calls,
        payments,
        others,
        total: hLogs.length,
      };
    });
  }, [logs, chartDate]);

  // --- Action type breakdown (pie) ---
  const breakdownData = useMemo(() => {
    const map: Record<string, number> = {};
    logs.forEach(l => { map[l.action_type] = (map[l.action_type] || 0) + 1; });
    return Object.entries(map)
      .map(([name, value]) => ({ name: ACTION_LABELS[name] || name.replace(/_/g, ' '), value }))
      .sort((a, b) => b.value - a.value);
  }, [logs]);

  const breakdownMax = Math.max(1, ...breakdownData.map(d => d.value));
  const peakHour = hourlyData.reduce((best, row, i) => (row.total > (hourlyData[best]?.total ?? 0) ? i : best), -1);

  // --- Performance score ---
  const performance = useMemo(() => {
    const todayStart = startOfDay(now);
    const todayCount = logs.filter(l => new Date(l.created_at) >= todayStart).length;

    // Last 7 days
    const last7Start = subDays(now, 7);
    const last7 = logs.filter(l => new Date(l.created_at) >= last7Start).length;
    const avg7 = Math.round(last7 / 7);

    // Last 30 days
    const last30Start = subDays(now, 30);
    const last30 = logs.filter(l => new Date(l.created_at) >= last30Start).length;
    const avg30 = Math.round(last30 / 30);

    // Peak day
    const dayMap: Record<string, number> = {};
    logs.forEach(l => {
      const d = format(new Date(l.created_at), 'yyyy-MM-dd');
      dayMap[d] = (dayMap[d] || 0) + 1;
    });
    let peakDay = '-';
    let peakCount = 0;
    Object.entries(dayMap).forEach(([day, count]) => {
      if (count > peakCount) { peakCount = count; peakDay = day; }
    });

    return { todayCount, avg7, avg30, peakDay, peakCount };
  }, [logs]);

  // --- 7-day breakdown table ---
  const weeklyBreakdown = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const day = subDays(now, i);
      const dayStart = startOfDay(day);
      const dayEnd = new Date(dayStart.getTime() + 86400000);
      const dayLogs = logs.filter(l => {
        const d = new Date(l.created_at);
        return d >= dayStart && d < dayEnd;
      });
      const statusChange = dayLogs.filter(l => l.action_type === 'order_status_change').length;
      const edits = dayLogs.filter(l => ['order_edit', 'product_edit', 'category_edit'].includes(l.action_type)).length;
      const notes = dayLogs.filter(l => l.action_type === 'note_added').length;
      const others = dayLogs.length - statusChange - edits - notes;
      return {
        date: format(day, 'dd/MM (EEE)'),
        total: dayLogs.length,
        statusChange,
        edits,
        notes,
        others,
      };
    });
  }, [logs]);

  const getColor = (val: number) => {
    if (val >= DAILY_TARGET) return 'text-emerald-500';
    if (val >= DAILY_TARGET * 0.5) return 'text-amber-500';
    return 'text-destructive';
  };

  const getBadge = (val: number) => {
    if (val >= DAILY_TARGET) return <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-200">ভালো</Badge>;
    if (val >= DAILY_TARGET * 0.5) return <Badge className="bg-accent text-accent-foreground border-accent">মাঝারি</Badge>;
    return <Badge variant="destructive" className="bg-destructive/10">কম</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Performance Score */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Target className="h-4 w-4" /> কর্মক্ষমতা সামারি
            <span className="text-[10px] text-muted-foreground font-normal">(টার্গেট: {DAILY_TARGET}/দিন)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className={`text-2xl font-bold ${getColor(performance.todayCount)}`}>{performance.todayCount}</p>
              <p className="text-[11px] text-muted-foreground">আজ</p>
              {getBadge(performance.todayCount)}
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className={`text-2xl font-bold ${getColor(performance.avg7)}`}>{performance.avg7}</p>
              <p className="text-[11px] text-muted-foreground">৭ দিনের গড়/দিন</p>
              {getBadge(performance.avg7)}
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className={`text-2xl font-bold ${getColor(performance.avg30)}`}>{performance.avg30}</p>
              <p className="text-[11px] text-muted-foreground">৩০ দিনের গড়/দিন</p>
              {getBadge(performance.avg30)}
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className="flex items-center justify-center gap-1">
                <Flame className="h-4 w-4 text-orange-500" />
                <p className="text-2xl font-bold">{performance.peakCount}</p>
              </div>
              <p className="text-[11px] text-muted-foreground">সর্বোচ্চ দিন</p>
              <p className="text-[10px] text-muted-foreground">{performance.peakDay !== '-' ? format(new Date(performance.peakDay), 'dd MMM') : '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hourly Stacked Chart — Full Width */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" /> ঘণ্টাভিত্তিক Activity (সকাল ১০টা — রাত ১২টা)
            </CardTitle>
            {onDateChange && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {format(chartDate, 'dd MMM yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={chartDate}
                    onSelect={(d) => d && onDateChange(d)}
                    disabled={(d) => d > new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>
          <div className="flex flex-wrap gap-3 mt-2">
            {ACTIVITY_SERIES.map(item => <Key key={item.key} shape="box" color={item.color} label={item.label} />)}
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={hourlyData} margin={{ top: 18, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" {...xAxisProps} />
              <YAxis {...yAxisProps} allowDecimals={false} width={32} tickFormatter={compact} />
              <Tooltip
                cursor={barHover}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload;
                  return (
                    <TipBox
                      title={String(label ?? '')}
                      rows={ACTIVITY_SERIES.filter(x => d?.[x.key]).map(x => ({ color: x.color, value: d[x.key], name: x.label }))}
                      footer={<>{d?.total ?? 0} মোট</>}
                    />
                  );
                }}
              />
              {ACTIVITY_SERIES.map((x, i) => (
                // A 2px card-coloured edge keeps the gap between stacked parts.
                <Bar key={x.key} dataKey={x.key} stackId="a" fill={x.color} stroke="hsl(var(--card))" strokeWidth={2} maxBarSize={24}
                  radius={i === ACTIVITY_SERIES.length - 1 ? [4, 4, 0, 0] : 0} isAnimationActive={false}>
                  {i === ACTIVITY_SERIES.length - 1 && (
                    // Only the busiest hour gets its total printed; the table below has every hour.
                    <LabelList dataKey="total" content={({ x: lx, y: ly, width, index }) =>
                      index === peakHour ? (
                        <text x={Number(lx) + Number(width) / 2} y={Number(ly) - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill="hsl(var(--foreground))">
                          {hourlyData[index]?.total}
                        </text>
                      ) : null} />
                  )}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>

          {/* Hourly Breakdown Table */}
          <div className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">ঘণ্টা</TableHead>
                  <TableHead className="text-xs text-center">মোট</TableHead>
                  <TableHead className="text-xs text-center">প্লেস</TableHead>
                  <TableHead className="text-xs text-center">স্ট্যাটাস</TableHead>
                  <TableHead className="text-xs text-center">এডিট</TableHead>
                  <TableHead className="text-xs text-center">নোট</TableHead>
                  <TableHead className="text-xs text-center">কল</TableHead>
                  <TableHead className="text-xs text-center">পেমেন্ট</TableHead>
                  <TableHead className="text-xs text-center">অন্যান্য</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hourlyData.map(row => (
                  <TableRow key={row.hour}>
                    <TableCell className="text-xs font-medium">{row.label}</TableCell>
                    <TableCell className="text-xs text-center font-bold">{row.total || '-'}</TableCell>
                    <TableCell className="text-xs text-center">{row.orderPlace || '-'}</TableCell>
                    <TableCell className="text-xs text-center">{row.statusChange || '-'}</TableCell>
                    <TableCell className="text-xs text-center">{row.edits || '-'}</TableCell>
                    <TableCell className="text-xs text-center">{row.notes || '-'}</TableCell>
                    <TableCell className="text-xs text-center">{row.calls || '-'}</TableCell>
                    <TableCell className="text-xs text-center">{row.payments || '-'}</TableCell>
                    <TableCell className="text-xs text-center">{row.others || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Activity Breakdown Pie */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" /> Activity ব্রেকডাউন (সর্বমোট)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {breakdownData.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">কোনো ডেটা নেই</p>
          ) : (
            // Ranked bars: easier to compare than a ring, and one colour, so no colour repeats.
            <div className="space-y-1.5 text-xs max-h-[220px] overflow-y-auto pr-1">
              {breakdownData.map(d => (
                <div key={d.name} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2">
                  <span className="truncate text-muted-foreground">{d.name}</span>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(d.value / breakdownMax) * 100}%`, background: SERIES[0] }} />
                  </div>
                  <span className="font-semibold tabular-nums text-right min-w-[2.5rem]">{d.value.toLocaleString('bn-BD')}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Daily charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">দৈনিক Activity (৩০ দিন)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dailyData} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" {...xAxisProps} interval={4} />
                <YAxis {...yAxisProps} allowDecimals={false} width={32} tickFormatter={compact} />
                <Tooltip cursor={barHover} content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return <TipBox title={String(label ?? '')} rows={[{ color: SERIES[0], value: Number(payload[0]?.value) || 0, name: "Activity" }]} />;
                }} />
                <Bar dataKey="count" fill={SERIES[0]} {...barProps} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">মাসিক Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={monthlyData} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" {...xAxisProps} />
                <YAxis {...yAxisProps} allowDecimals={false} width={32} tickFormatter={compact} />
                <Tooltip cursor={barHover} content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return <TipBox title={String(label ?? '')} rows={[{ color: SERIES[0], value: Number(payload[0]?.value) || 0, name: "Activity" }]} />;
                }} />
                <Bar dataKey="count" fill={SERIES[0]} {...barProps} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Breakdown Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> সাপ্তাহিক ব্রেকডাউন
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">তারিখ</TableHead>
                <TableHead className="text-xs text-center">মোট</TableHead>
                <TableHead className="text-xs text-center">স্ট্যাটাস</TableHead>
                <TableHead className="text-xs text-center">এডিট</TableHead>
                <TableHead className="text-xs text-center">নোট</TableHead>
                <TableHead className="text-xs text-center">অন্যান্য</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {weeklyBreakdown.map(row => (
                <TableRow key={row.date}>
                  <TableCell className="text-xs font-medium">{row.date}</TableCell>
                  <TableCell className="text-xs text-center">
                    <span className={`font-bold ${getColor(row.total)}`}>{row.total}</span>
                  </TableCell>
                  <TableCell className="text-xs text-center">{row.statusChange}</TableCell>
                  <TableCell className="text-xs text-center">{row.edits}</TableCell>
                  <TableCell className="text-xs text-center">{row.notes}</TableCell>
                  <TableCell className="text-xs text-center">{row.others}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
