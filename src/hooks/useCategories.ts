import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Orders categories so each subcategory appears directly under its parent,
// instead of interleaved alphabetically with unrelated main categories.
export function getCategoryTree(categories: any[]): Array<{ category: any; depth: number }> {
  const mains = categories.filter((c: any) => !c.parent_id);
  const mainIds = new Set(mains.map((c: any) => c.id));
  const result: Array<{ category: any; depth: number }> = [];
  for (const main of mains) {
    result.push({ category: main, depth: 0 });
    for (const sub of categories.filter((c: any) => c.parent_id === main.id)) {
      result.push({ category: sub, depth: 1 });
    }
  }
  // Subcategories whose parent is missing/inactive: show them rather than hide them
  for (const c of categories) {
    if (c.parent_id && !mainIds.has(c.parent_id)) result.push({ category: c, depth: 0 });
  }
  return result;
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .or('is_active.is.null,is_active.eq.true')
        .order('name');
      if (error) throw error;
      return data || [];
    },
    staleTime: 30 * 60 * 1000, // 30 min — categories rarely change
    gcTime: 60 * 60 * 1000,    // 1 hour garbage collection
  });
}
