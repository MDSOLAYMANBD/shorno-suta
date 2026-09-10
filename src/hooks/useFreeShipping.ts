import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  evaluateFreeShipping,
  type FreeShippingCampaign,
  type EvalCartItem,
} from '@/lib/freeShipping';

const CAMPAIGN_KEY = ['free-shipping-campaigns', 'active'] as const;

async function fetchActiveCampaigns(): Promise<FreeShippingCampaign[]> {
  const { data, error } = await supabase
    .from('free_shipping_campaigns' as any)
    .select('*')
    .eq('status', 'active')
    .order('priority', { ascending: false });
  if (error) {
    // Fail silent in production — feature is non-critical
    console.warn('[freeShipping] load failed', error.message);
    return [];
  }
  return (data as any[] as FreeShippingCampaign[]) || [];
}

export function useActiveFreeShippingCampaigns() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: CAMPAIGN_KEY,
    queryFn: fetchActiveCampaigns,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel(`free-shipping-campaigns-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'free_shipping_campaigns' },
        () => qc.invalidateQueries({ queryKey: CAMPAIGN_KEY }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return q;
}

/**
 * Fetch product categories for the given product ids (cached).
 */
function useProductCategories(productIds: string[]) {
  const key = useMemo(() => [...productIds].sort().join(','), [productIds]);
  return useQuery({
    queryKey: ['free-shipping', 'product-categories', key],
    enabled: productIds.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, category_id')
        .in('id', productIds);
      if (error) return {} as Record<string, string | null>;
      const map: Record<string, string | null> = {};
      (data || []).forEach((p: any) => {
        map[p.id] = p.category_id;
      });
      return map;
    },
  });
}

export interface UseFreeShippingArgs {
  items: Array<{ id: string; quantity: number; price: number }>;
  appliedCouponCode?: string | null;
}

export function useFreeShipping({ items, appliedCouponCode }: UseFreeShippingArgs) {
  const { data: campaigns = [] } = useActiveFreeShippingCampaigns();
  const productIds = useMemo(
    () => Array.from(new Set(items.map((i) => i.id).filter(Boolean))),
    [items],
  );
  const { data: catMap = {} } = useProductCategories(productIds);

  const result = useMemo(() => {
    const evalItems: EvalCartItem[] = items.map((i) => ({
      product_id: i.id,
      quantity: i.quantity,
      price: i.price,
      category_id: catMap[i.id] ?? null,
    }));
    const r = evaluateFreeShipping(campaigns, {
      items: evalItems,
      appliedCouponCode,
    });
    if (typeof window !== 'undefined' && (window as any).__FS_DEBUG__) {
      // eslint-disable-next-line no-console
      console.log('[freeShipping]', {
        campaigns: campaigns.length,
        items: evalItems,
        applied: r.applied?.name || null,
        evaluations: r.evaluations.map((e) => ({
          name: e.campaign.name,
          qualified: e.qualified,
          matchedQty: e.matchedQuantity,
          matchedAmount: e.matchedSubtotal,
          missingQty: e.missingQty,
          missingAmount: e.missingAmount,
        })),
      });
    }
    return r;
  }, [campaigns, items, catMap, appliedCouponCode]);

  return {
    ...result,
    campaigns,
    /** convenience: true when shipping should be free */
    isFree: !!result.applied,
  };
}

/**
 * Single-product preview (e.g. on product detail page) — pretends the
 * given product is in the cart with quantity 1.
 */
export function useProductFreeShippingPreview(productId: string | null | undefined, price: number) {
  const items = useMemo(
    () => (productId ? [{ id: productId, quantity: 1, price }] : []),
    [productId, price],
  );
  return useFreeShipping({ items });
}

/**
 * Fire confetti once per unlock — keyed by campaign id + cart signature.
 * Lazy-loads canvas-confetti only on first unlock.
 */
const CONFETTI_KEY = 'shorno-suta-fs-confetti';
export function useFreeShippingUnlockEffect(appliedCampaignId: string | null | undefined) {
  const [lastShown, setLastShown] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(CONFETTI_KEY);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!appliedCampaignId) return;
    if (lastShown === appliedCampaignId) return;
    let cancelled = false;
    (async () => {
      try {
        const mod = await import('canvas-confetti');
        if (cancelled) return;
        const confetti = (mod as any).default || mod;
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#16a34a', '#22c55e', '#f59e0b', '#eab308'],
        });
        sessionStorage.setItem(CONFETTI_KEY, appliedCampaignId);
        setLastShown(appliedCampaignId);
      } catch {
        // optional dep — ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appliedCampaignId, lastShown]);
}
