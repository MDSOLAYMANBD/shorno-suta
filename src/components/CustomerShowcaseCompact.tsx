import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, Repeat, MapPin, User, Clock, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ShowcaseData { total: number; repeat: number; top: any[] }
interface RecentCustomer { name: string; address: string; total_orders: number; avatar_url?: string | null; created_at: string | null }

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

export default function CustomerShowcaseCompact() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
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

  const [listOpen, setListOpen] = useState<null | 'all' | 'repeat'>(null);

  const { data: recent = [], isLoading: recentLoading } = useQuery({
    queryKey: ['customers-recent', listOpen === 'repeat' ? 'repeat' : 'all'],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_customers_recent', {
        p_repeat_only: listOpen === 'repeat',
      });
      if (error) throw error;
      return (data || []) as RecentCustomer[];
    },
    enabled: listOpen !== null,
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    const channel = supabase
      .channel('customer-showcase-compact-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'customers' }, () => {
        queryClient.invalidateQueries({ queryKey: ['customer-showcase'] });
        queryClient.invalidateQueries({ queryKey: ['customers-recent'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const total = data?.total || 0;
  const repeat = data?.repeat || 0;

  const filteredRecent = useMemo(() => {
    if (listOpen === 'repeat') return recent.filter(c => (c.total_orders || 0) > 1);
    return recent;
  }, [recent, listOpen]);

  const dialogTitle = listOpen === 'repeat' ? 'রিপিট কাস্টমার' : 'সকল রেজিস্টার্ড কাস্টমার';

  return (
    <section className="max-w-3xl mx-auto px-3 sm:px-4 mt-4">
      <div className="flex items-center justify-center gap-1.5 mb-2">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[10px] sm:text-[11px] font-medium text-muted-foreground">লাইভ কাস্টমার আপডেট</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => setListOpen('all')}
          className="text-left relative overflow-hidden rounded-xl border border-primary/20 bg-card p-2.5 sm:p-3 hover:border-primary/50 hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Users className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-base sm:text-lg font-extrabold tabular-nums leading-tight">{total.toLocaleString('bn-BD')}</div>
              <div className="text-[10px] text-muted-foreground leading-tight">রেজিস্টার্ড কাস্টমার</div>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-primary/60 group-hover:translate-x-0.5 transition-transform shrink-0" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => setListOpen('repeat')}
          className="text-left relative overflow-hidden rounded-xl border border-amber-400/30 bg-card p-2.5 sm:p-3 hover:border-amber-400/60 hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-amber-400/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Repeat className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-base sm:text-lg font-extrabold tabular-nums leading-tight">{repeat.toLocaleString('bn-BD')}</div>
              <div className="text-[10px] text-muted-foreground leading-tight">রিপিট কাস্টমার</div>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-amber-500/70 group-hover:translate-x-0.5 transition-transform shrink-0" />
          </div>
        </button>
      </div>

      <Dialog open={listOpen !== null} onOpenChange={(o) => !o && setListOpen(null)}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <DialogHeader className="px-4 py-3 pr-12 border-b bg-gradient-to-r from-primary/10 to-transparent">
            <DialogTitle className="flex items-center gap-2 text-base pr-2">
              {listOpen === 'repeat'
                ? <Repeat className="h-4 w-4 text-amber-500 shrink-0" />
                : <Users className="h-4 w-4 text-primary shrink-0" />}
              <span className="truncate">{dialogTitle}</span>
              <span className="ml-auto text-xs font-normal text-muted-foreground shrink-0 bg-background/70 rounded-full px-2 py-0.5 border">
                {filteredRecent.length} জন
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto divide-y divide-border">
            {recentLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : filteredRecent.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">কোনো কাস্টমার পাওয়া যায়নি।</div>
            ) : (
              filteredRecent.map((c, i) => (
                <div key={i} className="flex items-center gap-3 px-3 sm:px-4 py-2.5 hover:bg-muted/40 transition-colors">
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
                      {(c.total_orders || 0) > 1 && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] sm:text-[10px] font-semibold text-amber-700 bg-amber-100 border border-amber-200 rounded-full px-1.5 py-0.5">
                          <Repeat className="h-2.5 w-2.5" /> রিপিট
                        </span>
                      )}
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
                    <div className="text-xs sm:text-sm font-bold text-primary tabular-nums">{c.total_orders || 0}</div>
                    <div className="text-[9px] sm:text-[10px] text-muted-foreground">অর্ডার</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
