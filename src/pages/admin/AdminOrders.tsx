import { useState, useRef, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import HoverImagePreview from '@/components/admin/HoverImagePreview';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActivityLog } from '@/hooks/useActivityLog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { cn, normalizeBDPhone, toLocalDateStr } from '@/lib/utils';
import { Search, Printer, Eye, Truck, ChevronDown, Check, Trash2, CalendarIcon, SlidersHorizontal, RotateCcw, XCircle, RefreshCw, ChevronLeft, ChevronRight, Share2, Copy, MessageSquare, PackageCheck, Inbox } from 'lucide-react';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { bn } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { SmartRangeCalendar } from '@/components/ui/smart-range-calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import ManualOrderDialog from '@/components/admin/ManualOrderDialog';

import CourierActions from '@/components/admin/CourierActions';
import OrderInvoice from '@/components/admin/OrderInvoice';
import OrderPreviewDialog from '@/components/admin/OrderPreviewDialog';
import CustomerLoyaltyBadge from '@/components/admin/CustomerLoyaltyBadge';
import OrderChecklistDialog from '@/components/admin/OrderChecklistDialog';
import FraudCheckerDialog, { analyzeCustomer, riskConfig } from '@/components/admin/FraudCheckerDialog';
import { useBDCourierCache } from '@/hooks/useBDCourierCache';
import { ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { useAccounts } from '@/hooks/useAccounting';
import { ensureOfficeSellSaleEntry, deleteOfficeSellSaleEntry } from '@/lib/officeSellSaleEntry';
import { logAccActivity } from '@/hooks/useAccActivityLog';
import { getColorPrimaryImage } from '@/lib/productVariants';

function shortTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'এইমাত্র';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} মি. আগে`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ঘ. আগে`;
  return format(date, 'dd MMM', { locale: bn });
}

const bnToEnDigits = (s: string) => s.replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d).toString());

// The order-list thumbnail must show the actual color variant ordered, not just the
// product's default photo — mirrors the case-insensitive lookup already used in
// OrderPreviewDialog and the print-invoice builders in this file.
function getOrderItemImage(item: any): string | null {
  const colorImages = (item.products?.variant_images as any)?.color_images;
  return getColorPrimaryImage(colorImages, item.color) || item.products?.images?.[0] || null;
}

const statuses = ['pending', 'confirmed', 'scheduled', 'hold', 'in_review', 'shipped', 'delivered', 'office_sell', 'cancelled', 'delivery_failed', 'paid_return', 'exchange'] as const;

// Order status → conversion-quality signal sent to Meta CAPI / GA4 / Google Ads
// (track-conversion edge function). COD orders start unverified at placement;
// "confirmed" tells the ad platforms this is a real sale, "cancelled"/
// "delivery_failed" signals it wasn't — helps Smart Bidding & Meta's algorithm
// stop optimizing toward customers who never actually pay.
const CONVERSION_STAGE_MAP: Record<string, string> = {
  confirmed: 'confirmed',
  shipped: 'shipped',
  delivered: 'delivered',
  office_sell: 'delivered',
  cancelled: 'cancelled',
  delivery_failed: 'cancelled',
  paid_return: 'returned',
};

function fireConversionStage(orderId: string, status: string) {
  const stage = CONVERSION_STAGE_MAP[status];
  if (!stage) return;
  supabase.functions.invoke('track-conversion', { body: { order_id: orderId, stage } }).catch(() => {});
}

const origins = ['all', 'website', 'manual', 'call', 'facebook', 'messenger', 'whatsapp', 'google', 'tiktok', 'instagram', 'imo'] as const;
const paymentStatuses = ['unpaid', 'paid', 'partial'] as const;

const paymentLabel: Record<string, string> = {
  unpaid: 'ক্যাশ',
  paid: 'পরিশোধিত',
  partial: 'আংশিক',
};

const paymentColor: Record<string, string> = {
  unpaid: 'bg-blue-50 text-blue-600',
  paid: 'bg-green-100 text-green-700',
  partial: 'bg-yellow-100 text-yellow-700',
};

const paymentDot: Record<string, string> = {
  unpaid: 'bg-blue-500',
  paid: 'bg-green-500',
  partial: 'bg-yellow-500',
};

const statusColor: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  scheduled: 'bg-cyan-100 text-cyan-700',
  hold: 'bg-orange-100 text-orange-700',
  in_review: 'bg-sky-100 text-sky-700',
  shipped: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  office_sell: 'bg-teal-100 text-teal-700',
  cancelled: 'bg-red-100 text-red-700',
  delivery_failed: 'bg-red-200 text-red-800',
  paid_return: 'bg-pink-100 text-pink-700',
  exchange: 'bg-indigo-100 text-indigo-700',
};

const statusDot: Record<string, string> = {
  pending: 'bg-yellow-500',
  confirmed: 'bg-blue-500',
  scheduled: 'bg-cyan-500',
  hold: 'bg-orange-500',
  in_review: 'bg-sky-500',
  shipped: 'bg-purple-500',
  delivered: 'bg-green-500',
  office_sell: 'bg-teal-500',
  cancelled: 'bg-red-500',
  delivery_failed: 'bg-red-700',
  paid_return: 'bg-pink-500',
  exchange: 'bg-indigo-500',
};

const statusGlow: Record<string, string> = {
  pending: 'shadow-[0_0_8px_rgba(234,179,8,0.4)]',
  confirmed: 'shadow-[0_0_8px_rgba(59,130,246,0.4)]',
  scheduled: 'shadow-[0_0_8px_rgba(6,182,212,0.4)]',
  hold: 'shadow-[0_0_8px_rgba(249,115,22,0.4)]',
  in_review: 'shadow-[0_0_8px_rgba(14,165,233,0.4)]',
  shipped: 'shadow-[0_0_8px_rgba(168,85,247,0.4)]',
  delivered: 'shadow-[0_0_8px_rgba(34,197,94,0.4)]',
  office_sell: 'shadow-[0_0_8px_rgba(20,184,166,0.4)]',
  cancelled: 'shadow-[0_0_8px_rgba(239,68,68,0.4)]',
  delivery_failed: 'shadow-[0_0_8px_rgba(185,28,28,0.4)]',
  paid_return: 'shadow-[0_0_8px_rgba(236,72,153,0.4)]',
  exchange: 'shadow-[0_0_8px_rgba(99,102,241,0.4)]',
};

const statusLabel: Record<string, string> = {
  pending: 'পেন্ডিং',
  confirmed: 'কনফার্মড',
  scheduled: 'শিডিউলড',
  hold: 'হোল্ড',
  in_review: 'ইন রিভিউ',
  shipped: 'শিপড',
  delivered: 'ডেলিভার্ড',
  office_sell: 'অফিস সেল',
  cancelled: 'বাতিল',
  delivery_failed: 'ডেলিভারি ব্যর্থ',
  paid_return: 'পেইড রিটার্ন',
  exchange: 'এক্সচেঞ্জ',
};

const originColor: Record<string, string> = {
  website: 'bg-blue-50 text-blue-600',
  manual: 'bg-orange-50 text-orange-600',
  facebook: 'bg-indigo-50 text-indigo-600',
  google: 'bg-green-50 text-green-600',
  whatsapp: 'bg-emerald-50 text-emerald-600',
  tiktok: 'bg-gray-100 text-gray-800',
  instagram: 'bg-pink-50 text-pink-600',
  office: 'bg-purple-50 text-purple-600',
  exchange: 'bg-indigo-50 text-indigo-600',
};

const ORDERS_PER_PAGE = 100;

export default function AdminOrders() {
  const qc = useQueryClient();

  // Realtime: auto-refresh order list when courier_status changes (via webhook)
  // so admins never have to click a manual sync button.
  useEffect(() => {
    const channel = supabase
      .channel('admin-orders-courier-status')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          const oldRow: any = payload.old || {};
          const newRow: any = payload.new || {};
          if (oldRow.courier_status !== newRow.courier_status) {
            qc.invalidateQueries({ queryKey: ['admin-orders'] });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'courier_tracking_events' },
        () => {
          qc.invalidateQueries({ queryKey: ['admin-orders'] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const [searchParams, setSearchParams] = useSearchParams();
  // Initialize filter/page state from URL so that refresh / save preserves the user's spot
  const [filter, setFilter] = useState<string>(() => searchParams.get('status') || 'all');
  const [originFilter, setOriginFilter] = useState<string>(() => searchParams.get('origin') || 'all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>(() => searchParams.get('payment_status') || 'all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>(() => searchParams.get('payment_method') || 'all');
  const [showTrash, setShowTrash] = useState(() => searchParams.get('trash') === '1');
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || '');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [previewOrder, setPreviewOrder] = useState<any>(null);
  const [printOrder, setPrintOrder] = useState<any>(null);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [printItems, setPrintItems] = useState<any[]>([]);
  const printRef = useRef<HTMLDivElement>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [syncAllLoading, setSyncAllLoading] = useState(false);
  const [bulkPrintData, setBulkPrintData] = useState<{ order: any; items: any[] }[]>([]);
  const [fraudPhone, setFraudPhone] = useState<string | null>(null);
  const [refreshingPhone, setRefreshingPhone] = useState<string | null>(null);
  const [summaryRange, setSummaryRange] = useState<DateRange>({ from: new Date(), to: new Date() });
  const [currentPage, setCurrentPage] = useState(() => {
    const p = parseInt(searchParams.get('page') || '1', 10);
    return Number.isFinite(p) && p > 0 ? p : 1;
  });
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [partialPaymentOrder, setPartialPaymentOrder] = useState<any>(null);
  const [partialPaymentAmount, setPartialPaymentAmount] = useState('');
  // Scheduled-dispatch date picker
  const [scheduleDialog, setScheduleDialog] = useState<{ orderIds: string[]; orderRef?: any; isBulk: boolean } | null>(null);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined);
  // Track number of additional "View More" batches loaded so refresh can restore them
  const [loadedExtra, setLoadedExtra] = useState<number>(() => {
    const n = parseInt(searchParams.get('loaded') || '0', 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  });
  const isFirstMount = useRef(true);

  // Fetch active coupon for print invoices
  const { data: activeCoupon } = useQuery({
    queryKey: ['active-coupon-for-print'],
    queryFn: async () => {
      const { data } = await supabase
        .from('coupons')
        .select('code, discount_type, discount_value')
        .eq('is_active', true)
        .limit(1);
      return data?.[0] || null;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Today's scheduled-dispatch reminders (Asia/Dhaka local date)
  const todayStr = toLocalDateStr(new Date());
  const { data: scheduledTodayOrders = [] } = useQuery({
    queryKey: ['scheduled-dispatch-today', todayStr],
    queryFn: async () => {
      const { data } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, customer_phone, total, scheduled_dispatch_date')
        .eq('status', 'scheduled')
        .lte('scheduled_dispatch_date' as any, todayStr)
        .is('deleted_at' as any, null)
        .order('scheduled_dispatch_date' as any, { ascending: true })
        .limit(200);
      return (data || []) as any[];
    },
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  // Returned parcels awaiting physical receipt at the office — broken down by status
  const { data: returnPendingData = { byStatus: {} as Record<string, number>, total: 0 } } = useQuery({
    queryKey: ['return-pending-by-status'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('orders')
        .select('status')
        .eq('return_pending', true)
        .is('return_received_at', null)
        .is('deleted_at', null);
      const byStatus: Record<string, number> = {};
      (data || []).forEach((r: any) => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });
      return { byStatus, total: (data || []).length };
    },
    staleTime: 30 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });
  const returnPendingByStatus = returnPendingData?.byStatus || {};
  const returnPendingCount = returnPendingData?.total || 0;

  // Fetch ALL orders for fraud analysis (no filters)
  const { data: allOrdersForFraud = [] } = useQuery({
    queryKey: ['all-orders-fraud'],
    queryFn: async () => {
      const { data, error } = await supabase.from('orders')
        .select('id, customer_phone, customer_name, customer_address, status, total, created_at, order_number')
        .is('deleted_at' as any, null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 min — realtime invalidates on order changes
  });

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['admin-orders', filter, originFilter, paymentStatusFilter, paymentMethodFilter, searchQuery, showTrash, currentPage],
    queryFn: async () => {
      let q = supabase.from('orders').select('id, order_number, customer_name, customer_phone, customer_address, city, delivery_area, delivery_charge, subtotal, total, status, notes, created_at, order_origin, courier_consignment_id, courier_status, courier_provider, payment_status, payment_method, payment_invoice_id, paid_at, deleted_at, order_attribution, discount_note, free_shipping, is_pre_order, paid_amount, due_amount, scheduled_dispatch_date, return_pending, return_received_at', { count: 'exact' }).order('created_at', { ascending: false });
      if (showTrash) {
        q = q.not('deleted_at' as any, 'is', null);
      } else {
        q = q.is('deleted_at' as any, null);
      }
      if (filter === '__return_pending__') {
        q = (q as any).eq('return_pending', true).is('return_received_at' as any, null);
      } else if (filter.startsWith('__return_pending__:')) {
        const s = filter.split(':')[1];
        q = (q as any).eq('status', s).eq('return_pending', true).is('return_received_at' as any, null);
      } else if (filter !== 'all') q = q.eq('status', filter);
      if (paymentStatusFilter !== 'all') {
        q = q.eq('payment_status', paymentStatusFilter);
      }
      if (paymentMethodFilter !== 'all') {
        q = q.eq('payment_method', paymentMethodFilter);
      }
      if (originFilter !== 'all') {
        if (['facebook', 'whatsapp', 'instagram', 'tiktok', 'google', 'imo', 'messenger'].includes(originFilter)) {
          q = q.or(`order_origin.eq.${originFilter},order_origin.like.%+${originFilter}%`);
        } else if (originFilter === 'manual') {
          q = q.or(`order_origin.eq.manual,order_origin.like.manual+%`);
        } else {
          q = q.eq('order_origin', originFilter);
        }
      }
      if (searchQuery === '__preorder__') {
        q = (q as any).eq('is_pre_order', true);
      } else if (searchQuery) {
        const raw = searchQuery;
        const hasDigits = /\d/.test(raw);
        const normalized = hasDigits ? normalizeBDPhone(raw) : '';
        if (hasDigits && normalized.length >= 4 && normalized !== raw) {
          q = q.or(`order_number.ilike.%${raw}%,customer_name.ilike.%${raw}%,customer_phone.ilike.%${raw}%,customer_phone.ilike.%${normalized}%`);
        } else {
          q = q.or(`order_number.ilike.%${raw}%,customer_name.ilike.%${raw}%,customer_phone.ilike.%${raw}%`);
        }
      }
      const from = (currentPage - 1) * ORDERS_PER_PAGE;
      const to = from + ORDERS_PER_PAGE - 1;
      q = q.range(from, to);
      const { data, error, count } = await q;
      if (error) throw error;
      return { orders: data || [], totalCount: count || 0 };
    },
  });

  const baseOrders = ordersData?.orders || [];
  const totalCount = ordersData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / ORDERS_PER_PAGE);

  // Extra orders loaded via "View More" button
  const [extraOrders, setExtraOrders] = useState<any[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);

  const orders = useMemo(() => [...baseOrders, ...extraOrders], [baseOrders, extraOrders]);

  // Reset page and extra orders on filter changes — but not on first mount (URL state restore)
  useEffect(() => {
    if (isFirstMount.current) return;
    setCurrentPage(1);
    setExtraOrders([]);
    setLoadedExtra(0);
  }, [filter, originFilter, paymentStatusFilter, paymentMethodFilter, searchQuery, showTrash]);

  // Sync filter/page state to URL so refresh / save preserves user's spot
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    const setOrDel = (key: string, val: string, defaultVal: string) => {
      if (val && val !== defaultVal) next.set(key, val); else next.delete(key);
    };
    setOrDel('status', filter, 'all');
    setOrDel('origin', originFilter, 'all');
    setOrDel('payment_status', paymentStatusFilter, 'all');
    setOrDel('payment_method', paymentMethodFilter, 'all');
    setOrDel('q', searchQuery, '');
    if (showTrash) next.set('trash', '1'); else next.delete('trash');
    if (currentPage > 1) next.set('page', String(currentPage)); else next.delete('page');
    if (loadedExtra > 0) next.set('loaded', String(loadedExtra)); else next.delete('loaded');
    // Only update if something actually changed to avoid loops
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // After first mount sync, allow filter-change reset
    isFirstMount.current = false;
  }, [filter, originFilter, paymentStatusFilter, paymentMethodFilter, searchQuery, showTrash, currentPage, loadedExtra]);

  // On mount: if URL says we had additional batches loaded, restore them in one shot
  const restoredExtraRef = useRef(false);
  useEffect(() => {
    if (restoredExtraRef.current) return;
    if (loadedExtra <= 0 || baseOrders.length === 0) return;
    restoredExtraRef.current = true;
    (async () => {
      try {
        const from = currentPage * ORDERS_PER_PAGE; // i.e. (currentPage-1)*PP + PP
        const to = from + loadedExtra * ORDERS_PER_PAGE - 1;
        let q = supabase.from('orders').select('id, order_number, customer_name, customer_phone, customer_address, city, delivery_area, delivery_charge, subtotal, total, status, notes, created_at, order_origin, courier_consignment_id, courier_status, courier_provider, payment_status, payment_method, payment_invoice_id, paid_at, deleted_at, order_attribution, discount_note, free_shipping, is_pre_order, paid_amount, due_amount').order('created_at', { ascending: false });
        if (showTrash) q = q.not('deleted_at' as any, 'is', null); else q = q.is('deleted_at' as any, null);
        if (filter !== 'all') q = q.eq('status', filter);
        if (paymentStatusFilter !== 'all') q = q.eq('payment_status', paymentStatusFilter);
        if (paymentMethodFilter !== 'all') q = q.eq('payment_method', paymentMethodFilter);
        if (originFilter !== 'all') {
          if (['facebook', 'whatsapp', 'instagram', 'tiktok', 'google', 'imo', 'messenger'].includes(originFilter)) {
            q = q.or(`order_origin.eq.${originFilter},order_origin.like.%+${originFilter}%`);
          } else if (originFilter === 'manual') {
            q = q.or(`order_origin.eq.manual,order_origin.like.manual+%`);
          } else {
            q = q.eq('order_origin', originFilter);
          }
        }
        if (searchQuery === '__preorder__') {
          q = (q as any).eq('is_pre_order', true);
        } else if (searchQuery) {
          const raw = searchQuery;
          const hasDigits = /\d/.test(raw);
          const normalized = hasDigits ? normalizeBDPhone(raw) : '';
          if (hasDigits && normalized.length >= 4 && normalized !== raw) {
            q = q.or(`order_number.ilike.%${raw}%,customer_name.ilike.%${raw}%,customer_phone.ilike.%${raw}%,customer_phone.ilike.%${normalized}%`);
          } else {
            q = q.or(`order_number.ilike.%${raw}%,customer_name.ilike.%${raw}%,customer_phone.ilike.%${raw}%`);
          }
        }
        q = q.range(from, to);
        const { data } = await q;
        if (data && data.length > 0) setExtraOrders(data);
      } catch {}
    })();
  }, [baseOrders.length, loadedExtra]);

  const totalVisible = (currentPage - 1) * ORDERS_PER_PAGE + orders.length;
  const hasMore = totalVisible < totalCount;

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const from = (currentPage - 1) * ORDERS_PER_PAGE + orders.length;
      const to = from + ORDERS_PER_PAGE - 1;
      let q = supabase.from('orders').select('id, order_number, customer_name, customer_phone, customer_address, city, delivery_area, delivery_charge, subtotal, total, status, notes, created_at, order_origin, courier_consignment_id, courier_status, courier_provider, payment_status, payment_method, payment_invoice_id, paid_at, deleted_at, order_attribution, discount_note, free_shipping, is_pre_order, paid_amount, due_amount').order('created_at', { ascending: false });
      if (showTrash) {
        q = q.not('deleted_at' as any, 'is', null);
      } else {
        q = q.is('deleted_at' as any, null);
      }
      if (filter !== 'all') q = q.eq('status', filter);
      if (paymentStatusFilter !== 'all') q = q.eq('payment_status', paymentStatusFilter);
      if (paymentMethodFilter !== 'all') q = q.eq('payment_method', paymentMethodFilter);
      if (originFilter !== 'all') {
        if (['facebook', 'whatsapp', 'instagram', 'tiktok', 'google', 'imo', 'messenger'].includes(originFilter)) {
          q = q.or(`order_origin.eq.${originFilter},order_origin.like.%+${originFilter}%`);
        } else if (originFilter === 'manual') {
          q = q.or(`order_origin.eq.manual,order_origin.like.manual+%`);
        } else {
          q = q.eq('order_origin', originFilter);
        }
      }
      if (searchQuery === '__preorder__') {
        q = (q as any).eq('is_pre_order', true);
      } else if (searchQuery) {
        const raw = searchQuery;
        const hasDigits = /\d/.test(raw);
        const normalized = hasDigits ? normalizeBDPhone(raw) : '';
        if (hasDigits && normalized.length >= 4 && normalized !== raw) {
          q = q.or(`order_number.ilike.%${raw}%,customer_name.ilike.%${raw}%,customer_phone.ilike.%${raw}%,customer_phone.ilike.%${normalized}%`);
        } else {
          q = q.or(`order_number.ilike.%${raw}%,customer_name.ilike.%${raw}%,customer_phone.ilike.%${raw}%`);
        }
      }
      q = q.range(from, to);
      const { data } = await q;
      if (data && data.length > 0) {
        setExtraOrders(prev => [...prev, ...data]);
        setLoadedExtra(prev => prev + 1);
      }
    } catch (e) {
      toast.error('আরো অর্ডার লোড করতে সমস্যা হয়েছে');
    }
    setLoadingMore(false);
  };

  // Auto-open order preview from ?preview= URL param (e.g. from push notification click)
  const previewIdFromUrl = searchParams.get('preview');
  useEffect(() => {
    if (!previewIdFromUrl || isLoading) return;
    const order = orders.find((o: any) => o.id === previewIdFromUrl);
    if (order) {
      setPreviewOrder(order);
      setSearchParams(prev => { prev.delete('preview'); return prev; }, { replace: true });
    } else {
      supabase.from('orders').select('*').eq('id', previewIdFromUrl).maybeSingle()
        .then(({ data }) => {
          if (data) setPreviewOrder(data);
          setSearchParams(prev => { prev.delete('preview'); return prev; }, { replace: true });
        });
    }
  }, [previewIdFromUrl, orders, isLoading]);

  // Live preview query — keeps the open dialog in sync with backend changes
  // (e.g. courier tracking ID assigned right after sending to courier)
  const { data: livePreviewOrder } = useQuery({
    queryKey: ['admin-order-preview', previewOrder?.id],
    queryFn: async () => {
      if (!previewOrder?.id) return null;
      const { data } = await supabase.from('orders').select('*').eq('id', previewOrder.id).maybeSingle();
      return data;
    },
    enabled: !!previewOrder?.id,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Merge live courier/status fields into previewOrder snapshot whenever fresh data arrives
  useEffect(() => {
    if (!livePreviewOrder || !previewOrder?.id || livePreviewOrder.id !== previewOrder.id) return;
    const changed =
      livePreviewOrder.courier_consignment_id !== previewOrder.courier_consignment_id ||
      livePreviewOrder.courier_status !== previewOrder.courier_status ||
      livePreviewOrder.courier_provider !== previewOrder.courier_provider;
    if (changed) {
      setPreviewOrder((prev: any) => prev && prev.id === livePreviewOrder.id ? { ...prev, ...livePreviewOrder } : prev);
    }
  }, [livePreviewOrder]);

  const { getCourierData, fetchPhone, refreshPhone, preloadFromDB, preloadPhones } = useBDCourierCache();

  // The courier-check cache is a per-browser in-memory/localStorage cache —
  // a check done on one device/admin never showed up for anyone else, since
  // nothing ever loaded the already-saved customers.courier_data rows into
  // that cache. Hydrate it once on mount so previously-checked results (from
  // any device, or the new auto-check trigger) are visible here too.
  useEffect(() => { preloadFromDB(); }, [preloadFromDB]);

  // preloadFromDB above only runs once (gated by a one-time flag), so a check
  // that the auto-check trigger completes AFTER this page was first opened —
  // e.g. a brand new order that gets checked a few seconds after it appears
  // in this very list — never showed up without a hard reload. Re-ask for
  // just the currently-visible phones every time the order list refreshes.
  useEffect(() => {
    preloadPhones(orders.map((o: any) => o.customer_phone));
  }, [orders, preloadPhones]);

  // Fetch admin notes from order_notes table
  const { data: orderNotes = [] } = useQuery({
    queryKey: ['order-notes-list'],
    queryFn: async () => {
      const { data } = await supabase.from('order_notes')
        .select('id, order_id, note, created_by, created_at')
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  // All-time pending, hold & pre-order counts
  const { data: allTimeCounts } = useQuery({
    queryKey: ['all-time-pending-hold-preorder'],
    queryFn: async () => {
      const pendingRes = await supabase.from('orders').select('id', { count: 'exact', head: true }).is('deleted_at' as any, null).eq('status', 'pending');
      const holdRes = await supabase.from('orders').select('id', { count: 'exact', head: true }).is('deleted_at' as any, null).eq('status', 'hold');
      const preOrderRes = await (supabase.from('orders').select('id', { count: 'exact', head: true }) as any).is('deleted_at', null).eq('is_pre_order', true);
      return { pending: pendingRes.count ?? 0, hold: holdRes.count ?? 0, preOrder: preOrderRes.count ?? 0 };
    },
    staleTime: 3 * 60 * 1000, // 3 min — realtime invalidates on order INSERT/UPDATE
  });

  // Fetch order items with product images for visible orders
  const orderIds = useMemo(() => orders.map((o: any) => o.id), [orders]);
  const orderIdsKey = useMemo(() => JSON.stringify(orderIds), [orderIds]);
  const { data: orderItemsRaw = [], isLoading: isItemsLoading } = useQuery({
    queryKey: ['order-items-for-list', orderIdsKey],
    enabled: orderIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_items')
        .select('order_id, product_name, quantity, price, size, color, item_type, products!order_items_product_id_fkey(images, variant_images)')
        .in('order_id', orderIds.slice(0, 200));
      if (error) throw error;
      return data || [];
    },
    staleTime: 30 * 1000,
  });

  const orderItemsMap = useMemo(() => {
    const map = new Map<string, typeof orderItemsRaw>();
    orderItemsRaw.forEach((item: any) => {
      const arr = map.get(item.order_id) || [];
      arr.push(item);
      map.set(item.order_id, arr);
    });
    return map;
  }, [orderItemsRaw]);

  // Batched customer lookup for loyalty badges (one query for all visible orders)
  const phonesForLoyalty = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o: any) => { if (o.customer_phone) set.add(o.customer_phone); });
    return Array.from(set);
  }, [orders]);
  const phonesKey = useMemo(() => JSON.stringify(phonesForLoyalty), [phonesForLoyalty]);
  const { data: customerRecords = [] } = useQuery({
    queryKey: ['orders-list-customers', phonesKey],
    enabled: phonesForLoyalty.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('customers')
        .select('phone, name, address, delivered_orders, total_orders, total_spent')
        .in('phone', phonesForLoyalty.slice(0, 500));
      return data || [];
    },
    staleTime: 60 * 1000,
  });
  const customerLoyaltyMap = useMemo(() => {
    const map = new Map<string, any>();
    customerRecords.forEach((c: any) => { if (c.phone) map.set(c.phone, c); });
    return map;
  }, [customerRecords]);

  const notesMap = useMemo(() => {
    const map = new Map<string, typeof orderNotes>();
    orderNotes.forEach(n => {
      const arr = map.get(n.order_id) || [];
      arr.push(n);
      map.set(n.order_id, arr);
    });
    return map;
  }, [orderNotes]);

  const handleRefreshCourier = async (phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRefreshingPhone(phone);
    // Was a silent catch {} before — a failed check (API key missing, courier
    // API down/rate-limited, etc.) looked exactly like a check that "later
    // disappeared", since nothing ever told the admin it actually failed.
    try { await refreshPhone(phone); } catch (e: any) { toast.error(`ফ্রড চেক ব্যর্থ: ${e.message || 'অজানা সমস্যা'}`); }
    setRefreshingPhone(null);
  };

  // Auto sale entry hooks
  const { data: accAccounts = [] } = useAccounts();

  const autoSaleEntry = async (orderId: string, amount?: number, source?: 'cash' | 'bank') => {
    await ensureOfficeSellSaleEntry(orderId, { source, amount });
  };

  const autoDeliveryFailEntry = async (_orderId: string, _deliveryCharge: number) => {
    return; // Disabled: no longer deducting delivery charge on failed delivery
  };

  const dailySummary = useMemo(() => {
     const from = summaryRange?.from || new Date();
     const to = summaryRange?.to || from;
     const fromStr = format(from, 'yyyy-MM-dd');
     const toStr = format(to, 'yyyy-MM-dd');
     const dayOrders = allOrdersForFraud.filter(o => {
       const d = format(new Date(o.created_at), 'yyyy-MM-dd');
       return d >= fromStr && d <= toStr;
     });
    const counts: Record<string, number> = {};
    statuses.forEach(s => counts[s] = 0);
    dayOrders.forEach(o => { counts[o.status] = (counts[o.status] || 0) + 1; });
    const totalAmount = dayOrders.reduce((s, o) => s + Number(o.total), 0);
    const sumByStatus = (st: string) =>
      dayOrders.filter(o => o.status === st).reduce((s, o) => s + Number(o.total || 0), 0);
    const confirmedAmount = sumByStatus('confirmed');
    const shippedAmount = sumByStatus('shipped');
    const deliveredAmount = sumByStatus('delivered');
    const officeSellAmount = sumByStatus('office_sell');
    return { total: dayOrders.length, counts, totalAmount, confirmedAmount, shippedAmount, deliveredAmount, officeSellAmount };
  }, [allOrdersForFraud, summaryRange]);

  // সর্বমোট (তারিখ-নিরপেক্ষ) স্ট্যাটাস কাউন্ট — শুধু pending/confirmed/hold/scheduled এর জন্য
  // সর্বমোট (তারিখ-নিরপেক্ষ) স্ট্যাটাস কাউন্ট — সরাসরি DB থেকে accurate count (1000-row limit বাইপাস)
  const { data: allTimeStatusCounts = { pending: 0, confirmed: 0, in_review: 0, hold: 0, scheduled: 0, shipped: 0 } } = useQuery({
    queryKey: ['orders-status-counts-all-time'],
    queryFn: async () => {
      const targetStatuses = ['pending', 'confirmed', 'in_review', 'hold', 'scheduled', 'shipped'] as const;
      const results = await Promise.all(
        targetStatuses.map(async (s) => {
          const { count } = await supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .is('deleted_at' as any, null)
            .eq('status', s);
          return [s, count || 0] as const;
        })
      );
      return Object.fromEntries(results) as Record<string, number>;
    },
    staleTime: 2 * 60 * 1000,
  });

  const { logActivity } = useActivityLog();

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, oldStatus, subtotal, delivery_charge, scheduled_dispatch_date }: { id: string; status: string; oldStatus?: string; subtotal?: number; delivery_charge?: number; scheduled_dispatch_date?: string | null }) => {
      const updatePayload: any = { status };
      if (status === 'scheduled') {
        updatePayload.scheduled_dispatch_date = scheduled_dispatch_date || null;
      }
      const { error } = await supabase.from('orders').update(updatePayload).eq('id', id);
      if (error) throw error;
      if (status === 'office_sell' && subtotal) {
        const { data: orderForPayment } = await supabase.from('orders').select('payment_status, paid_amount').eq('id', id).single();
        const ps = orderForPayment?.payment_status;
        if (ps === 'paid' || ps === 'partial') {
          const paidAmt = Number(orderForPayment?.paid_amount || subtotal);
          await autoSaleEntry(id, paidAmt, 'bank');
        } else {
          await autoSaleEntry(id, subtotal, 'cash');
        }
      }
      // Remove sale entry when leaving office_sell (race-proof: always try cleanup for non-office_sell)
      if (status !== 'office_sell') {
        try { await deleteOfficeSellSaleEntry(id); } catch (e) { console.error('deleteOfficeSellSaleEntry error:', e); }
      }
      if (status === 'delivery_failed' && delivery_charge) {
        await autoDeliveryFailEntry(id, delivery_charge);
      }
      // Trigger notification for status changes
      const notifTypeMap: Record<string, string> = {
        confirmed: 'processing',
        shipped: 'shipped',
        delivered: 'delivered',
      };
      const notifType = notifTypeMap[status];
      if (notifType) {
        // Only the delivered thank-you/reorder SMS is turned on here — it
        // only needs to fire once, the moment an order newly becomes delivered.
        const sendSms = notifType === 'delivered' && oldStatus !== 'delivered';
        supabase.functions.invoke('send-order-notification', {
          body: { order_id: id, type: notifType, send_sms: sendSms },
        }).catch(() => {});
      }
      // Tell Meta/GA4/Google Ads whether this order turned out to be a real sale
      fireConversionStage(id, status);
      // Update delivered_orders count on customer
      const deliveredStatuses = ['delivered', 'office_sell'];
      const wasDelivered = oldStatus ? deliveredStatuses.includes(oldStatus) : false;
      const isNowDelivered = deliveredStatuses.includes(status);
      if (wasDelivered !== isNowDelivered) {
        const { data: order } = await supabase.from('orders').select('customer_phone').eq('id', id).single();
        if (order?.customer_phone) {
          const { data: cust } = await supabase.from('customers').select('id, delivered_orders').eq('phone', order.customer_phone).maybeSingle();
          if (cust) {
            const newCount = Math.max(0, (cust.delivered_orders || 0) + (isNowDelivered ? 1 : -1));
            await supabase.from('customers').update({ delivered_orders: newCount }).eq('id', cust.id);
          }
        }
      }
      return { id, status, oldStatus };
    },
    onSuccess: async (data) => {
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      qc.invalidateQueries({ queryKey: ['all-orders-fraud'] });
      qc.invalidateQueries({ queryKey: ['customer-stats'] });
      qc.invalidateQueries({ queryKey: ['admin-customers'] });
      qc.invalidateQueries({ queryKey: ['acc-accounts'] });
      qc.invalidateQueries({ queryKey: ['acc-transactions'] });
      qc.invalidateQueries({ queryKey: ['scheduled-dispatch-today'] });
      toast.success('স্ট্যাটাস আপডেট হয়েছে');
      if (data?.oldStatus && data.oldStatus !== data.status) {
        const oldLabel = statusLabel[data.oldStatus] || data.oldStatus;
        const newLabel = statusLabel[data.status] || data.status;
        await logActivity('order_status_change', 'order', data.id, `স্ট্যাটাস পরিবর্তন: ${oldLabel} → ${newLabel}`, { old_status: data.oldStatus, new_status: data.status });
      }
    },
  });

  // Mark returned parcel(s) as physically received at office
  const markReturnReceived = useMutation({
    mutationFn: async (orderIds: string[]) => {
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await (supabase as any).from('orders').update({
        return_received_at: new Date().toISOString(),
        return_received_by: session?.user?.id || null,
        return_pending: false,
      }).in('id', orderIds);
      if (error) throw error;
      return orderIds;
    },
    onSuccess: async (ids) => {
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      qc.invalidateQueries({ queryKey: ['return-pending-by-status'] });
      toast.success(`${ids.length}টি ফেরত পার্সেল গ্রহণ করা হয়েছে ✓`);
      for (const id of ids) {
        await logActivity('return_received', 'order', id, 'ফেরত পার্সেল গ্রহণ করা হয়েছে', {});
      }
    },
    onError: (e: any) => toast.error(e?.message || 'আপডেট ব্যর্থ হয়েছে'),
  });

  const updatePayment = useMutation({
    mutationFn: async ({ id, payment_status, paidAmount, orderTotal, oldPaymentStatus, orderNumber }: { id: string; payment_status: string; paidAmount?: number; orderTotal?: number; oldPaymentStatus?: string; orderNumber?: string }) => {
      const total = orderTotal || 0;
      let paid = paidAmount ?? (payment_status === 'paid' ? total : 0);
      let due = Math.max(total - paid, 0);
      
      const { error } = await supabase.from('orders').update({ 
        payment_status,
        paid_amount: paid,
        due_amount: due,
      } as any).eq('id', id);
      if (error) throw error;
      
      // Fetch current order status to guard sale entries
      const { data: currentOrder } = await supabase.from('orders').select('status').eq('id', id).single();
      const isOfficeSell = (currentOrder as any)?.status === 'office_sell';

      if (payment_status === 'unpaid') {
        // Delete previous sale entry when reverting to unpaid
        await deleteOfficeSellSaleEntry(id);
      } else if (paid > 0 && (payment_status === 'paid' || payment_status === 'partial')) {
        // Create bank sale entry for any paid/partial order (office_sell or regular)
        await ensureOfficeSellSaleEntry(id, { source: 'bank', amount: paid, silent: true, allowAnyStatus: !isOfficeSell });
      }

      // Activity log for order history
      const oldLabel = paymentLabel[oldPaymentStatus || 'unpaid'] || oldPaymentStatus || 'ক্যাশ';
      const newLabel = paymentLabel[payment_status] || payment_status;
      const desc = `পেমেন্ট: ${oldLabel} → ${newLabel}` + (paid > 0 ? ` (৳${paid})` : '');

      logActivity('payment_update', 'order', id, desc, { old_status: oldPaymentStatus, new_status: payment_status, paid_amount: paid });

      // Accounting activity log
      await logAccActivity({
        action: payment_status === 'unpaid' ? 'delete' : 'update',
        entity_type: 'transaction',
        entity_id: id,
        entity_name: orderNumber || '',
        description: desc,
        new_data: { payment_status, paid_amount: paid, due_amount: due },
        old_data: { payment_status: oldPaymentStatus },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      qc.invalidateQueries({ queryKey: ['acc-accounts'] });
      qc.invalidateQueries({ queryKey: ['acc-transactions'] });
      qc.invalidateQueries({ queryKey: ['acc-activity-logs'] });
      qc.invalidateQueries({ queryKey: ['acc-transactions-paginated'] });
      qc.invalidateQueries({ queryKey: ['acc-transaction-summary'] });
      qc.invalidateQueries({ queryKey: ['acc-daily-history'] });
      qc.invalidateQueries({ queryKey: ['accounting-financials'] });
      qc.invalidateQueries({ queryKey: ['sales-history'] });
      toast.success('পেমেন্ট স্ট্যাটাস আপডেট হয়েছে');
    },
    onError: (err: any) => {
      console.error('Payment update failed:', err);
      toast.error('পেমেন্ট আপডেট ব্যর্থ — হিসাব সিঙ্ক হয়নি: ' + (err?.message || 'Unknown error'));
    },
  });

  // Cleanup print portals after printing
  useEffect(() => {
    const cleanup = () => { setPrintOrder(null); setPrintItems([]); setBulkPrintData([]); };
    window.addEventListener('afterprint', cleanup);
    return () => window.removeEventListener('afterprint', cleanup);
  }, []);

  // Background price reconciliation — fix stale order totals on load
  const reconcileRef = useRef<string>('');
  useEffect(() => {
    if (!orders.length || isLoading) return;
    const key = orders.map((o: any) => o.id).sort().join(',');
    if (reconcileRef.current === key) return;
    reconcileRef.current = key;

    const reconcile = async () => {
      try {
        const orderIds = orders.map((o: any) => o.id);
        // Fetch order_items for all visible orders
        const { data: allItems } = await supabase.from('order_items')
          .select('id, order_id, product_id, product_name, price, quantity, size, item_type')
          .in('order_id', orderIds);
        if (!allItems || !allItems.length) return;

        // Fetch products for price calculation
        const productIds = [...new Set(allItems.filter(i => i.product_id).map(i => i.product_id))];
        const { data: products } = productIds.length > 0
          ? await supabase.from('products').select('id, price, original_price, variant_images, addon_config').in('id', productIds)
          : { data: [] };
        const productMap = new Map((products || []).map((p: any) => [p.id, p]));

        // calcEffectivePrice matching OrderPreviewDialog logic
        const calcPrice = (product: any, size: string | null) => {
          if (!product) return null;
          const basePrice = (product.original_price && product.original_price > 0 && product.original_price < product.price)
            ? product.original_price : product.price;
          if (!size) return basePrice;
          const sd = (product.variant_images as any)?.size_data?.[size];
          if (!sd) return basePrice;
          if (sd.sale_price && sd.sale_price > 0) return sd.sale_price;
          return basePrice;
        };

        // Helper: check if item is an addon/bump that should skip reconciliation
        const isUpsellItem = (item: any) => {
          // Primary: check item_type column (durable metadata)
          if (item.item_type === 'addon' || item.item_type === 'bump') return true;
          // Fallback: prefix-based detection for legacy rows
          const itemName = (item as any).product_name || '';
          if (itemName.startsWith('[অ্যাড-অন]') || itemName.startsWith('[বাম্প]')) return true;
          // Heuristic: if item price matches addon_config.price of its product, it's an addon
          const product = productMap.get(item.product_id);
          if (product?.addon_config) {
            const config = typeof product.addon_config === 'string' ? JSON.parse(product.addon_config) : product.addon_config;
            if (config?.price && item.price === config.price && config.name) {
              return true;
            }
          }
          return false;
        };

        // Group items by order_id
        const itemsByOrder = new Map<string, typeof allItems>();
        allItems.forEach(item => {
          const arr = itemsByOrder.get(item.order_id) || [];
          arr.push(item);
          itemsByOrder.set(item.order_id, arr);
        });

        // Fix individual item prices and calculate correct subtotals
        const itemUpdates: { id: string; price: number }[] = [];
        const orderUpdates: { id: string; subtotal: number; total: number }[] = [];

        for (const o of orders as any[]) {
          const oItems = itemsByOrder.get(o.id) || [];
          let correctSubtotal = 0;
          for (const item of oItems) {
            // Skip add-on/bump items — their prices are set at checkout
            if (isUpsellItem(item)) {
              correctSubtotal += item.price * item.quantity;
              continue;
            }
            const product = productMap.get(item.product_id);
            const correctPrice = calcPrice(product, item.size);
            const effectivePrice = correctPrice ?? item.price;
            if (correctPrice && correctPrice !== item.price) {
              itemUpdates.push({ id: item.id, price: correctPrice });
            }
            correctSubtotal += effectivePrice * item.quantity;
          }

          // Calculate discount using unified helper (supports discount_note fallback)
          const { getOrderDiscount } = await import('@/lib/orderDiscount');
          const storedDiscount = getOrderDiscount(o);
          const effectiveDelivery = o.free_shipping ? 0 : (o.delivery_charge || 0);
          const correctTotal = correctSubtotal - storedDiscount + effectiveDelivery;

          if (Math.round(correctTotal) !== Math.round(Number(o.total)) || Math.round(correctSubtotal) !== Math.round(Number(o.subtotal))) {
            orderUpdates.push({ id: o.id, subtotal: correctSubtotal, total: correctTotal });
          }
        }

        // Batch update item prices
        for (const u of itemUpdates) {
          await supabase.from('order_items').update({ price: u.price }).eq('id', u.id);
        }

        // Batch update order totals
        for (const u of orderUpdates) {
          await supabase.from('orders').update({ subtotal: u.subtotal, total: u.total }).eq('id', u.id);
        }

        if (orderUpdates.length > 0) {
          console.log(`[Reconciliation] Fixed ${orderUpdates.length} orders, ${itemUpdates.length} items`);
          qc.invalidateQueries({ queryKey: ['admin-orders'] });
        }
      } catch (err) {
        console.error('[Reconciliation] Error:', err);
      }
    };

    reconcile();
  }, [orders, isLoading]);

  const handlePrint = async (order: any) => {
    setBulkPrintData([]); // clear bulk portal
    const { data } = await supabase.from('order_items').select('*').eq('order_id', order.id);
    const items = data || [];
    const productIds = [...new Set(items.filter(i => i.product_id).map(i => i.product_id))];
    const { data: products } = productIds.length > 0
      ? await supabase.from('products').select('id, images, variant_images, price, original_price').in('id', productIds)
      : { data: [] };
    const productMap = new Map((products || []).map((p: any) => [p.id, p]));
    const itemsWithImages = items.map(item => {
      const product = productMap.get(item.product_id);
      const colorImage = getColorPrimaryImage((product?.variant_images as any)?.color_images, item.color);
      return { ...item, image: colorImage || product?.images?.[0] || null, regular_price: product?.price || null };
    });
    setPrintOrder(order);
    setPrintItems(itemsWithImages);
    // Wait for React to render the portal, then print
    requestAnimationFrame(() => {
      setTimeout(async () => {
        const wrapper = document.querySelector('.print-invoice-wrapper') as HTMLElement;
        const { printInvoice } = await import('@/lib/invoicePrint');
        await printInvoice(wrapper?.firstElementChild as HTMLElement);
      }, 500);
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedOrders(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selectedOrders.length === orders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(orders.map((o: any) => o.id));
    }
  };

  const bulkPrint = async () => {
    setPrintOrder(null); // clear single portal
    setBulkLoading(true);
    const selected = orders.filter((o: any) => selectedOrders.includes(o.id));
    const allData: { order: any; items: any[] }[] = [];
    for (const order of selected) {
      const { data } = await supabase.from('order_items').select('*').eq('order_id', order.id);
      const items = data || [];
      const productIds = [...new Set(items.filter(i => i.product_id).map(i => i.product_id))];
      const { data: products } = productIds.length > 0
        ? await supabase.from('products').select('id, images, variant_images, price, original_price').in('id', productIds)
        : { data: [] };
      const productMap = new Map((products || []).map((p: any) => [p.id, p]));
      const itemsWithImages = items.map(item => {
        const product = productMap.get(item.product_id);
        const colorImage = item.color && (product?.variant_images as any)?.color_images?.[item.color];
        return { ...item, image: colorImage || product?.images?.[0] || null, regular_price: product?.price || null };
      });
      allData.push({ order, items: itemsWithImages });
    }
    setBulkPrintData(allData);
    // Wait for React to render the portal, then print
    requestAnimationFrame(() => {
      setTimeout(async () => {
        const wrapper = document.querySelector('.print-invoice-wrapper') as HTMLElement;
        if (wrapper) {
          const invoiceEls = Array.from(wrapper.children) as HTMLElement[];
          const { printBulkInvoices } = await import('@/lib/invoicePrint');
          await printBulkInvoices(wrapper, invoiceEls);
        }
        setBulkLoading(false);
      }, 500);
    });
  };

  const bulkStatusChange = async (status: string, scheduledDate?: string | null) => {
    setBulkLoading(true);
    const oldStatuses: Record<string, string> = {};
    orders.filter((o: any) => selectedOrders.includes(o.id)).forEach((o: any) => { oldStatuses[o.id] = o.status; });
    const updatePayload: any = { status };
    if (status === 'scheduled') updatePayload.scheduled_dispatch_date = scheduledDate || null;
    const { error } = await supabase.from('orders').update(updatePayload).in('id', selectedOrders);
    if (error) { toast.error('স্ট্যাটাস আপডেট ব্যর্থ'); }
    else {
      toast.success(`${selectedOrders.length}টি অর্ডারের স্ট্যাটাস "${statusLabel[status]}" করা হয়েছে`);
      // Log activity for each order
      for (const orderId of selectedOrders) {
        const oldStatus = oldStatuses[orderId];
        if (oldStatus && oldStatus !== status) {
          const oldLabel = statusLabel[oldStatus] || oldStatus;
          const newLabel = statusLabel[status] || status;
          logActivity('order_status_change', 'order', orderId, `স্ট্যাটাস পরিবর্তন: ${oldLabel} → ${newLabel}`, { old_status: oldStatus, new_status: status }).catch(() => {});
        }
      }
      // Trigger notification for bulk status changes
      const notifTypeMap: Record<string, string> = { confirmed: 'processing', shipped: 'shipped', delivered: 'delivered' };
      const notifType = notifTypeMap[status];
      if (notifType) {
        for (const orderId of selectedOrders) {
          // Only the delivered thank-you/reorder SMS is turned on here — it
          // only needs to fire once, the moment an order newly becomes delivered.
          const sendSms = notifType === 'delivered' && oldStatuses[orderId] !== 'delivered';
          supabase.functions.invoke('send-order-notification', { body: { order_id: orderId, type: notifType, send_sms: sendSms } }).catch(() => {});
        }
      }
      // Tell Meta/GA4/Google Ads whether these orders turned out to be real sales
      for (const orderId of selectedOrders) {
        fireConversionStage(orderId, status);
      }
      // Update delivered_orders for each affected customer
      const deliveredStatuses = ['delivered', 'office_sell'];
      const isNowDelivered = deliveredStatuses.includes(status);
      for (const orderId of selectedOrders) {
        const oldStatus = oldStatuses[orderId];
        const wasDelivered = oldStatus ? deliveredStatuses.includes(oldStatus) : false;
        if (wasDelivered !== isNowDelivered) {
          const affectedOrder = orders.find((o: any) => o.id === orderId);
          if (affectedOrder?.customer_phone) {
            const { data: cust } = await supabase.from('customers').select('id, delivered_orders').eq('phone', affectedOrder.customer_phone).maybeSingle();
            if (cust) {
              const newCount = Math.max(0, (cust.delivered_orders || 0) + (isNowDelivered ? 1 : -1));
              await supabase.from('customers').update({ delivered_orders: newCount }).eq('id', cust.id);
            }
          }
        }
      }
      // Remove sale entry when leaving office_sell (bulk, race-proof)
      if (status !== 'office_sell') {
        for (const orderId of selectedOrders) {
          try { await deleteOfficeSellSaleEntry(orderId); } catch {}
        }
      }
      // Auto sale entry for office_sell
      if (status === 'office_sell') {
        const saleOrders = orders.filter((o: any) => selectedOrders.includes(o.id));
        for (const o of saleOrders) {
          try {
            const ps = o.payment_status;
            if (ps === 'paid' || ps === 'partial') {
              await autoSaleEntry(o.id, Number(o.paid_amount || o.subtotal), 'bank');
            } else {
              await autoSaleEntry(o.id, Number(o.subtotal), 'cash');
            }
          } catch {}
        }
      }
      // Auto delivery fail entry
      if (status === 'delivery_failed') {
        const failedOrders = orders.filter((o: any) => selectedOrders.includes(o.id));
        for (const o of failedOrders) {
          try { await autoDeliveryFailEntry(o.id, Number(o.delivery_charge)); } catch {}
        }
      }
    }
    setSelectedOrders([]);
    setBulkLoading(false);
    qc.invalidateQueries({ queryKey: ['acc-accounts'] });
    qc.invalidateQueries({ queryKey: ['acc-transactions'] });
    qc.invalidateQueries({ queryKey: ['admin-orders'] });
  };

  const bulkDelete = async () => {
    if (!confirm(`${selectedOrders.length}টি অর্ডার ট্র্যাশে সরাতে চান?`)) return;
    setBulkLoading(true);
    const { error } = await supabase.from('orders').update({ deleted_at: new Date().toISOString() } as any).in('id', selectedOrders);
    if (error) { toast.error('ট্র্যাশে সরানো ব্যর্থ'); }
    else { toast.success(`${selectedOrders.length}টি অর্ডার ট্র্যাশে সরানো হয়েছে`); }
    setSelectedOrders([]);
    setBulkLoading(false);
    qc.invalidateQueries({ queryKey: ['admin-orders'] });
    qc.invalidateQueries({ queryKey: ['all-orders-fraud'] });
  };

  const bulkRestore = async () => {
    setBulkLoading(true);
    const { error } = await supabase.from('orders').update({ deleted_at: null } as any).in('id', selectedOrders);
    if (error) { toast.error('রিস্টোর ব্যর্থ'); }
    else { toast.success(`${selectedOrders.length}টি অর্ডার রিস্টোর হয়েছে`); }
    setSelectedOrders([]);
    setBulkLoading(false);
    qc.invalidateQueries({ queryKey: ['admin-orders'] });
    qc.invalidateQueries({ queryKey: ['all-orders-fraud'] });
  };

  const bulkPermanentDelete = async () => {
    if (!confirm(`${selectedOrders.length}টি অর্ডার চিরতরে মুছে ফেলতে চান? এটি পূর্বাবস্থায় ফেরানো যাবে না।`)) return;
    setBulkLoading(true);
    await supabase.from('order_items').delete().in('order_id', selectedOrders);
    const { error } = await supabase.from('orders').delete().in('id', selectedOrders);
    if (error) { toast.error('ডিলিট ব্যর্থ'); }
    else { toast.success(`${selectedOrders.length}টি অর্ডার চিরতরে মুছে ফেলা হয়েছে`); }
    setSelectedOrders([]);
    setBulkLoading(false);
    qc.invalidateQueries({ queryKey: ['admin-orders'] });
  };

  const emptyTrash = async () => {
    if (!confirm('ট্র্যাশের সব অর্ডার চিরতরে মুছে ফেলতে চান?')) return;
    setBulkLoading(true);
    const trashIds = orders.map((o: any) => o.id);
    if (trashIds.length > 0) {
      await supabase.from('order_items').delete().in('order_id', trashIds);
      await supabase.from('orders').delete().in('id', trashIds);
    }
    toast.success('ট্র্যাশ খালি করা হয়েছে');
    setSelectedOrders([]);
    setBulkLoading(false);
    qc.invalidateQueries({ queryKey: ['admin-orders'] });
  };

  const COURIER_FUNCTIONS: Record<string, { fn: string; label: string }> = {
    steadfast: { fn: 'steadfast-courier', label: 'Steadfast' },
    pathao:    { fn: 'pathao-courier',    label: 'Pathao' },
    redx:      { fn: 'redx-courier',      label: 'RedX' },
  };

  const bulkCourier = async (provider: 'steadfast' | 'pathao' | 'redx') => {
    const cfg = COURIER_FUNCTIONS[provider];
    // Skip orders already sent to any courier
    const eligible = orders.filter((o: any) => selectedOrders.includes(o.id) && !o.courier_consignment_id);
    const skipped = selectedOrders.length - eligible.length;
    if (eligible.length === 0) {
      toast.error(`সব অর্ডার ইতিমধ্যে কুরিয়ারে পাঠানো হয়েছে (${skipped} skipped)`);
      return;
    }
    if (!confirm(`${eligible.length}টি অর্ডার ${cfg.label} এ পাঠাবেন?${skipped ? ` (${skipped}টি skip হবে — already sent)` : ''}`)) return;

    setBulkLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const eligibleIds = eligible.map((o: any) => o.id);
    let successCount = 0;
    let failCount = 0;
    const failMessages: string[] = [];

    try {
      if (provider === 'steadfast') {
        const res = await fetch(`https://gdwvktufhsbrblzzeiir.supabase.co/functions/v1/${cfg.fn}?action=bulk_create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ order_ids: eligibleIds }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Courier API error');
        successCount = data.results?.filter((r: any) => r.success).length || 0;
        failCount = (data.results?.length || 0) - successCount;
        (data.results || []).filter((r: any) => !r.success).slice(0, 3).forEach((r: any) => failMessages.push(r.error || 'unknown'));
      } else {
        // Pathao / RedX: no bulk endpoint — loop single create_order calls
        for (const id of eligibleIds) {
          try {
            const res = await fetch(`https://gdwvktufhsbrblzzeiir.supabase.co/functions/v1/${cfg.fn}?action=create_order`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
              body: JSON.stringify({ order_id: id }),
            });
            const data = await res.json();
            if (!res.ok || data.error) { failCount++; if (failMessages.length < 3) failMessages.push(data.error || `HTTP ${res.status}`); }
            else successCount++;
          } catch (e: any) {
            failCount++;
            if (failMessages.length < 3) failMessages.push(e.message);
          }
        }
      }

      const skippedNote = skipped ? `, ${skipped} skipped` : '';
      if (failCount === 0) {
        toast.success(`${successCount}টি ${cfg.label} এ পাঠানো হয়েছে${skippedNote}`);
      } else {
        toast.error(`${successCount} সফল, ${failCount} ব্যর্থ${skippedNote}${failMessages.length ? ` — ${failMessages.join('; ')}` : ''}`);
      }
    } catch (e: any) {
      toast.error(e.message);
    }
    setSelectedOrders([]);
    setBulkLoading(false);
    qc.invalidateQueries({ queryKey: ['admin-orders'] });
  };

  const bulkStatusSync = async () => {
    setBulkLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      // Group selected orders by their provider; orders without provider default to steadfast
      const selected = orders.filter((o: any) => selectedOrders.includes(o.id) && o.courier_consignment_id);
      const byProvider: Record<string, string[]> = { steadfast: [], pathao: [], redx: [] };
      selected.forEach((o: any) => {
        const p = (o.courier_provider || 'steadfast').toLowerCase();
        if (byProvider[p]) byProvider[p].push(o.id);
      });

      const providerCalls = Object.entries(byProvider)
        .filter(([, ids]) => ids.length > 0)
        .map(async ([p, ids]) => {
          const cfg = COURIER_FUNCTIONS[p];
          const res = await fetch(`https://gdwvktufhsbrblzzeiir.supabase.co/functions/v1/${cfg.fn}?action=bulk_status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
            body: JSON.stringify({ order_ids: ids }),
          });
          const data = await res.json();
          return { provider: p, ok: res.ok, updated: data.updated || 0, error: data.error };
        });

      if (providerCalls.length === 0) {
        toast.error('কোনো অর্ডার এখনো কুরিয়ারে পাঠানো হয়নি');
      } else {
        const results = await Promise.all(providerCalls);
        const totalUpdated = results.reduce((s, r) => s + (r.ok ? r.updated : 0), 0);
        const errors = results.filter(r => !r.ok).map(r => `${r.provider}: ${r.error}`);
        if (errors.length) toast.error(`${totalUpdated} সিঙ্ক হয়েছে, ত্রুটি: ${errors.join(', ')}`);
        else toast.success(`${totalUpdated}টি অর্ডারের স্ট্যাটাস আপডেট হয়েছে`);
      }
    } catch (e: any) {
      toast.error(e.message);
    }
    setSelectedOrders([]);
    setBulkLoading(false);
    qc.invalidateQueries({ queryKey: ['admin-orders'] });
  };

  const handleSyncAll = async () => {
    setSyncAllLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const providers: { name: string; fn: string }[] = [
        { name: 'steadfast', fn: 'steadfast-courier' },
        { name: 'pathao', fn: 'pathao-courier' },
        { name: 'redx', fn: 'redx-courier' },
      ];

      let totalUpdated = 0;
      let totalChecked = 0;
      let totalFailed = 0;

      // Sync ALL active courier parcels across every page (in_review, pending, hold, …)
      await Promise.all(providers.map(async (p) => {
        try {
          const res = await fetch(`https://gdwvktufhsbrblzzeiir.supabase.co/functions/v1/${p.fn}?action=bulk_status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
            body: JSON.stringify({ only_active: true, limit: 500 }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            console.warn(`${p.name} sync error:`, data?.error);
            return;
          }
          totalUpdated += data.updated || 0;
          totalChecked += data.total || 0;
          totalFailed += data.failed || 0;
        } catch (e: any) {
          console.error(`${p.name} sync exception:`, e?.message);
        }
      }));

      const msg = `${totalChecked}টি পার্সেল চেক — ${totalUpdated}টি আপডেট${totalFailed ? `, ${totalFailed}টি ব্যর্থ` : ''}`;
      if (totalUpdated > 0) toast.success(msg);
      else toast.info(msg);
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
    } catch (e: any) {
      toast.error(e.message);
    }
    setSyncAllLoading(false);
  };

  return (
    <div>
      <div className="sticky top-14 md:top-0 z-40 bg-background pb-2">
      {/* Header — Desktop */}
      <div className="mb-4 hidden md:flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{showTrash ? '🗑️ ট্র্যাশ' : 'অর্ডার সমূহ'}</h1>
          <p className="text-sm text-muted-foreground">মোট {totalCount}টি {showTrash ? 'ডিলিটেড' : ''} অর্ডার</p>
        </div>
        <Button
          variant={showTrash ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setShowTrash(!showTrash); setSelectedOrders([]); setCurrentPage(1); }}
          className="gap-1.5"
        >
          <Trash2 className="h-4 w-4" />
          {showTrash ? 'অর্ডার লিস্ট' : 'ট্র্যাশ'}
        </Button>
      </div>

      {/* Mobile Filter Row — top */}
      <div className="flex md:hidden items-center gap-2 mb-3 bg-background py-2 -mx-3 px-3 border-b border-border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={searchQuery} onChange={e => setSearchQuery(bnToEnDigits(e.target.value))}
            placeholder="খুঁজুন..." className="pl-9 h-9 text-sm" />
        </div>
        <ManualOrderDialog />
      </div>

      {/* Daily Summary */}
      <div className="mb-3 p-2 border border-border rounded-lg bg-muted/30 flex flex-col gap-2">
       <div className="flex gap-4">
        {/* বাম কলাম */}
        <div className="flex-1 flex flex-col">
        {/* সারি ১: হিসাব + ক্যালেন্ডার */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium">📅 হিসাব:</span>
           <Popover>
             <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="h-7 w-7">
                  <CalendarIcon className="h-3.5 w-3.5" />
                </Button>
             </PopoverTrigger>
             <PopoverContent className="w-auto p-0" align="start">
                 <SmartRangeCalendar
                   value={summaryRange as any}
                   onChange={(range) => setSummaryRange(range as any)}
                   numberOfMonths={1}
                 />
             </PopoverContent>
           </Popover>
           <Button
             variant={showTrash ? 'default' : 'outline'}
             size="icon"
             onClick={() => { setShowTrash(!showTrash); setSelectedOrders([]); setCurrentPage(1); }}
             className="h-7 w-7 md:hidden"
             title={showTrash ? 'অর্ডার লিস্ট' : 'ট্র্যাশ'}
           >
             <Trash2 className="h-3.5 w-3.5" />
           </Button>
          </div>
           {/* স্ট্যাটাস ব্যাজ: Desktop */}
          <div className="hidden md:flex flex-wrap gap-1.5 items-center">
           {statuses.map(s => {
              const isReturnStatus = s === 'delivery_failed' || s === 'paid_return' || s === 'exchange';
              const count = isReturnStatus ? (returnPendingByStatus[s] || 0) : dailySummary.counts[s];
              const targetFilter = isReturnStatus ? `__return_pending__:${s}` : s;
              const isActive = filter === targetFilter;
              return (
                <span
                  key={s}
                  className={cn(
                    'px-2 py-0.5 rounded text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity',
                    statusColor[s],
                    isActive && 'ring-2 ring-offset-1 ring-current'
                  )}
                  onClick={() => setFilter(prev => prev === targetFilter ? 'all' : targetFilter)}
                  title={isReturnStatus ? 'গ্রহণ-পেন্ডিং (সব সময়ের)' : undefined}
                >
                  {statusLabel[s]}: {count}
                  {(s === 'pending' || s === 'confirmed' || s === 'in_review' || s === 'hold' || s === 'scheduled') && (
                    <span className="ml-1 opacity-80">({allTimeStatusCounts[s] || 0})</span>
                  )}
                </span>
              );
            })}
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-muted text-foreground">
              মোট: {dailySummary.total}
            </span>
          </div>
          {/* স্ট্যাটাস ব্যাজ: Mobile */}
          <div className="flex md:hidden flex-wrap gap-1.5 items-center">
           {statuses.filter(s => {
              if (s === 'delivery_failed' || s === 'paid_return' || s === 'exchange') return false;
              const count = dailySummary.counts[s];
              const allTime = allTimeStatusCounts[s] || 0;
              return count > 0 || allTime > 0;
            }).map(s => {
              const isReturnStatus = s === 'delivery_failed' || s === 'paid_return' || s === 'exchange';
              const count = isReturnStatus ? (returnPendingByStatus[s] || 0) : dailySummary.counts[s];
              const targetFilter = isReturnStatus ? `__return_pending__:${s}` : s;
              const isActive = filter === targetFilter;
              return (
                <span
                  key={s}
                  className={cn(
                    'px-2 py-0.5 rounded text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity',
                    statusColor[s],
                    isActive && 'ring-2 ring-offset-1 ring-current'
                  )}
                  onClick={() => setFilter(prev => prev === targetFilter ? 'all' : targetFilter)}
                  title={isReturnStatus ? 'গ্রহণ-পেন্ডিং (সব সময়ের)' : undefined}
                >
                  {statusLabel[s]}: {count}
                  {(s === 'pending' || s === 'confirmed' || s === 'in_review' || s === 'hold' || s === 'scheduled') && (
                    <span className="ml-1 opacity-80">({allTimeStatusCounts[s] || 0})</span>
                  )}
                </span>
              );
            })}
          </div>
        </div>

        {/* ডান কলাম: উল্লম্ব স্ট্যাক */}
        <div className="text-right space-y-0.5 min-w-[90px]">
          <div className="flex gap-3 justify-end">
            <div className="text-right">
              <div className="text-xs text-muted-foreground">মোট টাকা:</div>
              <div className="text-sm font-bold">৳{dailySummary.totalAmount.toLocaleString()}</div>
            </div>
            <div className="text-right hidden md:block">
              <button
                onClick={() => setFilter(prev => prev === 'shipped' ? 'all' : 'shipped')}
                className="text-right hover:opacity-80 transition-opacity"
                title="আজকের শিফট হওয়া পার্সেল"
              >
                <div className="text-xs text-muted-foreground">শিফট:</div>
                <div className="text-sm font-bold text-purple-600">
                  {dailySummary.counts['shipped'] || 0} <span className="opacity-70 font-medium">({allTimeStatusCounts['shipped'] || 0})</span> টি · ৳{dailySummary.shippedAmount.toLocaleString()}
                </div>
              </button>
            </div>
            <div className="text-right md:hidden">
              <div className="text-xs text-muted-foreground">শিপড:</div>
              <div className="text-sm font-bold text-purple-600">৳{dailySummary.shippedAmount.toLocaleString()}</div>
              <div className="text-[10px] text-muted-foreground">{dailySummary.counts['shipped'] || 0} ({allTimeStatusCounts['shipped'] || 0}) টি</div>
            </div>
          </div>
          <div className="flex flex-col gap-0.5 items-end">
            <button
              onClick={() => setFilter(prev => prev === '__return_pending__:delivery_failed' ? 'all' : '__return_pending__:delivery_failed')}
              className={cn(
                'min-w-[90px] text-center px-2.5 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700 cursor-pointer hover:opacity-80 transition-opacity',
                filter === '__return_pending__:delivery_failed' && 'ring-2 ring-offset-1 ring-red-500'
              )}
            >
              ডেলিভারি ব্যর্থ: {returnPendingByStatus?.delivery_failed ?? 0}
            </button>
            <button
              onClick={() => setFilter(prev => prev === '__return_pending__:paid_return' ? 'all' : '__return_pending__:paid_return')}
              className={cn(
                'min-w-[90px] text-center px-2.5 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-700 cursor-pointer hover:opacity-80 transition-opacity',
                filter === '__return_pending__:paid_return' && 'ring-2 ring-offset-1 ring-purple-500'
              )}
            >
              পেইড রিটার্ন: {returnPendingByStatus?.paid_return ?? 0}
            </button>
          </div>
          <div className="hidden md:block">
            <div className="text-xs text-muted-foreground">আজ</div>
            <div className="text-sm font-bold">{format(new Date(), 'dd/MM/yy')}</div>
          </div>
        </div>
       </div>
       {/* Mobile-only: bottom row */}
       <div className="md:hidden flex items-center justify-between gap-2 pt-2 border-t border-border/50 text-sm font-semibold">
         <span>মোট: {dailySummary.total}</span>
         <span className="text-muted-foreground">|</span>
         <span className="text-primary">{showTrash ? '🗑️ ' : 'অর্ডার:'}{totalCount}</span>
         <span className="text-muted-foreground">|</span>
         <span>আজ {format(new Date(), 'dd/MM/yy')}</span>
       </div>
      </div>

      {/* Mobile Filter Row — moved above Daily Summary */}

      {/* Desktop Filter Row */}
      <div className="hidden md:flex items-center gap-3 mb-4">
        <ManualOrderDialog />
        <div className="relative flex-1 min-w-[150px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={searchQuery} onChange={e => setSearchQuery(bnToEnDigits(e.target.value))}
            placeholder="নাম, ফোন, অর্ডার নম্বর..." className="pl-10" />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="border border-input rounded-md px-3 py-2 text-sm bg-background capitalize">
          <option value="all">সব স্ট্যাটাস</option>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={originFilter} onChange={e => setOriginFilter(e.target.value)}
          className="border border-input rounded-md px-3 py-2 text-sm bg-background capitalize">
          <option value="all">সব সোর্স</option>
          {origins.filter(o => o !== 'all').map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <select value={paymentStatusFilter} onChange={e => setPaymentStatusFilter(e.target.value)}
          className="border border-input rounded-md px-3 py-2 text-sm bg-background">
          <option value="all">সব পেমেন্ট স্ট্যাটাস</option>
          <option value="paid">পেইড</option>
          <option value="partial">আংশিক পেইড</option>
          <option value="unpaid">আনপেইড</option>
        </select>
        <select value={paymentMethodFilter} onChange={e => setPaymentMethodFilter(e.target.value)}
          className="border border-input rounded-md px-3 py-2 text-sm bg-background">
          <option value="all">সব পেমেন্ট মেথড</option>
          <option value="cod">COD</option>
          <option value="uddoktapay">UddoktaPay</option>
          <option value="bkash">bKash</option>
        </select>
        <Button variant="outline" size="sm" onClick={handleSyncAll} disabled={syncAllLoading} title="সব কুরিয়ার স্ট্যাটাস সিঙ্ক">
          <RefreshCw className={cn("h-4 w-4 mr-1", syncAllLoading && "animate-spin")} />
          {syncAllLoading ? 'সিঙ্ক হচ্ছে...' : 'কুরিয়ার সিঙ্ক'}
        </Button>
      </div>
      {/* Bulk Actions */}
      {selectedOrders.length > 0 && (
        <div className="flex items-center gap-3 p-2 bg-muted rounded-md flex-wrap shadow-sm">
          <span className="text-sm font-medium">{selectedOrders.length}টি সিলেক্টেড</span>
          {showTrash ? (
            <>
              <Button size="sm" variant="outline" onClick={bulkRestore} disabled={bulkLoading}>
                <RotateCcw className="h-3 w-3 mr-1" /> রিস্টোর
              </Button>
              <Button size="sm" variant="destructive" onClick={bulkPermanentDelete} disabled={bulkLoading}>
                <XCircle className="h-3 w-3 mr-1" /> চিরতরে মুছুন
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={bulkPrint} disabled={bulkLoading}>
                <Printer className="h-3 w-3 mr-1" /> Bulk প্রিন্ট
              </Button>
              <Button size="sm" variant="outline" onClick={() => setChecklistOpen(true)} disabled={bulkLoading}>
                📋 চেকলিস্ট
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" disabled={bulkLoading}>
                    <Truck className="h-3 w-3 mr-1" /> {bulkLoading ? 'পাঠানো হচ্ছে...' : 'Bulk কুরিয়ার'} <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[160px]">
                  <DropdownMenuItem onClick={() => bulkCourier('steadfast')} className="text-xs cursor-pointer">
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-2" />Steadfast
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => bulkCourier('pathao')} className="text-xs cursor-pointer">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2" />Pathao
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => bulkCourier('redx')} className="text-xs cursor-pointer">
                    <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-2" />RedX
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="sm" variant="outline" onClick={bulkStatusSync} disabled={bulkLoading}>
                <RefreshCw className="h-3 w-3 mr-1" /> স্ট্যাটাস সিঙ্ক
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" disabled={bulkLoading}>
                    স্ট্যাটাস পরিবর্তন <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[160px]">
                  {statuses.map(s => (
                    <DropdownMenuItem key={s} onClick={() => {
                      if (s === 'scheduled') {
                        setScheduleDate(undefined);
                        setScheduleDialog({ orderIds: [...selectedOrders], isBulk: true });
                        return;
                      }
                      bulkStatusChange(s);
                    }} className="flex items-center gap-2 text-xs cursor-pointer">
                      <span className={cn('w-2 h-2 rounded-full shrink-0', statusDot[s])} />
                      {statusLabel[s]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="sm" variant="outline"
                className="border-orange-400 text-orange-800 hover:bg-orange-100"
                onClick={() => markReturnReceived.mutate([...selectedOrders])}
                disabled={bulkLoading || markReturnReceived.isPending}>
                <PackageCheck className="h-3 w-3 mr-1" /> ফেরত গ্রহণ
              </Button>
              <Button size="sm" variant="destructive" onClick={bulkDelete} disabled={bulkLoading}>
                <Trash2 className="h-3 w-3 mr-1" /> ডিলিট
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" onClick={() => setSelectedOrders([])}>বাতিল</Button>
        </div>
      )}
     </div>{/* end sticky wrapper */}

      {/* Scheduled-dispatch reminder banner */}
      {scheduledTodayOrders.length > 0 && !showTrash && (
        <div className="mb-3 flex items-center justify-between gap-3 p-3 rounded-lg border border-cyan-300 bg-cyan-50 text-cyan-900 shadow-sm">
          <div className="flex items-center gap-2 text-sm">
            <CalendarIcon className="h-4 w-4" />
            <span className="font-semibold">আজ শিডিউলড ডিসপ্যাচ:</span>
            <span>{scheduledTodayOrders.length}টি অর্ডার — কুরিয়ারে পাঠাতে ভুলবেন না!</span>
          </div>
          <Button size="sm" variant="outline" className="border-cyan-400 text-cyan-800 hover:bg-cyan-100"
            onClick={() => { setFilter('scheduled'); setCurrentPage(1); }}>
            দেখুন
          </Button>
        </div>
      )}

      {showTrash && orders.length > 0 && selectedOrders.length === 0 && (
        <div className="flex items-center gap-2 mb-3">
          <Button size="sm" variant="destructive" onClick={emptyTrash} disabled={bulkLoading}>
            <Trash2 className="h-3 w-3 mr-1" /> ট্র্যাশ খালি করুন ({orders.length})
          </Button>
        </div>
      )}

      {isLoading ? <p className="text-muted-foreground">লোড হচ্ছে...</p> : (
        <>
          {/* Desktop Table - hidden on mobile */}
          <div className="hidden md:block border border-border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={orders.length > 0 && selectedOrders.length === orders.length}
                      onCheckedChange={toggleAll} />
                  </TableHead>
                  
                  <TableHead>অর্ডার নং</TableHead>
                  <TableHead>কাস্টমার</TableHead>
                  <TableHead className="text-center">ফ্রড</TableHead>
                  <TableHead>মোট</TableHead>
                  <TableHead>স্ট্যাটাস</TableHead>
                  <TableHead>পেমেন্ট</TableHead>
                  <TableHead>অ্যাকশন</TableHead>
                  <TableHead>কুরিয়ার</TableHead>
                  <TableHead>সময়</TableHead>
                  <TableHead>সোর্স</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o: any, idx: number) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Checkbox checked={selectedOrders.includes(o.id)}
                        onCheckedChange={() => toggleSelect(o.id)} />
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      <div className="text-[10px] text-muted-foreground leading-none mb-0.5">#{(currentPage - 1) * ORDERS_PER_PAGE + idx + 1}</div>
                      {o.order_number}
                      {(o as any).is_pre_order && (
                        <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-700">📦 প্রি-অর্ডার</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="text-sm flex items-center gap-1.5 flex-wrap">
                          <span>{o.customer_name}</span>
                          <CustomerLoyaltyBadge phone={o.customer_phone} preloaded={customerLoyaltyMap.get(o.customer_phone) || null} hideForNew compact />
                        </div>
                        <span className="inline-flex items-center gap-1">
                          <a href={`tel:${o.customer_phone}`} className="text-xs text-blue-600 hover:underline">{o.customer_phone}</a>
                          {o.customer_phone && (
                            <button type="button" title="নম্বর কপি করুন"
                              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(o.customer_phone); toast.success('নম্বর কপি হয়েছে'); }}
                              className="p-0.5 rounded hover:bg-muted">
                              <Copy className="h-3 w-3 text-muted-foreground" />
                            </button>
                          )}
                        </span>
                        {/* Order Items */}
                        {(() => {
                          const items = orderItemsMap.get(o.id);
                          if (isItemsLoading && !items) return (
                            <div className="flex items-center gap-1 mt-1">
                              <div className="flex -space-x-1">
                                <div className="w-6 h-6 rounded border border-background bg-muted animate-pulse" />
                                <div className="w-6 h-6 rounded border border-background bg-muted animate-pulse" />
                              </div>
                              <div className="h-3 w-16 bg-muted animate-pulse rounded" />
                            </div>
                          );
                          if (!items || items.length === 0) return null;
                          return (
                            <div className="flex items-center gap-1 mt-1">
                              <div className="flex -space-x-1">
                                {items.slice(0, 3).map((item: any, idx: number) => {
                                  const img = getOrderItemImage(item);
                                  return img ? (
                                    <HoverImagePreview key={idx} src={img}>
                                      <img src={img} alt="" loading="eager" className="w-6 h-6 rounded border border-background object-cover" />
                                    </HoverImagePreview>
                                  ) : (
                                    <div key={idx} className="w-6 h-6 rounded border border-background bg-muted flex items-center justify-center text-[8px]">📦</div>
                                  );
                                })}
                              </div>
                              <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                                {items.map(item => `${item.product_name.length > 20 ? item.product_name.slice(0, 20) + '..' : item.product_name} ×${item.quantity}`).join(', ')}
                              </span>
                            </div>
                          );
                        })()}
                        {o.notes && (
                          <div className="text-[11px] text-orange-600 max-w-[180px] truncate mt-0.5" title={o.notes}>
                            📝 {o.notes}
                          </div>
                        )}
                        {notesMap.get(o.id)?.slice(0, 2).map(n => (
                          <div key={n.id} className="text-[11px] text-purple-600 max-w-[180px] truncate mt-0.5" title={n.note}>
                            💬 {n.note}
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const courier = getCourierData(o.customer_phone);
                        const customerOrders = allOrdersForFraud.filter(x => x.customer_phone === o.customer_phone);
                        const totalOrders = customerOrders.length;
                        let displayText: string;
                        let iconColor: string;
                        let Icon: typeof ShieldCheck;
                        if (courier && courier.status === 'success' && courier.successRate !== null) {
                          displayText = `${courier.successRate}%`;
                          if (courier.successRate > 70) { iconColor = 'text-green-600'; Icon = ShieldCheck; }
                          else if (courier.successRate >= 40) { iconColor = 'text-yellow-600'; Icon = ShieldAlert; }
                          else { iconColor = 'text-red-600'; Icon = ShieldAlert; }
                        } else if (totalOrders <= 1) {
                          displayText = 'NEW';
                          iconColor = 'text-gray-400';
                          Icon = ShieldQuestion;
                        } else {
                          const delivered = customerOrders.filter(x => x.status === 'delivered').length;
                          const rate = Math.round((delivered / totalOrders) * 100);
                          displayText = `${rate}%`;
                          if (rate > 70) { iconColor = 'text-green-600'; Icon = ShieldCheck; }
                          else if (rate >= 40) { iconColor = 'text-yellow-600'; Icon = ShieldAlert; }
                          else { iconColor = 'text-red-600'; Icon = ShieldAlert; }
                        }
                        return (
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => setFraudPhone(o.customer_phone)} className="shrink-0 cursor-pointer hover:scale-110 transition-transform">
                              <Icon className={`h-4 w-4 ${iconColor}`} />
                            </button>
                            <span className={`text-xs font-semibold ${iconColor}`}>{displayText}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRefreshCourier(o.customer_phone, e); }}
                              className="shrink-0 cursor-pointer hover:scale-110 transition-transform"
                              title="রিফ্রেশ"
                            >
                              {refreshingPhone === o.customer_phone
                                ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                                : <RefreshCw className="h-3 w-3 text-muted-foreground hover:text-primary" />}
                            </button>
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="font-medium text-sm">৳{o.total}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className={cn(
                            'inline-flex items-center gap-1.5 text-sm font-semibold rounded-full px-4 py-1.5 border border-current/20 cursor-pointer transition-all shadow-sm',
                            statusColor[o.status] || 'bg-muted',
                            statusGlow[o.status]
                          )}>
                            <span className={cn('w-2 h-2 rounded-full', statusDot[o.status])} />
                            {statusLabel[o.status] || o.status}
                            {o.status === 'scheduled' && o.scheduled_dispatch_date && (
                              <span className="ml-1 text-[10px] font-normal opacity-80">· {format(new Date(o.scheduled_dispatch_date), 'dd MMM', { locale: bn })}</span>
                            )}
                            <ChevronDown className="h-3 w-3 opacity-60" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="z-50 bg-white dark:bg-gray-900 min-w-[160px] p-1 rounded-lg shadow-xl border">
                          {statuses.map(s => (
                            <DropdownMenuItem key={s} onClick={() => {
                              if (s === 'scheduled') {
                                setScheduleDate(o.scheduled_dispatch_date ? new Date(o.scheduled_dispatch_date) : undefined);
                                setScheduleDialog({ orderIds: [o.id], orderRef: o, isBulk: false });
                                return;
                              }
                              updateStatus.mutate({ id: o.id, status: s, oldStatus: o.status, subtotal: Number(o.subtotal), delivery_charge: Number(o.delivery_charge) });
                            }}
                              className={cn('flex items-center gap-2 text-xs rounded-md px-2.5 py-1.5 cursor-pointer', o.status === s && 'font-bold')}>
                              <span className={cn('w-2 h-2 rounded-full shrink-0', statusDot[s])} />
                              {statusLabel[s]}
                              {o.status === s && <Check className="h-3 w-3 ml-auto" />}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {(o as any).return_pending && !(o as any).return_received_at && (
                        <div className="mt-1">
                          <Button size="sm" variant="outline"
                            className="h-6 px-2 text-[10px] border-orange-400 bg-orange-50 text-orange-800 hover:bg-orange-100"
                            disabled={markReturnReceived.isPending}
                            onClick={() => markReturnReceived.mutate([o.id])}>
                            <PackageCheck className="h-3 w-3 mr-1" /> ফেরত পেয়েছি
                          </Button>
                        </div>
                      )}
                      {(o as any).return_received_at && (
                        <div className="mt-1 text-[10px] text-green-700 inline-flex items-center gap-1">
                          <Check className="h-3 w-3" /> ফেরত গৃহীত
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className={cn(
                            'inline-flex items-center gap-1.5 text-sm font-semibold rounded-full px-4 py-1.5 border border-current/20 cursor-pointer transition-all shadow-sm',
                            paymentColor[(o as any).payment_status || 'unpaid']
                          )}>
                            <span className={cn('w-2 h-2 rounded-full', paymentDot[(o as any).payment_status || 'unpaid'])} />
                            {paymentLabel[(o as any).payment_status || 'unpaid']}
                            <ChevronDown className="h-3 w-3 opacity-60" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="z-50 bg-white dark:bg-gray-900 min-w-[160px] p-1 rounded-lg shadow-xl border">
                          {paymentStatuses.map(s => (
                            <DropdownMenuItem key={s} onClick={() => {
                              if (s === 'partial') {
                                setPartialPaymentOrder(o);
                                setPartialPaymentAmount('');
                              } else {
                                updatePayment.mutate({ id: o.id, payment_status: s, orderTotal: Number(o.total) || 0, oldPaymentStatus: (o as any).payment_status || 'unpaid', orderNumber: (o as any).order_number });
                              }
                            }}
                              className={cn('flex items-center gap-2 text-xs rounded-md px-2.5 py-1.5 cursor-pointer', (o as any).payment_status === s && 'font-bold')}>
                              <span className={cn('w-2 h-2 rounded-full shrink-0', paymentDot[s])} />
                              {paymentLabel[s]}
                              {(o as any).payment_status === s && <Check className="h-3 w-3 ml-auto" />}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {((o as any).payment_method === 'uddoktapay' || (o as any).payment_method === 'bkash') && (
                        <div className="mt-1 text-[10px] text-muted-foreground leading-tight">
                          <div className="uppercase font-medium">{(o as any).payment_method}</div>
                          {(o as any).payment_invoice_id && <div>TxnID: {(o as any).payment_invoice_id}</div>}
                          {(o as any).paid_at && <div>{format(new Date((o as any).paid_at), 'dd/MM/yy HH:mm')}</div>}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewOrder(o)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handlePrint(o)}>
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <Share2 className="h-3.5 w-3.5" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-52 p-2 z-[1002]" align="end">
                            <p className="text-xs font-semibold text-muted-foreground px-2 py-1">মেমো শেয়ার</p>
                            <button
                              onClick={() => {
                                const memoUrl = `https://shorno-suta.vercel.app/memo/${o.order_number}`;
                                const shareText = `স্বর্ণ সুতা ❤️\n\nআপনার অর্ডার কনফার্ম করা হয়েছে!\n\nঅর্ডার আইডি: ${o.order_number}\nমোট: ৳${o.total}\n\nঅর্ডার বিস্তারিত দেখুন:\n${memoUrl}`;
                                navigator.clipboard.writeText(shareText);
                                toast.success('লিংক কপি হয়েছে!');
                              }}
                              className="w-full flex items-center gap-2 px-2 py-2 text-sm rounded hover:bg-muted text-left"
                            >
                              <Copy className="h-4 w-4" />
                              লিংক কপি করুন
                            </button>
                            <button
                              onClick={() => {
                                const memoUrl = `https://shorno-suta.vercel.app/memo/${o.order_number}`;
                                const text = `স্বর্ণ সুতা ❤️\n\nআপনার অর্ডার কনফার্ম করা হয়েছে!\n\nঅর্ডার আইডি: ${o.order_number}\nমোট: ৳${o.total}\n\nঅর্ডার বিস্তারিত দেখুন:\n${memoUrl}`;
                                const phone = o.customer_phone?.replace(/[^0-9]/g, '');
                                const waPhone = phone?.startsWith('0') ? `88${phone}` : phone;
                                window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`, '_blank');
                              }}
                              className="w-full flex items-center gap-2 px-2 py-2 text-sm rounded hover:bg-muted text-left"
                            >
                              <MessageSquare className="h-4 w-4 text-green-600" />
                              WhatsApp-এ পাঠান
                            </button>
                            <button
                              onClick={() => window.open(`https://shorno-suta.vercel.app/memo/${o.order_number}`, '_blank')}
                              className="w-full flex items-center gap-2 px-2 py-2 text-sm rounded hover:bg-muted text-left"
                            >
                              <Eye className="h-4 w-4" />
                              মেমো দেখুন
                            </button>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </TableCell>
                    <TableCell>
                      <CourierActions orderId={o.id} orderNumber={o.order_number} consignmentId={o.courier_consignment_id}
                        courierStatus={o.courier_status} courierProvider={(o as any).courier_provider}
                        onUpdate={() => qc.invalidateQueries({ queryKey: ['admin-orders'] })} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {shortTimeAgo(new Date(o.created_at))}
                    </TableCell>
                    <TableCell>
                      {o.order_origin.includes('+') ? (
                        <div className="flex gap-1 flex-wrap">
                          {o.order_origin.split('+').map((part: string) => (
                            <span key={part} className={cn('text-xs px-2 py-0.5 rounded-full capitalize', originColor[part] || 'bg-muted text-muted-foreground')}>
                              {part}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className={cn('text-xs px-2 py-0.5 rounded-full capitalize', originColor[o.order_origin] || 'bg-muted text-muted-foreground')}>
                          {o.order_origin}
                        </span>
                      )}
                      {o.order_origin === 'exchange' && o.notes?.match(/#(SD-\d+)/) && (
                        <span className="text-[10px] text-indigo-500 font-medium">🔄 মূল: {o.notes.match(/#(SD-\d+)/)?.[0]}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {orders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                      কোনো অর্ডার পাওয়া যায়নি
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card List - hidden on desktop */}
          <div className="md:hidden space-y-3 pb-20">
            {orders.length === 0 && (
              <p className="text-center text-muted-foreground py-8">কোনো অর্ডার পাওয়া যায়নি</p>
            )}
            {orders.map((o: any, idx: number) => {
              const courier = getCourierData(o.customer_phone);
              const customerOrders = allOrdersForFraud.filter(x => x.customer_phone === o.customer_phone);
              const totalOrders = customerOrders.length;
              let fraudText: string;
              let fraudColor: string;
              let FraudIcon: typeof ShieldCheck;
              if (courier && courier.status === 'success' && courier.successRate !== null) {
                fraudText = `${courier.successRate}%`;
                if (courier.successRate > 70) { fraudColor = 'text-green-600'; FraudIcon = ShieldCheck; }
                else if (courier.successRate >= 40) { fraudColor = 'text-yellow-600'; FraudIcon = ShieldAlert; }
                else { fraudColor = 'text-red-600'; FraudIcon = ShieldAlert; }
              } else if (totalOrders <= 1) {
                fraudText = 'NEW';
                fraudColor = 'text-gray-400';
                FraudIcon = ShieldQuestion;
              } else {
                const delivered = customerOrders.filter(x => x.status === 'delivered').length;
                const rate = Math.round((delivered / totalOrders) * 100);
                fraudText = `${rate}%`;
                if (rate > 70) { fraudColor = 'text-green-600'; FraudIcon = ShieldCheck; }
                else if (rate >= 40) { fraudColor = 'text-yellow-600'; FraudIcon = ShieldAlert; }
                else { fraudColor = 'text-red-600'; FraudIcon = ShieldAlert; }
              }

              return (
                <div
                  key={o.id}
                  className={cn(
                    "border rounded-lg bg-green-50/40 dark:bg-muted/30 shadow-sm py-2 px-3 active:shadow-none transition-all cursor-pointer",
                    selectedOrders.includes(o.id) && "ring-2 ring-primary/40 border-primary/30 bg-green-50 dark:bg-muted/50"
                  )}
                  onClick={() => setPreviewOrder(o)}
                >
                  {/* Two-column layout */}
                  <div className="flex justify-between items-start gap-3">
                    {/* Left column */}
                    <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                      <span className="font-mono text-xs font-bold tracking-tight text-foreground">
                        <span className="mr-1.5 inline-flex items-center justify-center min-w-[20px] px-1 py-0.5 rounded bg-muted text-muted-foreground text-[10px]">
                          {(currentPage - 1) * ORDERS_PER_PAGE + idx + 1}
                        </span>
                        {o.order_number}
                        {(o as any).is_pre_order && (
                          <span className="ml-1 inline-flex items-center px-1 py-0.5 rounded text-[9px] font-semibold bg-orange-100 text-orange-700">📦</span>
                        )}
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-medium text-foreground">{o.customer_name}</span>
                        <CustomerLoyaltyBadge phone={o.customer_phone} preloaded={customerLoyaltyMap.get(o.customer_phone) || null} hideForNew compact />
                      </div>
                      <span className="inline-flex items-center gap-1 w-fit">
                        <a
                          href={`tel:${o.customer_phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-blue-600"
                        >
                          {o.customer_phone}
                        </a>
                        {o.customer_phone && (
                          <button type="button" title="নম্বর কপি করুন"
                            onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(o.customer_phone); toast.success('নম্বর কপি হয়েছে'); }}
                            className="p-0.5 rounded hover:bg-muted">
                            <Copy className="h-3 w-3 text-muted-foreground" />
                          </button>
                        )}
                      </span>
                      <span className="text-sm font-bold text-foreground">৳{o.total}</span>
                      {/* Order Items */}
                      {(() => {
                        const items = orderItemsMap.get(o.id);
                        if (isItemsLoading && !items) return (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <div className="flex -space-x-1">
                              <div className="w-5 h-5 rounded border border-background bg-muted animate-pulse" />
                              <div className="w-5 h-5 rounded border border-background bg-muted animate-pulse" />
                            </div>
                            <div className="h-2.5 w-14 bg-muted animate-pulse rounded" />
                          </div>
                        );
                        if (!items || items.length === 0) return null;
                        return (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <div className="flex -space-x-1">
                              {items.slice(0, 3).map((item: any, idx: number) => {
                                const img = getOrderItemImage(item);
                                return img ? (
                                  <HoverImagePreview key={idx} src={img}>
                                    <img src={img} alt="" loading="eager" className="w-5 h-5 rounded border border-background object-cover" />
                                  </HoverImagePreview>
                                ) : (
                                  <div key={idx} className="w-5 h-5 rounded border border-background bg-muted flex items-center justify-center text-[7px]">📦</div>
                                );
                              })}
                            </div>
                            <span className="text-[10px] text-muted-foreground truncate">
                              {items.map(item => `${item.product_name.length > 20 ? item.product_name.slice(0, 20) + '..' : item.product_name} ×${item.quantity}`).join(', ')}
                            </span>
                          </div>
                        );
                      })()}
                      {o.order_origin.includes('+') ? (
                        <div className="flex gap-1 flex-wrap">
                          {o.order_origin.split('+').map((part: string) => (
                            <span key={part} className={cn('text-[10px] px-1.5 py-0.5 rounded-full capitalize font-medium', originColor[part] || 'bg-muted text-muted-foreground')}>
                              {part}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full capitalize font-medium w-fit', originColor[o.order_origin] || 'bg-muted text-muted-foreground')}>
                          {o.order_origin}
                        </span>
                      )}
                      {o.order_origin === 'exchange' && o.notes?.match(/#(SD-\d+)/) && (
                        <span className="text-[10px] text-indigo-500 font-medium">🔄 মূল: {o.notes.match(/#(SD-\d+)/)?.[0]}</span>
                      )}
                    </div>
                    {/* Right column */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={cn(
                        'text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap',
                        statusColor[o.status] || 'bg-muted'
                      )}>
                        {statusLabel[o.status] || o.status}
                        {o.status === 'scheduled' && o.scheduled_dispatch_date && (
                          <span className="ml-1 opacity-80">· {format(new Date(o.scheduled_dispatch_date), 'dd MMM', { locale: bn })}</span>
                        )}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setFraudPhone(o.customer_phone); }}
                        className={`flex items-center gap-0.5 ${fraudColor}`}
                      >
                        <FraudIcon className="h-3 w-3" />
                        <span className="text-[10px] font-bold">{fraudText}</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRefreshCourier(o.customer_phone, e); }}
                        className="shrink-0 cursor-pointer hover:scale-110 transition-transform"
                        title="রিফ্রেশ"
                      >
                        {refreshingPhone === o.customer_phone
                          ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                          : <RefreshCw className="h-3 w-3 text-muted-foreground hover:text-primary" />}
                      </button>
                      <span className="text-[10px] text-muted-foreground">{shortTimeAgo(new Date(o.created_at))}</span>
                      {(o as any).return_pending && !(o as any).return_received_at && (
                        <Button size="sm" variant="outline"
                          className="h-6 px-2 text-[10px] border-orange-400 bg-orange-50 text-orange-800 hover:bg-orange-100"
                          disabled={markReturnReceived.isPending}
                          onClick={(e) => { e.stopPropagation(); markReturnReceived.mutate([o.id]); }}>
                          <PackageCheck className="h-3 w-3 mr-1" /> ফেরত পেয়েছি
                        </Button>
                      )}
                      {(o as any).return_received_at && (
                        <span className="text-[10px] text-green-700 inline-flex items-center gap-1">
                          <Check className="h-3 w-3" /> ফেরত গৃহীত
                        </span>
                      )}
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-primary/30 bg-primary/5 hover:bg-primary/15 text-primary text-[10px] font-medium transition-colors"
                          >
                            <Share2 className="h-3 w-3" />
                            <span>শেয়ার</span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-52 p-2 z-[1002]" align="end" onClick={(e) => e.stopPropagation()}>
                          <p className="text-xs font-semibold text-muted-foreground px-2 py-1">মেমো শেয়ার</p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const memoUrl = `https://shorno-suta.vercel.app/memo/${o.order_number}`;
                              const shareText = `স্বর্ণ সুতা ❤️\n\nআপনার অর্ডার কনফার্ম করা হয়েছে!\n\nঅর্ডার আইডি: ${o.order_number}\nমোট: ৳${o.total}\n\nঅর্ডার বিস্তারিত দেখুন:\n${memoUrl}`;
                              navigator.clipboard.writeText(shareText);
                              toast.success('লিংক কপি হয়েছে!');
                            }}
                            className="w-full flex items-center gap-2 px-2 py-2 text-sm rounded hover:bg-muted text-left"
                          >
                            <Copy className="h-4 w-4" />
                            লিংক কপি করুন
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const memoUrl = `https://shorno-suta.vercel.app/memo/${o.order_number}`;
                              const text = `স্বর্ণ সুতা ❤️\n\nআপনার অর্ডার কনফার্ম করা হয়েছে!\n\nঅর্ডার আইডি: ${o.order_number}\nমোট: ৳${o.total}\n\nঅর্ডার বিস্তারিত দেখুন:\n${memoUrl}`;
                              const phone = o.customer_phone?.replace(/[^0-9]/g, '');
                              const waPhone = phone?.startsWith('0') ? `88${phone}` : phone;
                              window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`, '_blank');
                            }}
                            className="w-full flex items-center gap-2 px-2 py-2 text-sm rounded hover:bg-muted text-left"
                          >
                            <MessageSquare className="h-4 w-4 text-green-600" />
                            WhatsApp-এ পাঠান
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`https://shorno-suta.vercel.app/memo/${o.order_number}`, '_blank');
                            }}
                            className="w-full flex items-center gap-2 px-2 py-2 text-sm rounded hover:bg-muted text-left"
                          >
                            <Eye className="h-4 w-4" />
                            মেমো দেখুন
                          </button>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  {/* Notes row - full width */}
                  {(o.notes || notesMap.get(o.id)?.length) && (
                    <div className="mt-1.5 pt-1.5 border-t border-border/50">
                      {o.notes && (
                        <span className="text-[11px] text-orange-600 flex items-center gap-1">
                          <span>📝</span><span className="line-clamp-2">{o.notes}</span>
                        </span>
                      )}
                      {notesMap.get(o.id)?.slice(0, 2).map(n => (
                        <div key={n.id} className="text-[11px] text-purple-600 truncate mt-0.5" title={n.note}>
                          💬 {n.note}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* Pagination */}
          {totalPages > 1 && (() => {
            const maxVisible = window.innerWidth < 768 ? 5 : 7;
            const half = Math.floor(maxVisible / 2);
            let start = Math.max(1, currentPage - half);
            let end = Math.min(totalPages, start + maxVisible - 1);
            if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
            const pages: (number | 'ellipsis-start' | 'ellipsis-end')[] = [];
            if (start > 1) { pages.push(1); if (start > 2) pages.push('ellipsis-start'); }
            for (let i = start; i <= end; i++) pages.push(i);
            if (end < totalPages) { if (end < totalPages - 1) pages.push('ellipsis-end'); pages.push(totalPages); }

            return (
              <div className="flex flex-col items-center gap-2 py-4 pb-20 md:pb-4 mt-4 border-t border-border">
                <div className="flex items-center gap-1 overflow-x-auto max-w-full">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); setExtraOrders([]); setLoadedExtra(0); }}
                    disabled={currentPage === 1}
                    className="gap-1 shrink-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden md:inline">আগে</span>
                  </Button>
                  <div className="flex items-center gap-1">
                    {pages.map((page, idx) =>
                      typeof page === 'string' ? (
                        <span key={page} className="px-1 text-muted-foreground text-sm">…</span>
                      ) : (
                        <Button
                          key={page}
                          variant={page === currentPage ? 'default' : 'outline'}
                          size="sm"
                          className="h-8 w-8 p-0 shrink-0"
                          onClick={() => { setCurrentPage(page); setExtraOrders([]); setLoadedExtra(0); }}
                        >
                          {page}
                        </Button>
                      )
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); setExtraOrders([]); setLoadedExtra(0); }}
                    disabled={currentPage === totalPages}
                    className="gap-1 shrink-0"
                  >
                    <span className="hidden md:inline">পরে</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <span className="text-xs text-muted-foreground">
                  {((currentPage - 1) * ORDERS_PER_PAGE) + 1}-{Math.min((currentPage - 1) * ORDERS_PER_PAGE + orders.length, totalCount)} / {totalCount}
                </span>
                {hasMore && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="gap-1"
                  >
                    {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    আরো ১০০টি দেখুন
                  </Button>
                )}
              </div>
            );
          })()}
        </>
      )}

      {/* Preview Dialog */}
      <OrderPreviewDialog order={previewOrder} open={!!previewOrder} onOpenChange={(open) => { if (!open) setPreviewOrder(null); }} />

      {/* Print-only invoice via portal — single (off-screen visible) */}
      {printOrder && createPortal(
        <div className="print-invoice-wrapper">
          <OrderInvoice ref={printRef} order={printOrder} items={printItems} coupon={activeCoupon} />
        </div>,
        document.body
      )}

      {/* Print-only invoice via portal — bulk (off-screen visible) */}
      {bulkPrintData.length > 0 && createPortal(
        <div className="print-invoice-wrapper">
          {bulkPrintData.map((d, i) => (
            <div key={d.order.id} className={i > 0 ? 'invoice-page-break' : ''}>
              <OrderInvoice order={d.order} items={d.items} coupon={activeCoupon} />
            </div>
          ))}
        </div>,
        document.body
      )}

      {/* Fraud Checker Dialog */}
      <FraudCheckerDialog
        open={!!fraudPhone}
        onOpenChange={(open) => { if (!open) setFraudPhone(null); }}
        phone={fraudPhone || ''}
        allOrders={allOrdersForFraud}
        courierCache={fraudPhone ? getCourierData(fraudPhone) : null}
        onRefresh={async (phone) => {
          await refreshPhone(phone);
        }}
      />

      {/* Partial Payment Dialog */}
      <Dialog open={!!partialPaymentOrder} onOpenChange={(open) => { if (!open) setPartialPaymentOrder(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>আংশিক পরিশোধ — #{partialPaymentOrder?.order_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">মোট বিল</span>
              <span className="font-semibold">৳{partialPaymentOrder?.total}</span>
            </div>
            {Number((partialPaymentOrder as any)?.paid_amount) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">আগে পরিশোধ</span>
                <span className="font-semibold text-green-600">৳{(partialPaymentOrder as any)?.paid_amount}</span>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">পরিশোধের পরিমাণ (৳)</label>
              <Input
                type="number"
                placeholder="কত টাকা দিয়েছে..."
                value={partialPaymentAmount}
                onChange={e => setPartialPaymentAmount(e.target.value)}
                className="mt-1"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPartialPaymentOrder(null)}>বাতিল</Button>
            <Button onClick={() => {
              const amt = Number(partialPaymentAmount);
              if (!amt || amt <= 0) { toast.error('সঠিক পরিমাণ দিন'); return; }
              const total = Number(partialPaymentOrder?.total) || 0;
              const prevPaid = Number((partialPaymentOrder as any)?.paid_amount) || 0;
              const newPaid = prevPaid + amt;
              const status = newPaid >= total ? 'paid' : 'partial';
              updatePayment.mutate({ 
                id: partialPaymentOrder.id, 
                payment_status: status, 
                paidAmount: newPaid, 
                orderTotal: total,
                oldPaymentStatus: (partialPaymentOrder as any)?.payment_status || 'unpaid',
                orderNumber: (partialPaymentOrder as any)?.order_number,
              });
              setPartialPaymentOrder(null);
            }}>
              সাবমিট
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Dispatch Date Dialog */}
      <Dialog open={!!scheduleDialog} onOpenChange={(open) => { if (!open) setScheduleDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              শিডিউলড ডিসপ্যাচ — {scheduleDialog?.isBulk ? `${scheduleDialog.orderIds.length}টি অর্ডার` : `#${scheduleDialog?.orderRef?.order_number || ''}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              কোন তারিখে এই পার্সেল কুরিয়ারে পাঠাতে হবে সেটি নির্বাচন করুন। ওই দিন আমরা আপনাকে অ্যাডমিন প্যানেলে রিমাইন্ডার দেখাব।
            </p>
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={scheduleDate}
                onSelect={setScheduleDate}
                disabled={(d) => d < new Date(new Date().setHours(0,0,0,0))}
                locale={bn}
                className={cn("p-3 pointer-events-auto rounded-md border")}
              />
            </div>
            {scheduleDate && (
              <p className="text-sm text-center font-medium text-cyan-700">
                নির্বাচিত: {format(scheduleDate, 'dd MMM yyyy', { locale: bn })}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialog(null)}>বাতিল</Button>
            <Button
              disabled={!scheduleDate}
              onClick={async () => {
                if (!scheduleDialog || !scheduleDate) return;
                const dateStr = toLocalDateStr(scheduleDate);
                if (scheduleDialog.isBulk) {
                  await bulkStatusChange('scheduled', dateStr);
                } else {
                  const o = scheduleDialog.orderRef;
                  updateStatus.mutate({
                    id: o.id, status: 'scheduled', oldStatus: o.status,
                    subtotal: Number(o.subtotal), delivery_charge: Number(o.delivery_charge),
                    scheduled_dispatch_date: dateStr,
                  });
                }
                setScheduleDialog(null);
                setScheduleDate(undefined);
                qc.invalidateQueries({ queryKey: ['scheduled-dispatch-today'] });
              }}
            >
              সংরক্ষণ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OrderChecklistDialog
        open={checklistOpen}
        onClose={() => setChecklistOpen(false)}
        orderIds={selectedOrders}
      />
    </div>
  );
}
