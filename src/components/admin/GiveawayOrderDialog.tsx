import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Plus, Minus, Trash2, Phone, Search, Loader2, Package, RefreshCw } from 'lucide-react';
import { useBDCourierCache } from '@/hooks/useBDCourierCache';
import { useActivityLog } from '@/hooks/useActivityLog';
import { useShippingCharges } from '@/hooks/useShippingCharges';
import { applyClearanceList } from '@/lib/clearancePrice';
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
}

export default function GiveawayOrderDialog() {
  const qc = useQueryClient();
  const { logActivity } = useActivityLog();
  const { charges } = useShippingCharges();
  const deliveryOptions = [
    { value: 'dhaka_inside', label: 'ঢাকা সিটি', price: charges.dhaka_inside },
    { value: 'dhaka_suburb', label: 'ঢাকা সাব-এরিয়া', price: charges.dhaka_suburb },
    { value: 'dhaka_outside', label: 'সারাদেশে', price: charges.dhaka_outside },
  ];
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    delivery_area: 'dhaka_inside',
    notes: '',
  });
  const [items, setItems] = useState<OrderItem[]>([]);
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [customDeliveryCharge, setCustomDeliveryCharge] = useState<number>(70);
  const [discount, setDiscount] = useState<number>(0);
  const [courierLoading, setCourierLoading] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState<number>(0);

  const { getCourierData, fetchPhone } = useBDCourierCache();
  const courierData = form.customer_phone.length >= 11 ? getCourierData(form.customer_phone) : null;

  const { data: matchedCustomer } = useQuery({
    queryKey: ['customer-lookup', form.customer_phone],
    queryFn: async () => {
      const { data } = await supabase
        .from('customers')
        .select('name, phone, address, total_orders, total_spent')
        .eq('phone', form.customer_phone)
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

  const { data: products = [] } = useQuery({
    queryKey: ['products-search-giveaway', search],
    queryFn: async () => {
      let query = supabase.from('products').select('id, name, name_bn, price, original_price, sizes, colors, images, variant_images, clearance_price, clearance_active')
        .eq('is_active', true).limit(20);
      if (search) {
        query = query.or(`name.ilike.%${search}%,name_bn.ilike.%${search}%`);
      }
      const { data } = await query;
      return applyClearanceList(data || []);
    },
    enabled: searchFocused || search.length >= 1,
  });

  const getAvailSizes = (colorSizes: Record<string, string[]>, color: string, allSizes: string[]) => {
    if (color && colorSizes[color]?.length > 0) return colorSizes[color];
    return allSizes;
  };

  const getEffectivePrice = (sizeData: Record<string, any>, size: string, basePrice: number) => {
    const sd = sizeData[size];
    if (sd?.sale_price && sd.sale_price > 0) return sd.sale_price;
    return basePrice;
  };

  const addProduct = (p: any) => {
    const vi = (p.variant_images as any) || {};
    let colorSizes: Record<string, string[]> = vi.color_sizes || {};
    const sizeData: Record<string, any> = vi.size_data || {};
    const allSizes = p.sizes || [];
    const allColors = p.colors || [];

    if (Object.keys(colorSizes).length === 0 && allColors.length > 0 && allSizes.length > 0) {
      colorSizes = {};
      allColors.forEach((c: string) => { colorSizes[c] = [...allSizes]; });
    }

    const initialColor = allColors[0] || '';
    const availSizes = getAvailSizes(colorSizes, initialColor, allSizes);
    const initialSize = availSizes[0] || '';

    const basePrice = (p.original_price && p.original_price > 0 && p.original_price < p.price) ? p.original_price : p.price;
    const effectivePrice = getEffectivePrice(sizeData, initialSize, basePrice);

    setItems(prev => [...prev, {
      product_id: p.id,
      product_name: p.name,
      price: effectivePrice,
      originalPrice: p.price,
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
    }]);
    setSearch('');
  };

  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));

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
        if (!availSizes.includes(item.size)) updates.size = availSizes[0] || '';
        const newSize = updates.size ?? item.size;
        updates.price = getEffectivePrice(item.sizeData, newSize, item.baseSalePrice);
        const colorImg = getColorPrimaryImage(item.colorImages, val);
        if (colorImg) updates.image = colorImg;
      }

      if (key === 'size') {
        updates.price = getEffectivePrice(item.sizeData, val, item.baseSalePrice);
      }

      return { ...item, ...updates };
    }));
  };

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const deliveryCharge = customDeliveryCharge;
  const finalTotal = Math.max(0, subtotal + deliveryCharge - discount);

  const createOrder = useMutation({
    mutationFn: async () => {
      if (!form.customer_name || !form.customer_phone) throw new Error('নাম ও ফোন আবশ্যক');
      if (items.length === 0) throw new Error('কমপক্ষে একটি প্রোডাক্ট যোগ করুন');

      const { data: order, error } = await supabase.from('orders').insert({
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        customer_address: form.customer_address || 'গিভঅ্যাওয়ে',
        delivery_area: form.delivery_area,
        notes: discount > 0 ? `${form.notes ? form.notes + ' | ' : ''}ডিসকাউন্ট: ৳${discount}` : form.notes,
        delivery_charge: deliveryCharge,
        subtotal,
        total: finalTotal,
        order_origin: 'giveaway',
        is_gift_order: true,
        order_attribution: {
          giveaway_photos: [],
        },
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
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;

      // Auto-insert giveaway entry
      const productNames = items.map(i => i.product_name).join(', ');
      await supabase.from('giveaway_entries').insert({
        order_id: order.id,
        customer_name: form.customer_name,
        product_name: productNames,
      } as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['giveaway-orders'] });
      qc.invalidateQueries({ queryKey: ['giveaway-entries'] });
      qc.invalidateQueries({ queryKey: ['giveaway-entries-map'] });
      toast.success('গিফট অর্ডার তৈরি হয়েছে!');
      setOpen(false);
      setForm({ customer_name: '', customer_phone: '', customer_address: '', delivery_area: 'dhaka_inside', notes: '' });
      setItems([]);
      setCustomDeliveryCharge(70);
      setDiscount(0);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="default" className="shadow-lg shadow-primary/25 gap-2 font-bold">
          <Plus className="h-5 w-5" /> নতুন গিফট অর্ডার
        </Button>
      </DialogTrigger>
      <DialogContent className="w-screen h-screen max-w-none max-h-none rounded-none sm:w-auto sm:h-auto sm:max-w-lg sm:max-h-[90vh] sm:rounded-lg overflow-y-auto overflow-x-hidden scroll-smooth p-4 sm:p-6">
        <DialogHeader><DialogTitle>🎁 গিফট অর্ডার তৈরি</DialogTitle></DialogHeader>
        <form onSubmit={e => { e.preventDefault(); createOrder.mutate(); }} className="space-y-4">
          
          {/* Customer Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>নাম *</Label><Input value={form.customer_name} onChange={e => setForm(p => ({ ...p, customer_name: e.target.value }))} required /></div>
            <div>
              <Label>ফোন *</Label>
              <div className="flex gap-1.5">
                <Input value={form.customer_phone} onChange={e => setForm(p => ({ ...p, customer_phone: e.target.value }))} required className="flex-1" />
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
              {courierData && courierData.status === 'success' && (
                <div className="flex flex-wrap gap-1 mt-1">
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] rounded bg-muted text-muted-foreground">মোট: {courierData.totalParcel}</span>
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] rounded bg-green-100 text-green-700">সফল: {courierData.successParcel}</span>
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] rounded bg-red-100 text-red-700">বাতিল: {courierData.cancelledParcel}</span>
                </div>
              )}
              {matchedCustomer && (
                <div className="flex items-center justify-between gap-2 mt-1.5 px-2 py-1.5 rounded-md bg-accent/50 border border-border">
                  <div className="text-[11px]">
                    <span className="font-medium">{matchedCustomer.name}</span>
                    <span className="text-muted-foreground"> · {matchedCustomer.total_orders} অর্ডার</span>
                  </div>
                  <button type="button" onClick={autoFillCustomer}
                    className="text-[10px] px-2 py-0.5 rounded bg-primary text-primary-foreground hover:bg-primary/90">
                    ব্যবহার করুন
                  </button>
                </div>
              )}
            </div>
          </div>




          <div><Label>ঠিকানা</Label><Input value={form.customer_address} onChange={e => setForm(p => ({ ...p, customer_address: e.target.value }))} /></div>

          {/* Delivery Area */}
          <div className="grid grid-cols-3 gap-2">
            {deliveryOptions.map(opt => (
              <button key={opt.value} type="button" onClick={() => { setForm(p => ({ ...p, delivery_area: opt.value })); setCustomDeliveryCharge(opt.price); }}
                className={`border rounded-md px-2 py-2 text-xs text-center transition-colors ${form.delivery_area === opt.value ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border hover:border-primary/50'}`}>
                {opt.label}<br/><span className="font-bold">৳{opt.price}</span>
              </button>
            ))}
          </div>

          <Separator />

          {/* Product Search */}
          <div>
            <Label>প্রোডাক্ট যোগ করুন</Label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)} onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                placeholder="প্রোডাক্ট নাম..." className="pl-9" />
            </div>
            {(searchFocused || search) && products.length > 0 && (
              <div className="border border-border rounded-md mt-1 max-h-[28rem] overflow-y-auto bg-background shadow-lg">
                {products.map((p: any) => (
                  <button key={p.id} type="button" onClick={() => addProduct(p)}
                    className="w-full flex items-start gap-3 px-3 py-3 hover:bg-muted text-left border-b border-border last:border-0">
                    {p.images?.[0] ? <img src={p.images[0]} alt="" className="w-16 h-16 object-cover rounded shrink-0" /> : <div className="w-16 h-16 bg-muted rounded shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-medium truncate">{p.name}</p>
                      {p.name_bn && <p className="text-sm text-muted-foreground truncate">{p.name_bn}</p>}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {(p.colors || []).map((c: string) => (
                          <span key={c} className="px-2 py-1 text-xs rounded-full border border-border text-muted-foreground">{c}</span>
                        ))}
                        {(p.sizes || []).map((s: string) => (
                          <span key={s} className="px-2 py-1 text-xs rounded-full border border-border text-muted-foreground">{s}</span>
                        ))}
                      </div>
                    </div>
                    <span className="text-sm font-semibold shrink-0">৳{p.original_price && p.original_price < p.price ? p.original_price : p.price}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Custom Item */}
          <div className="flex gap-2">
            <Input value={customItemName} onChange={e => setCustomItemName(e.target.value)} placeholder="কাস্টম আইটেম নাম" className="flex-1" />
            <Input type="number" value={customItemPrice || ''} onChange={e => setCustomItemPrice(Number(e.target.value))} placeholder="দাম" className="w-24" />
            <Button type="button" variant="outline" size="icon" onClick={addCustomItem}><Plus className="h-4 w-4" /></Button>
          </div>

          {/* Items List */}
          {items.length > 0 && (
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex items-center gap-2 p-2 border border-border rounded-md">
                  {item.image ? <img src={item.image} alt="" className="w-10 h-10 object-cover rounded" /> : <Package className="w-10 h-10 p-2 text-muted-foreground" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.product_name}</p>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {item.availableColors.map(c => (
                        <button key={c} type="button" onClick={() => updateItem(i, 'color', c)}
                          className={`px-1.5 py-0.5 text-[10px] rounded-full border ${item.color === c ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border text-muted-foreground'}`}>{c}</button>
                      ))}
                      {getAvailSizes(item.colorSizes, item.color, item.availableSizes).map(s => (
                        <button key={s} type="button" onClick={() => updateItem(i, 'size', s)}
                          className={`px-1.5 py-0.5 text-[10px] rounded-full border ${item.size === s ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border text-muted-foreground'}`}>{s}</button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => updateItem(i, 'quantity', Math.max(1, item.quantity - 1))} className="h-7 w-7 rounded border border-border flex items-center justify-center hover:bg-muted"><Minus className="h-3 w-3" /></button>
                    <span className="text-sm w-6 text-center">{item.quantity}</span>
                    <button type="button" onClick={() => updateItem(i, 'quantity', item.quantity + 1)} className="h-7 w-7 rounded border border-border flex items-center justify-center hover:bg-muted"><Plus className="h-3 w-3" /></button>
                  </div>
                  <span className="text-sm font-semibold w-16 text-right">৳{item.price * item.quantity}</span>
                  <button type="button" onClick={() => removeItem(i)} className="p-1 hover:bg-destructive/10 rounded"><Trash2 className="h-4 w-4 text-destructive" /></button>
                </div>
              ))}
            </div>
          )}

          <Separator />

          {/* Totals */}
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">সাবটোটাল</span><span>৳{subtotal}</span></div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">ডেলিভারি</span>
              <Input type="number" className="w-20 h-8 text-right text-sm" value={customDeliveryCharge} onChange={e => setCustomDeliveryCharge(Number(e.target.value) || 0)} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">ডিসকাউন্ট</span>
              <Input type="number" className="w-20 h-8 text-right text-sm" value={discount || ''} onChange={e => setDiscount(Number(e.target.value) || 0)} />
            </div>
            <div className="flex justify-between font-bold text-base pt-1 border-t border-border"><span>মোট</span><span>৳{finalTotal}</span></div>
          </div>

          <div><Label>নোট</Label><Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>

          <Button type="submit" disabled={createOrder.isPending} className="w-full h-11">
            {createOrder.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            গিফট অর্ডার তৈরি করুন
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
