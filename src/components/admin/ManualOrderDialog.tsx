import { useState, useEffect, useRef } from 'react';
import { useAdminProductPicker, useAdminCategoryOptions } from '@/hooks/useAdminProductPicker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { normalizeBDPhone } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Plus, Minus, Trash2, Phone, Search, Loader2, Package, Store, RefreshCw, Copy } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useBDCourierCache } from '@/hooks/useBDCourierCache';
import { useAccounts } from '@/hooks/useAccounting';
import { ensureOfficeSellSaleEntry } from '@/lib/officeSellSaleEntry';
import CouponApply from '@/components/checkout/CouponApply';
import { useActivityLog } from '@/hooks/useActivityLog';
import CustomerLoyaltyBadge from '@/components/admin/CustomerLoyaltyBadge';
import { useShippingCharges } from '@/hooks/useShippingCharges';
import { applyClearance } from '@/lib/clearancePrice';
import { getColorPrimaryImage } from '@/lib/productVariants';

interface OrderItem {
  product_id: string;
  product_name: string;
  price: number;
  originalPrice: number;
  baseSalePrice: number;
  quantity: number;
  size: string;
  color: string;
  image: string;
  availableSizes: string[];
  availableColors: string[];
  colorSizes: Record<string, string[]>;
  sizeData: Record<string, { price?: number; sale_price?: number }>;
  colorImages: Record<string, string | string[]>;
  is_addon?: boolean;
}

export default function ManualOrderDialog({ compact = false }: { compact?: boolean } = {}) {
  const qc = useQueryClient();
  const { logActivity } = useActivityLog();
  const [open, setOpen] = useState(false);
  const { charges } = useShippingCharges();
  const deliveryOptions = [
    { value: 'dhaka_inside', label: 'ঢাকা সিটি', price: charges.dhaka_inside },
    { value: 'dhaka_suburb', label: 'ঢাকা সাব-এরিয়া', price: charges.dhaka_suburb },
    { value: 'dhaka_outside', label: 'সারাদেশে', price: charges.dhaka_outside },
  ];
  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    customer_alt_phone: '',
    customer_email: '',
    customer_address: '',
    delivery_area: 'dhaka_inside',
    notes: '',
  });
  const [items, setItems] = useState<OrderItem[]>([]);
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedVariants, setSelectedVariants] = useState<Record<string, { size?: string; color?: string }>>({});
  const [isOfficeSell, setIsOfficeSell] = useState(false);
  const [customDeliveryCharge, setCustomDeliveryCharge] = useState<number>(charges.dhaka_inside);
  const [deliveryChargeTouched, setDeliveryChargeTouched] = useState(false);
  const [discount, setDiscount] = useState<number>(0);
  const [additionalSource, setAdditionalSource] = useState<string>('whatsapp');
  const [courierLoading, setCourierLoading] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState<number>(0);
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number; discount_type: string; discount_value: number } | null>(null);

  const { getCourierData, fetchPhone } = useBDCourierCache();
  const courierData = form.customer_phone.length >= 11 ? getCourierData(form.customer_phone) : null;

  const { data: matchedCustomer } = useQuery({
    queryKey: ['customer-lookup', form.customer_phone],
    queryFn: async () => {
      const { normalizePhoneVariants } = await import('@/lib/customerLoyalty');
      const phones = normalizePhoneVariants(form.customer_phone);
      if (phones.length === 0) return null;
      const { data } = await supabase
        .from('customers')
        .select('name, phone, address, total_orders, total_spent, delivered_orders')
        .in('phone', phones)
        .order('total_orders', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: form.customer_phone.length >= 11,
  });

  const autoFillCustomer = () => {
    if (!matchedCustomer) return;
    setForm(prev => ({
      ...prev,
      customer_name: matchedCustomer.name || prev.customer_name,
      customer_address: matchedCustomer.address || prev.customer_address,
    }));
  };

  const { data: categoryOptions = [] } = useAdminCategoryOptions(open);
  const { products, fetchNextPage, hasNextPage, isFetchingNextPage } = useAdminProductPicker(
    search,
    searchFocused || search.length >= 1 || categoryFilter !== 'all',
    categoryFilter !== 'all' ? categoryFilter : null,
  );
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sentinelRef.current || !hasNextPage) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) fetchNextPage();
    }, { rootMargin: '200px' });
    io.observe(sentinelRef.current);
    return () => io.disconnect();
  }, [hasNextPage, fetchNextPage, products.length]);

  // Keep delivery charge synced with the latest shipping setting for the selected area
  // unless: office sell, free shipping enabled, or user manually edited the input.
  useEffect(() => {
    if (isOfficeSell) return;
    if (customDeliveryCharge === 0) return; // free shipping
    if (deliveryChargeTouched) return;
    const expected = charges[form.delivery_area as keyof typeof charges] ?? charges.dhaka_inside;
    if (expected !== customDeliveryCharge) {
      setCustomDeliveryCharge(expected);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charges.dhaka_inside, charges.dhaka_suburb, charges.dhaka_outside, form.delivery_area, isOfficeSell, deliveryChargeTouched]);

  // Helper: get available sizes for a color
  const getAvailSizes = (colorSizes: Record<string, string[]>, color: string, allSizes: string[]) => {
    if (color && colorSizes[color]?.length > 0) return colorSizes[color];
    return allSizes;
  };

  // Helper: get effective sale price for a size
  const getEffectivePrice = (sizeData: Record<string, any>, size: string, basePrice: number) => {
    const sd = sizeData[size];
    if (sd?.sale_price && sd.sale_price > 0) return sd.sale_price;
    return basePrice;
  };

  // Helper: get effective original (regular) price for a size
  const getEffectiveOriginalPrice = (sizeData: Record<string, any>, size: string, productPrice: number) => {
    const sd = sizeData[size];
    if (sd?.price && sd.price > 0) return sd.price;
    return productPrice;
  };

  const addProduct = (p: any) => {
    const variants = selectedVariants[p.id] || {};
    const vi = (p.variant_images as any) || {};
    let colorSizes: Record<string, string[]> = vi.color_sizes || {};
    const sizeData: Record<string, any> = vi.size_data || {};
    const allSizes = p.sizes || [];
    const allColors = p.colors || [];

    // Auto-populate fallback: if no color_sizes but has colors and sizes, assign all sizes to all colors
    if (Object.keys(colorSizes).length === 0 && allColors.length > 0 && allSizes.length > 0) {
      colorSizes = {};
      allColors.forEach((c: string) => { colorSizes[c] = [...allSizes]; });
    }

    const initialColor = variants.color || allColors[0] || '';
    const availSizes = getAvailSizes(colorSizes, initialColor, allSizes);
    const initialSize = variants.size && availSizes.includes(variants.size) ? variants.size : (availSizes[0] || '');

    const basePrice = (p.original_price && p.original_price > 0 && p.original_price < p.price) ? p.original_price : p.price;
    const effectivePrice = getEffectivePrice(sizeData, initialSize, basePrice);

    const newItems: OrderItem[] = [{
      product_id: p.id,
      product_name: p.name,
      price: effectivePrice,
      originalPrice: getEffectiveOriginalPrice(sizeData, initialSize, p.price),
      baseSalePrice: basePrice,
      quantity: 1,
      size: initialSize,
      color: initialColor,
      image: getColorPrimaryImage(vi.color_images, initialColor) || p.images?.[0] || '',
      availableSizes: allSizes,
      availableColors: allColors,
      colorSizes,
      sizeData,
      colorImages: vi.color_images || {},
    }];

    // Auto-add addon_config as a suggestion item
    const addonCfg = p.addon_config as { name?: string; name_bn?: string; price?: number; image?: string } | null;
    if (addonCfg && addonCfg.name) {
      newItems.push({
        product_id: p.id,
        product_name: `[অ্যাড-অন] ${addonCfg.name_bn || addonCfg.name}`,
        price: addonCfg.price || 0,
        originalPrice: addonCfg.price || 0,
        baseSalePrice: addonCfg.price || 0,
        quantity: 1,
        size: '',
        color: '',
        image: addonCfg.image || '',
        availableSizes: [],
        availableColors: [],
        colorSizes: {},
        sizeData: {},
        colorImages: {},
        is_addon: true,
      });
    }

    setItems(prev => [...prev, ...newItems]);

    // If bump product exists, fetch and add as suggestion
    if (p.bump_product_id) {
      const bumpDisc = Number(p.bump_discount) || 0;
      supabase.from('products').select('id, name, name_bn, price, original_price, images, clearance_price, clearance_active').eq('id', p.bump_product_id).maybeSingle().then(({ data: bpRaw }) => {
        const bp: any = bpRaw ? applyClearance(bpRaw) : null;
        if (bp) {
          const bpBase = (bp.original_price && bp.original_price > 0 && bp.original_price < bp.price) ? bp.original_price : bp.price;
          const bpPrice = Math.max(0, bpBase - bumpDisc);
          setItems(prev => [...prev, {
            product_id: bp.id,
            product_name: `[বাম্প] ${bp.name}`,
            price: bpPrice,
            originalPrice: bp.price,
            baseSalePrice: bpPrice,
            quantity: 1,
            size: '',
            color: '',
            image: bp.images?.[0] || '',
            availableSizes: [],
            availableColors: [],
            colorSizes: {},
            sizeData: {},
            colorImages: {},
            is_addon: true,
          }]);
        }
      });
    }

    setSearch('');
    setSelectedVariants({});
    setCategoryFilter('all');
    setSearchFocused(false);
  };

  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const duplicateItem = (i: number) => setItems(prev => [
    ...prev.slice(0, i + 1),
    { ...prev[i], quantity: 1 },
    ...prev.slice(i + 1),
  ]);

  const addCustomItem = () => {
    if (!customItemName.trim()) return;
    setItems(prev => [...prev, {
      product_id: '',
      product_name: customItemName.trim(),
      price: customItemPrice || 0,
      originalPrice: customItemPrice || 0,
      baseSalePrice: customItemPrice || 0,
      quantity: 1,
      size: '',
      color: '',
      image: '',
      availableSizes: [],
      availableColors: [],
      colorSizes: {},
      sizeData: {},
      colorImages: {},
    }]);
    setCustomItemName('');
    setCustomItemPrice(0);
  };

  const updateItem = (i: number, key: string, val: any) => {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== i) return item;
      const updates: Partial<OrderItem> = { [key]: val };

      if (key === 'color') {
        const availSizes = getAvailSizes(item.colorSizes, val, item.availableSizes);
        if (!availSizes.includes(item.size)) {
          updates.size = availSizes[0] || '';
        }
        const newSize = updates.size ?? item.size;
        updates.price = getEffectivePrice(item.sizeData, newSize, item.baseSalePrice);
        updates.originalPrice = getEffectiveOriginalPrice(item.sizeData, newSize, item.originalPrice);
        // Color-specific image update
        const colorImg = getColorPrimaryImage(item.colorImages, val);
        if (colorImg) {
          updates.image = colorImg;
        }
      }

      if (key === 'size') {
        updates.price = getEffectivePrice(item.sizeData, val, item.baseSalePrice);
        updates.originalPrice = getEffectiveOriginalPrice(item.sizeData, val, item.originalPrice);
      }

      return { ...item, ...updates };
    }));
  };

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const deliveryCharge = isOfficeSell ? 0 : customDeliveryCharge;
  const couponDiscount = appliedCoupon?.discount || 0;
  const totalDiscount = discount + couponDiscount;
  const finalTotal = Math.max(0, subtotal + deliveryCharge - totalDiscount);

  // Accounting hooks for office sell auto sale entry
  const { data: accAccounts = [] } = useAccounts();

  const setVariant = (productId: string, field: 'size' | 'color', value: string) => {
    setSelectedVariants(prev => ({
      ...prev,
      [productId]: { ...prev[productId], [field]: value },
    }));
  };

  const createOrder = useMutation({
    mutationFn: async () => {
      if (!form.customer_name || !form.customer_phone) throw new Error('Name and phone required');
      if (items.length === 0) throw new Error('Add at least one product');

      // Build discount note
      const discountParts: string[] = [];
      if (appliedCoupon && couponDiscount > 0) {
        discountParts.push(`কুপন: ${appliedCoupon.code} (-৳${couponDiscount})`);
      }
      if (discount > 0) {
        discountParts.push(`ম্যানুয়াল ডিসকাউন্ট: -৳${discount}`);
      }
      const discountNote = discountParts.join(' | ');

      const { data: order, error } = await supabase.from('orders').insert({
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        customer_alt_phone: form.customer_alt_phone?.trim() || null,
        customer_email: form.customer_email.trim() || null,
        customer_address: isOfficeSell ? (form.customer_address || 'Office Sale') : form.customer_address,
        delivery_area: isOfficeSell ? 'dhaka_inside' : form.delivery_area,
        notes: form.notes || null,
        discount_note: discountNote || null,
        delivery_charge: deliveryCharge,
        subtotal,
        total: finalTotal,
        order_origin: isOfficeSell ? 'office' : (additionalSource ? `manual+${additionalSource}` : 'manual'),
        ...(isOfficeSell ? { status: 'office_sell' } : {}),
      }).select().single();

      if (error) throw error;

      const orderItems = items.map(item => ({
        order_id: order.id,
        product_id: item.product_id || null,
        product_name: item.product_name,
        quantity: item.quantity,
        price: item.price,
        size: item.size || null,
        color: item.color || null,
        item_type: item.is_addon ? 'addon' : 'normal',
        ...(item.is_addon && item.product_id ? { parent_product_id: item.product_id } : {}),
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;

      // Update coupon used_count if applied
      if (appliedCoupon) {
        try {
          const { data: couponData } = await supabase.from('coupons')
            .select('id, used_count').eq('code', appliedCoupon.code).maybeSingle();
          if (couponData) {
            await supabase.from('coupons').update({ used_count: (couponData.used_count || 0) + 1 }).eq('id', couponData.id);
          }
        } catch {}
      }

      return { order_number: order.order_number, total: order.total, phone: form.customer_phone, id: order.id, subtotal };
    },
    onSuccess: async (orderResult) => {
      // Log order placement
      if (orderResult?.id) {
        logActivity('order_place', 'order', orderResult.id, `ম্যানুয়াল অর্ডার প্লেস: ${orderResult.order_number}`);
      }
      // Fire-and-forget order confirmation SMS through the guarded order path.
      if (orderResult?.order_number && orderResult?.phone) {
        try {
          await supabase.functions.invoke('send-order-notification', {
            body: { order_id: orderResult.id, type: 'confirmation', send_email: false, send_sms: true },
          });
        } catch {}
      }
      // Customer record (counts/spent) is fully managed by the DB trigger
      // `trg_sync_customer_loyalty_stats` -> `recompute_customer_stats()`.
      // We only sync profile fields (name/address) here — never touch counts.
      if (orderResult?.phone) {
        try {
          await supabase.from('customers').update({
            name: form.customer_name.trim(),
            address: form.customer_address.trim(),
          }).eq('phone', orderResult.phone);
        } catch (e) { console.error('Customer profile sync error:', e); }
      }
      // Auto sale entry for office sell
      if (isOfficeSell && orderResult?.id) {
        await ensureOfficeSellSaleEntry(orderResult.id);
        qc.invalidateQueries({ queryKey: ['acc-accounts'] });
        qc.invalidateQueries({ queryKey: ['acc-transactions'] });
        qc.invalidateQueries({ queryKey: ['acc-transaction-summary'] });
        qc.invalidateQueries({ queryKey: ['acc-daily-history'] });
      }
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('অর্ডার তৈরি হয়েছে!');
      setOpen(false);
      setForm({ customer_name: '', customer_phone: '', customer_alt_phone: '', customer_email: '', customer_address: '', delivery_area: 'dhaka_inside', notes: '' });
      setItems([]);
      setIsOfficeSell(false);
      setCustomDeliveryCharge(charges.dhaka_inside);
      setDeliveryChargeTouched(false);
      setDiscount(0);
      setAppliedCoupon(null);
      setAdditionalSource('');
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {compact ? (
          <Button size="icon" className="h-9 w-9 shrink-0 shadow-md shadow-primary/25" title="নতুন অর্ডার">
            <Plus className="h-5 w-5" />
          </Button>
        ) : (
          <Button size="default" className="shadow-lg shadow-primary/25 gap-2 font-bold">
            <Plus className="h-5 w-5" /> নতুন অর্ডার
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="w-screen h-screen max-w-none max-h-none rounded-none sm:w-auto sm:h-auto sm:max-w-2xl sm:max-h-[90vh] sm:rounded-lg overflow-y-auto overflow-x-hidden scroll-smooth p-4 sm:p-6">
        <DialogHeader><DialogTitle>ম্যানুয়াল অর্ডার তৈরি</DialogTitle></DialogHeader>
        <form onSubmit={e => { e.preventDefault(); createOrder.mutate(); }} className="space-y-4">
          
          {/* Customer Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>নাম *</Label><Input value={form.customer_name} onChange={e => setForm(p => ({ ...p, customer_name: e.target.value }))} required /></div>
            <div>
              <Label>ফোন *</Label>
              <div className="flex gap-1.5">
                <Input value={form.customer_phone} onChange={e => setForm(p => ({ ...p, customer_phone: normalizeBDPhone(e.target.value) }))} required className="flex-1" />
                {form.customer_phone && (
                  <a href={`tel:${form.customer_phone}`} onClick={() => logActivity('call_action', 'order', null, `কাস্টমারকে কল: ${form.customer_phone}`)}
                    className="inline-flex items-center justify-center h-10 w-10 rounded-md border border-input bg-primary text-primary-foreground hover:bg-primary/90 shrink-0">
                    <Phone className="h-4 w-4" />
                  </a>
                )}
                {form.customer_phone.length >= 11 && (
                  <button type="button" onClick={async () => {
                    setCourierLoading(true);
                    try { await fetchPhone(form.customer_phone); } catch {}
                    setCourierLoading(false);
                  }} className="inline-flex items-center justify-center h-10 w-10 rounded-md border border-input hover:bg-muted shrink-0">
                    <RefreshCw className={`h-4 w-4 ${courierLoading ? 'animate-spin' : ''}`} />
                  </button>
                )}
              </div>
              {courierData && courierData.status === 'loading' && (
                <div className="flex items-center gap-1 mt-1">
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">কুরিয়ার ডাটা লোড হচ্ছে...</span>
                </div>
              )}
              {courierData && courierData.status === 'success' && (
                <div className="space-y-1 mt-1.5">
                  <div className="flex flex-wrap gap-1">
                    <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] rounded bg-muted text-muted-foreground">
                      মোট: {courierData.totalParcel}
                    </span>
                    <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] rounded bg-green-100 text-green-700">
                      সফল: {courierData.successParcel}
                    </span>
                    <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] rounded bg-red-100 text-red-700">
                      বাতিল: {courierData.cancelledParcel}
                    </span>
                    {courierData.successRate != null && (
                      <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] rounded font-semibold ${
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
                <p className="text-[10px] text-muted-foreground mt-1">কুরিয়ার হিস্ট্রি নেই</p>
              )}
              {matchedCustomer && (
                <div className="flex items-center justify-between gap-2 mt-1.5 px-2 py-1.5 rounded-md bg-accent/50 border border-border">
                  <div className="text-[11px] flex items-center gap-1.5 flex-wrap min-w-0">
                    <span className="font-medium truncate">{matchedCustomer.name}</span>
                    <CustomerLoyaltyBadge
                      phone={form.customer_phone}
                      preloaded={matchedCustomer as any}
                      compact
                      showCount
                    />
                    <span className="text-muted-foreground">· ৳{Number((matchedCustomer as any).total_spent || 0).toLocaleString('bn-BD')}</span>
                  </div>
                  <button type="button" onClick={autoFillCustomer}
                    className="text-[10px] px-2 py-0.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 shrink-0">
                    ব্যবহার করুন
                  </button>
                </div>
              )}
              {!matchedCustomer && form.customer_phone.length >= 11 && (
                <div className="mt-1.5 px-2 py-1 rounded-md bg-muted/40 border border-border text-[11px] text-muted-foreground">
                  🆕 নতুন কাস্টমার — আগে কোনো অর্ডার নেই
                </div>
              )}
            </div>
          </div>
          <div><Label>ঠিকানা</Label><Textarea rows={3} value={form.customer_address} onChange={e => setForm(p => ({ ...p, customer_address: e.target.value }))} placeholder={isOfficeSell ? 'Office Sale (ঐচ্ছিক)' : ''} /></div>
          <div>
            <Label>বিকল্প নম্বর <span className="text-xs text-muted-foreground font-normal">(ঐচ্ছিক)</span></Label>
            <Input
              value={form.customer_alt_phone}
              onChange={e => setForm(p => ({ ...p, customer_alt_phone: normalizeBDPhone(e.target.value) }))}
              placeholder="01XXXXXXXXX"
              inputMode="numeric"
            />
          </div>
          <div><Label>ইমেইল</Label><Input type="email" value={form.customer_email} onChange={e => setForm(p => ({ ...p, customer_email: e.target.value }))} placeholder="customer@email.com" /></div>
          {/* Office Sell - hidden in collapsible */}
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">⚙️ অ্যাডভান্সড</summary>
            <div className="mt-2 flex items-center gap-2">
              <Switch checked={isOfficeSell} onCheckedChange={(v) => {
                setIsOfficeSell(v);
                if (v) { setCustomDeliveryCharge(0); }
                else setCustomDeliveryCharge(deliveryOptions.find(o => o.value === form.delivery_area)?.price || 70);
              }} />
              <span className="text-sm">🏪 অফিস সেল</span>
            </div>
          </details>

          {/* Order Source Selector */}
          {!isOfficeSell && (
            <div>
              <Label className="text-xs">অর্ডার সোর্স</Label>
              <div className="flex flex-wrap gap-1.5 mt-1 items-center">
                {[
                  { value: 'call', label: '📞 Call' },
                  { value: 'whatsapp', label: 'WhatsApp' },
                  { value: 'facebook', label: 'Facebook' },
                  { value: 'instagram', label: 'Instagram' },
                  { value: 'tiktok', label: 'TikTok' },
                  { value: 'google', label: 'Google' },
                  { value: 'imo', label: 'IMO' },
                ].map(s => (
                  <button key={s.value} type="button" onClick={() => setAdditionalSource(s.value)}
                    className={`px-2 py-1 text-[10px] rounded-full border transition-colors ${
                      additionalSource === s.value
                        ? 'border-primary bg-primary/10 text-primary font-semibold'
                        : 'border-border hover:border-primary/50 text-muted-foreground'
                    }`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          

          {!isOfficeSell && (
            <div>
              <Label>ডেলিভারি এরিয়া</Label>
              <div className="grid grid-cols-3 gap-1 mt-1">
                {deliveryOptions.map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => {
                      setForm(p => ({ ...p, delivery_area: opt.value }));
                      setCustomDeliveryCharge(opt.price);
                      setDeliveryChargeTouched(false);
                    }}
                    className={`border rounded-md px-1 py-1.5 text-[10px] text-center transition-colors ${
                      form.delivery_area === opt.value
                        ? 'border-primary bg-primary/10 text-primary font-semibold'
                        : 'border-border hover:border-primary/50'
                    }`}>
                    <div className="leading-tight">{opt.label}</div>
                    <div className="font-bold">৳{opt.price}</div>
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <Label className="text-xs flex items-center gap-2 cursor-pointer">
                  <Switch
                    checked={customDeliveryCharge === 0}
                    onCheckedChange={(v) => setCustomDeliveryCharge(v ? 0 : (deliveryOptions.find(o => o.value === form.delivery_area)?.price ?? 0))}
                  />
                  ফ্রি শিপিং
                </Label>
              </div>
              <div className="mt-2">
                <Label className="text-xs text-muted-foreground">ডেলিভারি চার্জ (এডিট করুন)</Label>
                <Input type="number" value={customDeliveryCharge}
                  onChange={e => { setCustomDeliveryCharge(Number(e.target.value) || 0); setDeliveryChargeTouched(true); }}
                  className="mt-0.5 h-8 text-sm" min={0} />
              </div>
            </div>
          )}

          <Separator />

          {/* Product Search */}
          <div className="relative">
            <Label>প্রোডাক্ট খুঁজুন</Label>
            <div className="flex gap-2 mt-1">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[170px] shrink-0">
                  <SelectValue placeholder="ক্যাটাগরি" />
                </SelectTrigger>
                <SelectContent className="max-h-[18rem]">
                  <SelectItem value="all">সব ক্যাটাগরি</SelectItem>
                  {categoryOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name_bn || c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)}
                  onFocus={() => setSearchFocused(true)} onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                  placeholder="প্রোডাক্ট নাম লিখুন..." className="pl-8" />
              </div>
            </div>
            {(searchFocused || categoryFilter !== 'all') && products.length > 0 && (
              <div
                className="absolute z-50 w-full border border-border rounded-md mt-1 max-h-[28rem] overflow-y-auto overscroll-contain touch-pan-y bg-background shadow-lg"
                style={{ WebkitOverflowScrolling: 'touch' }}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
                onWheelCapture={(e) => e.stopPropagation()}
              >
                {products.map((p: any) => {
                  const sv = selectedVariants[p.id];
                  const vi = (p.variant_images as any) || {};
                  const colorSizesMap: Record<string, string[]> = vi.color_sizes || {};
                  const selectedColor = sv?.color || p.colors?.[0] || '';
                  const filteredSizes = getAvailSizes(colorSizesMap, selectedColor, p.sizes || []);
                  return (
                    <div key={p.id} onClick={() => addProduct(p)} className="px-3 py-3 text-sm hover:bg-muted border-b border-border last:border-0 cursor-pointer">
                      <div className="flex items-start gap-3">
                        {p.images?.[0] ? (
                          <img src={p.images[0]} alt={p.name} className="w-20 h-20 object-cover rounded shrink-0" />
                        ) : (
                          <div className="w-20 h-20 bg-muted rounded shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-base font-medium line-clamp-2">{p.name}</p>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${p.is_active === false ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'}`}>
                              {p.is_active === false ? 'Inactive' : 'Active'}
                            </span>
                          </div>
                          {p.name_bn && <p className="text-sm text-muted-foreground truncate">{p.name_bn}</p>}
                        </div>
                        <span className="text-sm font-medium whitespace-nowrap shrink-0">
                          {p.original_price && p.original_price > 0 && p.original_price < p.price ? (
                            <>
                              <span className="text-green-600">৳{p.original_price}</span>
                              {' '}
                              <span className="line-through text-muted-foreground">৳{p.price}</span>
                            </>
                          ) : (
                            <>৳{p.price}</>
                          )}
                        </span>
                      </div>
                      {(p.colors?.length > 0 || filteredSizes.length > 0) && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {p.colors?.map((c: string) => (
                            <button key={c} type="button" onClick={(e) => { e.stopPropagation(); setVariant(p.id, 'color', c); }}
                              className={`px-2 py-1 text-xs rounded border transition-colors ${
                                (sv?.color || p.colors?.[0]) === c ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border hover:border-primary/50'
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
                    </div>
                  );
                })}
                {hasNextPage && (
                  <div ref={sentinelRef} className="py-3 text-center text-xs text-muted-foreground">
                    {isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin inline" /> : 'স্ক্রল করুন...'}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Custom Item Form */}
          <div className="border border-dashed border-border rounded-lg p-2.5 space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">✏️ কাস্টম আইটেম</Label>
            <div className="flex gap-1.5 items-end">
              <Input
                value={customItemName}
                onChange={e => setCustomItemName(e.target.value)}
                placeholder="আইটেমের নাম"
                className="flex-1 h-8 text-sm"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomItem(); } }}
              />
              <Input
                type="number"
                value={customItemPrice || ''}
                onChange={e => setCustomItemPrice(Number(e.target.value) || 0)}
                placeholder="৳0 (ঐচ্ছিক)"
                className="w-24 h-8 text-sm"
                min={0}
              />
              <Button type="button" size="sm" variant="outline" onClick={addCustomItem} className="h-8 px-2.5 shrink-0">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Selected Items */}
          {items.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" /> পণ্য সমূহ
              </Label>
              {items.map((item, i) => {
                const availSizes = getAvailSizes(item.colorSizes, item.color, item.availableSizes);
                return (
                  <div key={i} className="border border-border rounded-lg p-2.5 flex items-start gap-2.5 overflow-hidden">
                    {item.image ? (
                      <img src={item.image} alt={item.product_name} className="w-10 h-10 rounded object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 bg-muted rounded shrink-0 flex items-center justify-center">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-sm font-medium line-clamp-2">{item.product_name}</p>
                        <div className="flex items-center gap-3 shrink-0">
                          <button type="button" onClick={() => duplicateItem(i)} title="কপি করুন"
                            className="flex items-center gap-1 px-2 py-1 rounded-md border border-primary/30 bg-primary/5 hover:bg-primary/15 text-primary text-xs font-medium transition-colors">
                            <Copy className="h-4 w-4" />
                            <span>কপি</span>
                          </button>
                          <button type="button" onClick={() => removeItem(i)}
                            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {item.product_id && item.availableColors.length > 0 && (
                          <select value={item.color} onChange={e => updateItem(i, 'color', e.target.value)}
                            className="border border-input rounded px-1.5 py-0.5 text-[11px] bg-background max-w-[90px]">
                            <option value="">কালার</option>
                            {item.availableColors.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        )}
                        {item.product_id && availSizes.length > 0 && (
                          <select value={item.size} onChange={e => updateItem(i, 'size', e.target.value)}
                            className="border border-input rounded px-1.5 py-0.5 text-[11px] bg-background max-w-[80px]">
                            <option value="">সাইজ</option>
                            {availSizes.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        )}
                        {!item.product_id && (
                          <Input
                            type="number"
                            value={item.price || ''}
                            onChange={e => updateItem(i, 'price', Number(e.target.value) || 0)}
                            className="w-20 h-6 text-[11px] px-1.5"
                            placeholder="৳0"
                            min={0}
                          />
                        )}
                        <div className="flex items-center border border-input rounded overflow-hidden ml-auto shrink-0">
                          <button type="button" onClick={() => updateItem(i, 'quantity', Math.max(1, item.quantity - 1))}
                            className="px-1.5 py-0.5 hover:bg-muted transition-colors">
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="px-2 py-0.5 text-xs font-medium min-w-[24px] text-center">{item.quantity}</span>
                          <button type="button" onClick={() => updateItem(i, 'quantity', item.quantity + 1)}
                            className="px-1.5 py-0.5 hover:bg-muted transition-colors">
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="text-xs font-semibold whitespace-nowrap shrink-0">
                          {item.product_id && item.price < item.originalPrice ? (
                            <>
                              <span className="text-green-600">৳{item.price * item.quantity}</span>
                              {' '}
                              <span className="line-through text-muted-foreground font-normal">৳{item.originalPrice * item.quantity}</span>
                            </>
                          ) : (
                            <>৳{item.price * item.quantity}</>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Summary */}
              <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">সাবটোটাল</span>
                  <span>৳{subtotal}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">ডেলিভারি</span>
                  <span>৳{deliveryCharge}</span>
                </div>
                {couponDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">কুপন ({appliedCoupon?.code})</span>
                    <span className="text-destructive">-৳{couponDiscount}</span>
                  </div>
                )}
                {discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">ডিসকাউন্ট</span>
                    <span className="text-destructive">-৳{discount}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-base">
                  <span>সর্বমোট</span>
                  <span>৳{finalTotal}</span>
                </div>
              </div>
            </div>
          )}

          {/* Coupon Apply */}
          <div>
            <Label className="text-sm mb-1.5 block">কুপন কোড</Label>
            <CouponApply
              subtotal={subtotal}
              applied={appliedCoupon}
              onApply={(result) => setAppliedCoupon(result)}
            />
          </div>

          {/* Manual Discount - always visible */}
          <div>
            <Label className="text-sm">ম্যানুয়াল ডিসকাউন্ট (৳)</Label>
            <Input type="number" value={discount || ''} onChange={e => setDiscount(Number(e.target.value) || 0)}
              className="mt-1 h-9 text-sm" min={0} placeholder="৳0" />
          </div>

          <Separator />

          <div><Label>নোট</Label><Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="অর্ডার সম্পর্কে নোট..." className="min-h-[60px]" /></div>
          <Button type="submit" className="w-full" disabled={createOrder.isPending}>
            {createOrder.isPending ? 'Creating...' : 'অর্ডার তৈরি করুন'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
