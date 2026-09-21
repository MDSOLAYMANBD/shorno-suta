import { useState, useEffect, useRef } from 'react';
import CustomerLoyaltyBadge from '@/components/admin/CustomerLoyaltyBadge';
import { getOrderDiscount } from '@/lib/orderDiscount';
import { getColorPrimaryImage } from '@/lib/productVariants';
import { useIsMobile } from '@/hooks/use-mobile';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import OrderInvoice from '@/components/admin/OrderInvoice';
import GiftMemoInvoice from '@/components/admin/GiftMemoInvoice';
import SendOrderSmsDialog from '@/components/admin/SendOrderSmsDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { ensureOfficeSellSaleEntry, deleteOfficeSellSaleEntry } from '@/lib/officeSellSaleEntry';
import { Save, Phone, Trash2, Plus, Minus, Search, Pencil, ChevronDown, MessageSquare, Printer, Loader2, Send, ArrowLeft, BarChart3, Globe, Monitor, Eye, Link, Gift, Truck, Clock, Edit, ShoppingCart, Package, Share2, Copy, Check, ExternalLink, ImageIcon, X, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import MediaCenter from '@/components/admin/MediaCenter';
import { useBDCourierCache } from '@/hooks/useBDCourierCache';
import { format } from 'date-fns';
import { useActivityLog } from '@/hooks/useActivityLog';
import ExchangeSection from '@/components/admin/ExchangeSection';
import CourierActions from '@/components/admin/CourierActions';
import { isDeliveryMemoPrintable, PRINT_LOCKED_MESSAGE } from '@/lib/orderPrintEligibility';
import CourierParcelHistory from '@/components/admin/CourierParcelHistory';
import { useAdminProductPicker, useAdminCategoryOptions } from '@/hooks/useAdminProductPicker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useShippingCharges } from '@/hooks/useShippingCharges';

interface OrderPreviewDialogProps {
  order: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// deliveryOptions are built dynamically inside the component from useShippingCharges()

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: 'পেন্ডিং', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  confirmed: { label: 'কনফার্মড', className: 'bg-blue-100 text-blue-800 border-blue-300' },
  hold: { label: 'হোল্ড', className: 'bg-orange-100 text-orange-800 border-orange-300' },
  in_review: { label: 'ইন রিভিউ', className: 'bg-sky-100 text-sky-800 border-sky-300' },
  shipped: { label: 'শিপড', className: 'bg-purple-100 text-purple-800 border-purple-300' },
  delivered: { label: 'ডেলিভার্ড', className: 'bg-green-100 text-green-800 border-green-300' },
  office_sell: { label: 'অফিস সেল', className: 'bg-teal-100 text-teal-800 border-teal-300' },
  cancelled: { label: 'বাতিল', className: 'bg-red-100 text-red-800 border-red-300' },
  delivery_failed: { label: 'ডেলিভারি ফেইলড', className: 'bg-rose-100 text-rose-800 border-rose-300' },
  paid_return: { label: 'পেইড রিটার্ন', className: 'bg-pink-100 text-pink-800 border-pink-300' },
  exchange: { label: 'এক্সচেঞ্জ', className: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
};

const statuses = ['pending', 'confirmed', 'hold', 'in_review', 'shipped', 'delivered', 'office_sell', 'cancelled', 'delivery_failed', 'paid_return', 'exchange'];

export default function OrderPreviewDialog({ order, open, onOpenChange }: OrderPreviewDialogProps) {
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const { logActivity } = useActivityLog();
  const { charges } = useShippingCharges();
  const deliveryOptions = [
    { value: 'dhaka_inside', label: 'ঢাকা সিটি', price: charges.dhaka_inside },
    { value: 'dhaka_suburb', label: 'সাব-এরিয়া', price: charges.dhaka_suburb },
    { value: 'dhaka_outside', label: 'সারাদেশ', price: charges.dhaka_outside },
  ];
  const [form, setForm] = useState({
    customer_name: '', customer_phone: '', customer_email: '', customer_address: '',
    delivery_charge: 0, delivery_area: 'dhaka_inside', total: 0, notes: '', status: '', discount: 0,
    discount_note: '', free_shipping: false, order_origin: 'website', is_gift_order: false,
    customer_alt_phone: '', courier_note: '',
  });
  const [defaultCourierNote, setDefaultCourierNote] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedVariants, setSelectedVariants] = useState<Record<string, { color?: string; size?: string }>>({});
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState<number>(0);
  const [customQty, setCustomQty] = useState<number>(1);

  const addCustomItem = async () => {
    const name = customName.trim();
    if (!name) { toast.error('আইটেমের নাম দিন'); return; }
    if (customPrice < 0) { toast.error('দাম সঠিক নয়'); return; }
    try {
      const { error } = await supabase.from('order_items').insert({
        order_id: order.id,
        product_id: null,
        product_name: name,
        price: customPrice,
        quantity: customQty || 1,
        item_type: 'custom',
      } as any);
      if (error) { toast.error('কাস্টম আইটেম যোগ করতে ব্যর্থ'); return; }
      const { data: freshItems } = await refetchItems();
      if (freshItems) {
        const newSub = freshItems.reduce((s: number, i: any) => s + getEffectivePrice(i) * i.quantity, 0);
        await syncTotalsToDb(newSub);
      }
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      const sName = await getStaffName();
      await logOrderActivity('item_added', `${sName} কাস্টম আইটেম যোগ করেছে: ${name}`, { product_name: name });
      toast.success('কাস্টম আইটেম যোগ হয়েছে!');
      setCustomName(''); setCustomPrice(0); setCustomQty(1);
    } catch { toast.error('কাস্টম আইটেম যোগ করতে সমস্যা হয়েছে'); }
  };

  const setVariant = (productId: string, key: 'color' | 'size', value: string) => {
    setSelectedVariants(prev => ({ ...prev, [productId]: { ...prev[productId], [key]: value } }));
  };

  const getAvailSizes = (colorSizesMap: Record<string, string[]>, color: string, allSizes: string[]) => {
    if (color && colorSizesMap[color]?.length > 0) return colorSizesMap[color];
    return allSizes;
  };
  const [statusOpen, setStatusOpen] = useState(false);
  const [newNote, setNewNote] = useState('');
  
  const [printReady, setPrintReady] = useState(false);
  const [giftMode, setGiftMode] = useState(false);
  const [giftDialogOpen, setGiftDialogOpen] = useState(false);
  const [giftSenderName, setGiftSenderName] = useState('');
  const [giftNote, setGiftNote] = useState('');
  const [giveawayProfileLink, setGiveawayProfileLink] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mediaCenterOpen, setMediaCenterOpen] = useState(false);
  const [giveawayDistrict, setGiveawayDistrict] = useState('');
  const [giveawayPhotos, setGiveawayPhotos] = useState<string[]>([]);
  const [addToGiveawayEntry, setAddToGiveawayEntry] = useState(false);
  
  const printRef = useRef<HTMLDivElement>(null);
  const giftPrintRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Fetch active coupon for invoice print
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
    enabled: open,
  });

  // BD Courier data
  const phoneForCourier = order?.customer_phone || '';
  const { getCourierData, fetchPhone } = useBDCourierCache();
  const courierData = phoneForCourier ? getCourierData(phoneForCourier) : null;

  // Fetch exchange record if this is an exchange order
  const { data: exchangeRecord } = useQuery({
    queryKey: ['exchange-record-for-order', order?.id],
    queryFn: async () => {
      const { data } = await supabase.from('order_exchanges')
        .select('*')
        .eq('new_order_id', order.id)
        .limit(1);
      if (!data || data.length === 0) return null;
      const record = data[0];
      // Fetch parent order info
      const { data: parentOrder } = await supabase.from('orders')
        .select('order_number, status')
        .eq('id', record.order_id)
        .single();
      
      // Enrich old_items and new_items with product images if missing
      const allItems = [...(record.old_items as any[] || []), ...(record.new_items as any[] || [])];
      const namesWithoutImage = allItems.filter((it: any) => !it.image).map((it: any) => it.product_name);
      let imageMap: Record<string, string> = {};
      if (namesWithoutImage.length > 0) {
        const uniqueNames = [...new Set(namesWithoutImage)];
        const { data: products } = await supabase.from('products')
          .select('name, image_url')
          .in('name', uniqueNames);
        if (products) {
          products.forEach((p: any) => { if (p.image_url) imageMap[p.name] = p.image_url; });
        }
      }
      const enrichItems = (items: any[]) => items.map((it: any) => ({
        ...it,
        image: it.image || imageMap[it.product_name] || null,
      }));

      return {
        ...record,
        old_items: enrichItems(record.old_items as any[] || []),
        new_items: enrichItems(record.new_items as any[] || []),
        parent_order_number: parentOrder?.order_number,
        parent_status: parentOrder?.status,
      };
    },
    enabled: !!order?.id && open && order?.order_origin === 'exchange',
    staleTime: 30_000,
  });

  // Fetch giveaway entry for this order
  const { data: giveawayEntryData } = useQuery({
    queryKey: ['giveaway-entry-for-order', order?.id],
    queryFn: async () => {
      const { data } = await supabase.from('giveaway_entries').select('*').eq('order_id', order.id).limit(1);
      return data?.[0] || null;
    },
    enabled: !!order?.id && open && order?.order_origin === 'giveaway',
  });

  // Fetch giveaway stats for gift memo
  const { data: giftStats } = useQuery({
    queryKey: ['giveaway-gift-stats', order?.id, order?.customer_name],
    queryFn: async () => {
      // Total gifts count
      const { count: totalGifts } = await supabase.from('giveaway_entries').select('*', { count: 'exact', head: true });
      // Total unique recipients
      const { data: allEntries } = await supabase.from('giveaway_entries').select('customer_name');
      const uniqueNames = new Set((allEntries || []).map((e: any) => e.customer_name?.trim().toLowerCase()));
      const totalRecipients = uniqueNames.size;
      // How many times this customer got a gift
      const { count: recipientCount } = await supabase.from('giveaway_entries').select('*', { count: 'exact', head: true }).eq('customer_name', order.customer_name);
      // Total gift value via RPC
      const { data: totalGiftValue } = await supabase.rpc('get_total_gift_value' as any);
      return {
        totalGifts: totalGifts || 0,
        totalRecipients,
        recipientGiftNumber: recipientCount || 1,
        totalGiftValue: Number(totalGiftValue) || 0,
      };
    },
    enabled: !!order?.id && open && order?.order_origin === 'giveaway',
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    if (order) {
      setForm({
        customer_name: order.customer_name || '', customer_phone: order.customer_phone || '',
        customer_email: order.customer_email || '', customer_address: order.customer_address || '',
        delivery_charge: order.delivery_charge || 0, delivery_area: order.delivery_area || 'dhaka_inside',
        total: order.total || 0, notes: order.notes || '', status: order.status || 'pending',
        discount: getOrderDiscount(order),
        discount_note: (order as any).discount_note || '', free_shipping: (order as any).free_shipping || false,
        order_origin: order.order_origin || 'website', is_gift_order: (order as any).is_gift_order || false,
        customer_alt_phone: (order as any).customer_alt_phone || '',
        courier_note: (order as any).courier_note || '',
      });
      setEditMode(false);
      setNewNote('');
      setCopied(false);
      const attr = order.order_attribution as any;
      setGiftSenderName(attr?.gift_sender_name || '');
      setGiftNote(attr?.gift_note || '');
      setGiveawayProfileLink(attr?.giveaway_profile_link || '');
      setGiveawayDistrict(attr?.giveaway_district || '');
      setGiveawayPhotos(attr?.giveaway_photos || []);
      setAddToGiveawayEntry(false);
    }
  }, [order]);

  // Load default courier notes (normal + exchange) once dialog opens; pick based on order_origin
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase.from('store_settings').select('key, value').in('key', ['courier_default_note', 'courier_exchange_default_note']);
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => { map[r.key] = r.value || ''; });
      const isExchange = (order as any)?.order_origin === 'exchange';
      setDefaultCourierNote(isExchange ? (map.courier_exchange_default_note || map.courier_default_note || '') : (map.courier_default_note || ''));
    })();
  }, [open, (order as any)?.order_origin]);

  // Auto-fix: when opening an office_sell order, ensure accounting entry matches current total
  useEffect(() => {
    if (open && order?.id && order?.status === 'office_sell') {
      ensureOfficeSellSaleEntry(order.id, { silent: true }).then(() => {
        qc.invalidateQueries({ queryKey: ['acc-accounts'] });
        qc.invalidateQueries({ queryKey: ['acc-transactions'] });
        qc.invalidateQueries({ queryKey: ['acc-transaction-summary'] });
        qc.invalidateQueries({ queryKey: ['sales-history'] });
      });
    }
  }, [open, order?.id, order?.status]);

  // Auto-sync courier status from provider when opening an active parcel
  useEffect(() => {
    if (!open || !order?.id) return;
    const cid = order?.courier_consignment_id;
    const provider = (order as any)?.courier_provider;
    const status = order?.courier_status;
    if (!cid || !provider) return;
    const ACTIVE = ['in_review', 'pending', 'hold', 'Pending', 'On_Hold'];
    if (!ACTIVE.includes(String(status || ''))) return;

    // Throttle: max once per 30s per consignment
    const key = `__courier_sync_${cid}`;
    const last = Number((window as any)[key] || 0);
    if (Date.now() - last < 30_000) return;
    (window as any)[key] = Date.now();

    const funcMap: Record<string, string> = {
      steadfast: 'steadfast-courier',
      pathao: 'pathao-courier',
      redx: 'redx-courier',
    };
    const fn = funcMap[provider];
    if (!fn) return;

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`https://xxucasikopqtcztbgfbw.supabase.co/functions/v1/${fn}?action=check_status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ consignment_id: cid }),
        });
        if (res.ok) {
          qc.invalidateQueries({ queryKey: ['admin-order-preview', order.id] });
          qc.invalidateQueries({ queryKey: ['admin-orders'] });
        }
      } catch (e) {
        console.warn('[preview courier auto-sync]', e);
      }
    })();
  }, [open, order?.id, order?.courier_consignment_id, order?.courier_status]);

  const getMemoUrl = () => `https://www.shornosuta.com/memo/${order?.order_number}`;

  const getShareText = () => `স্বর্ণ সুতা ❤️\n\nআপনার অর্ডার কনফার্ম করা হয়েছে!\n\nঅর্ডার আইডি: ${order?.order_number}\nমোট: ৳${order?.total}\n\nঅর্ডার বিস্তারিত দেখুন:\n${getMemoUrl()}`;

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(getShareText());
    setCopied(true);
    toast.success('মেমো লিংক কপি হয়েছে!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppShare = () => {
    const text = getShareText();
    const phone = order.customer_phone?.replace(/[^0-9]/g, '');
    const waPhone = phone?.startsWith('0') ? `88${phone}` : phone;
    window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`, '_blank');
    setShareOpen(false);
  };

  // Helper: get current staff name
  const getStaffName = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return 'Unknown';
    const { data: profile } = await supabase.from('employee_profiles').select('full_name').eq('user_id', session.user.id).single();
    return profile?.full_name || 'Staff';
  };

  const logOrderActivity = async (action_type: string, description: string, metadata?: Record<string, any>) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await supabase.from('activity_logs' as any).insert({
        user_id: session.user.id,
        action_type,
        entity_type: 'order',
        entity_id: order.id,
        description,
        metadata: metadata || {},
      } as any);
    } catch (e) {
      console.error('Activity log error:', e);
    }
  };

  const { data: items = [], refetch: refetchItems, isLoading: itemsLoading } = useQuery({
    queryKey: ['preview-order-items', order?.id],
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from('order_items')
        .select('id, order_id, product_id, product_name, price, quantity, color, size, item_type, parent_product_id, upsell_image, upsell_parent_name, products!order_items_product_id_fkey(images, sizes, colors, variant_images, price, original_price)').eq('order_id', order.id);
      return data || [];
    },
    enabled: !!order?.id && open,
  });

  // Activity logs for this order
  const { data: activityLogs = [], refetch: refetchActivityLogs } = useQuery({
    queryKey: ['order-activity-logs', order?.id],
    queryFn: async () => {
      const { data: logs } = await supabase.from('activity_logs' as any)
        .select('*')
        .eq('entity_type', 'order')
        .eq('entity_id', order.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!logs || logs.length === 0) return [];
      // Get unique user_ids and fetch employee names
      const userIds = [...new Set((logs as any[]).map((l: any) => l.user_id).filter(Boolean))];
      const { data: profiles } = await supabase.from('employee_profiles').select('user_id, full_name, avatar_url').in('user_id', userIds);
      const profileMap: Record<string, any> = {};
      (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p; });
      return (logs as any[]).map((l: any) => ({
        ...l,
        employee_name: profileMap[l.user_id]?.full_name || 'Unknown',
        employee_avatar: profileMap[l.user_id]?.avatar_url || null,
      }));
    },
    enabled: !!order?.id && open,
  });

  // Notes history
  const { data: notesHistory = [], refetch: refetchNotes } = useQuery({
    queryKey: ['order-notes', order?.id],
    queryFn: async () => {
      const { data } = await supabase.from('order_notes')
        .select('*').eq('order_id', order.id).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!order?.id && open,
  });

  const addNoteMutation = useMutation({
    mutationFn: async (note: string) => {
      const { error } = await supabase.from('order_notes').insert({
        order_id: order.id, note,
      });
      if (error) throw error;
      return note;
    },
    onSuccess: async (note) => {
      refetchNotes();
      setNewNote('');
      toast.success('নোট যোগ হয়েছে!');
      const staffName = await getStaffName();
      await logOrderActivity('note_added', `${staffName} নোট যোগ করেছে: ${note.length > 50 ? note.substring(0, 50) + '...' : note}`);
      refetchActivityLogs();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: categoryOptions = [] } = useAdminCategoryOptions(addOpen);
  const {
    products: searchResults,
    fetchNextPage: fetchNextProductPage,
    hasNextPage: hasMoreProducts,
    isFetchingNextPage: isFetchingMoreProducts,
  } = useAdminProductPicker(search, addOpen, categoryFilter !== 'all' ? categoryFilter : null);
  const productSentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!productSentinelRef.current || !hasMoreProducts) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) fetchNextProductPage();
    }, { rootMargin: '200px' });
    io.observe(productSentinelRef.current);
    return () => io.disconnect();
  }, [hasMoreProducts, fetchNextProductPage, searchResults.length]);

  const addItemMutation = useMutation({
    mutationFn: async (product: any) => {
      const vi = (product.variant_images as any) || {};
      const colorSizes: Record<string, string[]> = vi.color_sizes || {};
      const sv = selectedVariants[product.id];
      const initialColor = sv?.color || product.colors?.[0] || null;
      const allSizes = product.sizes || [];
      const availSizes = (initialColor && colorSizes[initialColor]?.length > 0) ? colorSizes[initialColor] : allSizes;
      const initialSize = sv?.size || availSizes[0] || null;

      const effectivePrice = calcEffectivePrice(product, initialSize);

      const { error } = await supabase.from('order_items').insert({
        order_id: order.id, product_id: product.id, product_name: product.name,
        price: effectivePrice, quantity: 1,
        size: initialSize, color: initialColor,
      });
      if (error) throw error;

      // Auto-add addon if configured
      const addon = product.addon_config as { name?: string; price?: number } | null;
      if (addon?.name && addon?.price) {
        await supabase.from('order_items').insert({
          order_id: order.id, product_id: product.id,
          product_name: `[অ্যাড-অন] ${addon.name}`,
          price: addon.price, quantity: 1,
          item_type: 'addon', parent_product_id: product.id,
        } as any);
      }

      // Auto-add bump product if configured
      if (product.bump_product_id) {
        const { data: bumpProduct } = await supabase.from('products')
          .select('id, name, price, original_price').eq('id', product.bump_product_id).maybeSingle();
        if (bumpProduct) {
          const bumpPrice = (bumpProduct.original_price && bumpProduct.original_price > 0 && bumpProduct.original_price < bumpProduct.price)
            ? bumpProduct.original_price : bumpProduct.price;
          // Fixed-taka discount (consistent with place-order edge function and standalone bump add)
          const discountedPrice = product.bump_discount ? Math.max(0, bumpPrice - product.bump_discount) : bumpPrice;
          await supabase.from('order_items').insert({
            order_id: order.id, product_id: bumpProduct.id,
            product_name: `[বাম্প] ${bumpProduct.name}`,
            price: discountedPrice, quantity: 1,
            item_type: 'bump', parent_product_id: product.id,
          } as any);
        }
      }
    },
    onSuccess: async (_data, product) => {
      const { data: freshItems } = await refetchItems();
      if (freshItems) {
        const newSub = freshItems.reduce((s: number, i: any) => s + getEffectivePrice(i) * i.quantity, 0);
        syncTotalsToDb(newSub);
      }
      const staffName = await getStaffName();
      await logOrderActivity('item_added', `${staffName} নতুন আইটেম যোগ করেছে: ${product.name}`);
      refetchActivityLogs();
      toast.success('প্রোডাক্ট যোগ হয়েছে!');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ itemId, field, value }: { itemId: string; field: string; value: any }) => {
      const { error } = await supabase.from('order_items').update({ [field]: value } as any).eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: async () => {
      const { data: freshItems } = await refetchItems();
      if (freshItems) {
        const newSub = freshItems.reduce((s: number, i: any) => s + getEffectivePrice(i) * i.quantity, 0);
        syncTotalsToDb(newSub);
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from('order_items').delete().eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: async (_data, itemId) => {
      const deletedItem = items.find((i: any) => i.id === itemId);
      const { data: freshItems } = await refetchItems();
      if (freshItems) {
        const newSub = freshItems.reduce((s: number, i: any) => s + getEffectivePrice(i) * i.quantity, 0);
        syncTotalsToDb(newSub);
      }
      if (deletedItem) {
        const staffName = await getStaffName();
        await logOrderActivity('item_deleted', `${staffName} আইটেম ডিলিট করেছে: ${deletedItem.product_name}`, { product_name: deletedItem.product_name });
        refetchActivityLogs();
      }
      toast.success('আইটেম ডিলিট হয়েছে!');
    },
    onError: (e: any) => toast.error(e.message),
  });

  // In-flight lock + debounce for courier resync so rapid item edits don't pile up duplicate calls.
  const resyncInFlightRef = useRef(false);
  const resyncDebounceRef = useRef<any>(null);
  const courierSyncBlockedRef = useRef(false);

  // Auto-recreate Steadfast parcel whenever courier-relevant data changes.
  // Steadfast public API has no edit endpoint, so we archive the old parcel and
  // create a brand-new one. Old-parcel delete is best-effort and never blocks.
  const maybeRecreateParcel = async (reason: string): Promise<boolean> => {
    if (order?.courier_provider !== 'steadfast') return true;
    if (!order?.courier_consignment_id) return true;
    const status = (order?.courier_status || '').toLowerCase();
    const allowed = ['in_review', 'draft', 'awaiting_dispatch', 'pending'];
    // If parcel already in courier network (picked/shipped/unknown/etc.), silently skip
    // recreate — DB edit still saves; courier parcel stays as-is (can't be modified anyway).
    if (status && !allowed.includes(status)) {
      courierSyncBlockedRef.current = true;
      toast.info('পার্সেল কুরিয়ার নেটওয়ার্কে — শুধু লোকাল অর্ডার আপডেট হলো, কুরিয়ারে পরিবর্তন যায়নি।', { duration: 6000 });
      return true;
    }

    if (resyncInFlightRef.current) return true;
    resyncInFlightRef.current = true;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/steadfast-courier?action=recreate_parcel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ order_id: order.id, reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        courierSyncBlockedRef.current = true;
        if (res.status === 409) {
          toast.error(data?.error || 'Parcel courier-এ চলে গেছে — auto recreate সম্ভব না।', { duration: 10000 });
          return false;
        }
        throw new Error(data?.error || 'recreate failed');
      }
      courierSyncBlockedRef.current = false;
      if (data?.skipped) return true;
      if (data?.recreated) {
        const oldNote = data?.old_consignment_id ? ` (পুরাতন #${data.old_consignment_id} archived${data?.old_deleted ? ' + deleted' : ''})` : '';
        toast.success(`নতুন Steadfast parcel #${data?.new_consignment_id} তৈরি হয়েছে — COD ৳${data?.new_cod}${oldNote}`, { duration: 9000 });
      }
      qc.invalidateQueries({ queryKey: ['admin-order-preview', order.id] });
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      qc.invalidateQueries({ queryKey: ['order-courier-history', order.id] });
      return true;
    } catch (e: any) {
      courierSyncBlockedRef.current = true;
      toast.error('Steadfast auto-recreate ব্যর্থ: ' + (e?.message || 'unknown'));
      return false;
    } finally {
      resyncInFlightRef.current = false;
    }
  };

  // Back-compat alias for legacy total-only callers (syncTotalsToDb scheduleResync path)
  const maybeResyncSteadfast = async (_oldTotal: number, _newTotal: number): Promise<boolean> => {
    return maybeRecreateParcel('cod_change');
  };

  // Debounced wrapper — multiple rapid edits collapse into one resync.
  const scheduleResync = (oldTotal: number, newTotal: number) => {
    if (courierSyncBlockedRef.current) return;
    if (resyncDebounceRef.current) clearTimeout(resyncDebounceRef.current);
    resyncDebounceRef.current = setTimeout(() => {
      maybeResyncSteadfast(oldTotal, newTotal);
    }, 900);
  };

  useEffect(() => {
    if (open && order?.id) courierSyncBlockedRef.current = false;
  }, [open, order?.id]);

  // NOTE: auto-resync on dialog open is intentionally disabled.
  // Courier parcel is only recreated when the user explicitly clicks Save.


  // Cancel parcel at courier when order status is set to cancelled (in_review only).
  const cancelCourierIfNeeded = async (newStatus: string) => {
    if (!order?.courier_consignment_id) return;
    if (newStatus !== 'cancelled') return;
    if (order?.courier_status && order.courier_status !== 'in_review' && order.courier_status !== 'pending' && order.courier_status !== 'Pending') {
      toast.warning('কুরিয়ার পার্সেল আর in-review নেই — পোর্টাল থেকে ম্যানুয়ালি ক্যানসেল করুন।');
      return;
    }
    const provider = order.courier_provider || 'steadfast';
    const fnMap: Record<string, string> = { steadfast: 'steadfast-courier', pathao: 'pathao-courier', redx: 'redx-courier' };
    const fnName = fnMap[provider];
    if (!fnName) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fnName}?action=cancel_order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ order_id: order.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.warning(data?.error || `${provider} থেকে অটো-ক্যানসেল ব্যর্থ — পোর্টাল থেকে ম্যানুয়ালি ডিলিট করুন`, { duration: 7000 });
        return;
      }
      if (data?.requires_manual) {
        toast.warning(`${provider.toUpperCase()} পোর্টাল থেকে পার্সেলটি ম্যানুয়ালি ক্যানসেল করুন (API সাপোর্ট করে না)`, { duration: 7000 });
      } else if (data?.deleted) {
        toast.success(`${provider.toUpperCase()} থেকে পার্সেল ক্যানসেল হয়েছে`);
      }
      qc.invalidateQueries({ queryKey: ['admin-order-preview', order.id] });
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
    } catch (e: any) {
      toast.error('কুরিয়ার ক্যানসেল ব্যর্থ: ' + (e?.message || 'unknown'));
    }
  };

  // Lightweight sync of subtotal/total to DB after item mutations
  const syncTotalsToDb = async (newSubtotal: number) => {
    const currentDelivery = form.free_shipping ? 0 : form.delivery_charge;
    const newTotal = newSubtotal + currentDelivery - (form.discount || 0);
    const prevTotal = Number(order?.total || 0);
    await supabase.from('orders').update({ subtotal: newSubtotal, total: newTotal }).eq('id', order.id);
    qc.invalidateQueries({ queryKey: ['admin-orders'] });

    // Always sync for office_sell — ensureOfficeSellSaleEntry is idempotent (skips if amount matches)
    if (order.status === 'office_sell' || form.status === 'office_sell') {
      await ensureOfficeSellSaleEntry(order.id);
      qc.invalidateQueries({ queryKey: ['acc-accounts'] });
      qc.invalidateQueries({ queryKey: ['acc-transactions'] });
      qc.invalidateQueries({ queryKey: ['acc-transaction-summary'] });
      qc.invalidateQueries({ queryKey: ['acc-daily-history'] });
      qc.invalidateQueries({ queryKey: ['acc-activity-logs'] });
      qc.invalidateQueries({ queryKey: ['sales-history'] });
    }

    // NOTE: courier parcel is NOT auto-recreated on item add/remove/edit.
    // It only happens when the user clicks the Save button (see updateOrder).
  };


  const updateOrder = useMutation({
    mutationFn: async () => {
      const statusChanged = form.status !== order.status;
      const { error } = await supabase.from('orders').update({
        customer_name: form.customer_name, customer_phone: form.customer_phone,
        customer_email: form.customer_email.trim() || null,
        customer_address: form.customer_address,
        delivery_charge: form.delivery_charge, delivery_area: form.delivery_area,
        subtotal, total: form.total, notes: form.notes, status: form.status,
        discount_note: form.discount_note, free_shipping: form.free_shipping,
        order_origin: form.order_origin, is_gift_order: form.is_gift_order,
        customer_alt_phone: form.customer_alt_phone?.trim() || null,
        courier_note: form.courier_note?.trim() || null,

      } as any).eq('id', order.id);
      if (error) throw error;

      // Log changes
      const staffName = await getStaffName();
      const changes: string[] = [];
      if (form.status !== order.status) {
        const oldLabel = statusConfig[order.status]?.label || order.status;
        const newLabel = statusConfig[form.status]?.label || form.status;
        await logOrderActivity('order_status_change', `${staffName} স্ট্যাটাস পরিবর্তন করেছে: ${oldLabel} → ${newLabel}`, { old_status: order.status, new_status: form.status });
      }
      if (form.delivery_charge !== order.delivery_charge) {
        await logOrderActivity('order_edit', `${staffName} ডেলিভারি চার্জ পরিবর্তন করেছে: ৳${order.delivery_charge} → ৳${form.delivery_charge}`);
      }
      if (form.total !== order.total) {
        await logOrderActivity('order_edit', `${staffName} টোটাল পরিবর্তন করেছে: ৳${order.total} → ৳${form.total}`);
      }
      if (form.customer_name !== order.customer_name) {
        await logOrderActivity('order_edit', `${staffName} কাস্টমার নাম পরিবর্তন করেছে: ${order.customer_name} → ${form.customer_name}`);
      }
      if (form.customer_phone !== order.customer_phone) {
        await logOrderActivity('order_edit', `${staffName} ফোন পরিবর্তন করেছে: ${order.customer_phone} → ${form.customer_phone}`);
        // A corrected number almost always means the original confirmation SMS
        // never reached the customer (wrong number) — resend it to the fixed
        // number now instead of leaving the customer without any confirmation.
        supabase.functions.invoke('send-order-notification', {
          body: { order_id: order.id, type: 'confirmation', send_sms: true },
        }).then(() => toast.success('সংশোধিত নম্বরে কনফার্মেশন SMS পাঠানো হয়েছে')).catch(() => {});
      }
      if (form.customer_address !== order.customer_address) {
        await logOrderActivity('order_edit', `${staffName} ঠিকানা পরিবর্তন করেছে`);
      }
      if (form.order_origin !== order.order_origin) {
        const sourceLabels: Record<string, string> = { website: 'Website', facebook: 'Facebook', 'manual+facebook': 'Messenger', whatsapp: 'WhatsApp', instagram: 'Instagram', tiktok: 'TikTok', google: 'Google', imo: 'IMO', manual: 'Manual', office: 'Office' };
        const oldLabel = sourceLabels[order.order_origin] || order.order_origin;
        const newLabel = sourceLabels[form.order_origin] || form.order_origin;
        await logOrderActivity('order_edit', `${staffName} অর্ডার সোর্স পরিবর্তন করেছে: ${oldLabel} → ${newLabel}`, { old_origin: order.order_origin, new_origin: form.order_origin });
      }

      // Handle office_sell sale entry transitions (race-proof)
      const totalDidChange = Number(form.total) !== Number(order.total);
      if (form.status !== 'office_sell') {
        try { await deleteOfficeSellSaleEntry(order.id); } catch (e) { console.error('deleteOfficeSellSaleEntry error:', e); }
      } else if (statusChanged || totalDidChange) {
        await ensureOfficeSellSaleEntry(order.id);
      }

      // Detect courier-relevant field changes → auto-recreate parcel
      const courierChanges: Array<string> = [];
      if (Number(form.total) !== Number(order.total)) courierChanges.push('cod_change');
      if ((form.customer_name || '') !== (order.customer_name || '')) courierChanges.push('name_change');
      if ((form.customer_phone || '') !== (order.customer_phone || '')) courierChanges.push('phone_change');
      if ((form.customer_address || '') !== (order.customer_address || '')) courierChanges.push('address_change');
      if ((form.delivery_area || '') !== (order.delivery_area || '')) courierChanges.push('area_change');
      if ((form.courier_note || '') !== (order.courier_note || '')) courierChanges.push('note_change');
      if ((form.customer_alt_phone || '') !== (order.customer_alt_phone || '')) courierChanges.push('alt_phone_change');
      if (courierChanges.length > 0) {
        await maybeRecreateParcel(courierChanges.join('+'));
      }

      // Auto-cancel parcel at courier when order is set to cancelled
      if (statusChanged && form.status === 'cancelled') {
        await cancelCourierIfNeeded(form.status);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      qc.invalidateQueries({ queryKey: ['acc-accounts'] });
      qc.invalidateQueries({ queryKey: ['acc-transactions'] });
      qc.invalidateQueries({ queryKey: ['acc-transaction-summary'] });
      qc.invalidateQueries({ queryKey: ['acc-daily-history'] });
      refetchActivityLogs();
      if (courierSyncBlockedRef.current) {
        toast.warning('অর্ডার আপডেট হয়েছে, কিন্তু Steadfast parcel auto update হয়নি — duplicate এড়াতে নতুন parcel তৈরি বন্ধ রাখা হয়েছে।', { duration: 10000 });
      } else {
        toast.success('অর্ডার আপডেট হয়েছে!');
      }
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  useEffect(() => {
    if (printReady) {
      const waitAndPrint = async () => {
        // Wait for portal to render
        await new Promise(r => setTimeout(r, 400));
        const targetRef = giftMode ? giftPrintRef : printRef;
        if (targetRef.current) {
          const { printInvoice } = await import('@/lib/invoicePrint');
          await printInvoice(targetRef.current, giftMode ? 'gift-memo.pdf' : 'invoice.pdf');
        }
        setPrintReady(false);
        setGiftMode(false);
      };
      waitAndPrint();
    }
  }, [printReady, giftMode]);

  const calcEffectivePrice = (product: any, size: string | null) => {
    const basePrice = (product?.original_price && product.original_price > 0 && product.original_price < product.price)
      ? product.original_price : product?.price;
    if (!size) return basePrice;
    const sd = (product?.variant_images as any)?.size_data?.[size];
    if (!sd) return basePrice;
    if (sd.sale_price && sd.sale_price > 0) return sd.sale_price;
    return basePrice;
  };
  const isUpsellItem = (i: any) => {
    if (i.item_type === 'addon' || i.item_type === 'bump') return true;
    if (i.product_name?.startsWith('[অ্যাড-অন]') || i.product_name?.startsWith('[বাম্প]')) return true;
    return false;
  };
  const getEffectivePrice = (i: any) => {
    if (isUpsellItem(i)) return i.price;
    return calcEffectivePrice(i.products, i.size) || i.price;
  };
  const subtotal = items.reduce((s: number, i: any) => s + getEffectivePrice(i) * i.quantity, 0);

  // Auto-sync total when subtotal, delivery_charge, or discount changes
  useEffect(() => {
    setForm(p => ({ ...p, total: subtotal + p.delivery_charge - (p.discount || 0) }));
  }, [subtotal, form.delivery_charge, form.discount]);

  // Auto-sync: if calcEffectivePrice differs from stored order_items.price, update DB
  const priceSyncRef = useRef(false);
  useEffect(() => {
    if (!items.length || priceSyncRef.current) return;
    priceSyncRef.current = true;
    const fixPrices = async () => {
      let needsTotalSync = false;
      for (const item of items) {
        if (isUpsellItem(item)) continue;
        const calc = calcEffectivePrice(item.products, item.size);
        if (calc && calc !== item.price) {
          await supabase.from('order_items').update({ price: calc }).eq('id', item.id);
          item.price = calc; // update local
          needsTotalSync = true;
        }
      }
      if (needsTotalSync) {
        qc.invalidateQueries({ queryKey: ['order-items', order?.id] });
        const newSub = items.reduce((s: number, i: any) => s + getEffectivePrice(i) * i.quantity, 0);
        await syncTotalsToDb(newSub);
      }
    };
    fixPrices();
  }, [items]);

  if (!order) return null;
  const currentStatus = statusConfig[form.status] || statusConfig.pending;

  const handleDeliveryAreaChange = (area: string) => {
    const option = deliveryOptions.find(o => o.value === area);
    if (option) setForm(p => ({ ...p, delivery_area: area, delivery_charge: option.price, total: subtotal + option.price }));
  };

  const handleQtyChange = (itemId: string, currentQty: number, delta: number) => {
    const newQty = Math.max(1, currentQty + delta);
    updateItemMutation.mutate({ itemId, field: 'quantity', value: newQty });
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    addNoteMutation.mutate(newNote.trim());
  };

  const invoiceItems = items.map((item: any) => {
    const vi = (item.products?.variant_images as any) || {};
    const img = getColorPrimaryImage(vi.color_images, item.color) || (item as any).upsell_image || item.products?.images?.[0] || null;

    const sizeData = vi.size_data?.[item.size];
    const itemPrice = getEffectivePrice(item);
    let regularPrice = item.products?.price || null;
    if (sizeData?.price && sizeData.price > 0) {
      regularPrice = sizeData.price;
    }

    return {
      ...item,
      image: img,
      price: itemPrice,
      regular_price: (regularPrice && regularPrice > itemPrice) ? regularPrice : null,
    };
  });

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent fullScreen={isMobile} className={`p-0 gap-0 scroll-smooth ${isMobile ? 'rounded-none' : 'sm:max-w-4xl max-h-[90vh] overflow-y-auto'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border pr-14 sticky top-0 z-10 bg-background">
          <div className="flex items-center gap-2">
            <button onClick={() => onOpenChange(false)} className="p-1 rounded hover:bg-muted -ml-1">
              <ArrowLeft className="h-4 w-4" />
            </button>
            {order.order_origin === 'giveaway' && giveawayEntryData ? (
              <>
                <h2 className="text-base font-bold">গিভঅ্যাওয়ে #{giveawayEntryData.gift_number}</h2>
                <span className="text-[10px] font-medium bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{order.order_number}</span>
              </>
            ) : (
              <h2 className="text-base font-bold">{order.order_number}</h2>
            )}
            {order.order_origin === 'exchange' && (
              <span className="text-[10px] font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 px-1.5 py-0.5 rounded">🔄 এক্সচেঞ্জ</span>
            )}
            {/* Status dropdown */}
            <Popover open={statusOpen} onOpenChange={setStatusOpen}>
              <PopoverTrigger asChild>
                <button className={`inline-flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-full border ${currentStatus.className}`}>
                  {currentStatus.label} <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-40 p-1 z-[1002]" align="start">
                {statuses.map(s => (
                  <button key={s} onClick={() => { setForm(p => ({ ...p, status: s })); setStatusOpen(false); }}
                    className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted ${form.status === s ? 'bg-muted font-semibold' : ''}`}>
                    {statusConfig[s]?.label || s}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPrintReady(true)}
              disabled={!isDeliveryMemoPrintable(order)}
              title={isDeliveryMemoPrintable(order) ? "ডেলিভারি মেমো প্রিন্ট" : PRINT_LOCKED_MESSAGE}
            >
              <Printer className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => setSmsOpen(true)} title="কাস্টমারকে SMS পাঠান">
              <MessageSquare className="h-4 w-4" />
            </Button>
            {(
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setGiftDialogOpen(true)} title="গিফট মেমো">
                <Gift className="h-4 w-4" />
              </Button>
            )}
            <Popover open={shareOpen} onOpenChange={setShareOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" title="মেমো শেয়ার করুন">
                  <Share2 className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2 z-[1002]" align="end">
                <p className="text-xs font-semibold text-muted-foreground px-2 py-1">কাস্টমারকে মেমো শেয়ার</p>
                <button
                  onClick={handleCopyLink}
                  className="w-full flex items-center gap-2 px-2 py-2 text-sm rounded hover:bg-muted text-left"
                >
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'কপি হয়েছে!' : 'লিংক কপি করুন'}
                </button>
                <button
                  onClick={handleWhatsAppShare}
                  className="w-full flex items-center gap-2 px-2 py-2 text-sm rounded hover:bg-muted text-left"
                >
                  <MessageSquare className="h-4 w-4 text-green-600" />
                  WhatsApp-এ পাঠান
                </button>
                <button
                  onClick={() => { window.open(getMemoUrl(), '_blank'); setShareOpen(false); }}
                  className="w-full flex items-center gap-2 px-2 py-2 text-sm rounded hover:bg-muted text-left"
                >
                  <Eye className="h-4 w-4" />
                  মেমো দেখুন
                </button>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* Customer Info - Serial Layout */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">কাস্টমার তথ্য</span>
              <div className="flex items-center gap-1">
                <CourierActions
                  orderId={order.id}
                  orderNumber={order.order_number}
                  consignmentId={order.courier_consignment_id}
                  courierStatus={order.courier_status}
                  courierProvider={order.courier_provider}
                  courierManualName={order.courier_manual_name}
                  onUpdate={() => {
                    qc.invalidateQueries({ queryKey: ['admin-orders'] });
                    qc.invalidateQueries({ queryKey: ['admin-order-preview', order.id] });
                  }}
                />
                <button onClick={() => setEditMode(!editMode)} className="p-1 rounded hover:bg-muted">
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-muted-foreground">নাম *</label>
              {editMode ? (
                <Input value={form.customer_name} onChange={e => setForm(p => ({ ...p, customer_name: e.target.value }))} placeholder="নাম" className="h-10 text-sm" />
              ) : (
                <p className="text-base font-medium py-2 px-3 border border-border rounded-md bg-muted/30">{form.customer_name || '—'}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-muted-foreground">ফোন *</label>
              {editMode ? (
                <Input value={form.customer_phone} onChange={e => setForm(p => ({ ...p, customer_phone: e.target.value }))} placeholder="ফোন" className="h-10 text-sm" />
              ) : (
                <div className="flex items-center gap-2 py-2 px-3 border border-border rounded-md bg-muted/30">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a href={`tel:${form.customer_phone}`} onClick={() => logActivity('call_action', 'order', order?.id, `কাস্টমারকে কল: ${form.customer_phone}`)} className="text-base text-primary hover:underline flex-1 min-w-0 truncate">{form.customer_phone || '—'}</a>
                  {form.customer_phone && (
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(form.customer_phone); toast.success('নম্বর কপি হয়েছে'); }}
                      className="p-1 rounded hover:bg-muted shrink-0"
                      title="নম্বর কপি করুন"
                    >
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
              )}
              {form.customer_phone && (
                <div className="mt-1">
                  <CustomerLoyaltyBadge phone={form.customer_phone} compact={false} showCount />
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-muted-foreground">ঠিকানা</label>
              {editMode ? (
                <Input value={form.customer_address} onChange={e => setForm(p => ({ ...p, customer_address: e.target.value }))} placeholder="ঠিকানা" className="h-10 text-sm" />
              ) : (
                <p className="text-base py-2 px-3 border border-border rounded-md bg-muted/30">{form.customer_address || '—'}</p>
              )}
            </div>

            {/* Quick save — right here so fixing the name/phone/address doesn't require
                scrolling all the way down to the main সেভ করুন button at the bottom,
                which is how a corrected number was ending up looking like it never saved. */}
            {editMode && (
              <Button
                type="button"
                size="sm"
                onClick={() => { updateOrder.mutate(); setEditMode(false); }}
                disabled={updateOrder.isPending}
                className="w-full h-9 text-sm"
              >
                <Save className="h-3.5 w-3.5 mr-1.5" /> {updateOrder.isPending ? 'সেভ হচ্ছে...' : 'নাম/ফোন/ঠিকানা সেভ করুন'}
              </Button>
            )}

            {/* Courier-specific fields: alt phone + note (forwarded to Steadfast on dispatch) */}
            <div className="space-y-1">
              <label className="text-sm font-semibold text-muted-foreground">অলটারনেটিভ নম্বর <span className="text-xs font-normal text-muted-foreground">(কুরিয়ারে যাবে)</span></label>
              {editMode ? (
                <Input
                  value={form.customer_alt_phone}
                  onChange={e => setForm(p => ({ ...p, customer_alt_phone: e.target.value }))}
                  placeholder="01XXXXXXXXX"
                  inputMode="numeric"
                  className="h-10 text-sm"
                />
              ) : (
                <p className="text-base py-2 px-3 border border-border rounded-md bg-muted/30">{form.customer_alt_phone || '—'}</p>
              )}
            </div>


            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2 w-full text-left">
                <span className="text-sm font-semibold text-muted-foreground">কুরিয়ার নোট <span className="text-xs font-normal text-muted-foreground">(কুরিয়ার এজেন্টের জন্য)</span></span>
                <ChevronDown className="h-4 w-4 ml-auto text-muted-foreground" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-1">
                {editMode ? (
                  <>
                    <Textarea
                      value={form.courier_note || (defaultCourierNote && !form.courier_note ? defaultCourierNote : form.courier_note)}
                      onChange={e => setForm(p => ({ ...p, courier_note: e.target.value }))}
                      placeholder={defaultCourierNote || 'কুরিয়ার এজেন্টের জন্য বিশেষ নির্দেশনা...'}
                      rows={2}
                      className="text-sm"
                    />
                    {defaultCourierNote && !form.courier_note && (
                      <p className="text-xs text-muted-foreground">ডিফল্ট নোট ব্যবহৃত হচ্ছে — পরিবর্তন করতে উপরে লিখুন</p>
                    )}
                  </>
                ) : (
                  <p className="text-base py-2 px-3 border border-border rounded-md bg-muted/30 whitespace-pre-wrap">{form.courier_note || defaultCourierNote || '—'}</p>
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* Courier parcel history (auto-recreated on COD/address changes) */}
            <CourierParcelHistory orderId={order.id} />

            <div className="space-y-1">
              <label className="text-sm font-semibold text-muted-foreground">ইমেইল</label>
              {editMode ? (
                <Input type="email" value={form.customer_email} onChange={e => setForm(p => ({ ...p, customer_email: e.target.value }))} placeholder="customer@email.com" className="h-10 text-sm" />
              ) : (
                form.customer_email ? (
                  <p className="text-base py-2 px-3 border border-border rounded-md bg-muted/30">{form.customer_email}</p>
                ) : null
              )}
            </div>

            {/* BD Courier Info */}
            {courierData && courierData.status === 'loading' && (
              <div className="flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">কুরিয়ার ডাটা লোড হচ্ছে...</span>
              </div>
            )}
            {courierData && courierData.status === 'success' && (
              <div className="space-y-1.5">
                <div className="flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center px-2 py-1 text-xs rounded bg-muted text-muted-foreground">
                    মোট: {courierData.totalParcel}
                  </span>
                  <span className="inline-flex items-center px-2 py-1 text-xs rounded bg-green-100 text-green-700">
                    সফল: {courierData.successParcel}
                  </span>
                  <span className="inline-flex items-center px-2 py-1 text-xs rounded bg-red-100 text-red-700">
                    বাতিল: {courierData.cancelledParcel}
                  </span>
                  {courierData.successRate != null && (
                    <span className={`inline-flex items-center px-2 py-1 text-xs rounded font-semibold ${
                      courierData.successRate >= 70 ? 'bg-green-100 text-green-800' :
                      courierData.successRate >= 40 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      রেট: {courierData.successRate}%
                    </span>
                  )}
                </div>
                {courierData.courierBreakdown && courierData.courierBreakdown.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {courierData.courierBreakdown.map(c => (
                      <span key={c.key} className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-muted border border-border">
                        {c.logo && <img src={c.logo} alt={c.name} className="w-3 h-3 object-contain" />}
                        <span className="font-medium">{c.name}</span>
                        <span className="text-green-600">{c.successParcel}</span>
                        <span className="text-muted-foreground">/</span>
                        <span>{c.totalParcel}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {courierData && courierData.status === 'no-data' && (
              <p className="text-xs text-muted-foreground">কুরিয়ার হিস্ট্রি নেই</p>
            )}
          </div>

          {/* Giveaway Customer Card */}
          {order.order_origin === 'giveaway' && (
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-foreground">🎁 গিভঅ্যাওয়ে তথ্য</span>
                {giveawayEntryData && (
                  <span className="text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 px-2 py-0.5 rounded-full">#{giveawayEntryData.gift_number}</span>
                )}
              </div>
              <div className="space-y-3 bg-green-50/50 dark:bg-green-950/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                {/* Profile Link */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">প্রোফাইল লিংক</label>
                  <Input value={giveawayProfileLink} onChange={e => setGiveawayProfileLink(e.target.value)} placeholder="Facebook/YouTube/TikTok URL" className="h-9 text-sm" />
                </div>
                {/* District */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">জেলা/এলাকা</label>
                  <Input value={giveawayDistrict} onChange={e => setGiveawayDistrict(e.target.value)} placeholder="যেমন: ঢাকা, চট্টগ্রাম" className="h-9 text-sm" />
                </div>
                {/* Photos from MediaCenter */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">ছবি</label>
                  {giveawayPhotos.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {giveawayPhotos.map((url, i) => (
                        <div key={i} className="relative w-16 h-16 rounded border border-border overflow-hidden group">
                          <img src={url} alt="" className="w-full h-full object-cover" />
                          <button onClick={() => setGiveawayPhotos(prev => prev.filter((_, idx) => idx !== i))}
                            className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button variant="outline" size="sm" className="w-full h-9 text-xs" onClick={() => setMediaCenterOpen(true)}>
                    <ImageIcon className="h-3.5 w-3.5 mr-1.5" /> মিডিয়া থেকে ছবি সিলেক্ট করুন
                  </Button>
                </div>
                {giveawayEntryData && (
                  <p className="text-xs text-green-600 font-medium pt-1">✅ গিফট এন্ট্রি #{giveawayEntryData.gift_number} তে যোগ করা আছে</p>
                )}
                {/* Save giveaway info button */}
                <Button variant="default" size="sm" className="w-full" onClick={async () => {
                  const attr = (order.order_attribution as any) || {};
                  const updatedAttr = {
                    ...attr,
                    giveaway_profile_link: giveawayProfileLink,
                    giveaway_district: giveawayDistrict,
                    giveaway_photos: giveawayPhotos,
                  };
                  await supabase.from('orders').update({
                    order_attribution: updatedAttr as any,
                  }).eq('id', order.id);

                  // Auto upsert giveaway entry
                  const productNames = items.map((i: any) => i.product_name).join(', ');
                  if (giveawayEntryData) {
                    // Update existing entry
                    await supabase.from('giveaway_entries').update({
                      customer_name: order.customer_name || '',
                      profile_link: giveawayProfileLink,
                      profile_screenshot: giveawayPhotos[0] || '',
                      packaging_image: giveawayPhotos[1] || '',
                      product_name: productNames,
                    }).eq('id', giveawayEntryData.id);
                    toast.success('গিফট এন্ট্রি আপডেট হয়েছে!');
                  } else {
                    // Insert new entry
                    const { error } = await supabase.from('giveaway_entries').insert({
                      order_id: order.id,
                      customer_name: order.customer_name || '',
                      profile_link: giveawayProfileLink,
                      profile_screenshot: giveawayPhotos[0] || '',
                      packaging_image: giveawayPhotos[1] || '',
                      product_name: productNames,
                    } as any);
                    if (error) {
                      toast.error('গিফট এন্ট্রি সেভ ব্যর্থ');
                      console.error(error);
                    } else {
                      toast.success('গিফট এন্ট্রি যোগ হয়েছে!');
                    }
                  }
                  qc.invalidateQueries({ queryKey: ['giveaway-entry-for-order', order.id] });
                  qc.invalidateQueries({ queryKey: ['giveaway-entries'] });
                  qc.invalidateQueries({ queryKey: ['giveaway-entries-map'] });
                  qc.invalidateQueries({ queryKey: ['admin-orders'] });
                  qc.invalidateQueries({ queryKey: ['giveaway-orders'] });
                }}>
                  <Save className="h-3.5 w-3.5 mr-1" /> গিভঅ্যাওয়ে তথ্য সেভ করুন
                </Button>
              </div>
            </div>
          )}
          {/* Exchange Summary Card */}
          {order.order_origin === 'exchange' && exchangeRecord && (
            <div className="border-t border-border pt-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold text-foreground">🔄 এক্সচেঞ্জ তথ্য</span>
                <span className="text-[10px] font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 px-1.5 py-0.5 rounded-full">
                  {exchangeRecord.exchange_type === 'store_fault' ? 'স্টোরের ত্রুটি' : exchangeRecord.exchange_type === 'customer_fault' ? 'কাস্টমার ত্রুটি' : 'প্রোডাক্ট সোয়াপ'}
                </span>
              </div>
              <div className="bg-indigo-50/50 dark:bg-indigo-950/20 rounded-lg p-3 border border-indigo-200 dark:border-indigo-800 space-y-3">
                {/* Parent order ref */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">মূল অর্ডার</span>
                  <button
                    onClick={() => {
                      // Navigate to parent order by setting URL param
                      const url = new URL(window.location.href);
                      url.searchParams.set('preview', exchangeRecord.parent_order_number || '');
                      window.history.pushState({}, '', url.toString());
                      window.location.reload();
                    }}
                    className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    #{exchangeRecord.parent_order_number}
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
                {exchangeRecord.parent_status && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">মূল অর্ডার স্ট্যাটাস</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${statusConfig[exchangeRecord.parent_status]?.className || 'bg-muted text-muted-foreground'}`}>
                      {statusConfig[exchangeRecord.parent_status]?.label || exchangeRecord.parent_status}
                    </span>
                  </div>
                )}

                {/* Old vs New items */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] font-semibold text-red-600 dark:text-red-400 mb-1">❌ পুরোনো আইটেম</p>
                    {(exchangeRecord.old_items as any[] || []).map((item: any, i: number) => (
                      <div key={i} className="text-xs bg-red-50 dark:bg-red-950/20 rounded p-1.5 mb-1 border border-red-100 dark:border-red-900 flex gap-1.5">
                        {item.image ? (
                          <img src={item.image} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                            <Package className="h-3 w-3 text-red-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium truncate">{item.product_name}</p>
                          <p className="text-muted-foreground">
                            {item.quantity}x ৳{item.price}
                            {item.size ? ` • ${item.size}` : ''}
                            {item.color ? ` • ${item.color}` : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-green-600 dark:text-green-400 mb-1">✅ নতুন আইটেম</p>
                    {(exchangeRecord.new_items as any[] || []).length > 0 ? (
                      (exchangeRecord.new_items as any[]).map((item: any, i: number) => (
                        <div key={i} className="text-xs bg-green-50 dark:bg-green-950/20 rounded p-1.5 mb-1 border border-green-100 dark:border-green-900 flex gap-1.5">
                          {item.image ? (
                            <img src={item.image} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                              <Package className="h-3 w-3 text-green-400" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium truncate">{item.product_name}</p>
                            <p className="text-muted-foreground">
                              {item.quantity}x ৳{item.price}
                              {item.size ? ` • ${item.size}` : ''}
                              {item.color ? ` • ${item.color}` : ''}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground italic">একই আইটেম পুনরায় পাঠানো হচ্ছে</p>
                    )}
                  </div>
                </div>

                {/* Financial summary */}
                <div className="flex flex-wrap gap-2 text-xs">
                  {Number(exchangeRecord.extra_delivery_charge) > 0 && (
                    <span className="bg-muted px-2 py-0.5 rounded">ডেলিভারি: ৳{exchangeRecord.extra_delivery_charge}</span>
                  )}
                  {Number(exchangeRecord.customer_owes) > 0 && (
                    <span className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 px-2 py-0.5 rounded">কাস্টমার দেবে: ৳{exchangeRecord.customer_owes}</span>
                  )}
                  {Number(exchangeRecord.store_owes) > 0 && (
                    <span className="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 px-2 py-0.5 rounded">স্টোর দেবে: ৳{exchangeRecord.store_owes}</span>
                  )}
                </div>

                {/* Exchange note */}
                {exchangeRecord.note && (
                  <p className="text-xs text-muted-foreground border-t border-indigo-100 dark:border-indigo-800 pt-2">
                    📝 {exchangeRecord.note}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Order Source */}
          <div className="border-t border-border pt-4">
            <span className="text-sm font-semibold text-foreground mb-2 block">অর্ডার সোর্স</span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { value: 'website', label: 'Website' },
                { value: 'facebook', label: 'Facebook' },
                { value: 'manual+facebook', label: 'Messenger' },
                { value: 'whatsapp', label: 'WhatsApp' },
                { value: 'instagram', label: 'Instagram' },
                { value: 'tiktok', label: 'TikTok' },
                { value: 'google', label: 'Google' },
                { value: 'imo', label: 'IMO' },
                { value: 'manual', label: 'Manual' },
                { value: 'office', label: 'Office' },
              ].map(src => (
                <button
                  key={src.value}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, order_origin: src.value }))}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                    form.order_origin === src.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted text-muted-foreground border-border hover:bg-accent'
                  }`}
                >
                  {src.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes History */}
          <div className="border-t border-border pt-4">
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-foreground w-full">
                <MessageSquare className="h-4 w-4" />
                <span>নোটস ({notesHistory.length + (form.notes ? 1 : 0)})</span>
                <ChevronDown className="h-4 w-4 ml-auto" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3 space-y-2.5">
                {/* Add new note */}
                <div className="flex gap-2">
                  <Input
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    placeholder="নতুন নোট লিখুন..."
                    className="h-10 text-sm flex-1"
                    onKeyDown={e => { if (e.key === 'Enter') handleAddNote(); }}
                  />
                  <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={handleAddNote} disabled={addNoteMutation.isPending || !newNote.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                {/* Notes list */}
                {(notesHistory.length > 0 || form.notes || editMode) && (
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {/* Customer note (pinned) */}
                    {(editMode || form.notes) && (
                      <div className="flex items-start gap-2 text-sm bg-orange-50 border border-orange-200 rounded-md px-3 py-2">
                        <div className="flex-1 min-w-0 space-y-1">
                          <span className="inline-block text-[10px] font-semibold uppercase tracking-wide text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded">📝 কাস্টমার</span>
                          {editMode ? (
                            <Textarea
                              value={form.notes || ''}
                              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                              placeholder="কাস্টমারের নোট..."
                              rows={2}
                              className="text-sm border-orange-200 bg-white/60 mt-1"
                            />
                          ) : (
                            <p className="text-orange-900 leading-relaxed whitespace-pre-wrap">{form.notes}</p>
                          )}
                        </div>
                      </div>
                    )}
                    {notesHistory.map((n: any) => (
                      <div key={n.id} className="flex items-start gap-2 text-sm bg-muted/50 rounded-md px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-foreground leading-relaxed">{n.note}</p>
                          <p className="text-muted-foreground text-xs mt-1">
                            {format(new Date(n.created_at), 'dd MMM yyyy, hh:mm a')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Items Section */}
          <div className="space-y-3 border-t border-border pt-4">
            <span className="text-sm font-semibold text-foreground">আইটেমস ({items.length})</span>

            {itemsLoading ? (
              <div className="space-y-3">
                {[1, 2].map(i => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="w-14 h-14 bg-muted rounded-lg shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                    <div className="h-4 bg-muted rounded w-16 shrink-0" />
                  </div>
                ))}
              </div>
            ) : items.map((item: any) => {
              const itemIsUpsell = isUpsellItem(item);
              const variantImages = item.products?.variant_images as any;
              const colorImages = variantImages?.color_images;
              const colorSizesMap: Record<string, string[]> = variantImages?.color_sizes || {};
              const sizeDataMap: Record<string, any> = variantImages?.size_data || {};
              const img = getColorPrimaryImage(colorImages, item.color) || (item as any).upsell_image || item.products?.images?.[0];
              const allSizes = item.products?.sizes || [];
              const colors = item.products?.colors || [];
              // Color-wise size filtering
              const availSizes = (item.color && colorSizesMap[item.color]?.length > 0)
                ? colorSizesMap[item.color] : allSizes;

              const handleColorChange = async (c: string) => {
                if (itemIsUpsell) {
                  // Upsell items: only change color, never recalculate price
                  const { error } = await supabase.from('order_items').update({ color: c }).eq('id', item.id);
                  if (!error) refetchItems();
                  return;
                }
                const newAvailSizes = (colorSizesMap[c]?.length > 0) ? colorSizesMap[c] : allSizes;
                const currentSizeValid = newAvailSizes.includes(item.size);
                const newSize = currentSizeValid ? item.size : (newAvailSizes[0] || null);
                const newPrice = calcEffectivePrice(item.products, newSize);
                const { error } = await supabase.from('order_items')
                  .update({ color: c, size: newSize, price: newPrice }).eq('id', item.id);
                if (!error) refetchItems();
              };

              const handleSizeChange = async (s: string) => {
                if (itemIsUpsell) {
                  // Upsell items: only change size, never recalculate price
                  const { error } = await supabase.from('order_items').update({ size: s }).eq('id', item.id);
                  if (!error) refetchItems();
                  return;
                }
                const newPrice = calcEffectivePrice(item.products, s);
                const { error } = await supabase.from('order_items')
                  .update({ size: s, price: newPrice }).eq('id', item.id);
                if (!error) refetchItems();
              };

              return (
                <div key={item.id} className="flex items-start gap-3 py-3 border-b border-border last:border-0">
                  {img ? <img src={img} alt="" className="w-14 h-14 object-cover rounded shrink-0" /> : <div className="w-14 h-14 bg-muted rounded shrink-0" />}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-tight truncate">{item.product_name}</p>
                        {(item as any).upsell_parent_name && (
                          <p className="text-[10px] text-muted-foreground truncate">← {(item as any).upsell_parent_name}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          title="কপি করুন"
                          onClick={async () => {
                            try {
                              const { error } = await supabase.from('order_items').insert({
                                order_id: order.id,
                                product_id: item.product_id,
                                product_name: item.product_name,
                                price: item.price,
                                quantity: 1,
                                color: item.color,
                                size: item.size,
                                item_type: item.item_type || 'normal',
                                parent_product_id: (item as any).parent_product_id ?? null,
                                upsell_image: (item as any).upsell_image ?? null,
                                upsell_parent_name: (item as any).upsell_parent_name ?? null,
                              } as any);
                              if (error) { toast.error('কপি করতে ব্যর্থ'); return; }
                              const { data: freshItems } = await refetchItems();
                              if (freshItems) {
                                const newSub = freshItems.reduce((s: number, i: any) => s + getEffectivePrice(i) * i.quantity, 0);
                                await syncTotalsToDb(newSub);
                              }
                              qc.invalidateQueries({ queryKey: ['admin-orders'] });
                              const sName = await getStaffName();
                              await logOrderActivity('item_added', `${sName} আইটেম কপি করেছে: ${item.product_name}`, { product_name: item.product_name });
                              toast.success('কপি হয়েছে!');
                            } catch { toast.error('কপি করতে সমস্যা হয়েছে'); }
                          }}
                          className="flex items-center gap-1 px-2 py-1 rounded-md border border-primary/30 bg-primary/5 hover:bg-primary/15 text-primary text-xs font-medium transition-colors"
                        >
                          <Copy className="h-4 w-4" />
                          <span>কপি</span>
                        </button>
                        <button onClick={() => deleteItemMutation.mutate(item.id)} className="p-1.5 rounded hover:bg-destructive/10">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </button>
                      </div>
                    </div>
                    {/* Variant badges - colors first, then filtered sizes */}
                    <div className="flex flex-wrap gap-1.5">
                      {colors.length > 0 && colors.map((c: string) => (
                        <button key={c} onClick={() => handleColorChange(c)}
                          className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${item.color === c ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                          {c}
                        </button>
                      ))}
                      {availSizes.length > 0 && availSizes.map((s: string) => (
                        <button key={s} onClick={() => handleSizeChange(s)}
                          className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${item.size === s ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                          {s}
                        </button>
                      ))}
                    </div>
                    {/* Price + Qty */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {(() => {
                          const ep = getEffectivePrice(item);
                          const vi = (item.products?.variant_images as any) || {};
                          const sd = vi.size_data?.[item.size];
                          let regPrice = item.products?.price || null;
                          if (sd?.price && sd.price > 0) regPrice = sd.price;
                          return <>
                            {regPrice && regPrice > ep && <span className="text-xs line-through text-muted-foreground">৳{regPrice}</span>}
                            <span className="text-sm font-semibold text-green-600">৳{ep}</span>
                          </>;
                        })()}
                      </div>
                      <div className="flex items-center gap-0">
                        <button onClick={() => handleQtyChange(item.id, item.quantity, -1)}
                          className="h-8 w-8 flex items-center justify-center rounded-l border border-border hover:bg-muted">
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="h-8 w-10 flex items-center justify-center border-y border-border text-sm font-medium bg-background">{item.quantity}</span>
                        <button onClick={() => handleQtyChange(item.id, item.quantity, 1)}
                          className="h-8 w-8 flex items-center justify-center rounded-r border border-border hover:bg-muted">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <span className="text-sm font-semibold">৳{getEffectivePrice(item) * item.quantity}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {/* Add Product Card */}
            <Popover open={addOpen} onOpenChange={o => { setAddOpen(o); if (o) setTimeout(() => searchRef.current?.focus(), 100); else { setSearch(''); setSelectedVariants({}); setCategoryFilter('all'); } }}>
              <PopoverTrigger asChild>
                <button className="w-full border border-dashed border-border rounded-lg py-3 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors flex items-center justify-center gap-1.5">
                  <Plus className="h-4 w-4" /> যোগ করুন
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[32rem] p-2 z-[1002]" align="center">
                <div className="flex gap-2 mb-2">
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[140px] h-8 text-xs shrink-0">
                      <SelectValue placeholder="ক্যাটাগরি" />
                    </SelectTrigger>
                    <SelectContent className="z-[1003] max-h-[18rem]">
                      <SelectItem value="all">সব ক্যাটাগরি</SelectItem>
                      {categoryOptions.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name_bn || c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="প্রোডাক্ট খুঁজুন..." className="pl-7 h-8 text-xs" />
                  </div>
                </div>
                <div
                  className="max-h-[28rem] overflow-y-auto overscroll-contain touch-pan-y pr-2"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                  onWheelCapture={(e) => e.stopPropagation()}
                >
                  <div className="space-y-0.5">
                  {searchResults.map((p: any) => {
                    const sv = selectedVariants[p.id];
                    const vi = (p.variant_images as any) || {};
                    const colorSizesMap: Record<string, string[]> = vi.color_sizes || {};
                    const selectedColor = sv?.color || p.colors?.[0] || '';
                    const filteredSizes = getAvailSizes(colorSizesMap, selectedColor, p.sizes || []);
                    const addon = p.addon_config as { name?: string; price?: number } | null;
                    return (
                      <div key={p.id} className="px-2 py-2 rounded hover:bg-muted border-b border-border last:border-0">
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => { addItemMutation.mutate(p); setAddOpen(false); setSelectedVariants({}); }}>
                          {p.images?.[0] ? <img src={p.images[0]} alt="" className="w-16 h-16 object-cover rounded shrink-0" /> : <div className="w-16 h-16 bg-muted rounded shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-sm font-medium truncate">{p.name}</p>
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${p.is_active === false ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'}`}>
                                {p.is_active === false ? 'Inactive' : 'Active'}
                              </span>
                            </div>
                            {p.name_bn && <p className="text-xs text-muted-foreground truncate">{p.name_bn}</p>}
                          </div>
                          {p.original_price && p.original_price > 0 && p.original_price < p.price ? (
                            <span className="text-xs whitespace-nowrap flex items-center gap-1">
                              <span className="font-semibold text-green-600">৳{p.original_price}</span>
                              <span className="line-through text-muted-foreground">৳{p.price}</span>
                            </span>
                          ) : (
                            <span className="text-xs font-semibold whitespace-nowrap">৳{p.price}</span>
                          )}
                        </div>
                        {(p.colors?.length > 0 || filteredSizes.length > 0) && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {p.colors?.map((c: string) => (
                              <button key={c} type="button" onClick={(e) => { e.stopPropagation(); setVariant(p.id, 'color', c); }}
                                className={`px-2 py-1 text-xs rounded border transition-colors ${
                                  selectedColor === c ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border hover:border-primary/50'
                                }`}>{c}</button>
                            ))}
                            {filteredSizes.map((s: string) => (
                              <button key={s} type="button" onClick={(e) => { e.stopPropagation(); setVariant(p.id, 'size', s); }}
                                className={`px-2 py-1 text-xs rounded border transition-colors ${
                                  sv?.size === s ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border hover:border-primary/50'
                                }`}>{s}</button>
                            ))}
                          </div>
                        )}
                        {/* Show add-on as separate addable item */}
                        {addon?.name && addon?.price && (
                          <div
                            className="mt-1.5 flex items-center gap-2 px-2 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 rounded cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors"
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                const { error } = await supabase.from('order_items').insert({
                                  order_id: order.id, product_id: p.id,
                                  product_name: `[অ্যাড-অন] ${addon.name}`,
                                  price: addon.price, quantity: 1,
                                  item_type: 'addon', parent_product_id: p.id,
                                  upsell_parent_name: p.name || p.name_bn || null,
                                  upsell_image: (p as any).addon_config?.image || p.images?.[0] || null,
                                } as any);
                                if (error) { toast.error('অ্যাড-অন যোগ করতে ব্যর্থ'); return; }
                                const { data: freshItems } = await refetchItems();
                                if (freshItems) {
                                  const newSub = freshItems.reduce((s: number, i: any) => s + getEffectivePrice(i) * i.quantity, 0);
                                  await syncTotalsToDb(newSub);
                                }
                                qc.invalidateQueries({ queryKey: ['admin-orders'] });
                                toast.success(`${addon.name} যোগ হয়েছে!`);
                                setAddOpen(false);
                              } catch { toast.error('অ্যাড-অন যোগ করতে সমস্যা হয়েছে'); }
                            }}
                          >
                            <Gift className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            <span className="text-xs text-emerald-700 dark:text-emerald-400 flex-1 min-w-0 truncate">🎁 {addon.name}</span>
                            <span className="text-xs font-semibold text-emerald-600">৳{addon.price}</span>
                          </div>
                        )}
                        {/* Show bump product as separate addable item */}
                        {p.bump_product_id && (
                          <div
                            className="mt-1.5 flex items-center gap-2 px-2 py-1.5 bg-violet-50 dark:bg-violet-950/30 rounded cursor-pointer hover:bg-violet-100 dark:hover:bg-violet-950/50 transition-colors"
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                const { data: bumpProduct, error: bpErr } = await supabase.from('products')
                                  .select('id, name, price, original_price, images').eq('id', p.bump_product_id).maybeSingle();
                                if (bpErr || !bumpProduct) { toast.error('বাম্প প্রোডাক্ট পাওয়া যায়নি'); return; }
                                const bumpBase = (bumpProduct.original_price && bumpProduct.original_price > 0 && bumpProduct.original_price < bumpProduct.price)
                                  ? bumpProduct.original_price : bumpProduct.price;
                                // Fixed-taka discount (consistent with place-order edge function)
                                const discountedPrice = p.bump_discount ? Math.max(0, bumpBase - p.bump_discount) : bumpBase;
                                const { error } = await supabase.from('order_items').insert({
                                  order_id: order.id, product_id: bumpProduct.id,
                                  product_name: `[বাম্প] ${bumpProduct.name}`,
                                  price: discountedPrice, quantity: 1,
                                  item_type: 'bump', parent_product_id: p.id,
                                  upsell_parent_name: p.name || p.name_bn || null,
                                  upsell_image: (bumpProduct as any).images?.[0] || null,
                                } as any);
                                if (error) { toast.error('বাম্প প্রোডাক্ট যোগ করতে ব্যর্থ'); return; }
                                const { data: freshItems } = await refetchItems();
                                if (freshItems) {
                                  const newSub = freshItems.reduce((s: number, i: any) => s + getEffectivePrice(i) * i.quantity, 0);
                                  await syncTotalsToDb(newSub);
                                }
                                qc.invalidateQueries({ queryKey: ['admin-orders'] });
                                toast.success(`${bumpProduct.name} বাম্প যোগ হয়েছে!`);
                                setAddOpen(false);
                              } catch { toast.error('বাম্প যোগ করতে সমস্যা হয়েছে'); }
                            }}
                          >
                            <Link className="h-3.5 w-3.5 text-violet-600 shrink-0" />
                            <span className="text-xs text-violet-700 dark:text-violet-400 flex-1 min-w-0 truncate">🔗 বাম্প প্রোডাক্ট</span>
                            {p.bump_discount ? (
                              <span className="text-xs font-semibold text-violet-600">৳{p.bump_discount} ছাড়ে</span>
                            ) : (
                              <span className="text-xs font-semibold text-violet-600">যোগ করুন</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {searchResults.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">কোনো প্রোডাক্ট পাওয়া যায়নি</p>}
                  {hasMoreProducts && (
                    <div ref={productSentinelRef} className="py-3 text-center text-xs text-muted-foreground">
                      {isFetchingMoreProducts ? <Loader2 className="h-4 w-4 animate-spin inline" /> : 'স্ক্রল করুন...'}
                    </div>
                  )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Custom Item Card — dedicated visible field (matches ManualOrderDialog) */}
            <div className="border border-dashed border-border rounded-lg p-2.5 space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">✏️ কাস্টম আইটেম</Label>
              <div className="flex gap-1.5 items-end">
                <Input
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  placeholder="আইটেমের নাম"
                  className="flex-1 h-8 text-sm"
                  maxLength={120}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomItem(); } }}
                />
                <Input
                  type="number"
                  value={customPrice || ''}
                  onChange={e => setCustomPrice(Number(e.target.value) || 0)}
                  placeholder="৳0 (ঐচ্ছিক)"
                  className="w-24 h-8 text-sm"
                  min={0}
                />
                <Input
                  type="number"
                  value={customQty || ''}
                  onChange={e => setCustomQty(Math.max(1, Number(e.target.value) || 1))}
                  placeholder="১"
                  className="w-14 h-8 text-sm"
                  min={1}
                />
                <Button type="button" size="sm" variant="outline" onClick={addCustomItem} className="h-8 px-2.5 shrink-0">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Exchange Section - above delivery area */}
          <ExchangeSection
            orderId={order.id}
            orderItems={items}
            deliveryCharge={form.delivery_charge}
            orderData={{
              customer_name: form.customer_name,
              customer_phone: form.customer_phone,
              customer_address: form.customer_address,
              delivery_area: form.delivery_area,
              delivery_charge: form.delivery_charge,
              order_number: order.order_number,
              city: order.city || '',
            }}
            onExchangeSaved={() => {
              refetchNotes();
              refetchActivityLogs();
            }}
          />

          {/* Delivery & Pricing */}
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">ডেলিভারি এরিয়া</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-muted-foreground">ফ্রি শিপিং</span>
                <Switch
                  checked={form.free_shipping}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setForm(p => ({ ...p, free_shipping: true, delivery_charge: 0, total: subtotal - (p.discount || 0) }));
                    } else {
                      const option = deliveryOptions.find(o => o.value === form.delivery_area);
                      const dc = option?.price || 70;
                      setForm(p => ({ ...p, free_shipping: false, delivery_charge: dc, total: subtotal + dc - (p.discount || 0) }));
                    }
                  }}
                />
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-muted-foreground">🎁 গিফট অর্ডার</span>
                <Switch
                  checked={form.is_gift_order}
                  onCheckedChange={(checked) => setForm(p => ({ ...p, is_gift_order: checked }))}
                />
              </label>
            </div>
            <div className={`grid grid-cols-3 gap-1.5 ${form.free_shipping ? 'opacity-40 pointer-events-none' : ''}`}>
              {deliveryOptions.map(opt => (
                <button key={opt.value} onClick={() => handleDeliveryAreaChange(opt.value)}
                  className={`border rounded-md px-1 py-1.5 text-xs text-center transition-colors ${form.delivery_area === opt.value ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border hover:border-primary/50'}`}
                  disabled={form.free_shipping}>
                  <span>{opt.label}</span>
                  <span className="font-bold ml-1">৳{opt.price}</span>
                </button>
              ))}
            </div>
            {(() => {
              if (form.free_shipping) return null;
              const currentOpt = deliveryOptions.find(o => o.value === form.delivery_area);
              if (!currentOpt || currentOpt.price === form.delivery_charge) return null;
              return (
                <div className="flex items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-2.5 py-1.5 text-xs">
                  <span className="text-amber-800 dark:text-amber-200">
                    বর্তমান চার্জ ৳{currentOpt.price} — সেভড ৳{form.delivery_charge}
                  </span>
                  <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs"
                    onClick={() => setForm(p => ({ ...p, delivery_charge: currentOpt.price, total: subtotal + currentOpt.price - (p.discount || 0) }))}>
                    আপডেট
                  </Button>
                </div>
              );
            })()}
            <div className="space-y-2">
              <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">সাবটোটাল</span><span className="text-sm">৳{subtotal}</span></div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">ডেলিভারি</span>
                <Input type="number" className="w-24 h-9 text-right text-sm" value={form.delivery_charge}
                  onChange={e => {
                    const dc = Number(e.target.value) || 0;
                    setForm(p => ({ ...p, delivery_charge: dc, total: subtotal + dc - (p.discount || 0) }));
                  }} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">ডিসকাউন্ট</span>
                <Input type="number" className="w-24 h-9 text-right text-sm" value={form.discount || ''} min={0} placeholder="৳0"
                  onChange={e => {
                    const d = Number(e.target.value) || 0;
                    setForm(p => ({ ...p, discount: d, total: subtotal + p.delivery_charge - d }));
                  }} />
              </div>
              {/* Discount Card */}
              {form.discount > 0 && (
                <div className="border border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-800 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Gift className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-semibold text-green-700 dark:text-green-400">ডিসকাউন্ট: ৳{form.discount}</span>
                  </div>
                  <Textarea
                    value={form.discount_note}
                    onChange={e => setForm(p => ({ ...p, discount_note: e.target.value }))}
                    placeholder="ডিসকাউন্ট নোট লিখুন... (যেমন: স্বর্ণ সুতা এর পক্ষ থেকে সালামি)"
                    className="min-h-[60px] text-xs bg-background"
                  />
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-border">
                <span className="font-bold text-lg">মোট</span>
                <Input type="number" className="w-28 h-9 text-right text-lg font-bold" value={form.total}
                  onChange={e => setForm(p => ({ ...p, total: Number(e.target.value) }))} />
              </div>
            </div>

            {/* Payment Status Section */}
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">পেমেন্ট স্ট্যাটাস</span>
                <span className={cn(
                  'inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1 border',
                  (order as any)?.payment_status === 'paid' ? 'bg-green-100 text-green-700 border-green-300' :
                  (order as any)?.payment_status === 'partial' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
                  'bg-blue-50 text-blue-600 border-blue-300'
                )}>
                  <span className={cn('w-1.5 h-1.5 rounded-full',
                    (order as any)?.payment_status === 'paid' ? 'bg-green-500' :
                    (order as any)?.payment_status === 'partial' ? 'bg-yellow-500' :
                    'bg-blue-500'
                  )} />
                  {(order as any)?.payment_status === 'paid' ? 'পরিশোধিত' :
                   (order as any)?.payment_status === 'partial' ? 'আংশিক পরিশোধ' : 'ক্যাশ অন ডেলিভারি'}
                </span>
              </div>
              {(Number((order as any)?.paid_amount) > 0 || (order as any)?.payment_status === 'partial' || (order as any)?.payment_status === 'paid') && (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">পরিশোধিত</span>
                    <span className="font-semibold text-green-600">৳{Number((order as any)?.paid_amount) || 0}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">বাকি (COD)</span>
                    <span className="font-semibold text-orange-600">৳{Number((order as any)?.due_amount) || 0}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Order Attribution */}
          {order.order_attribution && Object.keys(order.order_attribution).length > 0 && (
            <div className="border-t border-border pt-4">
              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-foreground w-full">
                  <BarChart3 className="h-4 w-4" />
                  <span>অর্ডার অ্যাট্রিবিউশন</span>
                  <ChevronDown className="h-4 w-4 ml-auto transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  <div className="space-y-2 text-sm">
                    {order.order_attribution.origin && (
                      <div className="flex items-center justify-between py-1.5 px-3 rounded-md bg-muted/40">
                        <span className="flex items-center gap-1.5 text-muted-foreground"><Globe className="h-3.5 w-3.5" /> Origin</span>
                        <span className="font-medium capitalize">{order.order_attribution.origin}</span>
                      </div>
                    )}
                    {order.order_attribution.landing_url && (
                      <div className="flex items-center justify-between py-1.5 px-3 rounded-md bg-muted/40">
                        <span className="flex items-center gap-1.5 text-muted-foreground"><Link className="h-3.5 w-3.5" /> Landing URL</span>
                        <span className="font-medium text-xs max-w-[200px] truncate">{order.order_attribution.landing_url}</span>
                      </div>
                    )}
                    {order.order_attribution.referrer && (
                      <div className="flex items-center justify-between py-1.5 px-3 rounded-md bg-muted/40">
                        <span className="flex items-center gap-1.5 text-muted-foreground"><Globe className="h-3.5 w-3.5" /> Referrer</span>
                        <span className="font-medium text-xs max-w-[200px] truncate">{order.order_attribution.referrer}</span>
                      </div>
                    )}
                    {order.order_attribution.device_type && (
                      <div className="flex items-center justify-between py-1.5 px-3 rounded-md bg-muted/40">
                        <span className="flex items-center gap-1.5 text-muted-foreground"><Monitor className="h-3.5 w-3.5" /> Device</span>
                        <span className="font-medium">{order.order_attribution.device_type}</span>
                      </div>
                    )}
                    {order.order_attribution.page_view_count != null && (
                      <div className="flex items-center justify-between py-1.5 px-3 rounded-md bg-muted/40">
                        <span className="flex items-center gap-1.5 text-muted-foreground"><Eye className="h-3.5 w-3.5" /> Page Views</span>
                        <span className="font-medium">{order.order_attribution.page_view_count}</span>
                      </div>
                    )}
                    {order.order_attribution.client_ip && (
                      <div className="flex items-center justify-between gap-2 py-1.5 px-3 rounded-md bg-muted/40">
                        <span className="flex items-center gap-1.5 text-muted-foreground"><Globe className="h-3.5 w-3.5" /> IP Address</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium font-mono text-xs">{order.order_attribution.client_ip}</span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-[10px] text-destructive border-destructive/30 hover:bg-destructive hover:text-destructive-foreground gap-1"
                            onClick={async () => {
                              const ip = order.order_attribution?.client_ip as string;
                              if (!ip || ip === 'unknown') { toast.error('IP পাওয়া যায়নি'); return; }
                              if (!confirm(`এই IP (${ip}) ব্লক করতে চান?`)) return;
                              try {
                                const { data: row } = await supabase.from('store_settings').select('value').eq('key', 'blocked_ips').maybeSingle();
                                let list: string[] = [];
                                try { list = JSON.parse(row?.value || '[]'); } catch {}
                                if (list.includes(ip)) { toast.error('এই IP আগেই ব্লক করা আছে'); return; }
                                list.push(ip);
                                const { error } = await supabase.from('store_settings').upsert({ key: 'blocked_ips', value: JSON.stringify(list) }, { onConflict: 'key' });
                                if (error) throw error;
                                toast.success(`${ip} ব্লক করা হয়েছে`);
                              } catch (e: any) {
                                toast.error('ব্লক করতে সমস্যা হয়েছে');
                              }
                            }}
                          >
                            <Ban className="h-3 w-3" /> ব্লক
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {/* Order Activity Log */}
          <div className="border-t border-border pt-4">
            <Collapsible defaultOpen={activityLogs.length > 0}>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-foreground w-full">
                <Clock className="h-4 w-4" />
                <span>অর্ডার অ্যাক্টিভিটি ({activityLogs.length})</span>
                <ChevronDown className="h-4 w-4 ml-auto transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                {activityLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">কোনো অ্যাক্টিভিটি নেই</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {(activityLogs as any[]).map((log: any) => {
                      const isStatus = log.action_type === 'order_status_change';
                      const isDelete = log.action_type === 'item_deleted';
                      const isAdd = log.action_type === 'item_added';
                      const IconComp = isStatus ? ShoppingCart : isDelete ? Trash2 : isAdd ? Package : Edit;
                      const iconColor = isStatus ? 'text-blue-500' : isDelete ? 'text-destructive' : isAdd ? 'text-green-500' : 'text-amber-500';
                      return (
                        <div key={log.id} className="flex items-start gap-2.5 py-2 px-3 rounded-md bg-muted/40">
                          <IconComp className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${iconColor}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm leading-snug">{log.description}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-xs text-muted-foreground">{log.employee_name}</span>
                              <span className="text-xs text-muted-foreground">•</span>
                              <span className="text-xs text-muted-foreground">{format(new Date(log.created_at), 'dd MMM, hh:mm a')}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Legacy notes field (hidden, kept for backward compat with orders.notes column) */}
          <input type="hidden" value={form.notes} />


          {/* Save */}
          <Button onClick={() => updateOrder.mutate()} disabled={updateOrder.isPending} className="w-full h-11 text-sm">
            <Save className="h-4 w-4 mr-1.5" /> {updateOrder.isPending ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    {printReady && !giftMode && createPortal(
      <div className="print-invoice-wrapper">
        <OrderInvoice ref={printRef} order={{ ...order, subtotal, delivery_charge: form.delivery_charge, total: form.total, discount: form.discount, discount_note: form.discount_note, free_shipping: form.free_shipping }} items={invoiceItems} coupon={activeCoupon} exchangeData={order.order_origin === 'exchange' ? exchangeRecord : undefined} />
      </div>,
      document.body
    )}
    {printReady && giftMode && createPortal(
      <div className="print-invoice-wrapper">
        <GiftMemoInvoice ref={giftPrintRef} order={{ ...order, subtotal, delivery_charge: form.delivery_charge, total: form.total }} items={invoiceItems} senderName={giftSenderName} giftNote={giftNote} giftStats={giftStats || undefined} />
      </div>,
      document.body
    )}
    {/* Gift Memo Dialog */}
    <Dialog open={giftDialogOpen} onOpenChange={setGiftDialogOpen}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-green-600" />
            <h3 className="text-lg font-bold">গিফট মেমো প্রিন্ট</h3>
          </div>
          <p className="text-sm text-muted-foreground">প্রিয়জনকে সারপ্রাইজ দিতে গিফট কার্ড সহ মেমো প্রিন্ট করুন। দাম লুকানো থাকবে।</p>
          <div className="space-y-1">
            <label className="text-sm font-medium">প্রেরকের নাম (ঐচ্ছিক)</label>
            <Input value={giftSenderName} onChange={e => setGiftSenderName(e.target.value)} placeholder="যেমন: আপনার প্রিয় বন্ধু" className="h-10" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">গিফট নোট (ঐচ্ছিক)</label>
            <Textarea value={giftNote} onChange={e => setGiftNote(e.target.value)} placeholder="যেমন: শুভ জন্মদিন! তোমার জন্য ভালোবাসা রইলো ❤️" rows={3} />
          </div>

          <Button className="w-full" onClick={async () => {
            if (order?.id) {
              const attr = (order.order_attribution as any) || {};
              await supabase.from('orders').update({
                order_attribution: { ...attr, gift_sender_name: giftSenderName, gift_note: giftNote } as any,
              }).eq('id', order.id);
            }
            setGiftMode(true); setPrintReady(true); setGiftDialogOpen(false);
          }}>
            <Printer className="h-4 w-4 mr-1.5" /> গিফট মেমো প্রিন্ট করুন
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    {/* MediaCenter for giveaway photos */}
    <MediaCenter open={mediaCenterOpen} onOpenChange={setMediaCenterOpen} multiple onSelect={(urls) => {
      setGiveawayPhotos(prev => [...prev, ...urls]);
    }} />
    <SendOrderSmsDialog open={smsOpen} onOpenChange={setSmsOpen} order={order ? { id: order.id, customer_name: order.customer_name, customer_phone: order.customer_phone, order_number: order.order_number } : null} />
    </>
  );
}
