import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCategories } from './useCategories';

export function usePopularCategories(limit = 8) {
  const { data: categories } = useCategories();

  return useQuery({
    queryKey: ['popular-categories', limit, (categories || []).length],
    enabled: !!categories && categories.length > 0,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      const subs = (categories || []).filter(
        (c: any) => c.parent_id && c.banner_image_url
      );
      if (subs.length === 0) return [];

      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: visits } = await supabase
        .from('site_visits' as any)
        .select('page_path')
        .gte('created_at', since)
        .like('page_path', '/shop/%')
        .limit(10000);

      const counts = new Map<string, number>();
      (visits || []).forEach((v: any) => {
        const slug = (v.page_path || '').replace('/shop/', '').split('?')[0].split('/')[0];
        if (slug) counts.set(slug, (counts.get(slug) || 0) + 1);
      });

      const sorted = [...subs].sort((a: any, b: any) => {
        const ca = counts.get(a.slug) || 0;
        const cb = counts.get(b.slug) || 0;
        if (cb !== ca) return cb - ca;
        return (new Date(b.created_at || 0).getTime()) - (new Date(a.created_at || 0).getTime());
      });

      return sorted.slice(0, limit);
    },
  });
}
