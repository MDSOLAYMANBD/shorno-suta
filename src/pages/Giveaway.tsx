import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import ImageLightbox from '@/components/product/ImageLightbox';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Gift, ExternalLink, Package, Trash2, Search, Image as ImageIcon, Eye, Printer, ChevronDown, Check, Truck, ChevronLeft, ChevronRight, Share2, Copy, MessageSquare, RefreshCw } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Layout from '@/components/layout/Layout';
import { Skeleton } from '@/components/ui/skeleton';
import SEOHead from '@/components/SEOHead';
import { useSiteConfig, DEFAULT_NAVBAR_CONFIG } from '@/hooks/useSiteConfig';
import AddGiveawayDialog from '@/components/admin/AddGiveawayDialog';
import { getColorPrimaryImage } from '@/lib/productVariants';
import GiveawayOrderDialog from '@/components/admin/GiveawayOrderDialog';
import OrderPreviewDialog from '@/components/admin/OrderPreviewDialog';
import OrderInvoice from '@/components/admin/OrderInvoice';
import CourierActions from '@/components/admin/CourierActions';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface GiveawayEntry {
  id: string;
  gift_number: number;
  customer_name: string;
  profile_link: string;
  profile_screenshot: string;
  packaging_image: string;
  product_name: string;
  created_at: string;
  order_id: string | null;
  orders: { total: number; order_items: { product_id: string | null; product_name: string; price: number; color: string | null; products: { slug: string; images: string[] | null; name: string; variant_images: { color_images?: Record<string, string | string[]> } | null } | null }[] } | null;
}

const statuses = ['pending', 'confirmed', 'hold', 'in_review', 'shipped', 'delivered', 'office_sell', 'cancelled', 'delivery_failed', 'paid_return', 'exchange'] as const;

const statusColor: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700', confirmed: 'bg-blue-100 text-blue-700', hold: 'bg-orange-100 text-orange-700',
  shipped: 'bg-purple-100 text-purple-700', delivered: 'bg-green-100 text-green-700', office_sell: 'bg-teal-100 text-teal-700',
  cancelled: 'bg-red-100 text-red-700', delivery_failed: 'bg-red-200 text-red-800', paid_return: 'bg-pink-100 text-pink-700',
  exchange: 'bg-indigo-100 text-indigo-700',
};
const statusDot: Record<string, string> = {
  pending: 'bg-yellow-500', confirmed: 'bg-blue-500', hold: 'bg-orange-500', shipped: 'bg-purple-500',
  delivered: 'bg-green-500', office_sell: 'bg-teal-500', cancelled: 'bg-red-500', delivery_failed: 'bg-red-700',
  paid_return: 'bg-pink-500', exchange: 'bg-indigo-500',
};
const statusLabel: Record<string, string> = {
  pending: 'পেন্ডিং', confirmed: 'কনফার্মড', hold: 'হোল্ড', shipped: 'শিপড', delivered: 'ডেলিভার্ড',
  office_sell: 'অফিস সেল', cancelled: 'বাতিল', delivery_failed: 'ডেলিভারি ব্যর্থ', paid_return: 'পেইড রিটার্ন', exchange: 'এক্সচেঞ্জ',
};

function shortTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'এইমাত্র';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} মি. আগে`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ঘ. আগে`;
  return format(date, 'dd MMM', { locale: bn });
}

const ORDERS_PER_PAGE = 50;

// ─── Gift Orders Tab ───
function GiftOrdersTab() {
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [previewOrder, setPreviewOrder] = useState<any>(null);
  const [printOrder, setPrintOrder] = useState<any>(null);
  const [printItems, setPrintItems] = useState<any[]>([]);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setCurrentPage(1); }, [filter, searchQuery]);

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['giveaway-orders', filter, searchQuery, currentPage],
    queryFn: async () => {
      let q = supabase.from('orders').select('id, order_number, customer_name, customer_phone, customer_address, city, delivery_area, delivery_charge, subtotal, total, status, notes, created_at, order_origin, courier_consignment_id, courier_status, payment_status, payment_method, deleted_at, order_attribution, discount_note, free_shipping', { count: 'exact' })
        .eq('order_origin', 'giveaway')
        .is('deleted_at' as any, null)
        .order('created_at', { ascending: false });
      if (filter !== 'all') q = q.eq('status', filter);
      if (searchQuery) {
        q = q.or(`order_number.ilike.%${searchQuery}%,customer_name.ilike.%${searchQuery}%,customer_phone.ilike.%${searchQuery}%`);
      }
      const from = (currentPage - 1) * ORDERS_PER_PAGE;
      q = q.range(from, from + ORDERS_PER_PAGE - 1);
      const { data, error, count } = await q;
      if (error) throw error;
      return { orders: data || [], totalCount: count || 0 };
    },
  });

  // Fetch giveaway entries to map order_id → gift_number
  const { data: giveawayEntries = [] } = useQuery({
    queryKey: ['giveaway-entries-map'],
    queryFn: async () => {
      const { data } = await supabase.from('giveaway_entries').select('order_id, gift_number');
      return data || [];
    },
  });
  const giftNumberMap = useMemo(() => {
    const map: Record<string, number> = {};
    // Sort by gift_number ascending to assign position-based numbers
    const sorted = [...giveawayEntries].sort((a: any, b: any) => a.gift_number - b.gift_number);
    sorted.forEach((e: any, idx: number) => { if (e.order_id) map[e.order_id] = idx + 1; });
    return map;
  }, [giveawayEntries]);

  const orders = ordersData?.orders || [];
  const totalCount = ordersData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / ORDERS_PER_PAGE);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('orders').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['giveaway-orders'] }); toast.success('স্ট্যাটাস আপডেট হয়েছে'); },
  });

  const softDeleteOrder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('orders').update({ deleted_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['giveaway-orders'] });
      qc.invalidateQueries({ queryKey: ['giveaway-entries'] });
      qc.invalidateQueries({ queryKey: ['giveaway-entries-map'] });
      toast.success('অর্ডার ডিলিট হয়েছে');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handlePrint = async (order: any) => {
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
    setPrintOrder(order);
    setPrintItems(itemsWithImages);
    requestAnimationFrame(() => {
      setTimeout(async () => {
        const wrapper = document.querySelector('.print-invoice-wrapper') as HTMLElement;
        const { printInvoice } = await import('@/lib/invoicePrint');
        await printInvoice(wrapper?.firstElementChild as HTMLElement);
      }, 500);
    });
  };

  useEffect(() => {
    const cleanup = () => { setPrintOrder(null); setPrintItems([]); };
    window.addEventListener('afterprint', cleanup);
    return () => window.removeEventListener('afterprint', cleanup);
  }, []);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">মোট {totalCount}টি গিফট অর্ডার</p>
        <GiveawayOrderDialog />
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="নাম, ফোন, অর্ডার নম্বর..." className="pl-9 h-9 text-sm" />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="border border-input rounded-md px-2 py-1.5 text-sm bg-background">
          <option value="all">সব</option>
          {statuses.map(s => <option key={s} value={s}>{statusLabel[s]}</option>)}
        </select>
      </div>

      {/* Status Badges */}
      <div className="flex flex-wrap gap-1.5">
        {statuses.filter(s => {
          const count = orders.filter((o: any) => o.status === s).length;
          return count > 0 || !isMobile;
        }).map(s => {
          const count = orders.filter((o: any) => o.status === s).length;
          return (
            <span key={s} onClick={() => setFilter(prev => prev === s ? 'all' : s)}
              className={cn('px-2 py-0.5 rounded text-xs font-medium cursor-pointer hover:opacity-80', statusColor[s], filter === s && 'ring-2 ring-offset-1 ring-current')}>
              {statusLabel[s]}: {count}
            </span>
          );
        })}
      </div>

      {isLoading ? <p className="text-muted-foreground text-sm">লোড হচ্ছে...</p> : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>অর্ডার নং</TableHead>
                  <TableHead>কাস্টমার</TableHead>
                  <TableHead>মোট</TableHead>
                  <TableHead>স্ট্যাটাস</TableHead>
                  <TableHead>অ্যাকশন</TableHead>
                  <TableHead>কুরিয়ার</TableHead>
                  <TableHead>সময়</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o: any) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium text-sm">
                      {giftNumberMap[o.id] ? (
                        <>
                          <span className="font-bold">গিভঅ্যাওয়ে #{giftNumberMap[o.id]}</span>
                          <span className="ml-1.5 text-[10px] text-muted-foreground">{o.order_number}</span>
                        </>
                      ) : o.order_number}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{o.customer_name}</div>
                      <a href={`tel:${o.customer_phone}`} className="text-xs text-blue-600 hover:underline">{o.customer_phone}</a>
                      {o.notes && <div className="text-[11px] text-orange-600 max-w-[180px] truncate mt-0.5">📝 {o.notes}</div>}
                    </TableCell>
                    <TableCell className="font-medium text-sm">৳{o.total}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className={cn('inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1 border border-current/20 cursor-pointer', statusColor[o.status])}>
                            <span className={cn('w-2 h-2 rounded-full', statusDot[o.status])} />
                            {statusLabel[o.status] || o.status}
                            <ChevronDown className="h-3 w-3 opacity-60" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[160px]">
                          {statuses.map(s => (
                            <DropdownMenuItem key={s} onClick={() => updateStatus.mutate({ id: o.id, status: s })}
                              className={cn('flex items-center gap-2 text-xs cursor-pointer', o.status === s && 'font-bold')}>
                              <span className={cn('w-2 h-2 rounded-full shrink-0', statusDot[s])} />
                              {statusLabel[s]}
                              {o.status === s && <Check className="h-3 w-3 ml-auto" />}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewOrder(o)}><Eye className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handlePrint(o)}><Printer className="h-3.5 w-3.5" /></Button>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-3" align="end">
                            <p className="text-sm mb-2">ডিলিট করতে চান?</p>
                            <Button variant="destructive" size="sm" onClick={() => softDeleteOrder.mutate(o.id)} disabled={softDeleteOrder.isPending}>হ্যাঁ, ডিলিট</Button>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </TableCell>
                    <TableCell>
                      <CourierActions orderId={o.id} orderNumber={o.order_number} consignmentId={o.courier_consignment_id} courierStatus={o.courier_status} courierProvider={(o as any).courier_provider}
                        onUpdate={() => qc.invalidateQueries({ queryKey: ['giveaway-orders'] })} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{shortTimeAgo(new Date(o.created_at))}</TableCell>
                  </TableRow>
                ))}
                {orders.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">কোনো গিফট অর্ডার পাওয়া যায়নি</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3 pb-4">
            {orders.length === 0 && <p className="text-center text-muted-foreground py-8">কোনো গিফট অর্ডার পাওয়া যায়নি</p>}
            {orders.map((o: any) => (
              <div key={o.id}
                className="border rounded-lg bg-green-50/40 dark:bg-muted/30 shadow-sm py-2 px-3 cursor-pointer active:shadow-none transition-all"
                onClick={() => setPreviewOrder(o)}>
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                    <span className="text-xs font-bold tracking-tight">
                      {giftNumberMap[o.id] ? (
                        <>গিভঅ্যাওয়ে #{giftNumberMap[o.id]} <span className="font-normal text-[10px] text-muted-foreground">{o.order_number}</span></>
                      ) : o.order_number}
                    </span>
                    <span className="text-sm font-medium">{o.customer_name}</span>
                    <a href={`tel:${o.customer_phone}`} onClick={e => e.stopPropagation()} className="text-xs text-blue-600 w-fit">{o.customer_phone}</a>
                    <span className="text-sm font-bold">৳{o.total}</span>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', statusColor[o.status])}>{statusLabel[o.status]}</span>
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <CourierActions orderId={o.id} orderNumber={o.order_number} consignmentId={o.courier_consignment_id} courierStatus={o.courier_status} courierProvider={(o as any).courier_provider}
                        onUpdate={() => qc.invalidateQueries({ queryKey: ['giveaway-orders'] })} />
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="p-1 rounded hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-3" align="end">
                          <p className="text-sm mb-2">ডিলিট করতে চান?</p>
                          <Button variant="destructive" size="sm" onClick={() => softDeleteOrder.mutate(o.id)} disabled={softDeleteOrder.isPending}>হ্যাঁ, ডিলিট</Button>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{shortTimeAgo(new Date(o.created_at))}</span>
                  </div>
                </div>
                {o.notes && (
                  <div className="mt-1.5 pt-1.5 border-t border-border/50">
                    <span className="text-[11px] text-orange-600 flex items-center gap-1"><span>📝</span><span className="line-clamp-2">{o.notes}</span></span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 py-4 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-xs text-muted-foreground">{currentPage} / {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
        </>
      )}

      {/* Preview Dialog */}
      <OrderPreviewDialog order={previewOrder} open={!!previewOrder} onOpenChange={open => { if (!open) setPreviewOrder(null); }} />

      {/* Print Portal */}
      {printOrder && createPortal(
        <div className="print-invoice-wrapper">
          <OrderInvoice ref={printRef} order={printOrder} items={printItems} coupon={null} />
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── Gift Entries Tab ───
function GiftEntriesTab() {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['giveaway-entries'],
    queryFn: async () => {
      const { data } = await supabase.from('giveaway_entries').select('*').order('gift_number', { ascending: false });
      return (data || []) as unknown as GiveawayEntry[];
    },
  });

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(e => e.customer_name.toLowerCase().includes(q) || e.product_name.toLowerCase().includes(q));
  }, [entries, searchQuery]);

  const handleDelete = async (id: string) => {
    if (!confirm('এই এন্ট্রি ডিলিট করতে চান?')) return;
    const { error } = await supabase.from('giveaway_entries').delete().eq('id', id);
    if (error) { toast.error('ডিলিট করতে সমস্যা হয়েছে'); }
    else { toast.success('ডিলিট হয়েছে'); queryClient.invalidateQueries({ queryKey: ['giveaway-entries'] }); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">মোট {entries.length}টি গিফট এন্ট্রি</p>
        <AddGiveawayDialog />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="নাম বা প্রোডাক্ট খুঁজুন..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-9" />
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Gift className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground font-medium">{searchQuery ? 'কোনো ফলাফল পাওয়া যায়নি' : 'এখনো কোনো গিফট এন্ট্রি নেই'}</p>
        </div>
      ) : isMobile ? (
        <div className="space-y-3">
          {filtered.map(entry => (
            <Card key={entry.id} className="overflow-hidden">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 inline-flex items-center justify-center min-w-[2rem] h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">#{filtered.length - filtered.indexOf(entry)}</span>
                      <h3 className="font-semibold text-sm truncate">{entry.customer_name}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">🎁 {entry.product_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(entry.created_at), 'dd MMM yyyy', { locale: bn })}</p>
                    {entry.profile_link && (
                      <a href={entry.profile_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"><ExternalLink className="h-3 w-3" /> প্রোফাইল</a>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {(entry.profile_screenshot || entry.packaging_image) && (
                      <div className="flex -space-x-2">
                        {entry.profile_screenshot && <img src={entry.profile_screenshot} alt="" className="w-8 h-8 rounded object-cover border-2 border-background" />}
                        {entry.packaging_image && <img src={entry.packaging_image} alt="" className="w-8 h-8 rounded object-cover border-2 border-background" />}
                      </div>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(entry.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>কাস্টমার</TableHead>
                <TableHead>প্রোডাক্ট</TableHead>
                <TableHead>প্রোফাইল</TableHead>
                <TableHead>ছবি</TableHead>
                <TableHead>তারিখ</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(entry => (
                <TableRow key={entry.id}>
                  <TableCell><span className="inline-flex items-center justify-center min-w-[2rem] h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">#{filtered.length - filtered.indexOf(entry)}</span></TableCell>
                  <TableCell className="font-medium">{entry.customer_name}</TableCell>
                  <TableCell className="text-muted-foreground">{entry.product_name}</TableCell>
                  <TableCell>
                    {entry.profile_link ? (
                      <a href={entry.profile_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><ExternalLink className="h-3 w-3" /> লিংক</a>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex -space-x-1">
                      {entry.profile_screenshot && <img src={entry.profile_screenshot} alt="" className="w-8 h-8 rounded object-cover border-2 border-background" />}
                      {entry.packaging_image && <img src={entry.packaging_image} alt="" className="w-8 h-8 rounded object-cover border-2 border-background" />}
                      {!entry.profile_screenshot && !entry.packaging_image && <ImageIcon className="h-5 w-5 text-muted-foreground/30" />}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(entry.created_at), 'dd MMM yyyy', { locale: bn })}</TableCell>
                  <TableCell><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(entry.id)}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───
export default function Giveaway() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin/');
  const { data: navbarConfig } = useSiteConfig('navbar_config');
  const navbar = { ...DEFAULT_NAVBAR_CONFIG, ...navbarConfig };

  // ─── Admin View ───
  if (isAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          গিভঅ্যাওয়ে ম্যানেজমেন্ট
        </h1>

        <Tabs defaultValue="orders" className="w-full">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="orders" className="flex-1 sm:flex-initial">🎁 গিফট অর্ডার</TabsTrigger>
            <TabsTrigger value="entries" className="flex-1 sm:flex-initial">📋 গিফট এন্ট্রি</TabsTrigger>
          </TabsList>
          <TabsContent value="orders">
            <GiftOrdersTab />
          </TabsContent>
          <TabsContent value="entries">
            <GiftEntriesTab />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // ─── Public View ───
  return <PublicGiveawayView brandName={navbar.brand_name} />;
}

function getNextSunday(): string {
  const now = new Date();
  const day = now.getDay();
  const daysUntilSunday = day === 0 ? 7 : 7 - day;
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntilSunday);
  return format(next, 'dd MMMM yyyy', { locale: bn });
}

function PublicGiveawayView({ brandName }: { brandName?: string }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const { data: footerConfig } = useSiteConfig('footer_config');

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['giveaway-entries-public'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_public_giveaway_entries');
      if (error) throw error;
      return (data || []) as unknown as GiveawayEntry[];
    },
  });

  const openLightbox = (entry: GiveawayEntry, index: number) => {
    const imgs: string[] = [];
    if (entry.profile_screenshot) imgs.push(entry.profile_screenshot);
    if (entry.packaging_image) imgs.push(entry.packaging_image);
    if (imgs.length === 0) return;
    setLightboxImages(imgs);
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const getProductSlug = (entry: GiveawayEntry): string | null => {
    const items = entry.orders?.order_items;
    if (!items?.length) return null;
    return items[0]?.products?.slug || null;
  };

  const getProductImage = (entry: GiveawayEntry): string | null => {
    const items = entry.orders?.order_items;
    if (!items?.length) return null;
    const item = items[0];
    return getColorPrimaryImage(item.products?.variant_images?.color_images, item.color) || item.products?.images?.[0] || null;
  };

  const totalGiftValue = useMemo(() => {
    return entries.reduce((sum, e) => sum + (e.orders?.total || 0), 0);
  }, [entries]);

  const customerGiftCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const sorted = [...entries].sort((a, b) => a.gift_number - b.gift_number);
    const seen: Record<string, number> = {};
    sorted.forEach(e => {
      const name = e.customer_name.trim().toLowerCase();
      counts[name] = (counts[name] || 0) + 1;
      seen[e.id] = counts[name];
    });
    return { totals: counts, nthMap: seen };
  }, [entries]);

  const toBanglaOrdinal = (n: number) => {
    const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(n).split('').map(d => banglaDigits[parseInt(d)]).join('');
  };

  const uniqueRecipients = useMemo(() => Object.keys(customerGiftCounts.totals).length, [customerGiftCounts]);

  const socialLinks = footerConfig as any;

  return (
    <Layout>
      <SEOHead title={`Giveaway | ${brandName || 'Shorno Suta'}`} description="আমাদের গিফট পাওয়া কাস্টমারদের তালিকা দেখুন" />
      <div className="min-h-screen bg-background">
        {/* ─── Hero Header with animated background ─── */}
        <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-accent text-primary-foreground py-10 px-4">
          {/* Floating animated elements */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <span className="absolute text-4xl animate-gift-float-1 opacity-20" style={{ top: '10%', left: '5%' }}>🎁</span>
            <span className="absolute text-3xl animate-gift-float-2 opacity-15" style={{ top: '20%', right: '8%' }}>🎉</span>
            <span className="absolute text-2xl animate-gift-float-3 opacity-20" style={{ top: '60%', left: '15%' }}>✨</span>
            <span className="absolute text-3xl animate-gift-float-1 opacity-15" style={{ top: '70%', right: '12%' }}>🎀</span>
            <span className="absolute text-2xl animate-gift-float-2 opacity-20" style={{ top: '40%', left: '80%' }}>🎊</span>
            <span className="absolute text-4xl animate-gift-float-3 opacity-10" style={{ top: '5%', left: '50%' }}>🎁</span>
            <span className="absolute text-2xl animate-gift-float-1 opacity-15" style={{ top: '80%', left: '45%' }}>⭐</span>
          </div>

          <div className="max-w-4xl mx-auto text-center relative z-10">
            <div className="inline-flex items-center gap-2 mb-3 animate-float-slow">
              <Gift className="h-8 w-8" />
              <h1 className="text-3xl font-extrabold tracking-tight">🎁 Giveaway Board</h1>
            </div>
            <p className="text-sm opacity-90 max-w-md mx-auto">আমরা আমাদের প্রিয় কাস্টমারদের গিফট দিয়ে থাকি — এখানে তাদের তালিকা দেখুন!</p>

            {entries.length > 0 && (
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <div className="inline-flex items-center gap-1.5 bg-primary-foreground/20 backdrop-blur-sm rounded-full px-4 py-2 text-sm font-bold badge-shimmer">
                  🎁 মোট গিফট: {toBanglaOrdinal(entries.length)}টি
                </div>
                <div className="inline-flex items-center gap-1.5 bg-primary-foreground/20 backdrop-blur-sm rounded-full px-4 py-2 text-sm font-bold">
                  <Package className="h-4 w-4" /> বিজয়ী: {toBanglaOrdinal(uniqueRecipients)} জন
                </div>
                <div className="inline-flex items-center gap-1.5 bg-primary-foreground/20 backdrop-blur-sm rounded-full px-4 py-2 text-sm font-bold">
                  💰 মোট মূল্য: ৳{toBanglaOrdinal(Math.round(totalGiftValue))}
                </div>
              </div>
            )}

            {/* Info Cards inside Hero */}
            <div className="mt-5 grid grid-cols-3 gap-2 max-w-md mx-auto">
              <div className="bg-primary-foreground/15 backdrop-blur-sm rounded-xl p-2.5 text-center">
                <span className="text-lg">🎁</span>
                <p className="text-[11px] font-bold leading-tight mt-1">প্রতি সপ্তাহে ৫ জন</p>
                <p className="text-[9px] opacity-80 mt-0.5">কাস্টমার গিফট পাবে</p>
              </div>
              <div className="bg-primary-foreground/15 backdrop-blur-sm rounded-xl p-2.5 text-center">
                <span className="text-lg">📅</span>
                <p className="text-[11px] font-bold leading-tight mt-1">পরবর্তী গিভঅ্যাওয়ে</p>
                <p className="text-[9px] opacity-80 mt-0.5">{getNextSunday()} (রবিবার)</p>
              </div>
              <div className="bg-primary-foreground/15 backdrop-blur-sm rounded-xl p-2.5 text-center">
                <span className="text-lg">📦</span>
                <p className="text-[11px] font-bold leading-tight mt-1">শর্তাবলী</p>
                <p className="text-[9px] opacity-80 mt-0.5">Facebook ও YouTube এ Active থাকুন</p>
              </div>
            </div>

            <p className="mt-3 text-[11px] opacity-80 max-w-sm mx-auto leading-relaxed">আমাদের Facebook পেজ ও YouTube এ নিয়মিত Active থাকতে হবে। যার পয়েন্ট ভালো থাকবে, সেই গিফট পাবে। যে যত Active থাকবে!</p>

            {/* Social Links */}
            {socialLinks && (
              <div className="mt-4 flex items-center justify-center gap-3">
                {socialLinks.facebook && (
                  <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-primary-foreground/20 hover:bg-primary-foreground/30 flex items-center justify-center transition-colors backdrop-blur-sm">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  </a>
                )}
                {socialLinks.instagram && (
                  <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-primary-foreground/20 hover:bg-primary-foreground/30 flex items-center justify-center transition-colors backdrop-blur-sm">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                  </a>
                )}
                {socialLinks.youtube && (
                  <a href={socialLinks.youtube} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-primary-foreground/20 hover:bg-primary-foreground/30 flex items-center justify-center transition-colors backdrop-blur-sm">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                  </a>
                )}
                {socialLinks.tiktok && (
                  <a href={socialLinks.tiktok} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-primary-foreground/20 hover:bg-primary-foreground/30 flex items-center justify-center transition-colors backdrop-blur-sm">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1 0-5.78c.27 0 .54.04.8.1v-3.5a6.37 6.37 0 0 0-.8-.05A6.34 6.34 0 0 0 3.15 15.3a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.98a8.2 8.2 0 0 0 3.76.92V6.69z"/></svg>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>


        {/* ─── Gift Cards Grid ─── */}
        <div className="max-w-4xl mx-auto px-4 py-6">
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
              {[1, 2, 3, 4].map(i => (
                <Card key={i} className="overflow-hidden"><Skeleton className="h-36 w-full" /><CardContent className="p-3 space-y-1.5"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></CardContent></Card>
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-16">
              <Gift className="h-16 w-16 mx-auto text-muted-foreground/40 mb-4" />
              <p className="text-lg font-semibold text-muted-foreground">এখনো কোনো গিফট এন্ট্রি নেই</p>
              <p className="text-sm text-muted-foreground mt-1">শীঘ্রই আমাদের গিভওয়ে শুরু হবে!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-5">
              {entries.map(entry => {
                const nameKey = entry.customer_name.trim().toLowerCase();
                const totalForPerson = customerGiftCounts.totals[nameKey] || 1;
                const nthTime = customerGiftCounts.nthMap[entry.id] || 1;
                const giftValue = entry.orders?.total || 0;
                const positionNumber = entries.length - entries.indexOf(entry);
                const slug = getProductSlug(entry);
                const productImage = getProductImage(entry);
                const proofImages: string[] = [];
                if (entry.profile_screenshot) proofImages.push(entry.profile_screenshot);
                if (entry.packaging_image) proofImages.push(entry.packaging_image);
                const mainImage = proofImages[0] || productImage;
                // Secondary: remaining proof images + product image
                const secondaryProofs = proofImages.slice(1);
                const secondaryProductImg = productImage && proofImages.length > 0 ? productImage : null;

                return (
                  <div key={entry.id} className="giveaway-card group relative rounded-xl overflow-hidden border border-border bg-card shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                    {/* Gradient top border */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary z-10" />
                    
                    {/* Main Product Image */}
                    <div className="relative aspect-square sm:aspect-[4/3] overflow-hidden bg-muted">
                      {mainImage ? (
                        <>
                          <img src={mainImage} alt={entry.product_name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 cursor-pointer" loading="lazy"
                            onClick={() => openLightbox(entry, 0)} />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center pointer-events-none">
                            <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                          <Gift className="h-10 w-10 text-muted-foreground/30" />
                        </div>
                      )}

                      {/* Gift number badge */}
                      <span className="absolute top-2 left-2 inline-flex items-center justify-center min-w-[2.5rem] h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold animate-glow-pulse-btn shadow-lg z-10">
                        #{toBanglaOrdinal(positionNumber)}
                      </span>

                      {/* Secondary thumbnails */}
                      {(secondaryProofs.length > 0 || secondaryProductImg) && (
                        <div className="absolute bottom-2 right-2 flex gap-1 z-10">
                          {secondaryProofs.map((img, idx) => (
                            <div key={`proof-${idx}`} className="w-9 h-9 rounded-md overflow-hidden border-2 border-card shadow cursor-pointer hover:scale-110 transition-transform"
                              onClick={(e) => { e.stopPropagation(); openLightbox(entry, idx + 1); }}>
                              <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-2.5 sm:p-3.5">
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-xs sm:text-sm text-card-foreground truncate">{entry.customer_name}</h3>
                          {slug ? (
                            <Link to={`/product/${slug}`} className="text-[10px] sm:text-xs text-primary hover:underline mt-0.5 block truncate">
                              🎁 {entry.product_name}
                            </Link>
                          ) : (
                            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-1">🎁 {entry.product_name}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {totalForPerson > 1 && (
                            <span className="text-[9px] sm:text-[10px] font-medium bg-accent text-accent-foreground rounded-full px-1.5 py-0.5">
                              {toBanglaOrdinal(nthTime)}য়
                            </span>
                          )}
                          {secondaryProductImg && slug && (
                            <Link to={`/product/${slug}`} onClick={(e) => e.stopPropagation()} className="block">
                              <img src={secondaryProductImg} alt={entry.product_name} className="w-8 h-8 rounded-md object-cover border border-border shadow-sm hover:scale-110 transition-transform" loading="lazy" />
                            </Link>
                          )}
                        </div>
                      </div>

                      {/* Date row */}
                      <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-border/50">
                        <span className="text-[10px] sm:text-xs font-semibold text-primary truncate">
                          {giftValue > 0 ? `৳${toBanglaOrdinal(Math.round(giftValue))}` : '🎁 ফ্রি'}
                        </span>
                        <span className="text-[9px] sm:text-[11px] text-muted-foreground shrink-0">
                          {format(new Date(entry.created_at), 'dd MMM', { locale: bn })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <ImageLightbox images={lightboxImages} open={lightboxOpen} onOpenChange={setLightboxOpen} initialIndex={lightboxIndex} />
    </Layout>
  );
}
