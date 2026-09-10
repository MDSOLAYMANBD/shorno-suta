import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows, fetchAllByIds } from '@/lib/supabaseHelpers';
import { format, subDays, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { bn } from 'date-fns/locale';

export type VisitorTabKey = 'today' | 'weekly' | 'monthly';

export function getVisitorDateRange(tab: VisitorTabKey) {
  const now = new Date();
  switch (tab) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'weekly':
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case 'monthly':
      return { from: startOfMonth(now), to: endOfMonth(now) };
  }
}

const STATIC_PAGE_LABELS: Record<string, string> = {
  '/': 'হোম',
  '/shop': 'শপ',
  '/cart': 'কার্ট',
  '/checkout': 'চেকআউট',
  '/thank-you': 'অর্ডার সম্পন্ন',
  '/account': 'একাউন্ট',
  '/trending': 'ট্রেন্ডিং',
  '/contact': 'যোগাযোগ',
  '/about': 'আমাদের সম্পর্কে',
  '/policies': 'পলিসি',
  '/giveaway': 'গিভঅ্যাওয়ে',
};

export function humanizePagePath(path: string, slugMap: Map<string, string>): string {
  const clean = path.split('?')[0];
  if (STATIC_PAGE_LABELS[clean]) return STATIC_PAGE_LABELS[clean];
  const productMatch = clean.match(/^\/product\/([^/]+)/);
  if (productMatch) return `প্রোডাক্ট: ${slugMap.get(productMatch[1]) || '...'}`;
  const shopMatch = clean.match(/^\/shop\/([^/]+)/);
  if (shopMatch) return `ক্যাটাগরি: ${slugMap.get(shopMatch[1]) || '...'}`;
  if (clean.startsWith('/shop')) return 'শপ';
  if (clean.startsWith('/lp/')) return 'ল্যান্ডিং পেজ';
  return clean;
}

function buildChartBuckets(rows: { created_at: string }[], tab: VisitorTabKey, from: Date) {
  if (tab === 'today') {
    const hours: { label: string; fullLabel: string; count: number }[] = [];
    for (let i = 0; i < 24; i++) {
      const hStart = new Date(from); hStart.setHours(i, 0, 0, 0);
      const hEnd = new Date(hStart); hEnd.setHours(i + 1);
      const count = rows.filter(r => { const d = new Date(r.created_at); return d >= hStart && d < hEnd; }).length;
      hours.push({
        label: hStart.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }).toLowerCase(),
        fullLabel: format(hStart, 'h:mm a', { locale: bn }),
        count,
      });
    }
    return hours;
  }
  const days = tab === 'weekly' ? 7 : new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate();
  const result: { label: string; fullLabel: string; count: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = tab === 'weekly' ? subDays(new Date(), days - 1 - i) : new Date(from.getFullYear(), from.getMonth(), i + 1);
    const dayStr = format(d, 'yyyy-MM-dd');
    const count = rows.filter(r => format(new Date(r.created_at), 'yyyy-MM-dd') === dayStr).length;
    result.push({ label: tab === 'weekly' ? format(d, 'dd/MM') : `${i + 1}`, fullLabel: format(d, 'dd MMM', { locale: bn }), count });
  }
  return result;
}

type ActivityRow = { session_id: string; product_id: string | null; product_name: string | null };
type ProductLookup = { id: string; name: string; name_bn: string | null; images: string[] | null; category_id: string | null; categories: { name: string; name_bn: string | null } | null };

function aggregateActivity(rows: ActivityRow[], productMap: Map<string, ProductLookup>) {
  const counts = new Map<string, { count: number; name: string; id: string | null }>();
  rows.forEach(r => {
    const key = r.product_id || `name:${r.product_name}`;
    const existing = counts.get(key) || { count: 0, name: r.product_name || 'অজানা প্রোডাক্ট', id: r.product_id };
    existing.count++;
    counts.set(key, existing);
  });
  return [...counts.values()]
    .map(v => {
      const p = v.id ? productMap.get(v.id) : undefined;
      return { id: v.id, name: p?.name_bn || p?.name || v.name, image: p?.images?.[0] || null, count: v.count };
    })
    .sort((a, b) => b.count - a.count);
}

export function useVisitorOverview(tab: VisitorTabKey) {
  const range = useMemo(() => getVisitorDateRange(tab), [tab]);
  return useQuery({
    queryKey: ['visitor-analytics-overview', tab],
    queryFn: async () => {
      const fromIso = range.from.toISOString();
      const toIso = range.to.toISOString();
      const [visits, productViewRows, cartRows, orderCountRes, contactClickRows] = await Promise.all([
        fetchAllRows<{ session_id: string; created_at: string; page_path: string; source: string | null }>(() =>
          (supabase.from('site_visits' as any) as any).select('session_id, created_at, page_path, source').gte('created_at', fromIso).lte('created_at', toIso)
        ),
        fetchAllRows<ActivityRow>(() =>
          (supabase.from('visitor_activity' as any) as any).select('session_id, product_id, product_name').eq('activity_type', 'product_view').gte('created_at', fromIso).lte('created_at', toIso)
        ),
        fetchAllRows<ActivityRow>(() =>
          (supabase.from('visitor_activity' as any) as any).select('session_id, product_id, product_name').eq('activity_type', 'add_to_cart').gte('created_at', fromIso).lte('created_at', toIso)
        ),
        supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', fromIso).lte('created_at', toIso),
        fetchAllRows<{ session_id: string; activity_type: string }>(() =>
          (supabase.from('visitor_activity' as any) as any).select('session_id, activity_type')
            .in('activity_type', ['call_click', 'whatsapp_click', 'messenger_click'])
            .gte('created_at', fromIso).lte('created_at', toIso)
        ),
      ]);

      const totalSessions = visits.length;
      const viewedSessions = new Set(productViewRows.map(r => r.session_id)).size;
      const cartSessions = new Set(cartRows.map(r => r.session_id)).size;
      const orderCount = orderCountRes.count || 0;

      const chartData = buildChartBuckets(visits, tab, range.from);

      const pageCounts = new Map<string, number>();
      visits.forEach(v => pageCounts.set(v.page_path, (pageCounts.get(v.page_path) || 0) + 1));
      const topPagesRaw = [...pageCounts.entries()]
        .map(([path, count]) => ({ path, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

      // Resolve readable labels for just these top 6 paths (not every distinct path ever
      // visited) — bounded slug lookup, same idiom as the journeys feed below.
      const pageSlugs = new Set<string>();
      topPagesRaw.forEach(p => {
        const m = p.path.match(/^\/product\/([^/?]+)/) || p.path.match(/^\/shop\/([^/?]+)/);
        if (m) pageSlugs.add(m[1]);
      });
      const pageSlugMap = new Map<string, string>();
      if (pageSlugs.size > 0) {
        const [prods, cats] = await Promise.all([
          fetchAllByIds<{ slug: string; name: string; name_bn: string | null }>('products', 'slug, name, name_bn', 'slug', [...pageSlugs]),
          fetchAllByIds<{ slug: string; name: string; name_bn: string | null }>('categories', 'slug, name, name_bn', 'slug', [...pageSlugs]),
        ]);
        prods.forEach(p => pageSlugMap.set(p.slug, p.name_bn || p.name));
        cats.forEach(c => pageSlugMap.set(c.slug, c.name_bn || c.name));
      }
      const topPages = topPagesRaw.map(p => ({ ...p, label: humanizePagePath(p.path, pageSlugMap) }));

      const allProductIds = [...new Set([...productViewRows, ...cartRows].map(r => r.product_id).filter(Boolean))] as string[];
      const products = allProductIds.length > 0
        ? await fetchAllByIds<ProductLookup>('products', 'id, name, name_bn, images, category_id, categories(name, name_bn)', 'id', allProductIds)
        : [];
      const productMap = new Map(products.map(p => [p.id, p]));

      const topViewedProducts = aggregateActivity(productViewRows, productMap).slice(0, 6);
      const topCartProducts = aggregateActivity(cartRows, productMap).slice(0, 6);

      const categoryCounts = new Map<string, number>();
      productViewRows.forEach(r => {
        if (!r.product_id) return;
        const p = productMap.get(r.product_id);
        const catName = p?.categories?.name_bn || p?.categories?.name;
        if (!catName) return;
        categoryCounts.set(catName, (categoryCounts.get(catName) || 0) + 1);
      });
      const totalCategoryViews = [...categoryCounts.values()].reduce((s, c) => s + c, 0);
      const topCategories = [...categoryCounts.entries()]
        .map(([name, count]) => ({ name, count, pct: totalCategoryViews > 0 ? Math.round((count / totalCategoryViews) * 100) : 0 }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Traffic source — only counts visits recorded after the source column was added
      // (20260821130000); older rows have source=null and are excluded here, same as any
      // newly-introduced optional field.
      const sourceCounts = new Map<string, number>();
      let sourceKnownTotal = 0;
      visits.forEach(v => {
        if (!v.source) return;
        sourceCounts.set(v.source, (sourceCounts.get(v.source) || 0) + 1);
        sourceKnownTotal++;
      });
      const sourceBreakdown = [...sourceCounts.entries()]
        .map(([source, count]) => ({ source, count, pct: sourceKnownTotal > 0 ? Math.round((count / sourceKnownTotal) * 100) : 0 }))
        .sort((a, b) => b.count - a.count);

      // Contact-button clicks (call/WhatsApp/Messenger) cross-tabbed against the visitor's
      // source — a session can have multiple site_visits rows (repeat page loads) but they
      // all carry the same source, so this map is safe to build from any one of them.
      const sessionSourceMap = new Map<string, string>();
      visits.forEach(v => { if (v.session_id && v.source && !sessionSourceMap.has(v.session_id)) sessionSourceMap.set(v.session_id, v.source); });

      const contactBySource = new Map<string, { call: Set<string>; whatsapp: Set<string>; messenger: Set<string> }>();
      contactClickRows.forEach(r => {
        const source = sessionSourceMap.get(r.session_id) || 'অজানা';
        if (!contactBySource.has(source)) contactBySource.set(source, { call: new Set(), whatsapp: new Set(), messenger: new Set() });
        const bucket = contactBySource.get(source)!;
        if (r.activity_type === 'call_click') bucket.call.add(r.session_id);
        else if (r.activity_type === 'whatsapp_click') bucket.whatsapp.add(r.session_id);
        else if (r.activity_type === 'messenger_click') bucket.messenger.add(r.session_id);
      });
      const contactClicksBySource = [...contactBySource.entries()]
        .map(([source, b]) => ({ source, call: b.call.size, whatsapp: b.whatsapp.size, messenger: b.messenger.size, total: b.call.size + b.whatsapp.size + b.messenger.size }))
        .sort((a, b) => b.total - a.total);

      return {
        totalSessions, viewedSessions, cartSessions, orderCount,
        chartData, topPages, topViewedProducts, topCartProducts, topCategories, sourceBreakdown, sourceKnownTotal, contactClicksBySource,
      };
    },
  });
}

export function useRecentVisitorJourneys() {
  return useQuery({
    queryKey: ['visitor-analytics-journeys'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('page_views' as any) as any)
        .select('session_id, page_path, created_at')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      const rows = (data || []) as { session_id: string; page_path: string; created_at: string }[];

      const sessions = new Map<string, { path: string; created_at: string }[]>();
      rows.forEach(r => {
        if (!sessions.has(r.session_id)) sessions.set(r.session_id, []);
        sessions.get(r.session_id)!.push({ path: r.page_path, created_at: r.created_at });
      });

      const journeyList = [...sessions.entries()]
        .map(([sessionId, pages]) => {
          const sorted = [...pages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          return { sessionId, pages: sorted, lastSeen: sorted[sorted.length - 1].created_at };
        })
        .sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime())
        .slice(0, 20);

      const slugs = new Set<string>();
      journeyList.forEach(j => j.pages.forEach(p => {
        const m = p.path.match(/^\/product\/([^/?]+)/) || p.path.match(/^\/shop\/([^/?]+)/);
        if (m) slugs.add(m[1]);
      }));
      const slugMap = new Map<string, string>();
      if (slugs.size > 0) {
        const [prods, cats] = await Promise.all([
          fetchAllByIds<{ slug: string; name: string; name_bn: string | null }>('products', 'slug, name, name_bn', 'slug', [...slugs]),
          fetchAllByIds<{ slug: string; name: string; name_bn: string | null }>('categories', 'slug, name, name_bn', 'slug', [...slugs]),
        ]);
        prods.forEach(p => slugMap.set(p.slug, p.name_bn || p.name));
        cats.forEach(c => slugMap.set(c.slug, c.name_bn || c.name));
      }

      return journeyList.map(j => ({
        ...j,
        labeledPages: j.pages.map(p => ({ ...p, label: humanizePagePath(p.path, slugMap) })),
      }));
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
