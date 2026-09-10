import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ShoppingBag, TrendingUp, ChevronRight, Home } from 'lucide-react';

interface CategoryLite { slug: string; name: string; name_bn?: string | null }

interface Props {
  productIds: string[];
  parentCategory?: CategoryLite | null;
  currentCategory?: CategoryLite | null;
  hideCounter?: boolean;
}

function useAnimatedNumber(target: number, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!target) { setVal(0); return; }
    const start = performance.now();
    const from = val;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);
  return val;
}

export default function CategoryOrderCounter({ productIds, parentCategory, currentCategory, hideCounter = false }: Props) {
  const idsKey = useMemo(() => productIds.slice().sort().join(','), [productIds]);
  const idSet = useMemo(() => new Set(productIds), [productIds]);

  const { data: baseCount = 0 } = useQuery({
    queryKey: ['category-order-count', idsKey],
    queryFn: async () => {
      if (productIds.length === 0) return 0;
      const { data, error } = await (supabase.rpc as any)('get_category_order_count', {
        p_product_ids: productIds,
      });
      if (error) throw error;
      return Number(data) || 0;
    },
    enabled: productIds.length > 0,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });

  const [liveDelta, setLiveDelta] = useState(0);
  const [pulse, setPulse] = useState(false);

  useEffect(() => { setLiveDelta(0); }, [idsKey]);

  useEffect(() => {
    if (productIds.length === 0) return;
    const channel = supabase
      .channel(`cat-orders-${idsKey.slice(0, 20)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'order_items' },
        (payload: any) => {
          const pid = payload?.new?.product_id;
          if (pid && idSet.has(pid)) {
            setLiveDelta(d => d + 1);
            setPulse(true);
            setTimeout(() => setPulse(false), 700);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [idsKey, idSet, productIds.length]);

  const total = baseCount + liveDelta;
  const animated = useAnimatedNumber(total);

  if (!hideCounter && productIds.length === 0) return null;
  if (hideCounter && !currentCategory) return null;

  const parentLabel = parentCategory ? (parentCategory.name_bn || parentCategory.name) : null;
  const currentLabel = currentCategory ? (currentCategory.name_bn || currentCategory.name) : null;

  return (
    <div className="mb-4 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 via-amber-50 to-orange-50 dark:from-primary/15 dark:via-amber-500/10 dark:to-orange-500/10 overflow-hidden">
      {/* Top row: counter */}
      {!hideCounter && (
      <div className="flex items-center gap-3 px-4 pt-2.5 pb-2">
        <div className="relative">
          <div className={`h-9 w-9 rounded-full bg-primary/15 text-primary flex items-center justify-center ${pulse ? 'animate-pulse' : ''}`}>
            <ShoppingBag className="h-4 w-4" />
          </div>
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 animate-pulse ring-2 ring-background" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground font-medium">
            <TrendingUp className="h-3 w-3 text-emerald-600" />
            লাইভ অর্ডার কাউন্টার
          </div>
          <div className="text-xs sm:text-sm font-semibold text-foreground truncate">
            <span className="text-primary text-base sm:text-lg font-extrabold tabular-nums">
              {animated.toLocaleString('bn-BD')}
            </span>
            {' '}টি অর্ডার
          </div>
        </div>
        {liveDelta > 0 && (
          <span className="shrink-0 text-[10px] sm:text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 rounded-full px-2 py-0.5 animate-fade-in">
            +{liveDelta} এইমাত্র
          </span>
        )}
      </div>
      )}

      {/* Bottom row: clickable breadcrumb */}
      <div className={`flex items-center gap-1 px-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${hideCounter ? 'py-2' : 'pb-2'}`}>
        <Link
          to="/shop"
          className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-background/70 border border-border/60 text-[10px] sm:text-[11px] font-medium text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
        >
          <Home className="h-3 w-3" /> শপ
        </Link>
        {parentLabel && parentCategory && (
          <>
            <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
            <Link
              to={`/shop/${parentCategory.slug}`}
              className="shrink-0 px-2 py-1 rounded-full bg-background/70 border border-border/60 text-[10px] sm:text-[11px] font-medium text-foreground/80 hover:text-primary hover:border-primary/40 transition-colors max-w-[140px] truncate"
            >
              {parentLabel}
            </Link>
          </>
        )}
        {currentLabel && currentCategory && (
          <>
            <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
            <Link
              to={`/shop/${currentCategory.slug}`}
              className="shrink-0 px-2 py-1 rounded-full bg-primary text-primary-foreground text-[10px] sm:text-[11px] font-semibold max-w-[160px] truncate hover:bg-primary/90 transition-colors"
            >
              {currentLabel}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
