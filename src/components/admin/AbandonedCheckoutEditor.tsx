import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Plus, Minus, Trash2, Phone, Search, Loader2, Package, CheckCircle, Save } from 'lucide-react';
import { useBDCourierCache } from '@/hooks/useBDCourierCache';
import { useActivityLog } from '@/hooks/useActivityLog';
import { useShippingCharges, resolveShippingCharge } from '@/hooks/useShippingCharges';
import { getColorPrimaryImage } from '@/lib/productVariants';

interface OrderItem {
  product_id: string;
  product_name: string;
  price: number;
  quantity: number;
  size: string;
  color: string;
  image: string;
  availableSizes: string[];
  availableColors: string[];
}

interface Props {
  checkout: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export default function AbandonedCheckoutEditor({ checkout, open, onOpenChange, onSaved }: Props) {
  const qc = useQueryClient();
  const { logActivity } = useActivityLog();
  const { charges } = useShippingCharges();
  const deliveryOptions = [
    { value: 'dhaka_inside', label: 'ঢাকা সিটি', price: charges.dhaka_inside },
    { value: 'dhaka_suburb', label: 'ঢাকা সাব-এরিয়া', price: charges.dhaka_suburb },
    { value: 'dhaka_outside', label: 'সারাদেশে', price: charges.dhaka_outside },
  ];
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
  const [selectedVariants, setSelectedVariants] = useState<Record<string, { size?: string; color?: string }>>({});

  // Initialize from checkout data
  useEffect(() => {
    if (!checkout || !open) return;
    setForm({
      customer_name: checkout.customer_name || '',
      customer_phone: checkout.customer_phone || '',
      customer_address: checkout.customer_address || '',
      delivery_area: 'dhaka_inside',
      notes: checkout.notes || '',
    });
    // Convert cart_data to OrderItem[]
    const cart = checkout.cart_data || [];
    if (cart.length > 0 && items.length === 0) {
      setItems(cart.map((item: any) => ({
        product_id: item.id || item.product_id || '',
        product_name: item.name_bn || item.name || item.product_name || '',
        price: item.price || 0,
        quantity: item.quantity || item.qty || 1,
        size: item.size || '',
        color: item.color || '',
        image: item.image || '',
        availableSizes: item.sizes || [],
        availableColors: item.colors || [],
      })));
    }
  }, [checkout, open]);

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
    queryKey: ['products-search', search],
    queryFn: async () => {
      let query = supabase.from('products').select('id, name, name_bn, price, original_price, sizes, colors, images, variant_images')
        .eq('is_active', true).limit(20);
      if (search) {
        query = query.or(`name.ilike.%${search}%,name_bn.ilike.%${search}%`);
      }
      const { data } = await query;
      return data || [];
    },
    enabled: searchFocused || search.length >= 1,
  });

  const addProduct = (p: any) => {
    const variants = selectedVariants[p.id] || {};
    const colorImages = (p.variant_images as any)?.color_images;
    const initialColor = variants.color || p.colors?.[0] || '';
    setItems(prev => [...prev, {
      product_id: p.id,
      product_name: p.name_bn || p.name,
      price: (p.original_price && p.original_price < p.price) ? p.original_price : p.price,
      quantity: 1,
      size: variants.size || p.sizes?.[0] || '',
      color: initialColor,
      image: getColorPrimaryImage(colorImages, initialColor) || p.images?.[0] || '',
      availableSizes: p.sizes || [],
      availableColors: p.colors || [],
      colorImages,
    }]);
    setSearch('');
    setSelectedVariants({});
  };

  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i: number, key: string, val: any) =>
    setItems(prev => prev.map((item, idx) => {
      if (idx !== i) return item;
      const updates: any = { [key]: val };
      // Color change must also follow that color's own photo, not stay on whichever
      // color's image happened to load first — same fix as ManualOrderDialog.
      if (key === 'color') {
        const colorImg = getColorPrimaryImage(item.colorImages, val);
        if (colorImg) updates.image = colorImg;
      }
      return { ...item, ...updates };
    }));

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const deliveryCharge = resolveShippingCharge(charges, form.delivery_area);

  const setVariant = (productId: string, field: 'size' | 'color', value: string) => {
    setSelectedVariants(prev => ({
      ...prev,
      [productId]: { ...prev[productId], [field]: value },
    }));
  };

  // Save updates to abandoned_checkouts record
  const saveCheckout = useMutation({
    mutationFn: async () => {
      const cartData = items.map(item => ({
        id: item.product_id,
        name: item.product_name,
        name_bn: item.product_name,
        price: item.price,
        quantity: item.quantity,
        size: item.size || null,
        color: item.color || null,
        image: item.image || null,
      }));
      const { error } = await supabase.from('abandoned_checkouts').update({
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        customer_address: form.customer_address,
        notes: form.notes || null,
        cart_data: cartData as any,
        subtotal,
      }).eq('id', checkout.id);
      if (error) throw error;
    },
    onSuccess: () => {
      onSaved();
      toast.success('আপডেট সেভ হয়েছে');
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Confirm as order via place-order edge function
  const confirmOrder = useMutation({
    mutationFn: async () => {
      if (!form.customer_name || !form.customer_phone) throw new Error('নাম ও ফোন আবশ্যক');
      if (!form.customer_address || form.customer_address.trim().length < 5) throw new Error('সম্পূর্ণ ঠিকানা দিন');
      if (items.length === 0) throw new Error('কমপক্ষে একটি প্রোডাক্ট যোগ করুন');

      // Filter out items without valid product_id
      const validItems = items.filter(item => item.product_id && item.product_id.trim() !== '');
      if (validItems.length === 0) throw new Error('কোনো বৈধ প্রোডাক্ট নেই। প্রোডাক্ট সার্চ করে নতুন করে যোগ করুন।');

      const orderItems = validItems.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        price: item.price,
        size: item.size || null,
        color: item.color || null,
      }));

      const { data, error } = await supabase.functions.invoke('place-order', {
        body: {
          orderData: {
            customer_name: form.customer_name,
            customer_phone: form.customer_phone,
            customer_address: form.customer_address,
            delivery_area: form.delivery_area,
            notes: form.notes,
          },
          items: orderItems,
          abandoned_checkout_id: checkout.id,
        },
      });

      if (error) throw new Error(error.message || 'অর্ডার তৈরি ব্যর্থ');
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      onSaved();
      onOpenChange(false);
      toast.success(`অর্ডার তৈরি হয়েছে! ${data?.order?.order_number || ''}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleClose = () => {
    onOpenChange(false);
    setItems([]);
    setSearch('');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6">
        <DialogHeader><DialogTitle>অসম্পূর্ণ অর্ডার এডিট</DialogTitle></DialogHeader>
        <div className="space-y-4">

          {/* Customer Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>নাম *</Label><Input value={form.customer_name} onChange={e => setForm(p => ({ ...p, customer_name: e.target.value }))} /></div>
            <div>
              <Label>ফোন *</Label>
              <div className="flex gap-1.5">
                 <Input value={form.customer_phone} onChange={e => setForm(p => ({ ...p, customer_phone: e.target.value }))} className="flex-1" />
                {form.customer_phone && (
                  <a href={`tel:${form.customer_phone}`} onClick={() => logActivity('call_action', 'order', null, `কাস্টমারকে কল: ${form.customer_phone}`)}
                    className="inline-flex items-center justify-center h-10 w-10 rounded-md border border-input bg-primary text-primary-foreground hover:bg-primary/90 shrink-0">
                    <Phone className="h-4 w-4" />
                  </a>
                )}
              </div>
              {courierData && courierData.status === 'loading' && (
                <div className="flex items-center gap-1 mt-1">
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">কুরিয়ার ডাটা লোড হচ্ছে...</span>
                </div>
              )}
              {courierData && courierData.status === 'success' && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] rounded bg-muted text-muted-foreground">মোট: {courierData.totalParcel}</span>
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] rounded bg-green-100 text-green-700">সফল: {courierData.successParcel}</span>
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] rounded bg-red-100 text-red-700">বাতিল: {courierData.cancelledParcel}</span>
                  {courierData.successRate != null && (
                    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] rounded font-semibold ${
                      courierData.successRate >= 70 ? 'bg-green-100 text-green-800' :
                      courierData.successRate >= 40 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>রেট: {courierData.successRate}%</span>
                  )}
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
          <div>
            <Label>ডেলিভারি এরিয়া</Label>
              <div className="grid grid-cols-3 gap-1 mt-1">
                {deliveryOptions.map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setForm(p => ({ ...p, delivery_area: opt.value }))}
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
          </div>

          <Separator />

          {/* Product Search */}
          <div className="relative">
            <Label>প্রোডাক্ট খুঁজুন</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)} onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                placeholder="প্রোডাক্ট নাম লিখুন..." className="pl-8" />
            </div>
            {searchFocused && products.length > 0 && (
              <div className="absolute z-50 w-full border border-border rounded-md mt-1 max-h-60 overflow-y-auto bg-background shadow-lg">
                {products.map((p: any) => {
                  const sv = selectedVariants[p.id];
                  return (
                    <div key={p.id} onClick={() => addProduct(p)} className="px-3 py-2 text-sm hover:bg-muted border-b border-border last:border-0 cursor-pointer">
                      <div className="flex items-center gap-2">
                        {p.images?.[0] ? (
                          <img src={p.images[0]} alt={p.name} className="w-8 h-8 object-cover rounded" />
                        ) : (
                          <div className="w-8 h-8 bg-muted rounded" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium">{p.name_bn || p.name}</p>
                        </div>
                        <span className="text-xs font-medium whitespace-nowrap">
                          {p.original_price && p.original_price < p.price ? (
                            <><span className="line-through text-muted-foreground mr-1">৳{p.price}</span><span className="text-green-600">৳{p.original_price}</span></>
                          ) : (<>৳{p.price}</>)}
                        </span>
                      </div>
                      {(p.sizes?.length > 0 || p.colors?.length > 0) && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {p.sizes?.map((s: string) => (
                            <button key={s} type="button" onClick={(e) => { e.stopPropagation(); setVariant(p.id, 'size', s); }}
                              className={`px-1.5 py-0.5 text-[10px] rounded border transition-colors ${
                                sv?.size === s ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border hover:border-primary/50'
                              }`}>{s}</button>
                          ))}
                          {p.colors?.map((c: string) => (
                            <button key={c} type="button" onClick={(e) => { e.stopPropagation(); setVariant(p.id, 'color', c); }}
                              className={`px-1.5 py-0.5 text-[10px] rounded border transition-colors ${
                                sv?.color === c ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border hover:border-primary/50'
                              }`}>{c}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected Items */}
          {items.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" /> পণ্য সমূহ
              </Label>
              {items.map((item, i) => (
                <div key={i} className="border border-border rounded-lg p-2.5 flex items-start gap-2.5">
                  {item.image ? (
                    <img src={item.image} alt={item.product_name} className="w-10 h-10 rounded object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 bg-muted rounded shrink-0 flex items-center justify-center">
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{item.product_name}</p>
                      <button type="button" onClick={() => removeItem(i)}
                        className="shrink-0 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {item.availableSizes.length > 0 && (
                        <select value={item.size} onChange={e => updateItem(i, 'size', e.target.value)}
                          className="border border-input rounded px-1.5 py-0.5 text-[11px] bg-background">
                          <option value="">সাইজ</option>
                          {item.availableSizes.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      )}
                      {item.availableColors.length > 0 && (
                        <select value={item.color} onChange={e => updateItem(i, 'color', e.target.value)}
                          className="border border-input rounded px-1.5 py-0.5 text-[11px] bg-background">
                          <option value="">কালার</option>
                          {item.availableColors.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      )}
                      <div className="flex items-center border border-input rounded overflow-hidden ml-auto">
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
                      <span className="text-xs font-semibold whitespace-nowrap">৳{item.price * item.quantity}</span>
                    </div>
                  </div>
                </div>
              ))}

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
                <Separator />
                <div className="flex justify-between font-bold text-base">
                  <span>সর্বমোট</span>
                  <span>৳{subtotal + deliveryCharge}</span>
                </div>
              </div>
            </div>
          )}

          <Separator />

          <div><Label>নোট</Label><Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="নোট..." className="min-h-[60px]" /></div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" className="flex-1 gap-1.5" onClick={() => saveCheckout.mutate()} disabled={saveCheckout.isPending}>
              <Save className="h-4 w-4" />
              {saveCheckout.isPending ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
            </Button>
            <Button type="button" className="flex-1 gap-1.5" onClick={() => confirmOrder.mutate()} disabled={confirmOrder.isPending}>
              <CheckCircle className="h-4 w-4" />
              {confirmOrder.isPending ? 'তৈরি হচ্ছে...' : 'অর্ডার কনফার্ম'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
