import { useState, useEffect } from 'react'; // rebuild
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows, fetchAllByIds } from '@/lib/supabaseHelpers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { ShoppingCart, DollarSign, Package, AlertTriangle, ArrowUpRight, Plus, CheckCircle, Calendar as CalendarIcon, Facebook, Search, MessageCircle, MessageSquare, Instagram, Video, Phone, Globe, Truck, PackageCheck, Scale, XCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SmartRangeCalendar } from '@/components/ui/smart-range-calendar';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { getColorPrimaryImage } from '@/lib/productVariants';

const BLUE = { gradient: 'from-blue-500/10 to-blue-600/5', iconBg: 'bg-blue-500/15', iconColor: 'text-blue-600' };
const GREEN = { gradient: 'from-green-500/10 to-green-600/5', iconBg: 'bg-green-500/15', iconColor: 'text-green-600' };
const RED = { gradient: 'from-red-500/10 to-red-600/5', iconBg: 'bg-red-500/15', iconColor: 'text-red-600' };
const AMBER = { gradient: 'from-amber-500/10 to-amber-600/5', iconBg: 'bg-amber-500/15', iconColor: 'text-amber-600' };

// অর্ডার/বিক্রিত আইটেম/মোট বিক্রি → blue, সফল/কনফার্মড → green, ক্যান্সেল → red, অসম্পূর্ণ → amber
// Row 1: blue, blue, blue, green | Row 2: green, green, red, green
const CARD_STYLES = [BLUE, BLUE, BLUE, GREEN, GREEN, GREEN, RED, GREEN];

// Single source of truth for order_origin → source-card key, shared by the
// "অর্ডার সোর্স" summary counts and the per-source product popup so a card's
// count and its popup contents always agree.
function deriveOrderSource(orderOrigin: string | null | undefined): string {
  const origin = (orderOrigin || 'website').toLowerCase();
  const parts = origin.split('+');
  return origin === 'manual+facebook' ? 'messenger' : (parts.length > 1 ? parts[parts.length - 1] : origin);
}

const ORDER_SOURCES = [
  { key: 'facebook', label: 'Facebook', icon: Facebook, color: '#1877F2' },
  { key: 'messenger', label: 'Messenger', icon: MessageSquare, color: '#0084FF' },
  { key: 'google', label: 'Google', icon: Search, color: '#4285F4' },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: '#25D366' },
  { key: 'instagram', label: 'Instagram', icon: Instagram, color: '#E4405F' },
  { key: 'tiktok', label: 'TikTok', icon: Video, color: '#000000' },
  { key: 'imo', label: 'IMO', icon: MessageCircle, color: '#0078FF' },
  { key: 'website', label: 'Website', icon: Globe, color: 'hsl(var(--primary))' },
  { key: 'manual', label: 'ম্যানুয়াল', icon: Phone, color: '#F59E0B' },
];

export default function AdminOverview() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Date range for performance section
  const [perfDateRange, setPerfDateRange] = useState<DateRange>({
    from: today,
    to: today,
  });

  // Date range for top products section
  const [topProductRange, setTopProductRange] = useState<DateRange>({ from: today, to: today });
  const [showAllTimeSales, setShowAllTimeSales] = useState(false);
  const [showTopProductsAll, setShowTopProductsAll] = useState(false);
  const [topProductsStatusFilter, setTopProductsStatusFilter] = useState<'all' | 'active' | 'cancelled'>('active');
  // "অর্ডার সোর্স" card click — which source's item-list popup is open, if any.
  const [sourceDialogKey, setSourceDialogKey] = useState<string | null>(null);
  // Live clock
  const [currentTime, setCurrentTime] = useState(
    new Date().toLocaleTimeString('bn-BD', { hour: 'numeric', minute: '2-digit', hour12: true })
  );
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('bn-BD', { hour: 'numeric', minute: '2-digit', hour12: true }));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const perfStart = perfDateRange.from || today;
  const perfEnd = perfDateRange.to || perfStart;
  const perfEndOfDay = new Date(perfEnd);
  perfEndOfDay.setHours(23, 59, 59, 999);

  const { data: stats } = useQuery({
    queryKey: ['admin-dashboard-stats', perfStart.toISOString(), perfEndOfDay.toISOString()],
    queryFn: async () => {
      const [
        ordersList,
        { count: abandonedCount },
        { count: visitorCount },
      ] = await Promise.all([
        fetchAllRows(() => supabase.from('orders').select('id, total, status, created_at, order_origin').gte('created_at', perfStart.toISOString()).lte('created_at', perfEndOfDay.toISOString())),
        supabase.from('abandoned_checkouts').select('*', { count: 'exact', head: true }).eq('status', 'abandoned'),
        supabase.from('site_visits').select('*', { count: 'exact', head: true }).gte('created_at', perfStart.toISOString()).lte('created_at', perfEndOfDay.toISOString()),
      ]);
      const orderCount = ordersList.length;
      const confirmedStatuses = ['confirmed', 'in_review', 'shipped', 'delivered', 'office_sell'];
      const successOrders = ordersList.filter(o => confirmedStatuses.includes(o.status)).length;
      const cancelledCount = ordersList.filter(o => o.status === 'cancelled').length;
      const deliveredCount = ordersList.filter(o => o.status === 'delivered').length;
      const revenue = ordersList.reduce((s, o) => s + Number(o.total), 0);
      const confirmedRevenue = ordersList.filter(o => confirmedStatuses.includes(o.status)).reduce((s, o) => s + Number(o.total), 0);

      let productsSold = 0;
      let confirmedItemsSold = 0;
      const orderIds = ordersList.map(o => o.id);
      const confirmedOrderIds = ordersList.filter(o => confirmedStatuses.includes(o.status)).map(o => o.id);

      if (orderIds.length > 0) {
        const items = await fetchAllByIds('order_items', 'quantity, order_id', 'order_id', orderIds);
        productsSold = items?.reduce((s: number, i: any) => s + i.quantity, 0) || 0;
        confirmedItemsSold = items?.filter((i: any) => confirmedOrderIds.includes(i.order_id)).reduce((s: number, i: any) => s + i.quantity, 0) || 0;
      }

      const totalVisitors = visitorCount || 0;
      const conversionRate = totalVisitors > 0 ? (orderCount / totalVisitors * 100).toFixed(1) : '0';

      // Build source stats with confirmed/cancelled breakdown
      const sourceStats: Record<string, { total: number; confirmed: number; cancelled: number }> = {};
      for (const o of ordersList) {
        const src = deriveOrderSource(o.order_origin);
        if (!sourceStats[src]) sourceStats[src] = { total: 0, confirmed: 0, cancelled: 0 };
        sourceStats[src].total++;
        if (confirmedStatuses.includes(o.status)) sourceStats[src].confirmed++;
        if (o.status === 'cancelled') sourceStats[src].cancelled++;
      }

      return {
        todayOrders: orderCount,
        todaySuccessOrders: successOrders,
        todayProductsSold: productsSold,
        confirmedItemsSold,
        cancelledCount,
        todayRevenue: revenue,
        confirmedRevenue,
        deliveredCount,
        totalVisitors,
        conversionRate,
        sourceStats,
      };
    },
  });

  // Item list for the "অর্ডার সোর্স" card popup — same date range as the
  // source cards above, filtered to just the clicked source's orders.
  const { data: sourceProducts = [], isLoading: sourceProductsLoading } = useQuery({
    queryKey: ['admin-source-products', sourceDialogKey, perfStart.toISOString(), perfEndOfDay.toISOString()],
    enabled: !!sourceDialogKey,
    queryFn: async () => {
      const ordersList = await fetchAllRows(() =>
        supabase.from('orders').select('id, order_origin').gte('created_at', perfStart.toISOString()).lte('created_at', perfEndOfDay.toISOString())
      );
      const matchingOrderIds = ordersList.filter((o: any) => deriveOrderSource(o.order_origin) === sourceDialogKey).map((o: any) => o.id);
      if (matchingOrderIds.length === 0) return [];

      const items = await fetchAllByIds('order_items', 'product_name, product_id, color, quantity, price, order_id, item_type', 'order_id', matchingOrderIds);
      if (!items || items.length === 0) return [];

      const map = new Map<string, { name: string; productId: string | null; color: string | null; sold: number; revenue: number }>();
      for (const item of items) {
        if ((item.item_type || 'normal') !== 'normal') continue; // just the real products, not addon/bump noise
        const key = `${item.product_id || item.product_name}::${item.color || ''}`;
        const existing = map.get(key) || { name: item.product_name, productId: item.product_id, color: item.color || null, sold: 0, revenue: 0 };
        existing.sold += item.quantity;
        existing.revenue += item.price * item.quantity;
        map.set(key, existing);
      }

      const productIds = [...new Set(items.map((i: any) => i.product_id).filter(Boolean))] as string[];
      const { data: products } = productIds.length > 0
        ? await supabase.from('products').select('id, images, variant_images').in('id', productIds)
        : { data: [] as { id: string; images: string[] | null; variant_images: any }[] };
      const imgMap = new Map((products || []).map(p => [p.id, p.images?.[0] || null]));
      const variantImgMap = new Map((products || []).map(p => [p.id, (p as any).variant_images]));

      return Array.from(map.values())
        .sort((a, b) => b.sold - a.sold)
        .map(p => {
          const colorImg = p.color ? getColorPrimaryImage(variantImgMap.get(p.productId || '')?.color_images, p.color) : null;
          return {
            name: p.color ? `${p.name} (${p.color})` : p.name,
            sold: p.sold,
            revenue: p.revenue,
            image: colorImg || imgMap.get(p.productId || '') || null,
          };
        });
    },
  });

  const { data: hourlyData = [] } = useQuery({
    queryKey: ['admin-hourly-orders', perfStart.toISOString(), perfEndOfDay.toISOString()],
    queryFn: async () => {
      const isSingleDay = perfStart.toDateString() === perfEnd.toDateString();

      const [orders, visits] = await Promise.all([
        fetchAllRows<{ created_at: string; total: number }>(() =>
          supabase
            .from('orders')
            .select('created_at, total')
            .gte('created_at', perfStart.toISOString())
            .lte('created_at', perfEndOfDay.toISOString())
        ),
        fetchAllRows<{ created_at: string }>(() =>
          supabase
            .from('site_visits')
            .select('created_at')
            .gte('created_at', perfStart.toISOString())
            .lte('created_at', perfEndOfDay.toISOString())
        ),
      ]);

      if (isSingleDay) {
        const hours: { time: string; revenue: number; orders: number; visitors: number }[] = [];
        for (let i = 0; i < 24; i++) {
          const hourStart = new Date(perfStart);
          hourStart.setHours(i);
          const hourEnd = new Date(hourStart);
          hourEnd.setHours(hourEnd.getHours() + 1);
          const filteredOrders = (orders || []).filter(o => { const d = new Date(o.created_at); return d >= hourStart && d < hourEnd; });
          const filteredVisits = (visits || []).filter(v => { const d = new Date(v.created_at); return d >= hourStart && d < hourEnd; });
          const revenue = filteredOrders.reduce((s, o) => s + Number(o.total), 0);
          const label = hourStart.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }).toLowerCase();
          hours.push({ time: label, revenue, orders: filteredOrders.length, visitors: filteredVisits.length });
        }
        return hours;
      } else {
        // Multi-day: group by date
        const dayMap = new Map<string, { revenue: number; orders: number; visitors: number }>();
        for (let d = new Date(perfStart); d <= perfEnd; d.setDate(d.getDate() + 1)) {
          dayMap.set(format(new Date(d), 'dd/MM'), { revenue: 0, orders: 0, visitors: 0 });
        }
        (orders || []).forEach(o => {
          const key = format(new Date(o.created_at), 'dd/MM');
          const existing = dayMap.get(key) || { revenue: 0, orders: 0, visitors: 0 };
          existing.revenue += Number(o.total);
          existing.orders += 1;
          dayMap.set(key, existing);
        });
        (visits || []).forEach(v => {
          const key = format(new Date(v.created_at), 'dd/MM');
          const existing = dayMap.get(key) || { revenue: 0, orders: 0, visitors: 0 };
          existing.visitors += 1;
          dayMap.set(key, existing);
        });
        return Array.from(dayMap.entries()).map(([time, data]) => ({ time, revenue: data.revenue, orders: data.orders, visitors: data.visitors }));
      }
    },
  });

  // Top products - filtered by selected date range
  const topProductFrom = topProductRange.from || today;
  const topProductTo = topProductRange.to || topProductFrom;
  const topProductStart = new Date(topProductFrom);
  topProductStart.setHours(0, 0, 0, 0);
  const topProductEnd = new Date(topProductTo);
  topProductEnd.setHours(23, 59, 59, 999);

  const EMPTY_TOP_PRODUCTS = { items: [], activeItems: [], cancelledItems: [], totalSold: 0, confirmedSold: 0, pendingSold: 0, cancelledSold: 0 };
  const { data: topProductsData = EMPTY_TOP_PRODUCTS } = useQuery({
    queryKey: ['admin-top-products', topProductStart.toISOString(), topProductEnd.toISOString()],
    queryFn: async () => {
      // Match the dashboard "বিক্রিত আইটেম" card exactly: all orders in the selected date range.
      const dateOrders = await fetchAllRows(() =>
        supabase.from('orders').select('id, status').gte('created_at', topProductStart.toISOString()).lte('created_at', topProductEnd.toISOString())
      );

      const orderIds = dateOrders.map((o: any) => o.id);
      if (orderIds.length === 0) return EMPTY_TOP_PRODUCTS;

      // Same status grouping as the KPI cards above (confirmedStatuses) — kept consistent so
      // this badge's "কনফার্ম" number always agrees with "কনফার্মড আইটেম" at the top.
      const confirmedStatuses = ['confirmed', 'in_review', 'shipped', 'delivered', 'office_sell'];
      const statusById = new Map(dateOrders.map((o: any) => [o.id, o.status]));

      const items = await fetchAllByIds('order_items', 'product_name, product_id, quantity, price, order_id, item_type, parent_product_id, upsell_image, upsell_parent_name', 'order_id', orderIds);
      if (!items || items.length === 0) return EMPTY_TOP_PRODUCTS;

      // Group by composite key: product_id + item_type + parent_product_id, tracking each
      // product's sold/revenue split by status so the confirm+pending and cancelled badges can
      // open a dialog scoped to exactly what they show, instead of the unfiltered total.
      const map = new Map<string, {
        name: string; productId: string | null; parentName: string | null; upsellImage: string | null; itemType: string;
        sold: number; revenue: number;
        activeSold: number; activeRevenue: number;
        cancelledSold: number; cancelledRevenue: number;
      }>();
      let confirmedSold = 0, pendingSold = 0, cancelledSold = 0;
      for (const item of items) {
        const itemType = item.item_type || 'normal';
        const groupKey = itemType === 'normal'
          ? (item.product_id || item.product_name)
          : `${itemType}:${item.product_id || ''}:${item.parent_product_id || ''}`;
        const existing = map.get(groupKey) || {
          name: item.product_name, productId: item.product_id, parentName: item.upsell_parent_name || null,
          upsellImage: item.upsell_image || null, itemType,
          sold: 0, revenue: 0, activeSold: 0, activeRevenue: 0, cancelledSold: 0, cancelledRevenue: 0,
        };
        const lineRevenue = item.price * item.quantity;
        existing.sold += item.quantity;
        existing.revenue += lineRevenue;

        const orderStatus = statusById.get(item.order_id);
        if (orderStatus === 'cancelled') {
          existing.cancelledSold += item.quantity;
          existing.cancelledRevenue += lineRevenue;
          cancelledSold += item.quantity;
        } else {
          existing.activeSold += item.quantity;
          existing.activeRevenue += lineRevenue;
          if (confirmedStatuses.includes(orderStatus)) confirmedSold += item.quantity;
          else pendingSold += item.quantity;
        }
        map.set(groupKey, existing);
      }

      const allProducts = Array.from(map.values());
      const totalSold = allProducts.reduce((sum, p) => sum + p.sold, 0);

      const productIds = [...new Set(items.map(i => i.product_id).filter(Boolean))] as string[];
      const { data: products } = productIds.length > 0
        ? await supabase.from('products').select('id, images').in('id', productIds)
        : { data: [] as { id: string; images: string[] | null }[] };
      const imgMap = new Map((products || []).map(p => [p.id, p.images?.[0] || null]));

      const displayName = (p: typeof allProducts[number]) => p.parentName ? `${p.name} (${p.parentName})` : p.name;
      const image = (p: typeof allProducts[number]) => p.upsellImage || imgMap.get(p.productId || '') || null;

      const sorted = allProducts
        .filter(p => p.sold > 0)
        .sort((a, b) => b.sold - a.sold)
        .map(p => ({ name: displayName(p), sold: p.sold, revenue: p.revenue, image: image(p) }));

      const activeSorted = allProducts
        .filter(p => p.activeSold > 0)
        .sort((a, b) => b.activeSold - a.activeSold)
        .map(p => ({ name: displayName(p), sold: p.activeSold, revenue: p.activeRevenue, image: image(p) }));

      const cancelledSorted = allProducts
        .filter(p => p.cancelledSold > 0)
        .sort((a, b) => b.cancelledSold - a.cancelledSold)
        .map(p => ({ name: displayName(p), sold: p.cancelledSold, revenue: p.cancelledRevenue, image: image(p) }));

      return { items: sorted, activeItems: activeSorted, cancelledItems: cancelledSorted, totalSold, confirmedSold, pendingSold, cancelledSold };
    },
  });

  const { data: allTimeBestSelling = [], isLoading: allTimeLoading } = useQuery({
    queryKey: ['admin-all-time-best-selling'],
    queryFn: async () => {
      // Use server-side RPC to avoid URL length limits
      const { data: salesData, error: rpcError } = await supabase.rpc('get_all_product_sales_counts');
      if (rpcError) throw rpcError;
      if (!salesData || salesData.length === 0) return [];

      const topItems = salesData.slice(0, 20);
      const productIds = topItems.map((s: any) => s.product_id);

      // Fetch product names & images + revenue from order_items in parallel.
      // Use fetchAllRows for order_items because top products can have >1000 rows each
      // (PostgREST default limit would silently truncate and zero-out most products' revenue).
      const [{ data: products }, revenueItems] = await Promise.all([
        supabase.from('products').select('id, name, name_bn, images').in('id', productIds),
        fetchAllRows<{ product_id: string; quantity: number; price: number }>(
          () => supabase.from('order_items').select('product_id, quantity, price').in('product_id', productIds)
        ),
      ]);

      const prodMap = new Map((products || []).map(p => [p.id, p]));
      const revMap = new Map<string, number>();
      (revenueItems || []).forEach((i: any) => {
        revMap.set(i.product_id, (revMap.get(i.product_id) || 0) + i.price * i.quantity);
      });

      return topItems.map((s: any) => {
        const prod = prodMap.get(s.product_id);
        return {
          name: prod?.name_bn || prod?.name || 'Unknown',
          sold: Number(s.total_sold),
          revenue: revMap.get(s.product_id) || 0,
          image: prod?.images?.[0] || null,
        };
      });
    },
  });

  // পার্সেল অ্যাক্টিভিটি
  // - শিফট: orders.courier_entry_date range (পার্সেল আজ courier-এ entry হয়েছে)
  // - ডেলিভারি/পার্শিয়াল/ফেইল: courier_tracking_events range — আজ যে status-এ event এসেছে
  const { data: parcelActivity } = useQuery({
    queryKey: ['admin-parcel-activity-v2', perfStart.toISOString(), perfEndOfDay.toISOString()],
    queryFn: async () => {
      const bucket = {
        shift: { count: 0, amount: 0 },
        delivered: { count: 0, amount: 0 },
        partial: { count: 0, amount: 0 },
        failed: { count: 0, amount: 0 },
      };

      // 1) শিফট — entry_date based
      const shiftRows = await fetchAllRows<{ total: number | null }>(
        () => supabase.from('orders')
          .select('total')
          .gte('courier_entry_date', perfStart.toISOString())
          .lte('courier_entry_date', perfEndOfDay.toISOString())
      );
      for (const o of shiftRows || []) {
        bucket.shift.count++;
        bucket.shift.amount += Number(o.total) || 0;
      }

      // 2) Tracking events within range — latest terminal event per order_id
      const events = await fetchAllRows<{ order_id: string; status: string | null; created_at: string }>(
        () => supabase.from('courier_tracking_events')
          .select('order_id, status, created_at')
          .gte('created_at', perfStart.toISOString())
          .lte('created_at', perfEndOfDay.toISOString())
      );

      const latestByOrder = new Map<string, { status: string; created_at: string }>();
      for (const e of events || []) {
        if (!e.order_id) continue;
        const prev = latestByOrder.get(e.order_id);
        if (!prev || new Date(e.created_at).getTime() > new Date(prev.created_at).getTime()) {
          latestByOrder.set(e.order_id, { status: (e.status || '').toLowerCase(), created_at: e.created_at });
        }
      }

      const deliveredIds: string[] = [];
      const partialIds: string[] = [];
      const failedIds: string[] = [];
      for (const [oid, ev] of latestByOrder) {
        const cs = ev.status;
        if (cs === 'delivered' || cs === 'delivered_approval_pending') deliveredIds.push(oid);
        else if (cs === 'partial_delivered' || cs === 'partial_delivered_approval_pending') partialIds.push(oid);
        else if (cs === 'cancelled' || cs === 'cancelled_approval_pending' || cs === 'unknown' || cs === 'pickup_failed' || cs === 'pickup_cancelled') failedIds.push(oid);
      }

      const allIds = [...deliveredIds, ...partialIds, ...failedIds];
      if (allIds.length > 0) {
        const totalsMap = new Map<string, number>();
        const chunkSize = 200;
        for (let i = 0; i < allIds.length; i += chunkSize) {
          const chunk = allIds.slice(i, i + chunkSize);
          const { data } = await supabase.from('orders').select('id, total').in('id', chunk);
          (data || []).forEach((r: any) => totalsMap.set(r.id, Number(r.total) || 0));
        }
        for (const id of deliveredIds) { bucket.delivered.count++; bucket.delivered.amount += totalsMap.get(id) || 0; }
        for (const id of partialIds) { bucket.partial.count++; bucket.partial.amount += totalsMap.get(id) || 0; }
        for (const id of failedIds) { bucket.failed.count++; bucket.failed.amount += totalsMap.get(id) || 0; }
      }

      return bucket;
    },
    staleTime: 60 * 1000,
  });



  const cards = [
    // Row 1: blue, blue, blue, green
    { label: "অর্ডার", value: stats?.todayOrders || 0, icon: ShoppingCart },
    { label: "বিক্রিত আইটেম", value: stats?.todayProductsSold || 0, icon: Package },
    { label: "মোট বিক্রি", value: `৳${(stats?.todayRevenue || 0).toLocaleString('bn-BD')}`, icon: DollarSign },
    { label: "সফল অর্ডার", value: stats?.todaySuccessOrders || 0, icon: CheckCircle },
    // Row 2: green, green, red, amber
    { label: "কনফার্মড আইটেম", value: stats?.confirmedItemsSold || 0, icon: Package },
    { label: "কনফার্মড বিক্রি", value: `৳${(stats?.confirmedRevenue || 0).toLocaleString('bn-BD')}`, icon: DollarSign },
    { label: "ক্যান্সেল", value: stats?.cancelledCount || 0, icon: AlertTriangle },
    { label: "সম্পূর্ণ অর্ডার", value: stats?.deliveredCount || 0, icon: CheckCircle },
  ];

  const perfDateLabel = perfDateRange.from && perfDateRange.to && perfDateRange.from.toDateString() !== perfDateRange.to.toDateString()
    ? `${format(perfDateRange.from, 'dd MMM')} - ${format(perfDateRange.to, 'dd MMM, yyyy')}`
    : perfDateRange.from
      ? perfDateRange.from.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' })
      : '';

  const topProductDateLabel = topProductFrom.toDateString() !== topProductTo.toDateString()
    ? `${format(topProductFrom, 'dd MMM')} — ${format(topProductTo, 'dd MMM, yyyy')}`
    : topProductFrom.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' });

  // Shared between the card body list and the "আরও দেখুন" dialog, so both always show the same
  // status-filtered set — clicking a badge changes what's on the card itself, not a popup.
  const filteredTopProducts = topProductsStatusFilter === 'cancelled' ? topProductsData.cancelledItems
    : topProductsStatusFilter === 'active' ? topProductsData.activeItems
    : topProductsData.items;
  const filteredTopProductsTitle = topProductsStatusFilter === 'cancelled' ? 'ক্যান্সেল হওয়া প্রোডাক্ট'
    : topProductsStatusFilter === 'active' ? 'কনফার্ম + পেন্ডিং প্রোডাক্ট'
    : 'বিক্রিত প্রোডাক্ট';
  const filteredTopProductsEmptyText = topProductsStatusFilter === 'cancelled' ? 'এই তারিখে কোনো ক্যান্সেল অর্ডার নেই'
    : topProductsStatusFilter === 'active' ? 'এই তারিখে কনফার্ম বা পেন্ডিং কোনো অর্ডার নেই'
    : 'এই তারিখে কোনো বিক্রি নেই';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold">ড্যাশবোর্ড</h1>
        <div className="hidden md:flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/orders"><Plus className="h-4 w-4 mr-1" /> অর্ডার</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/admin/products"><Plus className="h-4 w-4 mr-1" /> প্রোডাক্ট</Link>
          </Button>
        </div>
      </div>



      {/* Stats Cards - horizontally scrollable on mobile */}
      <div className="grid grid-cols-4 md:grid-cols-4 gap-1.5 md:gap-3">
        {cards.map((c, i) => {
          const style = CARD_STYLES[i];
          return (
            <Card key={c.label} className={cn('border-0 bg-gradient-to-br', style.gradient)}>
              <CardContent className="p-2 md:p-4">
                <div className="flex items-center justify-between mb-1 md:mb-2">
                   <div className={cn('h-6 w-6 md:h-9 md:w-9 rounded-lg flex items-center justify-center', style.iconBg)}>
                     <c.icon className={cn('h-3 w-3 md:h-4 md:w-4', style.iconColor)} />
                   </div>
                 </div>
                <p className="text-[13px] md:text-xl font-bold break-all leading-tight">{c.value}</p>
                <p className="text-[10px] md:text-[11px] text-muted-foreground mt-0.5">{c.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Performance Card */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-1">
          <CardTitle className="text-sm font-semibold shrink-0">পারফরম্যান্স</CardTitle>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center gap-1.5 text-xs text-muted-foreground h-auto p-1">
                <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{perfDateLabel}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <SmartRangeCalendar
                value={perfDateRange}
                onChange={setPerfDateRange}
                numberOfMonths={1}
                disabled={(date) => date > new Date()}
              />
            </PopoverContent>
          </Popover>
        </CardHeader>
        <CardContent>
          <div className="text-center mb-4">
            <p className="text-2xl md:text-3xl font-bold break-words">৳{(stats?.todayRevenue || 0).toLocaleString('bn-BD')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">আয়</p>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center mb-3">
            <div>
              <p className="text-xl font-bold">{stats?.todayOrders || 0}</p>
              <p className="text-[10px] text-muted-foreground">অর্ডার</p>
            </div>
            <div>
              <p className="text-xl font-bold">{(stats?.totalVisitors || 0).toLocaleString('bn-BD')}</p>
              <p className="text-[10px] text-muted-foreground">ভিজিটর</p>
            </div>
            <div>
              <p className="text-xl font-bold">{stats?.conversionRate || '0'}%</p>
              <p className="text-[10px] text-muted-foreground">কনভার্সন</p>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mb-2">
            সর্বশেষ আপডেট: {currentTime}
          </p>

          <div className="flex items-center justify-center gap-3 mb-2 text-[10px]">
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-[#22c55e]" /> অর্ডার/আয়</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-[#3b82f6]" /> ভিজিটর</span>
          </div>

          <div className="overflow-hidden">
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={hourlyData} margin={{ left: 0, right: 0, top: 5, bottom: 0 }}>
              <defs>
                <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="visitorsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" />
              <XAxis dataKey="time" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" interval={5} />
              <YAxis yAxisId="left" width={38} tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
              <YAxis yAxisId="right" orientation="right" width={28} tick={{ fontSize: 9, fill: '#3b82f6' }} stroke="#3b82f6" />
              <Tooltip content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const data = payload[0]?.payload;
                return (
                  <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-xl">
                    <p className="font-medium mb-1">{label}</p>
                    <p className="text-muted-foreground">আয় : <span className="font-semibold text-foreground">৳{(data?.revenue || 0).toLocaleString('bn-BD')}</span></p>
                    <p className="text-muted-foreground">অর্ডার : <span className="font-semibold text-foreground">{data?.orders || 0}</span></p>
                    <p className="text-muted-foreground">ভিজিটর : <span className="font-semibold" style={{ color: '#3b82f6' }}>{data?.visitors || 0}</span></p>
                  </div>
                );
              }} />
              <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} fill="url(#perfGrad)" />
              <Area yAxisId="right" type="monotone" dataKey="visitors" stroke="#3b82f6" strokeWidth={2} fill="url(#visitorsGrad)" />
            </AreaChart>
          </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* আজকের পার্সেল অ্যাক্টিভিটি */}
      <Card>
        <CardHeader className="pb-1 pt-3 px-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold">পার্সেল অ্যাক্টিভিটি</CardTitle>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" /> {perfDateLabel}
            </span>
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-3 pt-1">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {[
              { key: 'shift', label: 'শিফট', icon: Truck, value: parcelActivity?.shift.count ?? 0, amount: parcelActivity?.shift.amount ?? 0, accent: 'border-l-cyan-500', iconColor: 'text-cyan-600', bg: 'bg-cyan-500/10' },
              { key: 'delivered', label: 'ডেলিভারি', icon: PackageCheck, value: parcelActivity?.delivered.count ?? 0, amount: parcelActivity?.delivered.amount ?? 0, accent: 'border-l-green-500', iconColor: 'text-green-600', bg: 'bg-green-500/10' },
              { key: 'partial', label: 'পার্শিয়াল', icon: Scale, value: parcelActivity?.partial.count ?? 0, amount: parcelActivity?.partial.amount ?? 0, accent: 'border-l-blue-500', iconColor: 'text-blue-600', bg: 'bg-blue-500/10' },
              { key: 'failed', label: 'ফেইল', icon: XCircle, value: parcelActivity?.failed.count ?? 0, amount: parcelActivity?.failed.amount ?? 0, accent: 'border-l-red-500', iconColor: 'text-red-600', bg: 'bg-red-500/10' },
            ].map(s => (
              <div key={s.key} className={cn("flex items-center gap-2 rounded-lg border bg-background px-2.5 py-2 border-l-4", s.accent)}>
                <div className={cn("h-8 w-8 rounded-md flex items-center justify-center shrink-0", s.bg)}>
                  <s.icon className={cn("h-5 w-5", s.iconColor)} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  <p className="text-base font-bold leading-tight">{s.value.toLocaleString('bn-BD')}</p>
                  <p className="text-[10px] font-semibold text-muted-foreground truncate">৳{Math.round(s.amount).toLocaleString('bn-BD')}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* অর্ডার সোর্স */}
      <Card>
        <CardHeader className="pb-1 pt-3 px-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold">অর্ডার সোর্স</CardTitle>
            {stats && (
              <p className="text-[10px] text-muted-foreground">
                মোট: <span className="font-semibold text-foreground">{stats.todayOrders}</span>
                {' | '}
                <span className="text-green-600">✅ {stats.todaySuccessOrders} ({stats.todayOrders > 0 ? ((stats.todaySuccessOrders / stats.todayOrders) * 100).toFixed(1) : '0'}%)</span>
                {' | '}
                <span className="text-red-500">❌ {stats.cancelledCount} ({stats.todayOrders > 0 ? ((stats.cancelledCount / stats.todayOrders) * 100).toFixed(1) : '0'}%)</span>
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-3 pt-1">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {ORDER_SOURCES.filter(s => {
              const st = stats?.sourceStats?.[s.key] || { total: 0 };
              return st.total > 0;
            }).map(s => {
              const st = stats?.sourceStats?.[s.key] || { total: 0, confirmed: 0, cancelled: 0 };
              const total = stats?.todayOrders || 0;
              const pct = total > 0 ? ((st.total / total) * 100).toFixed(1) : '0';
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSourceDialogKey(s.key)}
                  className="flex items-center gap-2 rounded-lg border bg-background px-2.5 py-2 hover:bg-muted/50 hover:border-primary/40 transition-colors cursor-pointer text-left"
                >
                  <div className="h-8 w-8 rounded-md flex items-center justify-center shrink-0 bg-muted/40">
                    <s.icon className="h-5 w-5" style={{ color: s.color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm font-bold">{st.total}</span>
                      <span className="text-[9px] text-muted-foreground">({pct}%)</span>
                    </div>
                    <div className="flex items-center gap-2 text-[9px] text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />{st.confirmed}</span>
                      <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />{st.cancelled}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* অর্ডার সোর্স কার্ড ক্লিক — সেই সোর্সের আজকের আইটেম লিস্ট */}
      <Dialog open={!!sourceDialogKey} onOpenChange={(o) => { if (!o) setSourceDialogKey(null); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>
              {ORDER_SOURCES.find(s => s.key === sourceDialogKey)?.label || sourceDialogKey} থেকে অর্ডার হওয়া প্রোডাক্ট
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {sourceProductsLoading ? (
              <p className="text-sm text-muted-foreground text-center py-8">লোড হচ্ছে...</p>
            ) : sourceProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">এই সোর্স থেকে কোনো প্রোডাক্ট অর্ডার হয়নি</p>
            ) : (
              <div className="space-y-1">
                {sourceProducts.map((p, i) => (
                  <div key={p.name}>
                    <div className="flex items-center gap-3 py-2.5">
                      <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                      <div className="h-9 w-9 rounded-md overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
                        {p.image ? (
                          <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                        ) : (
                          <Package className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground">{p.sold} বিক্রি · ৳{p.revenue.toLocaleString('bn-BD')}</p>
                      </div>
                      <span className="text-sm font-semibold flex-shrink-0 whitespace-nowrap">{p.sold}</span>
                    </div>
                    {i < sourceProducts.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* সেরা প্রোডাক্ট */}
      <Card>
        <CardHeader className="pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
          <CardTitle className="text-base md:text-lg font-bold shrink-0">আজকের বিক্রি প্রোডাক্ট</CardTitle>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button type="button" onClick={() => setTopProductsStatusFilter('active')} className="cursor-pointer">
              <Badge variant="secondary" className={`text-[10px] px-1.5 py-0.5 whitespace-nowrap transition-colors ${
                topProductsStatusFilter === 'active'
                  ? 'bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-400 dark:ring-slate-500'
                  : 'bg-transparent border border-slate-200 dark:border-slate-700 opacity-60 hover:opacity-100'
              }`}>
                <span className="text-green-700 dark:text-green-400 font-semibold">কনফার্ম: {topProductsData.confirmedSold.toLocaleString('bn-BD')}</span>
                <span className="mx-1 opacity-60">·</span>
                <span className="text-amber-700 dark:text-amber-400 font-semibold">পেন্ডিং: {topProductsData.pendingSold.toLocaleString('bn-BD')}</span>
              </Badge>
            </button>
            <button type="button" onClick={() => setTopProductsStatusFilter('cancelled')} className="cursor-pointer">
              <Badge variant="secondary" className={`text-[10px] px-1.5 py-0.5 whitespace-nowrap text-red-700 dark:text-red-400 transition-colors ${
                topProductsStatusFilter === 'cancelled'
                  ? 'bg-red-50 dark:bg-red-950/40 ring-1 ring-red-400 dark:ring-red-700'
                  : 'bg-transparent border border-red-200 dark:border-red-900 opacity-60 hover:opacity-100'
              }`}>
                ক্যান্সেল: {topProductsData.cancelledSold.toLocaleString('bn-BD')}
              </Badge>
            </button>
            <button type="button" onClick={() => setTopProductsStatusFilter('all')} className="cursor-pointer">
              <Badge variant="secondary" className={`text-[10px] px-1.5 py-0.5 whitespace-nowrap transition-colors ${
                topProductsStatusFilter === 'all' ? '' : 'bg-transparent border border-border opacity-60 hover:opacity-100 text-muted-foreground'
              }`}>
                মোট: {topProductsData.totalSold.toLocaleString('bn-BD')} আইটেম
              </Badge>
            </button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center gap-1.5 text-xs text-muted-foreground h-auto p-1">
                  <CalendarIcon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{topProductDateLabel}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <SmartRangeCalendar
                  value={topProductRange}
                  onChange={setTopProductRange}
                  numberOfMonths={1}
                  disabled={(date) => date > new Date()}
                />
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="sm" className="text-xs h-auto p-1" onClick={() => setShowTopProductsAll(true)}>
              দেখুন <ArrowUpRight className="h-3 w-3 ml-0.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>প্রোডাক্ট</span>
            <span>বিক্রি</span>
          </div>
          <Separator className="mb-1" />

          {filteredTopProducts.slice(0, 10).map((p, i, arr) => (
            <div key={p.name}>
              <div className="flex items-center gap-3 py-3">
                <div className="h-12 w-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
                  {p.image ? (
                    <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">মোট বিক্রি: {p.revenue.toLocaleString('bn-BD')}BDT</p>
                </div>
                <span className="text-sm font-semibold flex-shrink-0 whitespace-nowrap">{p.sold}</span>
              </div>
              {i < arr.length - 1 && <Separator />}
            </div>
          ))}

          {filteredTopProducts.length > 10 && (
            <Button variant="ghost" size="sm" className="w-full mt-2 text-xs" onClick={() => setShowTopProductsAll(true)}>
              আরও {filteredTopProducts.length - 10}টি দেখুন <ArrowUpRight className="h-3 w-3 ml-1" />
            </Button>
          )}

          {filteredTopProducts.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">{filteredTopProductsEmptyText}</p>
          )}

          <p className="text-[10px] text-muted-foreground text-center mt-4">
            সর্বশেষ আপডেট: {currentTime}
          </p>
        </CardContent>
      </Card>

      {/* বেস্ট সেলিং প্রোডাক্ট */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">বেস্ট সেলিং প্রোডাক্ট</CardTitle>
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowAllTimeSales(true)}>
            সব দেখুন <ArrowUpRight className="h-3 w-3 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {allTimeLoading ? (
              <p className="text-sm text-muted-foreground text-center py-4">লোড হচ্ছে...</p>
            ) : allTimeBestSelling.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">কোনো বিক্রি ডাটা নেই</p>
            ) : (
              allTimeBestSelling.slice(0, 10).map((p, i) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                  <div className="h-8 w-8 rounded-md overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
                    {p.image ? (
                      <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <Package className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">{p.sold} বিক্রি</p>
                  </div>
                  <span className="text-sm font-semibold flex-shrink-0 whitespace-nowrap">৳{p.revenue.toLocaleString('bn-BD')}</span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Top products all dialog — "দেখুন"/"আরও দেখুন" only; shows whatever status filter is
          currently selected on the card itself, via the same filteredTopProducts used there. */}
      <Dialog open={showTopProductsAll} onOpenChange={setShowTopProductsAll}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{filteredTopProductsTitle} — {topProductDateLabel}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {filteredTopProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{filteredTopProductsEmptyText}</p>
            ) : (
              <div className="space-y-1">
                {filteredTopProducts.map((p, i) => (
                  <div key={p.name}>
                    <div className="flex items-center gap-3 py-2.5">
                      <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                      <div className="h-9 w-9 rounded-md overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
                        {p.image ? (
                          <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                        ) : (
                          <Package className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground">{p.sold} বিক্রি · ৳{p.revenue.toLocaleString('bn-BD')}</p>
                      </div>
                      <span className="text-sm font-semibold flex-shrink-0 whitespace-nowrap">{p.sold}</span>
                    </div>
                    {i < filteredTopProducts.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* All-time best selling dialog */}
      <Dialog open={showAllTimeSales} onOpenChange={setShowAllTimeSales}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>সর্বকালের বেস্ট সেলিং প্রোডাক্ট</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {allTimeLoading ? (
              <p className="text-sm text-muted-foreground text-center py-8">লোড হচ্ছে...</p>
            ) : allTimeBestSelling.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">কোনো বিক্রি ডাটা নেই</p>
            ) : (
              <div className="space-y-1">
                {allTimeBestSelling.map((p, i) => (
                  <div key={p.name}>
                    <div className="flex items-center gap-3 py-2.5">
                      <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                      <div className="h-9 w-9 rounded-md overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
                        {p.image ? (
                          <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                        ) : (
                          <Package className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground">{p.sold} বিক্রি</p>
                      </div>
                      <span className="text-sm font-semibold flex-shrink-0 whitespace-nowrap">৳{p.revenue.toLocaleString('bn-BD')}</span>
                    </div>
                    {i < allTimeBestSelling.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
