import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabaseHelpers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, Download, Wallet, Info, CheckCircle2, PackageCheck, XCircle, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { fmtBDT, fmtPct, aggregate, areaKey, bucketOf, DEFAULT_RATE_MATRIX, type OrderRow, type Bucket, type AreaKey } from '@/lib/courierFinance';

interface PaymentRow {
  id: string;
  date: string;
  collected_amount: number | string | null;
  delivery_bill: number | string | null;
  cod_charge: number | string | null;
  receivable_amount: number | string | null;
  status: string | null;
  courier_provider: string | null;
}

const SELECT_COLS = 'id, date, collected_amount, delivery_bill, cod_charge, receivable_amount, status, courier_provider';

async function fetchPayments(from: Date, to: Date): Promise<PaymentRow[]> {
  return fetchAllRows<PaymentRow>(() =>
    supabase.from('courier_payments').select(SELECT_COLS)
      .gte('date', from.toISOString())
      .lte('date', to.toISOString())
  );
}

const PARCEL_COLS = 'id, created_at, status, courier_status, courier_provider, delivery_area, delivery_charge, paid_amount, free_shipping, return_pending, return_received_at, courier_entry_date';

async function fetchParcels(from: Date, to: Date): Promise<OrderRow[]> {
  return fetchAllRows<OrderRow>(() =>
    supabase.from('orders').select(PARCEL_COLS)
      .gte('courier_entry_date', from.toISOString())
      .lte('courier_entry_date', to.toISOString())
      .not('courier_entry_date', 'is', null)
  );
}

interface DeliveryCourierAnalyticsProps {
  dateRange?: { from: Date; to: Date };
}

export default function DeliveryCourierAnalytics({ dateRange }: DeliveryCourierAnalyticsProps = {}) {
  const now = new Date();
  const fallbackRange = useMemo(() => ({ from: startOfMonth(now), to: endOfMonth(now) }), []);
  const range = dateRange ?? fallbackRange;

  const { data: payments, isLoading } = useQuery({
    queryKey: ['courier-pl-from-payments', range.from.toISOString(), range.to.toISOString()],
    queryFn: () => fetchPayments(range.from, range.to),
    staleTime: 5 * 60 * 1000,
  });

  const { data: parcels, isLoading: parcelsLoading } = useQuery({
    queryKey: ['courier-pl-parcels', range.from.toISOString(), range.to.toISOString()],
    queryFn: () => fetchParcels(range.from, range.to),
    staleTime: 5 * 60 * 1000,
  });

  const parcelList = parcels || [];

  const parcelAgg = useMemo(() => aggregate(parcelList, DEFAULT_RATE_MATRIX), [parcelList]);

  // Bucket × Area matrix
  const matrix = useMemo(() => {
    const buckets: Bucket[] = ['delivered', 'partial', 'failed', 'exchange'];
    const areas: AreaKey[] = ['dhaka_inside', 'dhaka_suburb', 'dhaka_outside'];
    const m: Record<string, Record<string, number>> = {};
    buckets.forEach(b => { m[b] = { dhaka_inside: 0, dhaka_suburb: 0, dhaka_outside: 0, total: 0 }; });
    for (const o of parcelList) {
      const b = bucketOf(o);
      if (!buckets.includes(b)) {
        if (b === 'cancelled') {
          const a = areaKey(o.delivery_area);
          m.failed[a]++; m.failed.total++;
        }
        continue;
      }
      const a = areaKey(o.delivery_area);
      m[b][a]++; m[b].total++;
    }
    return m;
  }, [parcelList]);

  // Provider-wise parcel P/L
  const providerParcelRows = useMemo(() => {
    const groups: Record<string, OrderRow[]> = {};
    for (const o of parcelList) {
      const k = (o.courier_provider || 'unknown').toLowerCase();
      (groups[k] ||= []).push(o);
    }
    return Object.entries(groups).map(([k, rows]) => {
      const a = aggregate(rows, DEFAULT_RATE_MATRIX);
      const label = k === 'steadfast' ? 'Steadfast' : k === 'pathao' ? 'Pathao' : k === 'redx' ? 'RedX' : k.charAt(0).toUpperCase() + k.slice(1);
      return { key: k, label, ...a };
    }).sort((a, b) => b.totalParcels - a.totalParcels);
  }, [parcelList]);

  const list = payments || [];

  const agg = useMemo(() => {
    const num = (v: any) => Number(v) || 0;
    let collected = 0, bill = 0, cod = 0, receivable = 0, paid = 0, pending = 0;
    for (const p of list) {
      collected += num(p.collected_amount);
      bill += num(p.delivery_bill);
      cod += num(p.cod_charge);
      receivable += num(p.receivable_amount);
      if (p.status === 'Paid') paid++; else pending++;
    }
    return { collected, bill, cod, receivable, paid, pending, total: list.length };
  }, [list]);

  const providerRows = useMemo(() => {
    const groups: Record<string, PaymentRow[]> = {};
    for (const p of list) {
      const k = (p.courier_provider || 'unknown').toLowerCase();
      (groups[k] ||= []).push(p);
    }
    const num = (v: any) => Number(v) || 0;
    return Object.entries(groups).map(([k, rows]) => {
      const collected = rows.reduce((s, r) => s + num(r.collected_amount), 0);
      const bill = rows.reduce((s, r) => s + num(r.delivery_bill), 0);
      const codSum = rows.reduce((s, r) => s + num(r.cod_charge), 0);
      const recv = rows.reduce((s, r) => s + num(r.receivable_amount), 0);
      const label = k === 'steadfast' ? 'Steadfast' : k === 'pathao' ? 'Pathao' : k === 'redx' ? 'RedX' : k.charAt(0).toUpperCase() + k.slice(1);
      return { key: k, label, count: rows.length, collected, bill, cod: codSum, receivable: recv };
    }).sort((a, b) => b.collected - a.collected);
  }, [list]);

  const exportCSV = () => {
    const rows = [
      ['মেট্রিক', 'মান'],
      ['মোট ইনভয়েস', agg.total],
      ['Paid ইনভয়েস', agg.paid],
      ['Pending ইনভয়েস', agg.pending],
      ['মোট সংগৃহীত (collected)', agg.collected],
      ['কুরিয়ার ডেলিভারি বিল', agg.bill],
      ['COD চার্জ', agg.cod],
      ['মোট প্রাপ্য (net receivable)', agg.receivable],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `courier-pl-${format(range.from, 'yyyyMMdd')}-${format(range.to, 'yyyyMMdd')}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <Card className="overflow-hidden border shadow-sm">
      <CardHeader className="pb-3 pt-4 px-4 flex flex-row items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          <CardTitle className="text-base font-bold">ডেলিভারি চার্জ ও কুরিয়ার প্রফিট/লস</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={exportCSV} className="h-8 text-xs">
            <Download className="h-3.5 w-3.5 mr-1" /> CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()} className="h-8 text-xs hidden md:inline-flex">
            প্রিন্ট
          </Button>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <TooltipProvider delayDuration={150}>
            {/* Summary cards — invoice based */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard label="মোট ইনভয়েস" value={agg.total.toLocaleString('en-IN')} sub="" tone="default" />
              <SummaryCard label="Paid ইনভয়েস" value={agg.paid.toLocaleString('en-IN')} sub={agg.total ? `${((agg.paid / agg.total) * 100).toFixed(1)}%` : '0%'} tone="success" />
              <SummaryCard label="Pending ইনভয়েস" value={agg.pending.toLocaleString('en-IN')} sub={agg.total ? `${((agg.pending / agg.total) * 100).toFixed(1)}%` : '0%'} tone="warning" />
              <SummaryCard label="গড় ইনভয়েস" value={fmtBDT(agg.total ? agg.collected / agg.total : 0)} sub="" tone="default" />
            </div>

            {/* ════════ PARCEL HISHAB SECTION ════════ */}
            <div className="rounded-2xl bg-gradient-to-br from-primary/5 via-background to-accent/5 border p-4 md:p-5 space-y-5 shadow-sm">
              {/* Header */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
                    <PackageCheck className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold leading-tight">পার্সেল হিসাব</h3>
                    <p className="text-[11px] text-muted-foreground">মোট <b className="text-foreground">{parcelAgg.totalParcels.toLocaleString('en-IN')}</b> পার্সেল · {format(range.from, 'dd MMM')} — {format(range.to, 'dd MMM')}</p>
                  </div>
                </div>
                <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
                  ⚠ Approximate
                </span>
              </div>

              {parcelsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : (
                <>
                  {/* 4 status cards with gradient + icon */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatusCard icon={CheckCircle2} label="ডেলিভারি" value={parcelAgg.counts.delivered} sub={`${fmtPct(parcelAgg.successRate)} success`} from="from-emerald-50" to="to-emerald-100/50" accent="border-l-emerald-500" iconColor="text-emerald-600" />
                    <StatusCard icon={PackageCheck} label="পার্শিয়াল" value={parcelAgg.counts.partial} sub="আংশিক পেমেন্ট" from="from-blue-50" to="to-blue-100/50" accent="border-l-blue-500" iconColor="text-blue-600" />
                    <StatusCard icon={XCircle} label="ফেইল্ড" value={parcelAgg.counts.failed + parcelAgg.counts.cancelled} sub={`${fmtPct(parcelAgg.failureRate)} failure`} from="from-rose-50" to="to-rose-100/50" accent="border-l-rose-500" iconColor="text-rose-600" />
                    <StatusCard icon={RefreshCw} label="এক্সচেঞ্জ" value={parcelAgg.counts.exchange} sub={fmtPct(parcelAgg.exchangeRate)} from="from-amber-50" to="to-amber-100/50" accent="border-l-amber-500" iconColor="text-amber-600" />
                  </div>

                  {/* Area breakdown — segmented bars */}
                  <div className="rounded-xl border bg-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">এরিয়া অনুযায়ী</h4>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-sky-500"/>ঢাকা সিটি</span>
                        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-violet-500"/>সাব</span>
                        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-orange-500"/>বাইরে</span>
                      </div>
                    </div>
                    {([
                      ['delivered', 'ডেলিভারি', 'text-emerald-700'],
                      ['partial', 'পার্শিয়াল', 'text-blue-700'],
                      ['failed', 'ফেইল্ড', 'text-rose-700'],
                      ['exchange', 'এক্সচেঞ্জ', 'text-amber-700'],
                    ] as const).map(([k, label, cls]) => (
                      <AreaBar
                        key={k}
                        label={label}
                        labelCls={cls}
                        inside={matrix[k].dhaka_inside}
                        suburb={matrix[k].dhaka_suburb}
                        outside={matrix[k].dhaka_outside}
                        total={matrix[k].total}
                      />
                    ))}
                  </div>

                  {/* 3 compact P/L stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <PLStat
                      icon={TrendingDown}
                      label="কুরিয়ার বিল"
                      value={fmtBDT(parcelAgg.totalCost)}
                      tone="negative"
                      hint="Steadfast fee schedule — delivered fee + return fee"
                    />
                    <PLStat
                      icon={parcelAgg.netProfit >= 0 ? TrendingUp : TrendingDown}
                      label="নেট প্রফিট / লস"
                      value={fmtBDT(parcelAgg.netProfit)}
                      tone={parcelAgg.netProfit >= 0 ? 'positive' : 'negative'}
                      highlight
                      hint="ডেলিভারি প্রফিট + পার্শিয়াল P/L + এক্সচেঞ্জ P/L − ফেইল্ড লস"
                    />
                    <PLStat
                      icon={TrendingUp}
                      label="গড় (প্রতি পার্সেলে)"
                      value={fmtBDT(parcelAgg.totalParcels ? parcelAgg.netProfit / parcelAgg.totalParcels : 0)}
                      tone={parcelAgg.netProfit >= 0 ? 'positive' : 'negative'}
                      hint="নেট ÷ মোট পার্সেল"
                    />
                  </div>
                </>
              )}
            </div>

            {providerRows.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">কুরিয়ার অনুযায়ী</h3>
                <div className={cn('grid grid-cols-1 gap-3', providerRows.length === 1 ? 'md:grid-cols-1' : providerRows.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3')}>
                  {providerRows.map(p => (
                    <div key={p.key} className="rounded-xl border bg-card p-4">
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-sm font-semibold">{p.label}</div>
                        <div className="text-[11px] text-muted-foreground">{p.count} ইনভয়েস</div>
                      </div>
                      <div className="space-y-1 mt-2 text-xs">
                        <div className="flex justify-between"><span className="text-muted-foreground">সংগৃহীত</span><span className="font-mono">{fmtBDT(p.collected)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">বিল</span><span className="font-mono text-rose-600">−{fmtBDT(p.bill)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">COD</span><span className="font-mono text-rose-600">−{fmtBDT(p.cod)}</span></div>
                        <div className="flex justify-between border-t pt-1 mt-1"><span className="font-semibold">প্রাপ্য</span><span className={cn('font-mono font-bold', p.receivable >= 0 ? 'text-emerald-600' : 'text-rose-600')}>{fmtBDT(p.receivable)}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
}

type LucideIcon = React.ComponentType<{ className?: string }>;

function StatusCard({ icon: Icon, label, value, sub, from, to, accent, iconColor }: {
  icon: LucideIcon; label: string; value: number; sub: string;
  from: string; to: string; accent: string; iconColor: string;
}) {
  return (
    <div className={cn('relative rounded-2xl border border-l-4 p-4 bg-gradient-to-br shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5', from, to, accent)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] text-muted-foreground font-medium">{label}</div>
          <div className="text-3xl font-extrabold leading-tight mt-0.5 tabular-nums">{value.toLocaleString('en-IN')}</div>
          {sub && <div className="text-[10px] text-muted-foreground mt-1">{sub}</div>}
        </div>
        <div className={cn('h-9 w-9 rounded-xl bg-white/70 flex items-center justify-center shrink-0', iconColor)}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
    </div>
  );
}

function AreaBar({ label, labelCls, inside, suburb, outside, total }: {
  label: string; labelCls: string; inside: number; suburb: number; outside: number; total: number;
}) {
  const max = Math.max(total, 1);
  const pIn = (inside / max) * 100;
  const pSub = (suburb / max) * 100;
  const pOut = (outside / max) * 100;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className={cn('font-semibold', labelCls)}>{label}</span>
        <span className="font-mono font-bold tabular-nums">{total}</span>
      </div>
      <div className="h-7 w-full rounded-lg bg-muted/40 overflow-hidden flex">
        <Tooltip>
          <TooltipTrigger asChild>
            <div style={{ width: `${pIn}%` }} className="bg-sky-500 flex items-center justify-center text-[10px] text-white font-semibold transition-all hover:brightness-110 cursor-default">
              {pIn > 8 ? inside : ''}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">ঢাকা সিটি: {inside}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <div style={{ width: `${pSub}%` }} className="bg-violet-500 flex items-center justify-center text-[10px] text-white font-semibold transition-all hover:brightness-110 cursor-default">
              {pSub > 8 ? suburb : ''}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">ঢাকা সাব: {suburb}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <div style={{ width: `${pOut}%` }} className="bg-orange-500 flex items-center justify-center text-[10px] text-white font-semibold transition-all hover:brightness-110 cursor-default">
              {pOut > 8 ? outside : ''}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">ঢাকার বাইরে: {outside}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

function PLStat({ icon: Icon, label, value, tone, hint, highlight = false }: {
  icon: LucideIcon; label: string; value: string; tone: 'positive' | 'negative'; hint: string; highlight?: boolean;
}) {
  const toneCls = tone === 'positive' ? 'text-emerald-600' : 'text-rose-600';
  const bgCls = highlight
    ? (tone === 'positive' ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/40 border-emerald-200' : 'bg-gradient-to-br from-rose-50 to-rose-100/40 border-rose-200')
    : 'bg-card';
  return (
    <div className={cn('rounded-xl border p-4 flex items-center gap-3', bgCls, highlight && 'shadow-md')}>
      <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', highlight ? 'bg-white/70' : 'bg-muted/40', toneCls)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <span>{label}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="text-muted-foreground/60 hover:text-foreground"><Info className="h-3 w-3" /></button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px] text-xs">{hint}</TooltipContent>
          </Tooltip>
        </div>
        <div className={cn('font-mono font-bold tabular-nums truncate', highlight ? 'text-2xl' : 'text-lg', toneCls)}>{value}</div>
      </div>
    </div>
  );
}


function SummaryCard({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: 'default' | 'success' | 'danger' | 'warning' }) {
  const toneCls = {
    default: 'bg-card',
    success: 'bg-emerald-500/5 border-emerald-500/20',
    danger: 'bg-rose-500/5 border-rose-500/20',
    warning: 'bg-amber-500/5 border-amber-500/20',
  }[tone];
  const valueCls = {
    default: 'text-foreground',
    success: 'text-emerald-600',
    danger: 'text-rose-600',
    warning: 'text-amber-600',
  }[tone];
  return (
    <div className={cn('rounded-xl border p-4', toneCls)}>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={cn('text-2xl font-bold leading-tight', valueCls)}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function CalcRow({ label, value, sign, hint }: { label: string; value: number; sign: '+' | '−'; hint: string }) {
  const positive = value >= 0;
  return (
    <div className="flex items-center justify-between px-4 py-2.5 text-sm gap-3">
      <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
        <span className="truncate">{label}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="text-muted-foreground/60 hover:text-foreground shrink-0">
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[280px] text-xs">{hint}</TooltipContent>
        </Tooltip>
      </div>
      <div className={cn('font-mono font-semibold tabular-nums shrink-0', positive ? 'text-emerald-600' : 'text-rose-600')}>
        {sign} {fmtBDT(Math.abs(value))}
      </div>
    </div>
  );
}

function CalcSubtotal({ label, value, bold = false }: { label: string; value: number; bold?: boolean }) {
  const positive = value >= 0;
  return (
    <div className={cn('flex items-center justify-between px-4 py-3 bg-muted/40', bold && 'bg-muted/60')}>
      <span className={cn('text-sm', bold ? 'font-bold' : 'font-semibold')}>{label}</span>
      <span className={cn('font-mono tabular-nums', bold ? 'text-lg font-extrabold' : 'text-base font-bold', positive ? 'text-emerald-600' : 'text-rose-600')}>
        = {fmtBDT(value)}
      </span>
    </div>
  );
}
