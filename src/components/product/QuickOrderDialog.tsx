import { useState, useRef, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, Minus, Plus, ShoppingCart, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';
import { storeThankYouData } from '@/pages/ThankYou';
import CouponApply from '@/components/checkout/CouponApply';
import PolicyAgreement from '@/components/checkout/PolicyAgreement';
import DuplicateOrderBanner from '@/components/checkout/DuplicateOrderBanner';
import { trackAddToCart, trackBeginCheckout, trackPurchase } from '@/lib/ecommerceTracking';
import { trackMetaAddToCart, trackMetaInitiateCheckout, trackMetaPurchase } from '@/lib/metaTracking';
import { useProduct } from '@/hooks/useProducts';
import { useCart } from '@/contexts/CartContext';
import { useNavigate } from 'react-router-dom';
import { getOrderOrigin, getOrderAttribution } from '@/hooks/useUtmCapture';
import { useQuery } from '@tanstack/react-query';
import { useShippingCharges, resolveShippingCharge } from '@/hooks/useShippingCharges';
import { applyClearance } from '@/lib/clearancePrice';
import { FreeShippingProgress } from '@/components/freeShipping/FreeShippingProgress';
import { useEnabledPaymentMethods } from '@/hooks/usePaymentMethods';
import { optimizedImageUrl } from '@/lib/imageUrl';
import { getColorPrimaryImage } from '@/lib/productVariants';

interface QuickOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: any;
  selectedSize?: string;
  selectedColor?: string;
  qty: number;
}

export default function QuickOrderDialog({ open, onOpenChange, product, selectedSize, selectedColor, qty }: QuickOrderDialogProps) {
  // Fetch full product data for sizes/colors/variants
  const { data: fullProduct } = useProduct(product?.slug || '');

  const [localSize, setLocalSize] = useState(selectedSize || '');
  const [localColor, setLocalColor] = useState(selectedColor || '');
  const [localQty, setLocalQty] = useState(qty || 1);

  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    delivery_area: 'dhaka_outside' as string,
    notes: '',
    customer_email: '',
  });
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('cod');
  const { methods: enabledPaymentMethods } = useEnabledPaymentMethods();
  const [duplicateOrder, setDuplicateOrder] = useState<any>(null);
  const [orderNumber, setOrderNumber] = useState('');
  const abandonedIdRef = useRef<string | null>(null);
  const { addItem } = useCart();
  const navigate = useNavigate();
  const [addonChecked, setAddonChecked] = useState(false);
  const [bumpChecked, setBumpChecked] = useState(false);
  const [agreed, setAgreed] = useState(true);

  // Addon config from product
  const addonConfig = fullProduct?.addon_config as { name?: string; name_bn?: string; price?: number; image?: string } | null;
  const bumpProductId = fullProduct?.bump_product_id as string | null;
  const bumpDiscount = Number(fullProduct?.bump_discount) || 0;

  // Fetch bump product
  const { data: bumpProduct } = useQuery({
    queryKey: ['bump-product', bumpProductId],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('id, name, name_bn, slug, price, original_price, images, clearance_price, clearance_active').eq('id', bumpProductId!).maybeSingle();
      return data ? applyClearance(data as any) : null;
    },
    enabled: !!bumpProductId,
    staleTime: 5 * 60 * 1000,
  });

  const bumpBaseSale = bumpProduct ? ((bumpProduct as any).original_price && (bumpProduct as any).original_price > 0 && (bumpProduct as any).original_price < bumpProduct.price ? (bumpProduct as any).original_price : bumpProduct.price) : 0;
  const bumpPrice = bumpProduct ? Math.max(0, bumpBaseSale - bumpDiscount) : 0;

  // The dialog has its own color picker (localColor), so the cart/thank-you image
  // must follow whichever color the customer actually picked here, not just images[0].
  const getColorImage = (color: string | undefined): string | null =>
    getColorPrimaryImage((fullProduct as any)?.variant_images?.color_images, color);
  const popupTrackedRef = useRef<string | null>(null);

  useEffect(() => {
    if (open) {
      setLocalSize(selectedSize || '');
      setLocalColor(selectedColor || '');
      setLocalQty(qty || 1);
    }
  }, [open, selectedSize, selectedColor, qty]);

  useEffect(() => {
    if (!open || !product?.id) return;
    if (popupTrackedRef.current === product.id) return;
    popupTrackedRef.current = product.id;

    const value = (product.price || 0) * (localQty || 1);
    trackAddToCart(product, localQty);
    trackBeginCheckout([{ ...product, quantity: localQty }], value);
    trackMetaAddToCart(product, localQty);
    trackMetaInitiateCheckout([{ id: product.id, quantity: localQty }], value);
  }, [open, product?.id]);

  useEffect(() => {
    if (!fullProduct || !open) return;
    const sizes = fullProduct.sizes || [];
    const colors = fullProduct.colors || [];
    if (sizes.length > 0 && !localSize) setLocalSize(sizes[0]);
    if (colors.length > 0 && !localColor) setLocalColor(colors[0]);
  }, [fullProduct, open]);

  const sizes: string[] = fullProduct?.sizes || product?.sizes || [];
  const colors: string[] = fullProduct?.colors || product?.colors || [];
  const variantImages: any = fullProduct?.variant_images || product?.variant_images || {};
  const colorSizesMap: Record<string, string[]> = variantImages?.color_sizes || {};

  const availableSizes = useMemo(() => {
    if (localColor && colorSizesMap[localColor]?.length > 0) {
      return colorSizesMap[localColor];
    }
    return sizes;
  }, [localColor, colorSizesMap, sizes]);

  useEffect(() => {
    if (!localColor) return;
    const cs = colorSizesMap[localColor];
    if (cs?.length > 0 && localSize && !cs.includes(localSize)) {
      setLocalSize(cs[0]);
    }
  }, [localColor]);

  const getEffectivePrice = () => {
    let basePrice = product.price;
    let originalPrice = product.original_price || null;
    const productOnSale = originalPrice && originalPrice > basePrice;

    if (localSize && variantImages?.size_data?.[localSize]) {
      const sd = variantImages.size_data[localSize];
      if (sd.sale_price && sd.sale_price > 0) {
        originalPrice = sd.price || basePrice;
        basePrice = sd.sale_price;
      } else if (sd.price) {
        if (productOnSale) {
          originalPrice = sd.price;
        } else {
          basePrice = sd.price;
        }
      }
    }

    const isSale = originalPrice && originalPrice > basePrice;
    const discount = isSale ? Math.round(((originalPrice - basePrice) / originalPrice) * 100) : 0;
    return { price: basePrice, originalPrice: isSale ? originalPrice : null, discount };
  };

  const { price: effectivePrice, originalPrice: effectiveOriginal, discount } = getEffectivePrice();

  useEffect(() => {
    if (!open) { abandonedIdRef.current = null; return; }
    const phoneClean = form.customer_phone.replace(/[\s-]/g, '').replace(/^\+?88/, '');
    if (/^01[3-9]\d{8}$/.test(phoneClean) && !abandonedIdRef.current) {
      const timer = setTimeout(async () => {
        try {
          const { data } = await supabase.functions.invoke('save-abandoned-checkout', {
            body: {
              customer_name: form.customer_name || 'Unknown',
              customer_phone: form.customer_phone,
              customer_address: form.customer_address,
              customer_email: form.customer_email || null,
              cart_data: [{ name: product.name, name_bn: product.name_bn, quantity: localQty, price: effectivePrice, image: getColorImage(localColor) || product.images?.[0] || '', size: localSize, color: localColor }],
              subtotal: subtotal,
            },
          });
          if (data?.id) abandonedIdRef.current = data.id;
        } catch (e) {
          console.error('Abandoned checkout save failed:', e);
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [form.customer_phone, open]);

  useEffect(() => {
    if (!abandonedIdRef.current) return;
    const timer = setTimeout(async () => {
      try {
        await supabase.functions.invoke('save-abandoned-checkout', {
          body: {
            id: abandonedIdRef.current,
            customer_phone: form.customer_phone,
            customer_name: form.customer_name || 'Unknown',
            customer_address: form.customer_address || null,
            customer_email: form.customer_email || null,
          },
        });
      } catch (e) {
        console.error('Abandoned checkout update failed:', e);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [form.customer_name, form.customer_address]);

  const [coupon, setCoupon] = useState<{ code: string; discount: number; discount_type: string; discount_value: number } | null>(null);
  const couponDiscount = coupon?.discount || 0;

  const { charges } = useShippingCharges();
  const deliveryOptions = [
    { value: 'dhaka_outside', label: 'সারাদেশে', price: charges.dhaka_outside },
    { value: 'dhaka_suburb', label: 'সাব-এরিয়া', price: charges.dhaka_suburb },
    { value: 'dhaka_inside', label: 'ঢাকা সিটি', price: charges.dhaka_inside },
  ] as const;
  const deliveryCharge = resolveShippingCharge(charges, form.delivery_area);
  const addonTotal = addonChecked && addonConfig?.price ? addonConfig.price : 0;
  const bumpTotal = bumpChecked && bumpProduct ? bumpPrice : 0;
  const subtotal = effectivePrice * localQty + addonTotal + bumpTotal;
  const total = subtotal - couponDiscount + deliveryCharge;

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) {
      toast.error('অনুগ্রহ করে শর্তাবলীতে সম্মতি দিন');
      return;
    }
    if (!form.customer_name || !form.customer_phone || !form.customer_address) {
      toast.error('নাম, ফোন ও ঠিকানা দিন');
      return;
    }
    const phoneClean = form.customer_phone.replace(/[\s-]/g, '').replace(/^\+?88/, '');
    if (!/^01[3-9]\d{8}$/.test(phoneClean)) {
      toast.error('সঠিক ফোন নম্বর দিন');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('place-order', {
        body: {
          orderData: {
            customer_name: form.customer_name,
            customer_phone: form.customer_phone,
            customer_address: form.customer_address,
            delivery_area: form.delivery_area,
            notes: form.notes || null,
            order_origin: getOrderOrigin(),
          },
          items: [
            {
              product_id: product.id,
              product_name: product.name,
              quantity: localQty,
              price: effectivePrice,
              size: localSize || null,
              color: localColor || null,
              item_type: 'normal',
            },
            ...(addonChecked && addonConfig ? [{
              product_id: product.id,
              product_name: `[অ্যাড-অন] ${addonConfig.name_bn || addonConfig.name || 'Add-on'}`,
              quantity: 1,
              price: addonConfig.price || 0,
              size: null,
              color: null,
              item_type: 'addon',
              parent_product_id: product.id,
            }] : []),
            ...(bumpChecked && bumpProduct ? [{
              product_id: bumpProduct.id,
              product_name: `[বাম্প] ${bumpProduct.name_bn || bumpProduct.name}`,
              quantity: 1,
              price: bumpPrice,
              size: null,
              color: null,
              item_type: 'bump',
              parent_product_id: product.id,
            }] : []),
          ],
          abandoned_checkout_id: abandonedIdRef.current || undefined,
          order_attribution: getOrderAttribution(),
          tracking_context: (await import('@/lib/trackingIds')).buildTrackingContext(undefined, (await import('@/lib/consent')).getConsent()),
          ...(coupon?.code ? { coupon_code: coupon.code } : {}),
        },
      });

      // Parse error from non-2xx responses
      if (error) {
        let errorBody: any = null;
        try {
          if (error.context && typeof error.context.json === 'function') {
            errorBody = await error.context.json();
          }
        } catch {
          try {
            if (error.context && typeof error.context.text === 'function') {
              const txt = await error.context.text();
              if (txt) errorBody = JSON.parse(txt);
            }
          } catch {}
        }
        if (errorBody?.error === 'duplicate_order' && errorBody?.existing_order) {
          setDuplicateOrder(errorBody.existing_order);
          setLoading(false);
          return;
        }
        if (errorBody?.error === 'blocked') {
          toast.error('আপনার এই নম্বর থেকে অর্ডার করা সম্ভব নয়।');
          setLoading(false);
          return;
        }
        throw new Error(errorBody?.error || error?.message || 'Order failed');
      }
      if (data?.error === 'duplicate_order' && data?.existing_order) {
        setDuplicateOrder(data.existing_order);
        setLoading(false);
        return;
      }
      if (data?.error === 'blocked') {
        toast.error('আপনার এই নম্বর থেকে অর্ডার করা সম্ভব নয়।');
        setLoading(false);
        return;
      }
      if (data?.error) throw new Error(data.error);

      if (paymentMethod === 'uddoktapay') {
        const { data: payData, error: payError } = await supabase.functions.invoke('uddoktapay-checkout', {
          body: {
            order_id: data.order.id,
            order_number: data.order.order_number,
            amount: total,
            customer_name: form.customer_name,
            customer_email: form.customer_email || undefined,
            customer_phone: form.customer_phone,
          },
        });
        if (payError || payData?.error) {
          toast.error(payData?.error || 'পেমেন্ট শুরু করতে সমস্যা হয়েছে');
          setLoading(false);
          return;
        }
        window.open(payData.payment_url, '_blank');
        return;
      }

      if (paymentMethod === 'bkash') {
        const { data: payData, error: payError } = await supabase.functions.invoke('bkash-checkout', {
          body: { order_id: data.order.id },
        });
        if (payError || payData?.error) {
          toast.error(payData?.error || 'পেমেন্ট শুরু করতে সমস্যা হয়েছে');
          setLoading(false);
          return;
        }
        window.open(payData.payment_url, '_blank');
        return;
      }

      // Tracking in separate try-catch — must NOT block navigation
      try {
        trackPurchase(data.order.order_number, [{ id: product.id, name: product.name, name_bn: product.name_bn, price: effectivePrice, quantity: localQty }], total, deliveryCharge, undefined, {
          customer_name: form.customer_name,
          customer_phone: form.customer_phone,
          customer_address: form.customer_address,
          customer_email: form.customer_email || undefined,
        });
        const nameParts = form.customer_name.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        const phoneNorm = form.customer_phone.replace(/[^\d]/g, '');
        const emailNorm = (form.customer_email || '').trim().toLowerCase();
        trackMetaPurchase(data.order.order_number, [{ id: product.id, quantity: localQty, price: effectivePrice }], total, {
          fn: firstName,
          ln: lastName || undefined,
          ph: phoneNorm || undefined,
          em: emailNorm || undefined,
          client_user_agent: navigator.userAgent,
        });
      } catch (trackErr) {
        console.error('[Tracking] Post-order tracking failed:', trackErr);
      }
      try {
        storeThankYouData({
          orderNumber: data.order.order_number,
          orderId: data.order.id,
          items: [{
            name: product.name_bn || product.name,
            image: getColorImage(localColor) || product.images?.[0],
            qty: localQty,
            price: effectivePrice,
            size: localSize,
            color: localColor,
          }],
          deliveryCharge,
          customerPhone: form.customer_phone,
          customerEmail: form.customer_email || undefined,
        });
      } catch {}
      onOpenChange(false);
      navigate('/thank-you');
    } catch {
      toast.error('অর্ডার দিতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOrderNumber('');
    abandonedIdRef.current = null;
    popupTrackedRef.current = null;
    setForm({ customer_name: '', customer_phone: '', customer_address: '', delivery_area: 'dhaka_outside', notes: '', customer_email: '' });
    onOpenChange(false);
  };

  const handleAddMore = () => {
    addItem({
      id: product.id,
      name: product.name,
      name_bn: product.name_bn,
      price: effectivePrice,
      original_price: effectiveOriginal || undefined,
      image: getColorImage(localColor) || product.images?.[0] || '',
      slug: product.slug,
      size: localSize || undefined,
      color: localColor || undefined,
    });
    toast.success('কার্টে যোগ করা হয়েছে!');
    onOpenChange(false);
    navigate('/shop');
  };

  const productImage = getColorImage(localColor) || product.images?.[0] || '/placeholder.svg';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[85vh] rounded-2xl overflow-hidden p-0 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-accent to-accent/80 text-accent-foreground px-4 py-2.5 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-accent-foreground text-sm">দ্রুত অর্ডার</DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-4 pb-4 pt-2 space-y-3 overflow-y-auto min-h-0 scrollbar-hide">
          {duplicateOrder && (
            <DuplicateOrderBanner
              existingOrder={duplicateOrder}
              onDismiss={() => setDuplicateOrder(null)}
              newItems={[{
                product_name: product.name_bn || product.name,
                quantity: localQty,
                price: effectivePrice,
                size: localSize,
                color: localColor,
              }]}
            />
          )}
          {/* Product info card */}
          <div className="border border-primary/20 rounded-xl p-3 bg-primary/5 space-y-2.5">
            <div className="flex items-center gap-3">
              <div className="w-20 h-28 rounded-lg overflow-hidden bg-muted flex-shrink-0 border-2 border-primary/30 shadow-sm">
                <img src={optimizedImageUrl(productImage, 160, 224)} alt={product.name_bn || product.name} className="w-full h-full object-cover object-top" loading="lazy" />
              </div>
              <div className="flex-1 min-w-0 text-sm">
                <p className="font-semibold text-base line-clamp-2">{product.name_bn || product.name}</p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className="text-primary font-bold text-lg">৳{effectivePrice}</span>
                  {effectiveOriginal && (
                    <span className="text-xs text-muted-foreground line-through">৳{effectiveOriginal}</span>
                  )}
                  {discount > 0 && (
                    <span className="text-[10px] bg-destructive text-destructive-foreground px-1.5 py-px rounded-full font-bold">-{discount}%</span>
                  )}
                </div>
              </div>
            </div>

            {/* Size selection */}
            {availableSizes.length > 0 && (
              <div>
                <Label className="text-xs font-medium mb-1.5 block">সাইজ</Label>
                <div className="flex flex-wrap gap-1.5">
                  {availableSizes.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setLocalSize(s)}
                      className={cn(
                        'px-3 py-1.5 text-xs rounded-full border transition-all font-medium',
                        localSize === s
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border bg-background hover:border-primary/50'
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Color selection */}
            {colors.length > 0 && (
              <div>
                <Label className="text-xs font-medium mb-1.5 block">কালার</Label>
                <div className="grid grid-cols-4 gap-2">
                  {colors.map(c => {
                    const colorImg = getColorPrimaryImage(variantImages?.color_images, c);
                    const isSelected = localColor === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setLocalColor(c)}
                        className={cn(
                          'flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all',
                          isSelected
                            ? 'border-primary bg-primary/5 shadow-[0_0_0_3px_hsl(var(--primary)/0.15)]'
                            : 'border-border bg-background hover:border-primary/40 hover:bg-muted/40'
                        )}
                      >
                        <div className="relative">
                          {colorImg ? (
                            <img
                              src={optimizedImageUrl(colorImg, 100, 132)}
                              alt={c}
                              className={cn('w-14 h-[4.5rem] rounded-lg object-cover object-top border-2', isSelected ? 'border-primary' : 'border-border')}
                              loading="lazy"
                            />
                          ) : (
                            <div className={cn(
                              'w-14 h-[4.5rem] rounded-lg flex items-center justify-center text-sm font-bold border-2',
                              isSelected ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted text-muted-foreground'
                            )}>
                              {c.charAt(0)}
                            </div>
                          )}
                          {isSelected && (
                            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center ring-2 ring-background">
                              <CheckCircle className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                        <span className={cn('text-[11px] font-medium text-center leading-tight line-clamp-1 w-full', isSelected ? 'text-primary' : 'text-foreground')}>
                          {c}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity control */}
            <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
              <Label className="text-xs font-medium">পরিমাণ</Label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLocalQty(q => Math.max(1, q - 1))}
                  className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-8 text-center text-sm font-bold">{localQty}</span>
                <button
                  type="button"
                  onClick={() => setLocalQty(q => q + 1)}
                  className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Addon checkbox */}
          {addonConfig && addonConfig.name && (
            <label className="flex items-start gap-2.5 border border-accent/30 bg-accent/5 rounded-xl p-2.5 cursor-pointer hover:bg-accent/10 transition-colors">
              <Checkbox checked={addonChecked} onCheckedChange={(v) => setAddonChecked(!!v)} className="mt-0.5" />
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {addonConfig.image && (
                  <img src={optimizedImageUrl(addonConfig.image, 80, 70)} alt={addonConfig.name_bn || addonConfig.name} className="w-10 h-10 rounded object-cover border border-border flex-shrink-0" loading="lazy" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium line-clamp-1">{addonConfig.name_bn || addonConfig.name}</p>
                  <p className="text-xs text-primary font-bold">৳{addonConfig.price}</p>
                </div>
              </div>
            </label>
          )}

          {/* Bump product card */}
          {bumpProduct && (
            <label className="flex items-start gap-2.5 border border-accent/30 bg-accent/5 rounded-xl p-2.5 cursor-pointer hover:bg-accent/10 transition-colors">
              <Checkbox checked={bumpChecked} onCheckedChange={(v) => setBumpChecked(!!v)} className="mt-0.5" />
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {bumpProduct.images?.[0] && (
                  <img src={optimizedImageUrl(bumpProduct.images[0], 80, 70)} alt={bumpProduct.name_bn || bumpProduct.name} className="w-10 h-10 rounded object-cover border border-border flex-shrink-0" loading="lazy" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <Gift className="h-3 w-3 text-accent" />
                    <span className="text-[10px] text-accent font-semibold">এটিও নিন</span>
                  </div>
                  <p className="text-xs font-medium line-clamp-1">{bumpProduct.name_bn || bumpProduct.name}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-primary font-bold">৳{bumpPrice}</span>
                    {bumpDiscount > 0 && (
                      <span className="text-[10px] text-muted-foreground line-through">৳{bumpProduct.price}</span>
                    )}
                  </div>
                </div>
              </div>
            </label>
          )}

          <button
            type="button"
            onClick={handleAddMore}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-primary font-medium py-2 border border-dashed border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            আরও প্রোডাক্ট যোগ করুন
          </button>

          {/* Customer info card */}
          <div className="border border-border rounded-xl p-3 space-y-2.5">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">📋 আপনার তথ্য</h3>
            <form onSubmit={handleSubmit} id="quick-order-form" className="space-y-2.5">
              <div>
                <Label className="text-xs font-medium flex items-center gap-1.5 mb-1">👤 নাম *</Label>
                <Input value={form.customer_name} onChange={e => update('customer_name', e.target.value)} placeholder="আপনার পূর্ণ নাম" required autoComplete="name" className="rounded-lg h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs font-medium flex items-center gap-1.5 mb-1">📞 ফোন *</Label>
                <Input value={form.customer_phone} onChange={e => update('customer_phone', e.target.value)} placeholder="01XXXXXXXXX" required autoComplete="tel" className="rounded-lg h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs font-medium flex items-center gap-1.5 mb-1">📍 ঠিকানা *</Label>
                <Textarea value={form.customer_address} onChange={e => update('customer_address', e.target.value)} placeholder="বিস্তারিত ঠিকানা" required autoComplete="street-address" className="rounded-lg min-h-[55px] text-sm" rows={2} />
              </div>
              <div>
                <Label className="text-xs font-medium flex items-center gap-1.5 mb-1">📧 ইমেইল (ঐচ্ছিক)</Label>
                <Input type="email" value={form.customer_email} onChange={e => update('customer_email', e.target.value)} placeholder="example@gmail.com" autoComplete="email" className="rounded-lg h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs font-medium flex items-center gap-1.5 mb-1">📝 নোট (ঐচ্ছিক)</Label>
                <Input value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="বিশেষ নির্দেশনা..." className="rounded-lg h-9 text-sm" />
              </div>
            </form>
          </div>

          {/* Order Summary card */}
          <div className="border border-border rounded-xl p-3 space-y-3 bg-muted/30">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">🛍️ অর্ডার সামারি</h3>

            {/* Selected variant summary */}
            <div className="text-xs space-y-1 bg-background rounded-lg p-2 border border-border">
              <div className="flex items-start gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <span className="font-medium">{product.name_bn || product.name}</span>
                  <div className="text-muted-foreground mt-0.5">
                    {localColor && <span>{localColor}</span>}
                    {localColor && localSize && <span> • </span>}
                    {localSize && <span>{localSize}</span>}
                    <span> — ৳{effectivePrice} × {localQty}</span>
                  </div>
                </div>
                <span className="font-bold text-primary">৳{subtotal}</span>
              </div>
            </div>

            {/* Delivery Charge */}
            <div>
              <Label className="text-xs font-medium flex items-center gap-1.5 mb-1.5">🚚 ডেলিভারি চার্জ</Label>
              <RadioGroup
                value={form.delivery_area}
                onValueChange={(val) => update('delivery_area', val)}
                className="space-y-0"
              >
                {deliveryOptions.map((opt, idx) => (
                  <label
                    key={opt.value}
                    className={cn(
                      'flex items-center gap-2.5 px-2.5 py-2 cursor-pointer transition-colors rounded-md',
                      form.delivery_area === opt.value ? 'bg-accent/5' : 'hover:bg-muted/50',
                      idx < deliveryOptions.length - 1 && 'border-b border-border'
                    )}
                  >
                    <RadioGroupItem value={opt.value} />
                    <span className="flex-1 text-xs font-medium">{opt.label}</span>
                    <span className={cn(
                      'text-xs font-bold',
                      form.delivery_area === opt.value ? 'text-primary' : 'text-muted-foreground'
                    )}>৳{opt.price}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>

            {/* Payment Method */}
            <div>
              <Label className="text-xs font-medium flex items-center gap-1.5 mb-1.5">💳 পেমেন্ট</Label>
              <div className={cn(
                "grid gap-2",
                enabledPaymentMethods.length >= 3 ? "grid-cols-3" : "grid-cols-2"
              )}>
                {enabledPaymentMethods.map((method) => {
                  const Icon = method.icon;
                  const isSelected = paymentMethod === method.id;
                  const brand = method.brand;
                  const watermarkColor = brand ? brand.accentText : 'text-accent';
                  const disabled = !!method.comingSoon;
                  return (
                    <button
                      key={method.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => { if (!disabled) setPaymentMethod(method.id); }}
                      aria-disabled={disabled}
                      className={cn(
                        "flex flex-col items-center gap-1 p-2 border-2 rounded-xl relative transition-all overflow-hidden",
                        disabled
                          ? "opacity-60 cursor-not-allowed border-border"
                          : isSelected
                            ? (brand ? brand.selectedBorder : 'border-accent bg-accent/5')
                            : 'border-border hover:border-accent/30',
                        !disabled && (brand ? 'animate-pm-card-glow-pink' : 'animate-pm-card-glow-primary')
                      )}
                    >
                      {/* Watermark icon — fills the card's empty space */}
                      <Icon className={cn("absolute -right-1.5 -bottom-1.5 h-9 w-9 rotate-[-15deg] opacity-[0.08] pointer-events-none", watermarkColor)} />

                      {disabled && (
                        <span className="absolute top-0.5 left-1/2 -translate-x-1/2 z-10 text-[7px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border whitespace-nowrap">
                          শীঘ্রই
                        </span>
                      )}

                      {isSelected && !disabled && <CheckCircle className={cn("absolute top-1 right-1 h-3 w-3 z-10", brand ? brand.accentText : 'text-accent')} />}
                      <div className={cn(
                        "relative z-10 w-8 h-8 rounded-full flex items-center justify-center mt-1.5",
                        brand ? brand.iconBg : 'bg-accent/10',
                        !disabled && brand?.glowClassName
                      )}>
                        <Icon className={cn("h-4 w-4", brand ? brand.iconColor : 'text-accent')} />
                      </div>
                      <span className="relative z-10 text-[11px] font-semibold">{method.labelBn}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Free Shipping Progress */}
            <FreeShippingProgress
              items={[
                { id: product.id, quantity: localQty, price: effectivePrice },
                ...(addonChecked && addonConfig?.price ? [{ id: `${product.id}-addon`, quantity: 1, price: addonConfig.price }] : []),
                ...(bumpChecked && bumpProduct ? [{ id: bumpProduct.id, quantity: 1, price: bumpPrice }] : []),
              ]}
              variant="banner"
              celebrate={false}
              className="mt-1"
            />

            {/* Coupon */}
            <div className="pt-1">
              <CouponApply subtotal={subtotal} onApply={setCoupon} applied={coupon} />
            </div>

            {/* Totals */}
            <div className="border-t border-border pt-2.5 text-sm space-y-1">
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">সাবটোটাল</span><span>৳{subtotal}</span></div>
              {couponDiscount > 0 && (
                <div className="flex justify-between text-xs text-primary"><span>কুপন ছাড়</span><span className="font-medium">-৳{couponDiscount}</span></div>
              )}
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">ডেলিভারি</span><span className="text-primary font-medium">৳{deliveryCharge}</span></div>
              <div className="flex justify-between font-bold text-sm pt-1 border-t border-border"><span>🧾 সর্বমোট</span><span className="text-primary">৳{total}</span></div>
            </div>
          </div>

          <PolicyAgreement checked={agreed} onChange={setAgreed} />

          <Button form="quick-order-form" type="submit" className="w-full rounded-full h-10 text-sm font-semibold" disabled={loading || !agreed}>
            {loading ? 'প্রসেস হচ্ছে...' : (paymentMethod === 'uddoktapay' || paymentMethod === 'bkash') ? 'পেমেন্ট করুন' : 'অর্ডার কনফার্ম করুন'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
