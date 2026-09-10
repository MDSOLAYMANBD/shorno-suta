import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { applyClearanceList } from '@/lib/clearancePrice';

export function useAdminCategoryOptions(enabled: boolean = true) {
  return useQuery({
    queryKey: ['admin-picker-category-options'],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, name_bn')
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []) as { id: string; name: string; name_bn: string | null }[];
    },
  });
}

const PAGE_SIZE = 30;
const PRODUCT_FIELDS =
  'id, name, name_bn, slug, price, original_price, sizes, colors, images, variant_images, bump_product_id, bump_discount, addon_config, clearance_price, clearance_active, is_active';

/**
 * Admin product picker for manual order / order preview "Add product" dropdowns.
 *
 * Behavior:
 * - When no search term: first page = recently-used products (from order_items),
 *   subsequent pages = remaining products (created_at desc), de-duped.
 * - When searching: paginated ilike search across name/name_bn/slug.
 * - Includes both active + inactive products, excludes soft-deleted (deleted_at).
 */
export function useAdminProductPicker(
  search: string,
  enabled: boolean,
  categoryId?: string | null,
) {
  const trimmed = search.trim();
  const isSearching = trimmed.length > 0;
  const hasCategory = !!categoryId;

  // Recently used IDs (only when not searching and no category) — kept separate so they cache nicely
  const recentQuery = useQuery({
    queryKey: ['admin-picker-recent-product-ids'],
    enabled: enabled && !isSearching && !hasCategory,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_recently_used_product_ids' as any, {
        p_limit: 30,
      });
      if (error) throw error;
      return ((data as any[]) || []).map((r) => r.product_id as string);
    },
  });

  const recentIds = recentQuery.data || [];

  const infinite = useInfiniteQuery({
    queryKey: [
      'admin-picker-products',
      trimmed,
      categoryId || '',
      isSearching || hasCategory ? null : recentIds.join(','),
    ],
    enabled: enabled && (isSearching || hasCategory || !recentQuery.isLoading),
    initialPageParam: 0 as number,
    staleTime: 30_000,
    queryFn: async ({ pageParam }) => {
      const page = pageParam as number;

      // Category-filtered (with or without search): simple paginated query
      if (hasCategory) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        let q = supabase
          .from('products')
          .select(PRODUCT_FIELDS)
          .is('deleted_at', null as any)
          .eq('category_id', categoryId!);
        if (isSearching) {
          q = q.or(`name.ilike.%${trimmed}%,name_bn.ilike.%${trimmed}%,slug.ilike.%${trimmed}%`);
        }
        const { data, error } = await q
          .order('created_at', { ascending: false })
          .range(from, to);
        if (error) throw error;
        return data || [];
      }

      // Searching: simple paginated ilike
      if (isSearching) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const { data, error } = await supabase
          .from('products')
          .select(PRODUCT_FIELDS)
          .is('deleted_at', null as any)
          .or(`name.ilike.%${trimmed}%,name_bn.ilike.%${trimmed}%,slug.ilike.%${trimmed}%`)
          .order('created_at', { ascending: false })
          .range(from, to);
        if (error) throw error;
        return data || [];
      }

      // Page 0 (no search, no category): recently-used products in RPC order
      if (page === 0 && recentIds.length > 0) {
        const { data, error } = await supabase
          .from('products')
          .select(PRODUCT_FIELDS)
          .is('deleted_at', null as any)
          .in('id', recentIds);
        if (error) throw error;
        const map = new Map<string, any>();
        (data || []).forEach((p: any) => map.set(p.id, p));
        return recentIds.map((id) => map.get(id)).filter(Boolean);
      }

      // Page 1+: remaining products by created_at desc, excluding recents
      const offset = page === 0 ? 0 : (page - 1) * PAGE_SIZE;
      const from = offset;
      const to = from + PAGE_SIZE - 1;
      let q = supabase
        .from('products')
        .select(PRODUCT_FIELDS)
        .is('deleted_at', null as any);
      if (recentIds.length > 0) {
        q = q.not('id', 'in', `(${recentIds.join(',')})`);
      }
      const { data, error } = await q
        .order('created_at', { ascending: false })
        .range(from, to);
      if (error) throw error;
      return data || [];
    },
    getNextPageParam: (lastPage, allPages) => {
      if (allPages.length === 1 && !isSearching && !hasCategory) return 1;
      if (!lastPage || lastPage.length < PAGE_SIZE) return undefined;
      return allPages.length;
    },
  });

  const products = applyClearanceList((infinite.data?.pages || []).flat());

  return {
    products,
    fetchNextPage: infinite.fetchNextPage,
    hasNextPage: !!infinite.hasNextPage,
    isFetchingNextPage: infinite.isFetchingNextPage,
    isLoading: infinite.isLoading || recentQuery.isLoading,
  };
}
