import { useEffect, useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, Repeat, Trophy, MapPin, ChevronRight, User, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getLoyaltyTier } from '@/lib/customerLoyalty';
import { useLoyaltyTiers } from '@/hooks/useLoyaltyTiers';

interface CustomerRow { name: string; address: string; total_orders: number; delivered_orders?: number; total_spent?: number; avatar_url?: string | null }
interface RecentCustomer { name: string; address: string; total_orders: number; delivered_orders?: number; total_spent?: number; avatar_url?: string | null; created_at: string | null }
interface ShowcaseData {
  total: number;
  repeat: number;
  top: CustomerRow[];
}

function useAnimatedNumber(target: number, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!target) { setVal(0); return; }
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

function formatTimeAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'এইমাত্র';
  if (m < 60) return `${m} মিনিট আগে`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ঘন্টা আগে`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} দিন আগে`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} মাস আগে`;
  return `${Math.floor(mo / 12)} বছর আগে`;
}

export default function CustomerShowcaseSection() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['customer-showcase'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_customer_showcase');
      if (error) throw error;
      return data as unknown as ShowcaseData;
    },
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const [listOpen, setListOpen] = useState<null | 'all' | 'repeat' | 'top'>(null);

  const { data: recent = [], isLoading: recentLoading } = useQuery({
    queryKey: ['customers-recent', listOpen === 'repeat' ? 'repeat' : 'all'],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_customers_recent', {
        p_repeat_only: listOpen === 'repeat',
      });
      if (error) throw error;
      return (data || []) as RecentCustomer[];
    },
    enabled: listOpen === 'all' || listOpen === 'repeat',
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    const channel = supabase
      .channel('customer-showcase-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'customers' }, () => {
        queryClient.invalidateQueries({ queryKey: ['customer-showcase'] });
        queryClient.invalidateQueries({ queryKey: ['customers-recent'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const total = data?.total || 0;
  const repeat = data?.repeat || 0;
  const top = data?.top || [];
  const preview = top.slice(0, 5);

  const animTotal = useAnimatedNumber(total);
  const animRepeat = useAnimatedNumber(repeat);

  const filteredRecent = useMemo(() => {
    if (listOpen === 'repeat') return recent.filter(c => (c.total_orders || 0) > 1);
    return recent;
  }, [recent, listOpen]);

  const dialogTitle =
    listOpen === 'repeat' ? 'রিপিট কাস্টমার'
    : listOpen === 'top' ? 'টপ ১০০ কাস্টমার'
    : 'সকল রেজিস্টার্ড কাস্টমার';

  return (
    <section className="py-10 sm:py-12 bg-gradient-to-b from-background via-primary/5 to-background border-t border-border/40">
      <div className="max-w-7xl mx-auto px-3 md:px-6">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[11px] sm:text-xs font-medium mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            লাইভ কাস্টমার আপডেট
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold">আমাদের সম্মানিত ক্রেতাগণ</h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">প্রতিদিন বাড়ছে আমাদের পরিবার</p>
        </div>

        {/* Stat cards - clickable */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
          <button
            type="button"
            onClick={() => setListOpen('all')}
            className="text-left relative overflow-hidden rounded-2xl border border-primary/20 bg-card p-4 sm:p-5 shadow-sm hover:border-primary/50 hover:shadow-md transition-all group"
          >
            <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-primary/10" />
            <div className="relative flex items-center gap-3">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                <Users className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xl sm:text-3xl font-extrabold tabular-nums">{animTotal.toLocaleString('bn-BD')}</div>
                <div className="text-[11px] sm:text-xs text-muted-foreground">মোট রেজিস্টার্ড কাস্টমার</div>
              </div>
              <ChevronRight className="h-4 w-4 text-primary/60 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => setListOpen('repeat')}
            className="text-left relative overflow-hidden rounded-2xl border border-amber-400/30 bg-card p-4 sm:p-5 shadow-sm hover:border-amber-400/60 hover:shadow-md transition-all group"
          >
            <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-amber-400/15" />
            <div className="relative flex items-center gap-3">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-amber-400/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Repeat className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xl sm:text-3xl font-extrabold tabular-nums">{animRepeat.toLocaleString('bn-BD')}</div>
                <div className="text-[11px] sm:text-xs text-muted-foreground">রিপিট কাস্টমার</div>
              </div>
              <ChevronRight className="h-4 w-4 text-amber-500/70 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>
        </div>

        {/* Top customers preview — clickable */}
        <button
          type="button"
          onClick={() => setListOpen('top')}
          className="w-full text-left rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-lg transition-all group"
        >
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-gradient-to-r from-primary/10 to-transparent">
            <Trophy className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm sm:text-base font-bold">টপ ১০০ কাস্টমার</h3>
            <span className="ml-auto flex items-center gap-1 text-[10px] sm:text-xs text-primary font-medium">
              সম্পূর্ণ লিস্ট দেখুন
              <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>

          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : top.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">এখনও কোনো কাস্টমার তথ্য নেই।</div>
          ) : (
            <div className="divide-y divide-border">
              {preview.map((c, i) => (
                <CustomerRowItem key={i} c={c} index={i} />
              ))}
              <div className="px-4 py-2.5 text-center text-[11px] sm:text-xs text-muted-foreground bg-muted/20">
                + আরও {Math.max(0, top.length - preview.length)} জন কাস্টমার দেখতে ক্লিক করুন
              </div>
            </div>
          )}
        </button>
      </div>

      <Dialog open={listOpen !== null} onOpenChange={(o) => !o && setListOpen(null)}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <DialogHeader className="px-4 py-3 pr-12 border-b bg-gradient-to-r from-primary/10 to-transparent">
            <DialogTitle className="flex items-center gap-2 text-base pr-2">
              {listOpen === 'top' ? <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
                : listOpen === 'repeat' ? <Repeat className="h-4 w-4 text-amber-500 shrink-0" />
                : <Users className="h-4 w-4 text-primary shrink-0" />}
              <span className="truncate">{dialogTitle}</span>
              <span className="ml-auto text-xs font-normal text-muted-foreground shrink-0 bg-background/70 rounded-full px-2 py-0.5 border">
                {listOpen === 'top' ? top.length : filteredRecent.length} জন
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto divide-y divide-border">
            {listOpen === 'top' ? (
              top.map((c, i) => <CustomerRowItem key={i} c={c} index={i} />)
            ) : recentLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : filteredRecent.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">কোনো কাস্টমার পাওয়া যায়নি।</div>
            ) : (
              filteredRecent.map((c, i) => <RecentCustomerRow key={i} c={c} />)
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function LoyaltyTierTag({ deliveredOrders }: { deliveredOrders: number | undefined }) {
  const tiers = useLoyaltyTiers();
  const tier = getLoyaltyTier(deliveredOrders, tiers);
  if (tier.key === 'new') return null;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] sm:text-[10px] font-semibold rounded-full px-1.5 py-0.5 border ${tier.className}`}>
      <span>{tier.emoji}</span> {tier.shortLabel}
    </span>
  );
}

function CustomerRowItem({ c, index }: { c: CustomerRow; index: number }) {
  const badgeCls =
    index === 0 ? 'bg-amber-400 text-amber-950'
    : index === 1 ? 'bg-slate-300 text-slate-800'
    : index === 2 ? 'bg-orange-400 text-orange-950'
    : 'bg-primary/10 text-primary';
  return (
    <div className="flex items-center gap-3 px-3 sm:px-4 py-2.5 hover:bg-muted/40 transition-colors">
      <div className={`flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${badgeCls}`}>
        {index + 1}
      </div>
      <div className="flex-shrink-0 h-9 w-9 sm:h-10 sm:w-10 rounded-full overflow-hidden bg-muted flex items-center justify-center ring-2 ring-background">
        {c.avatar_url ? (
          <img src={c.avatar_url} alt={c.name} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <User className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs sm:text-sm font-semibold truncate">{c.name}</span>
          <LoyaltyTierTag deliveredOrders={c.delivered_orders} />
        </div>
        {c.address && (
          <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground truncate">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{c.address}</span>
          </div>
        )}
      </div>
      <div className="flex-shrink-0 text-right">
        <div className="text-xs sm:text-sm font-bold text-primary tabular-nums">{c.total_orders} অর্ডার</div>
        {(c.total_spent || 0) > 0 && (
          <div className="text-[10px] sm:text-xs font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">৳{(c.total_spent || 0).toLocaleString('bn-BD')}</div>
        )}
      </div>
    </div>
  );
}

function RecentCustomerRow({ c }: { c: RecentCustomer }) {
  return (
    <div className="flex items-center gap-3 px-3 sm:px-4 py-2.5 hover:bg-muted/40 transition-colors">
      <div className="flex-shrink-0 h-9 w-9 sm:h-10 sm:w-10 rounded-full overflow-hidden bg-muted flex items-center justify-center ring-2 ring-background">
        {c.avatar_url ? (
          <img src={c.avatar_url} alt={c.name} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <User className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs sm:text-sm font-semibold truncate">{c.name}</span>
          <LoyaltyTierTag deliveredOrders={c.delivered_orders} />
        </div>
        <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-muted-foreground truncate">
          {c.address && (
            <span className="inline-flex items-center gap-0.5 truncate">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{c.address}</span>
            </span>
          )}
          {c.address && c.created_at && <span>•</span>}
          {c.created_at && (
            <span className="inline-flex items-center gap-0.5 shrink-0">
              <Clock className="h-3 w-3" /> {formatTimeAgo(c.created_at)}
            </span>
          )}
        </div>
      </div>
      <div className="flex-shrink-0 text-right">
        <div className="text-xs sm:text-sm font-bold text-primary tabular-nums">{c.total_orders || 0} অর্ডার</div>
        {(c.total_spent || 0) > 0 && (
          <div className="text-[10px] sm:text-xs font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">৳{(c.total_spent || 0).toLocaleString('bn-BD')}</div>
        )}
      </div>
    </div>
  );
}
