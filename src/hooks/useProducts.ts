import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { applyClearance, applyClearanceList } from '@/lib/clearancePrice';

// Lightweight select for product lists (cards) — omit heavy fields
const PRODUCT_LIST_SELECT = 'id, slug, name, name_bn, price, original_price, clearance_price, clearance_active, images, is_featured, is_active, category_id, stock, allow_pre_order, colors, sizes, product_type, video_url, created_at, category_pinned_at, bump_product_id, bump_discount, addon_config, variant_images, categories(name, name_bn, slug)';
// Fallback (without clearance_* columns) — used if primary query fails because the
// clearance columns are missing (e.g. migration not yet applied / stale schema cache).
const PRODUCT_LIST_SELECT_SAFE = PRODUCT_LIST_SELECT.replace('clearance_price, clearance_active, ', '');

const HOMEPAGE_CARD_SELECT = 'id, slug, name, name_bn, price, original_price, clearance_price, clearance_active, images, video_url, stock, allow_pre_order, created_at, variant_images';
const HOMEPAGE_CARD_SELECT_SAFE = HOMEPAGE_CARD_SELECT.replace('clearance_price, clearance_active, ', '');

const PRODUCT_DETAIL_SELECT = 'id, slug, name, name_bn, description, description_bn, price, original_price, clearance_price, clearance_active, images, is_featured, is_active, category_id, stock, allow_pre_order, colors, sizes, product_type, video_url, video_file_url, created_at, bump_product_id, bump_discount, addon_config, variant_images, is_hidden_from_shop, seo_title, seo_description, seo_keywords, feed_title, feed_description, linked_product_ids, suggested_product_ids, categories(name, name_bn, slug)';
const PRODUCT_DETAIL_SELECT_SAFE = PRODUCT_DETAIL_SELECT.replace('clearance_price, clearance_active, ', '');

/**
 * Detect "missing column" / "schema cache" errors from PostgREST so we can
 * gracefully retry with a safer SELECT instead of letting the whole product
 * section blank out.
 */
function isSchemaError(err: any): boolean {
  if (!err) return false;
  const msg = String(err?.message || err?.hint || '').toLowerCase();
  return (
    err?.code === 'PGRST204' ||
    err?.code === '42703' ||
    msg.includes('clearance_') ||
    msg.includes('column') && (msg.includes('does not exist') || msg.includes('not found') || msg.includes('schema cache'))
  );
}

/** Run a builder; on schema-shape errors retry with the safe builder. Never throws. */
async function runWithFallback<T = any>(
  build: (select: string) => PromiseLike<{ data: any; error: any }>,
  primary: string,
  safe: string,
  label: string,
): Promise<T[]> {
  try {
    const { data, error } = await build(primary);
    if (error) {
      if (isSchemaError(error)) {
        const retry = await build(safe);
        if (!retry.error) return (retry.data || []) as T[];
        // eslint-disable-next-line no-console
        console.error(`[useProducts:${label}] fallback failed`, retry.error);
        return [];
      }
      // eslint-disable-next-line no-console
      console.error(`[useProducts:${label}] query error`, error);
      return [];
    }
    return (data || []) as T[];
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`[useProducts:${label}] unexpected`, e);
    return [];
  }
}

const RETRY_OPTS = {
  retry: 2 as const,
  retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 8000),
};

const PRODUCT_CARD_PRICE_VERSION = 'product-card-sale-price-v2';

export function useProducts(categorySlug?: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['products', PRODUCT_CARD_PRICE_VERSION, categorySlug],
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    ...RETRY_OPTS,
    queryFn: async () => {
      let categoryIds: string[] | null = null;
      if (categorySlug) {
        try {
          const { data: cat } = await supabase.from('categories').select('id').eq('slug', categorySlug).maybeSingle();
          if (cat) {
            const { data: subCats } = await supabase.from('categories').select('id').eq('parent_id', cat.id);
            categoryIds = [cat.id, ...(subCats || []).map((s: any) => s.id)];
          } else {
            categoryIds = [];
          }
        } catch (e) {
          console.error('[useProducts] category resolve failed', e);
        }
      }

      const rows = await runWithFallback(
        (select) => {
          let q = supabase.from('products').select(select)
            .eq('is_active', true).eq('is_hidden_from_shop', false).is('deleted_at', null)
            .or('stock.gt.0,allow_pre_order.eq.true');
          if (categoryIds) q = q.in('category_id', categoryIds);
          return q.order('created_at', { ascending: false });
        },
        PRODUCT_LIST_SELECT,
        PRODUCT_LIST_SELECT_SAFE,
        'list',
      );

      const out = applyClearanceList(rows);
      if (categorySlug) {
        out.sort((a: any, b: any) => {
          const ap = a.category_pinned_at ? new Date(a.category_pinned_at).getTime() : 0;
          const bp = b.category_pinned_at ? new Date(b.category_pinned_at).getTime() : 0;
          if (ap !== bp) return bp - ap;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      }
      return out;
    },
  });
}

export function useProduct(slug: string) {
  return useQuery({
    queryKey: ['product', slug],
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    ...RETRY_OPTS,
    queryFn: async () => {
      const tryOne = async (select: string) => supabase
        .from('products').select(select)
        .eq('slug', slug.trim())
        .eq('is_active', true).eq('is_hidden_from_shop', false).is('deleted_at', null)
        .or('stock.gt.0,allow_pre_order.eq.true')
        .maybeSingle();

      let { data, error } = await tryOne(PRODUCT_DETAIL_SELECT);
      if (error && isSchemaError(error)) {
        const retry = await tryOne(PRODUCT_DETAIL_SELECT_SAFE);
        data = retry.data; error = retry.error;
      }
      if (error) {
        console.error('[useProduct] error', error);
        return null;
      }
      return data ? applyClearance(data as any) : data;
    },
    enabled: !!slug,
  });
}

export function useFeaturedProducts() {
  return useQuery({
    queryKey: ['featured-products', PRODUCT_CARD_PRICE_VERSION],
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    ...RETRY_OPTS,
    queryFn: async () => {
      const rows = await runWithFallback(
        (select) => supabase.from('products').select(select)
          .eq('is_active', true).eq('is_hidden_from_shop', false).is('deleted_at', null)
          .or('stock.gt.0,allow_pre_order.eq.true')
          .eq('is_featured', true)
          .order('created_at', { ascending: false }).limit(8),
        PRODUCT_LIST_SELECT, PRODUCT_LIST_SELECT_SAFE, 'featured',
      );
      return applyClearanceList(rows);
    },
  });
}

// Best selling products - today's ordered products, calculated from order_items count
export function useBestSellingProducts() {
  return useQuery({
    queryKey: ['best-selling-products', PRODUCT_CARD_PRICE_VERSION],
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    ...RETRY_OPTS,
    queryFn: async () => {
      try {
        const { data: bestIds, error: rpcError } = await (supabase as any)
          .rpc('get_today_best_selling_product_ids', { p_limit: 500 });
        if (rpcError) { console.error('[useBestSellingProducts] rpc', rpcError); return []; }
        if (!bestIds || bestIds.length === 0) return [];

        const salesMap = new Map<string, number>();
        const topProductIds: string[] = [];
        bestIds.forEach((item: any) => {
          topProductIds.push(item.product_id);
          salesMap.set(item.product_id, item.total_sold);
        });

        const rows = await runWithFallback(
          (select) => supabase.from('products').select(select)
            .is('deleted_at', null)
            .in('id', topProductIds),
          PRODUCT_LIST_SELECT, PRODUCT_LIST_SELECT_SAFE, 'best-selling',
        );
        // Attach today_sold so consumers can repeat each card per sold quantity
        const enriched = applyClearanceList(rows).map((p: any) => ({
          ...p,
          today_sold: Number(salesMap.get(p.id) || 0),
        }));
        return enriched.sort((a: any, b: any) => (b.today_sold || 0) - (a.today_sold || 0));
      } catch (e) {
        console.error('[useBestSellingProducts] unexpected', e);
        return [];
      }
    },
  });
}

// All products with active stock clearance offer
export function useClearanceProducts() {
  return useQuery({
    queryKey: ['clearance-products-all', PRODUCT_CARD_PRICE_VERSION],
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    ...RETRY_OPTS,
    queryFn: async () => {
      const rows = await runWithFallback(
        (select) => supabase.from('products').select(select)
          .eq('is_active', true).eq('is_hidden_from_shop', false).is('deleted_at', null)
          .or('stock.gt.0,allow_pre_order.eq.true')
          .eq('clearance_active', true)
          .order('created_at', { ascending: false }),
        PRODUCT_LIST_SELECT, PRODUCT_LIST_SELECT_SAFE, 'clearance',
      );
      return applyClearanceList(rows);
    },
  });
}

// Newest products
export function useNewProducts() {
  return useQuery({
    queryKey: ['new-products', PRODUCT_CARD_PRICE_VERSION],
    ...RETRY_OPTS,
    queryFn: async () => {
      const rows = await runWithFallback(
        (select) => supabase.from('products').select(select)
          .eq('is_active', true).eq('is_hidden_from_shop', false).is('deleted_at', null)
          .or('stock.gt.0,allow_pre_order.eq.true')
          .order('created_at', { ascending: false }).limit(10),
        PRODUCT_LIST_SELECT, PRODUCT_LIST_SELECT_SAFE, 'new',
      );
      return applyClearanceList(rows);
    },
  });
}

// Homepage "all products" — server-side limited slim fetch
export function useHomepageAllProducts(limit: number = 40) {
  return useQuery({
    queryKey: ['homepage-all-products', PRODUCT_CARD_PRICE_VERSION, limit],
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    ...RETRY_OPTS,
    queryFn: async () => {
      const rows = await runWithFallback(
        (select) => supabase.from('products').select(select)
          .eq('is_active', true).eq('is_hidden_from_shop', false).is('deleted_at', null)
          .or('stock.gt.0,allow_pre_order.eq.true')
          .order('created_at', { ascending: false }).limit(limit),
        HOMEPAGE_CARD_SELECT, HOMEPAGE_CARD_SELECT_SAFE, 'homepage-all',
      );
      return applyClearanceList(rows);
    },
  });
}

// Lightweight count for "load more" hasMore detection
export function useHomepageAllProductsCount() {
  return useQuery({
    queryKey: ['homepage-all-products-count'],
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    ...RETRY_OPTS,
    queryFn: async () => {
      try {
        const { count, error } = await supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true)
          .eq('is_hidden_from_shop', false).is('deleted_at', null)
          .or('stock.gt.0,allow_pre_order.eq.true');
        if (error) { console.error('[useHomepageAllProductsCount]', error); return 0; }
        return count || 0;
      } catch (e) {
        console.error('[useHomepageAllProductsCount] unexpected', e);
        return 0;
      }
    },
  });
}

// Fetch specific product ids as full homepage-card rows — used to backfill
// sections like "Trending এখন" up to their target count when too few
// products actually sold today.
export function useProductCardsByIds(ids: string[]) {
  const key = ids.slice().sort().join(',');
  return useQuery({
    queryKey: ['product-cards-by-ids', key],
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const rows = await runWithFallback(
        (select) => supabase.from('products').select(select)
          .eq('is_active', true).eq('is_hidden_from_shop', false).is('deleted_at', null)
          .or('stock.gt.0,allow_pre_order.eq.true')
          .in('id', ids),
        HOMEPAGE_CARD_SELECT, HOMEPAGE_CARD_SELECT_SAFE, 'product-cards-by-ids',
      );
      return applyClearanceList(rows);
    },
  });
}

// All product sales counts for review/rating display
export function useProductSalesCounts() {
  return useQuery({
    queryKey: ['product-sales-counts'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc('get_all_product_sales_counts');
        if (error) { console.error('[useProductSalesCounts]', error); return new Map<string, number>(); }
        const map = new Map<string, number>();
        (data || []).forEach((item: any) => map.set(item.product_id, item.total_sold));
        return map;
      } catch (e) {
        console.error('[useProductSalesCounts] unexpected', e);
        return new Map<string, number>();
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

// A few real product photos per category — used to animate category tiles
// (homepage subcategory cards) with an actual live preview of what's inside,
// instead of a single static banner image.
export function useCategoryPreviewImages(categoryIds: string[]) {
  const key = categoryIds.slice().sort().join(',');
  return useQuery({
    queryKey: ['category-preview-images', key],
    enabled: categoryIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('category_id, images')
        .in('category_id', categoryIds)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) { console.error('[useCategoryPreviewImages]', error); return {} as Record<string, string[]>; }
      const map: Record<string, string[]> = {};
      for (const p of data || []) {
        const cid = (p as any).category_id as string | null;
        const img = (p as any).images?.[0];
        if (!cid || !img) continue;
        if (!map[cid]) map[cid] = [];
        if (map[cid].length < 8) map[cid].push(img);
      }
      return map;
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

// Many "umbrella" parent categories (e.g. শাড়ি, পার্টি ড্রেস) hold no products
// directly — every real product lives under their subcategories. Falls back to
// pulling images from direct children so the parent's tile isn't empty/repetitive.
export function resolveTileImages(categoryId: string, categories: any[], imageMap: Record<string, string[]>): string[] {
  const own = imageMap[categoryId] || [];
  const children = categories.filter((c: any) => c.parent_id === categoryId);
  if (children.length === 0) return own;
  // Round-robin one photo per child at a time (instead of dumping all of one
  // child's photos before the next) so a parent tile isn't dominated by a
  // single subcategory's images — spreads representation across all of them.
  const childBuckets = children.map((c: any) => imageMap[c.id] || []);
  const maxLen = Math.max(0, ...childBuckets.map((b) => b.length));
  const interleaved: string[] = [];
  for (let i = 0; i < maxLen; i++) {
    for (const bucket of childBuckets) {
      if (bucket[i]) interleaved.push(bucket[i]);
    }
  }
  return Array.from(new Set([...own, ...interleaved])).slice(0, 12);
}

// Fetch a specific set of products by id — used for "other colors of this
// design" swatches (linked_product_ids) and similar cross-references.
// Fetches the SAME full field set as useProduct (not just card fields) so a
// linked color-variant's row can be dropped straight into the ['product', slug]
// cache for an instant, flash-free swap when clicking between linked colors
// on a product page — see ProductDetail's handleLinkedColorClick.
export function useProductsByIds(ids: string[]) {
  const key = ids.slice().sort().join(',');
  return useQuery({
    queryKey: ['products-by-ids', key],
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const rows = await runWithFallback(
        (select) => supabase.from('products').select(select).in('id', ids),
        PRODUCT_DETAIL_SELECT, PRODUCT_DETAIL_SELECT_SAFE, 'products-by-ids',
      );
      return applyClearanceList(rows);
    },
  });
}

// Keeps linked_product_ids symmetric across a whole "same design, different
// color" group. The edited product's own row is already saved by the caller
// (as part of its normal update/insert payload) — this only touches the
// OTHER members: anything newly selected gets the full group (this product +
// everyone selected) written to it; anything the admin removed just has this
// product's id dropped from its list, leaving its other links untouched.
export async function syncLinkedProducts(productId: string, desiredIds: string[], previousIds: string[]) {
  const desired = Array.from(new Set(desiredIds.filter((v) => v && v !== productId)));
  const previous = Array.from(new Set(previousIds.filter((v) => v && v !== productId)));
  const removed = previous.filter((pid) => !desired.includes(pid));

  await Promise.all([
    ...desired.map(async (memberId) => {
      const linked = [productId, ...desired].filter((mid) => mid !== memberId);
      const { error } = await supabase.from('products').update({ linked_product_ids: linked } as any).eq('id', memberId);
      if (error) console.error('[syncLinkedProducts] failed to update member', memberId, error);
    }),
    ...removed.map(async (removedId) => {
      const { data } = await supabase.from('products').select('linked_product_ids').eq('id', removedId).maybeSingle();
      const current: string[] = ((data as any)?.linked_product_ids as string[]) || [];
      const next = current.filter((cid) => cid !== productId);
      const { error } = await supabase.from('products').update({ linked_product_ids: next } as any).eq('id', removedId);
      if (error) console.error('[syncLinkedProducts] failed to detach', removedId, error);
    }),
  ]);
}

// Keeps suggested_product_ids symmetric across a whole cross-sell group, same
// approach as syncLinkedProducts above but for "সম্পর্কিত পণ্য" ordering
// instead of color variants — so linking product A to B also makes A show
// first under B's related products, not just the other way around.
export async function syncSuggestedProducts(productId: string, desiredIds: string[], previousIds: string[]) {
  const desired = Array.from(new Set(desiredIds.filter((v) => v && v !== productId)));
  const previous = Array.from(new Set(previousIds.filter((v) => v && v !== productId)));
  const removed = previous.filter((pid) => !desired.includes(pid));

  await Promise.all([
    ...desired.map(async (memberId) => {
      const { data } = await supabase.from('products').select('suggested_product_ids').eq('id', memberId).maybeSingle();
      const current: string[] = ((data as any)?.suggested_product_ids as string[]) || [];
      const next = Array.from(new Set([...current, productId]));
      const { error } = await supabase.from('products').update({ suggested_product_ids: next } as any).eq('id', memberId);
      if (error) console.error('[syncSuggestedProducts] failed to update member', memberId, error);
    }),
    ...removed.map(async (removedId) => {
      const { data } = await supabase.from('products').select('suggested_product_ids').eq('id', removedId).maybeSingle();
      const current: string[] = ((data as any)?.suggested_product_ids as string[]) || [];
      const next = current.filter((cid) => cid !== productId);
      const { error } = await supabase.from('products').update({ suggested_product_ids: next } as any).eq('id', removedId);
      if (error) console.error('[syncSuggestedProducts] failed to detach', removedId, error);
    }),
  ]);
}

// Total page views per product (from visitor_activity)
export function useProductViewCounts() {
  return useQuery({
    queryKey: ['product-view-counts'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc('get_all_product_view_counts' as any);
        if (error) { console.error('[useProductViewCounts]', error); return new Map<string, number>(); }
        const map = new Map<string, number>();
        (data || []).forEach((item: any) => map.set(item.product_id, Number(item.total_views) || 0));
        return map;
      } catch (e) {
        console.error('[useProductViewCounts] unexpected', e);
        return new Map<string, number>();
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
