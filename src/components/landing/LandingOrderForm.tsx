import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { trackViewItem, trackBeginCheckout, trackPurchase } from '@/lib/ecommerceTracking';
import { trackMetaViewContent, trackMetaInitiateCheckout, trackMetaPurchase, trackMetaAddToCart, trackMetaAddPaymentInfo, trackMetaEvent } from '@/lib/metaTracking';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { estimateReviewCount } from '@/lib/reviewCount';
import { getColorPrimaryImage } from '@/lib/productVariants';
import { storeThankYouData } from '@/pages/ThankYou';
import CouponApply from '@/components/checkout/CouponApply';
import DuplicateOrderBanner from '@/components/checkout/DuplicateOrderBanner';
import { Plus, Minus, X, Check, Star } from 'lucide-react';
import { useProductSalesCounts } from '@/hooks/useProducts';
import { getOrderOrigin, getOrderAttribution } from '@/hooks/useUtmCapture';
import { useShippingCharges } from '@/hooks/useShippingCharges';

interface OrderItem {
  productId: string;
  color: string;
  size: string;
  qty: number;
  selected: boolean;
}

interface ProductOverride {
  card_style?: 'compact' | 'detailed';
  hidden_sizes?: string[];
}

interface Props {
  products: any[];
  heading?: string;
  submitText?: string;
  submitColor?: string;
  showEmail?: boolean;
  showOrderNote?: boolean;
  namePlaceholder?: string;
  phonePlaceholder?: string;
  addressPlaceholder?: string;
  headingColor?: string;
  headingSize?: 'sm' | 'md' | 'lg';
  labelColor?: string;
  inputBorderColor?: string;
  inputBgColor?: string;
  totalColor?: string;
  highlightColor?: string;
  submitTextColor?: string;
  submitRounded?: boolean;
  cardBorderColor?: string;
  showCardShadow?: boolean;
  landingPageId?: string;
  itemLabel?: string;
  deliveryAreaOrder?: string[];
  defaultDeliveryArea?: string;
  productOverrides?: Record<string, ProductOverride>;
}

const PHONE_RE = /^01[3-9]\d{8}$/;

function getProductPricing(product: any, size?: string) {
  const rawPrice = product.price || 0;
  const isSale = product.original_price && product.original_price > 0 && product.original_price < rawPrice;
  let price = isSale ? product.original_price : rawPrice;
  let regularPrice: number | null = isSale ? rawPrice : null;

  // Size-specific price overrides
  if (size) {
    const sd = (product.variant_images as any)?.size_data?.[size];
    if (sd) {
      if (sd.sale_price && sd.sale_price > 0) {
        price = sd.sale_price;
        regularPrice = sd.price || rawPrice;
      } else if (sd.price && sd.price > 0) {
        if (isSale) {
          regularPrice = sd.price;
          price = product.original_price;
        } else {
          price = sd.price;
          regularPrice = null;
        }
      }
    }
  }

  const discount = regularPrice && regularPrice > price
    ? Math.round(((regularPrice - price) / regularPrice) * 100) : 0;
  return { price, regularPrice, discount };
}

function filterHiddenSizes(sizes: string[], hiddenSizes: string[], color?: string): string[] {
  if (!hiddenSizes || hiddenSizes.length === 0) return sizes;
  return sizes.filter(s => {
    if (color && hiddenSizes.includes(`${color}:${s}`)) return false;
    // Plain size name (no colon in the hidden entry) hides from all colors
    if (hiddenSizes.some(h => h === s && !h.includes(':'))) return false;
    return true;
  });
}

function getColorSizes(product: any, color: string, hiddenSizes?: string[]): string[] {
  const vi = product.variant_images as any;
  const colorSizes = vi?.color_sizes;
  let sizes: string[];
  if (colorSizes && colorSizes[color]) {
    sizes = colorSizes[color];
  } else {
    sizes = product.sizes || [];
  }
  sizes = filterHiddenSizes(sizes, hiddenSizes || [], color);
  return sizes;
}

function getProductColors(product: any): string[] {
  if (Array.isArray(product?.colors) && product.colors.length > 0) return product.colors;
  const vi = product?.variant_images as any;
  const fromImages = vi?.color_images && typeof vi.color_images === 'object' ? Object.keys(vi.color_images) : [];
  const fromSizes = vi?.color_sizes && typeof vi.color_sizes === 'object' ? Object.keys(vi.color_sizes) : [];
  return Array.from(new Set([...fromImages, ...fromSizes])).filter(Boolean);
}

function buildInitialItems(products: any[], overrides?: Record<string, ProductOverride>): OrderItem[] {
  const items: OrderItem[] = [];
  products.forEach((p, pIdx) => {
    const colors: string[] = getProductColors(p);
    const override = overrides?.[p.id];
    const cardStyle = override?.card_style || 'compact';
    const hiddenSizes = override?.hidden_sizes || [];

    if (cardStyle === 'detailed') {
      // One card per product, first color selected
      const firstColor = colors[0] || '';
      const availSizes = firstColor ? getColorSizes(p, firstColor, hiddenSizes) : filterHiddenSizes(p.sizes || [], hiddenSizes);
      items.push({
        productId: p.id,
        color: firstColor,
        size: availSizes[0] || '',
        qty: 1,
        selected: pIdx === 0,
      });
    } else {
      // Compact: one card per color
      if (colors.length > 0) {
        colors.forEach((c, cIdx) => {
          const availSizes = getColorSizes(p, c, hiddenSizes);
          items.push({
            productId: p.id,
            color: c,
            size: availSizes[0] || '',
            qty: 1,
            selected: pIdx === 0 && cIdx === 0,
          });
        });
      } else {
        const availSizes = filterHiddenSizes(p.sizes || [], hiddenSizes);
        items.push({
          productId: p.id,
          color: '',
          size: availSizes[0] || '',
          qty: 1,
          selected: pIdx === 0,
        });
      }
    }
  });
  return items;
}

export default function LandingOrderForm({
  products, heading, submitText, submitColor,
  showEmail, showOrderNote,
  namePlaceholder, phonePlaceholder, addressPlaceholder,
  headingColor, headingSize = 'md', labelColor, inputBorderColor, inputBgColor,
  totalColor, highlightColor, submitTextColor, submitRounded = true,
  cardBorderColor, showCardShadow = true,
  landingPageId, itemLabel, deliveryAreaOrder, defaultDeliveryArea,
  productOverrides,
}: Props) {
  const lpNavigate = useNavigate();
  const defaultProduct = products[0];
  const accent = highlightColor || '#429B39';
  const priceColor = totalColor || '#429B39';
  const { data: salesMap } = useProductSalesCounts();

  const getRatingInfo = (productId: string) => {
    const totalSold = salesMap?.get(productId) || 0;
    if (totalSold <= 0) return null;
    const reviewCount = estimateReviewCount(totalSold);
    const hash = parseInt(productId.replace(/-/g, '').slice(0, 8), 16);
    const rating = (4.5 + (hash % 6) / 10).toFixed(1);
    return { rating, reviewCount };
  };

  // Always the live, admin-configured rate — a landing page used to be able to freeze its own
  // snapshot here, which silently went stale the moment the global rate changed after the page
  // was last saved (found 13 of 15 pages stuck on months-old numbers). There's no legitimate
  // per-page override UI, so there's nothing to preserve by keeping that path.
  const { charges } = useShippingCharges();

  const [items, setItems] = useState<OrderItem[]>(() => buildInitialItems(products, productOverrides));
  const [form, setForm] = useState({ customer_name: '', customer_phone: '', customer_address: '', delivery_area: defaultDeliveryArea || 'dhaka_outside', email: '', order_note: '' });
  const [loading, setLoading] = useState(false);
  const [coupon, setCoupon] = useState<{ code: string; discount: number; discount_type: string; discount_value: number } | null>(null);
  const [duplicateOrder, setDuplicateOrder] = useState<any>(null);
  const couponDiscount = coupon?.discount || 0;

  const landingFired = useRef(false);
  const addToCartFired = useRef<Set<string>>(new Set());
  const leadFired = useRef(false);
  const paymentInfoFired = useRef(false);

  useEffect(() => {
    if (!landingFired.current) {
      landingFired.current = true;
      const p = defaultProduct;
      const { price } = getProductPricing(p);
      trackViewItem({ id: p.id, name: p.name, name_bn: p.name_bn, price });
      trackMetaViewContent(p);
      trackBeginCheckout([{ id: p.id, name: p.name, price, quantity: 1 }], price);
      trackMetaInitiateCheckout([{ id: p.id, quantity: 1 }], price);
    }
  }, []);

  // Lead event: fire once when phone becomes valid (11-digit BD number)
  useEffect(() => {
    if (leadFired.current) return;
    const phoneClean = form.customer_phone.replace(/[\s-]/g, '').replace(/^\+?88/, '');
    if (PHONE_RE.test(phoneClean)) {
      leadFired.current = true;
      trackMetaEvent('Lead', { currency: 'BDT', value: subtotal }, {
        ph: phoneClean,
        fn: form.customer_name || undefined,
      });
    }
  }, [form.customer_phone]);


  const getProduct = (id: string) => products.find((p: any) => p.id === id) || defaultProduct;
  const getOverride = (id: string): ProductOverride => productOverrides?.[id] || {};

  const deliveryCharge = form.delivery_area === 'dhaka_inside' ? charges.dhaka_inside : form.delivery_area === 'dhaka_suburb' ? charges.dhaka_suburb : charges.dhaka_outside;
  const selectedItems = items.filter(it => it.selected);
  const subtotal = selectedItems.reduce((sum, it) => {
    const { price } = getProductPricing(getProduct(it.productId), it.size);
    return sum + it.qty * price;
  }, 0);
  const total = subtotal - couponDiscount + deliveryCharge;

  const updateItem = (idx: number, patch: Partial<OrderItem>) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const updated = { ...it, ...patch };
      // Fire AddToCart when item becomes selected (once per item key)
      if (patch.selected === true && !it.selected) {
        const key = `${updated.productId}_${updated.color}_${updated.size}`;
        if (!addToCartFired.current.has(key)) {
          addToCartFired.current.add(key);
          const prod = getProduct(updated.productId);
          const { price } = getProductPricing(prod, updated.size);
          trackMetaAddToCart({ id: prod.id, name: prod.name_bn || prod.name, price }, updated.qty);
        }
      }
      return updated;
    }));
  };

  const [showProductPicker, setShowProductPicker] = useState(false);
  const [colorPickerProduct, setColorPickerProduct] = useState<any>(null);

  const addSingleColorItem = (p: any, color: string) => {
    const override = getOverride(p.id);
    const hiddenSizes = override?.hidden_sizes || [];
    const availSizes = color ? getColorSizes(p, color, hiddenSizes) : filterHiddenSizes(p.sizes || [], hiddenSizes);
    setItems(prev => [...prev, { productId: p.id, color, size: availSizes[0] || '', qty: 1, selected: false }]);
  };

  const addItemForProduct = (p: any) => {
    const colors: string[] = getProductColors(p);
    const override = getOverride(p.id);
    const cardStyle = override?.card_style || 'compact';
    const hiddenSizes = override?.hidden_sizes || [];

    if (cardStyle === 'detailed') {
      const firstColor = colors[0] || '';
      const availSizes = firstColor ? getColorSizes(p, firstColor, hiddenSizes) : filterHiddenSizes(p.sizes || [], hiddenSizes);
      setItems(prev => [...prev, { productId: p.id, color: firstColor, size: availSizes[0] || '', qty: 1, selected: false }]);
    } else {
      if (colors.length > 1) {
        // Show color picker instead of adding all colors
        setColorPickerProduct(p);
      } else {
        const color = colors[0] || '';
        addSingleColorItem(p, color);
      }
    }
  };

  const addItem = () => {
    if (products.length <= 1) {
      addItemForProduct(defaultProduct);
    } else {
      setShowProductPicker(true);
    }
  };
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const inputStyle: React.CSSProperties = {
    ...(inputBorderColor ? { borderColor: inputBorderColor } : {}),
    ...(inputBgColor ? { backgroundColor: inputBgColor } : {}),
  };
  const labelStyle: React.CSSProperties = labelColor ? { color: labelColor } : {};
  const cardStyleObj: React.CSSProperties = {
    ...(cardBorderColor ? { borderColor: cardBorderColor } : {}),
  };
  const headingSizeClass = headingSize === 'sm' ? 'text-lg sm:text-xl' : headingSize === 'lg' ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { customer_name, customer_phone, customer_address } = form;

    if (!customer_name || customer_name.length < 3) { toast.error('নাম কমপক্ষে ৩ অক্ষর হতে হবে'); return; }
    const phoneClean = customer_phone.replace(/[\s-]/g, '').replace(/^\+?88/, '');
    if (!PHONE_RE.test(phoneClean)) { toast.error('সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)'); return; }
    if (!customer_address || customer_address.length < 10) { toast.error('সম্পূর্ণ ঠিকানা দিন (কমপক্ষে ১০ অক্ষর)'); return; }

    if (selectedItems.length === 0) { toast.error('কমপক্ষে ১টি আইটেম সিলেক্ট করুন'); return; }

    for (let i = 0; i < selectedItems.length; i++) {
      const prod = getProduct(selectedItems[i].productId);
      const hiddenSizes = getOverride(selectedItems[i].productId).hidden_sizes || [];
      const availSizes = selectedItems[i].color ? getColorSizes(prod, selectedItems[i].color, hiddenSizes) : filterHiddenSizes(prod.sizes || [], hiddenSizes);
      if (availSizes.length > 0 && !selectedItems[i].size) { toast.error(`${itemLabel || 'আইটেম'} ${i + 1}: সাইজ সিলেক্ট করুন`); return; }
    }

    setLoading(true);
    try {
      const orderItems = selectedItems.map(it => {
        const prod = getProduct(it.productId);
        const { price } = getProductPricing(prod, it.size);
        return {
          product_id: prod.id,
          product_name: prod.name_bn || prod.name || 'Product',
          quantity: it.qty,
          price,
          size: it.size || null,
          color: it.color || null,
        };
      });

      const { buildTrackingContext } = await import('@/lib/trackingIds');
      const { getConsent } = await import('@/lib/consent');
      const tracking_context = buildTrackingContext(undefined, getConsent());
      const { data, error } = await supabase.functions.invoke('place-order', {
        body: { orderData: { ...form, order_origin: getOrderOrigin(), ...(landingPageId ? { source_landing_page_id: landingPageId } : {}) }, items: orderItems, order_attribution: getOrderAttribution(), tracking_context, ...(coupon?.code ? { coupon_code: coupon.code } : {}) },
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

      // Tracking in separate try-catch — must NOT block navigation
      try {
        trackPurchase(data.order.order_number, orderItems.map(oi => ({ id: oi.product_id, name: oi.product_name, price: oi.price, quantity: oi.quantity })), total, deliveryCharge, undefined, {
          customer_name: form.customer_name,
          customer_phone: form.customer_phone,
          customer_address: form.customer_address,
        });
        trackMetaPurchase(data.order.order_number, orderItems.map(oi => ({ id: oi.product_id, quantity: oi.quantity, price: oi.price })), total, {
          ph: form.customer_phone,
          em: form.email || undefined,
          fn: form.customer_name || undefined,
          client_user_agent: navigator.userAgent,
        });
      } catch (trackErr) {
        console.error('[Tracking] Post-order tracking failed:', trackErr);
      }
      try {
        storeThankYouData({
          orderNumber: data.order.order_number,
          orderId: data.order.id,
          items: selectedItems.map(it => {
            const prod = getProduct(it.productId);
            const { price } = getProductPricing(prod, it.size);
            return {
              name: prod.name_bn || prod.name || 'Product',
              image: prod.images?.[0],
              qty: it.qty,
              price,
              size: it.size,
              color: it.color,
            };
          }),
          deliveryCharge,
          customerPhone: form.customer_phone,
          customerEmail: form.email || undefined,
        });
      } catch {}
      lpNavigate('/thank-you');
    } catch {
      toast.error('অর্ডার দিতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  };

  // Render a compact card (one card per color variant)
  const renderCompactCard = (item: OrderItem, idx: number) => {
    const currentProduct = getProduct(item.productId);
    const override = getOverride(item.productId);
    const hiddenSizes = override.hidden_sizes || [];
    const colorImage = getColorPrimaryImage((currentProduct.variant_images as any)?.color_images, item.color);
    const displayImage = colorImage || currentProduct.images?.[0];
    const availSizes = item.color ? getColorSizes(currentProduct, item.color, hiddenSizes) : filterHiddenSizes(currentProduct.sizes || [], hiddenSizes);
    const { price, regularPrice } = getProductPricing(currentProduct, item.size);

    return (
      <div
        key={idx}
        className={cn('bg-card rounded-xl border p-2.5 sm:p-3 relative transition-all', showCardShadow && 'shadow-sm')}
        style={cardStyleObj}
      >

        <div className="flex items-center gap-3 cursor-pointer" onClick={() => updateItem(idx, { selected: !item.selected })}>
          <div className={cn('w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors', item.selected ? 'border-transparent' : 'border-border')} style={item.selected ? { backgroundColor: accent, borderColor: accent } : {}}>
            {item.selected && <Check className="h-3 w-3 text-white" />}
          </div>
          {displayImage && (
            <img src={displayImage} alt={item.color || currentProduct.name_bn || currentProduct.name} className="w-16 h-20 object-cover rounded-lg shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            {item.color && (
              <span
                className="inline-flex items-center gap-1 text-sm font-extrabold px-2.5 py-1 rounded-full mb-1 shadow-sm ring-2 ring-white/40"
                style={{ backgroundColor: accent, color: '#fff' }}
              >
                <span className="inline-block w-2 h-2 rounded-full bg-white/90" />
                {item.color}
              </span>
            )}
            <p className="text-xs text-muted-foreground truncate">{currentProduct.name_bn || currentProduct.name}</p>
            <p className="text-sm font-semibold mt-0.5 flex items-center gap-1.5 flex-wrap">
              {regularPrice ? (
                <><span className="line-through text-muted-foreground">৳{regularPrice}</span> <span style={{ color: accent }}>৳{price}</span></>
              ) : (
                <span>৳{price}</span>
              )}
              {(() => { const r = getRatingInfo(item.productId); return r ? (<><span className="text-muted-foreground/40">|</span><Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" /><span className="text-[11px] font-bold text-foreground">{r.rating}</span><span className="text-[10px] text-muted-foreground">({r.reviewCount})</span></>) : null; })()}
            </p>
          </div>
        </div>

        <div className="space-y-2 mt-2">
          {availSizes.length > 0 && (
            <div>
              <Label className="text-xs font-semibold mb-1 block" style={labelStyle}>সাইজ সিলেক্ট করুন</Label>
              <div className="flex flex-wrap gap-1.5">
                {availSizes.map((s: string) => (
                  <button key={s} type="button" onClick={() => updateItem(idx, { size: s })} className={cn('min-w-[38px] h-8 px-2.5 rounded-lg border-2 font-semibold text-xs transition-all', item.size === s ? 'text-white' : 'border-border text-foreground')} style={item.size === s ? { backgroundColor: accent, borderColor: accent } : {}}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <Label className="text-xs font-semibold mb-1 block" style={labelStyle}>পরিমাণ</Label>
            <div className="flex items-center gap-0 border border-border rounded-lg w-fit" style={inputBorderColor ? { borderColor: inputBorderColor } : {}}>
              <button type="button" onClick={() => updateItem(idx, { qty: Math.max(1, item.qty - 1) })} className="w-8 h-8 flex items-center justify-center hover:bg-muted rounded-l-lg"><Minus className="h-3 w-3" /></button>
              <span className="w-8 h-8 flex items-center justify-center font-semibold text-xs border-x border-border">{item.qty}</span>
              <button type="button" onClick={() => updateItem(idx, { qty: Math.min(10, item.qty + 1) })} className="w-8 h-8 flex items-center justify-center hover:bg-muted rounded-r-lg"><Plus className="h-3 w-3" /></button>
            </div>
            <p className="text-xs mt-0.5 text-muted-foreground">
              ৳{price} × {item.qty} = <span style={{ color: accent }} className="font-semibold">৳{price * item.qty}</span>
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Render a detailed card (one card per product, color selector inside)
  const renderDetailedCard = (item: OrderItem, idx: number) => {
    const currentProduct = getProduct(item.productId);
    const override = getOverride(item.productId);
    const hiddenSizes = override.hidden_sizes || [];
    const colors: string[] = getProductColors(currentProduct);
    const colorImage = getColorPrimaryImage((currentProduct.variant_images as any)?.color_images, item.color);
    const displayImage = colorImage || currentProduct.images?.[0];
    const availSizes = item.color ? getColorSizes(currentProduct, item.color, hiddenSizes) : filterHiddenSizes(currentProduct.sizes || [], hiddenSizes);
    const { price, regularPrice } = getProductPricing(currentProduct, item.size);

    return (
      <div
        key={idx}
        className={cn('bg-card rounded-xl border p-3 sm:p-4 relative transition-all', showCardShadow && 'shadow-sm')}
        style={cardStyleObj}
      >

        {/* Header with checkbox + product name */}
        <div className="flex items-center gap-3 cursor-pointer mb-3" onClick={() => updateItem(idx, { selected: !item.selected })}>
          <div className={cn('w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors', item.selected ? 'border-transparent' : 'border-border')} style={item.selected ? { backgroundColor: accent, borderColor: accent } : {}}>
            {item.selected && <Check className="h-3 w-3 text-white" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold" style={{ color: accent }}>{currentProduct.name_bn || currentProduct.name}</p>
            <p className="text-sm font-semibold mt-0.5 flex items-center gap-1.5 flex-wrap">
              {regularPrice ? (
                <><span className="line-through text-muted-foreground">৳{regularPrice}</span> <span style={{ color: accent }}>৳{price}</span></>
              ) : (
                <span>৳{price}</span>
              )}
              {(() => { const r = getRatingInfo(item.productId); return r ? (<><span className="text-muted-foreground/40">|</span><Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" /><span className="text-[11px] font-bold text-foreground">{r.rating}</span><span className="text-[10px] text-muted-foreground">({r.reviewCount})</span></>) : null; })()}
            </p>
          </div>
        </div>

        {/* Color selector with thumbnail images */}
        {colors.length > 0 && (
          <div className="mb-3">
            <Label className="text-xs font-semibold mb-1.5 block" style={labelStyle}>কালার সিলেক্ট করুন</Label>
            <div className="flex flex-wrap gap-2">
              {colors.map((c) => {
                const cImg = variantImages[c] || currentProduct.images?.[0];
                const isActive = item.color === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      const newSizes = getColorSizes(currentProduct, c, hiddenSizes);
                      updateItem(idx, { color: c, size: newSizes[0] || '' });
                    }}
                    className={cn(
                      'flex flex-col items-center gap-1 p-1.5 rounded-lg border-2 transition-all min-w-[60px]',
                      isActive ? 'border-transparent shadow-md scale-105' : 'border-border hover:border-primary/40'
                    )}
                    style={isActive ? { borderColor: accent } : {}}
                  >
                    {cImg && (
                      <img src={cImg} alt={c} className="w-12 h-14 object-cover rounded-md" />
                    )}
                    <span className={cn('text-[10px] font-medium', isActive ? 'font-bold' : 'text-muted-foreground')} style={isActive ? { color: accent } : {}}>
                      {c}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Size selector */}
        {availSizes.length > 0 && (
          <div className="mb-3">
            <Label className="text-xs font-semibold mb-1 block" style={labelStyle}>সাইজ সিলেক্ট করুন</Label>
            <div className="flex flex-wrap gap-1.5">
              {availSizes.map((s: string) => (
                <button key={s} type="button" onClick={() => updateItem(idx, { size: s })} className={cn('min-w-[38px] h-8 px-2.5 rounded-lg border-2 font-semibold text-xs transition-all', item.size === s ? 'text-white' : 'border-border text-foreground')} style={item.size === s ? { backgroundColor: accent, borderColor: accent } : {}}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quantity */}
        <div>
          <Label className="text-xs font-semibold mb-1 block" style={labelStyle}>পরিমাণ</Label>
          <div className="flex items-center gap-0 border border-border rounded-lg w-fit" style={inputBorderColor ? { borderColor: inputBorderColor } : {}}>
            <button type="button" onClick={() => updateItem(idx, { qty: Math.max(1, item.qty - 1) })} className="w-8 h-8 flex items-center justify-center hover:bg-muted rounded-l-lg"><Minus className="h-3 w-3" /></button>
            <span className="w-8 h-8 flex items-center justify-center font-semibold text-xs border-x border-border">{item.qty}</span>
            <button type="button" onClick={() => updateItem(idx, { qty: Math.min(10, item.qty + 1) })} className="w-8 h-8 flex items-center justify-center hover:bg-muted rounded-r-lg"><Plus className="h-3 w-3" /></button>
          </div>
          <p className="text-xs mt-0.5 text-muted-foreground">
            ৳{price} × {item.qty} = <span style={{ color: accent }} className="font-semibold">৳{price * item.qty}</span>
          </p>
        </div>
      </div>
    );
  };

  return (
    <section id="order-form" className="py-8 sm:py-12 px-4">
      <div className="max-w-xl mx-auto">
        <h2 className={cn('font-bold text-center mb-6', headingSizeClass)} style={headingColor ? { color: headingColor } : {}}>
          {heading || 'অর্ডার করুন'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ── Product Section ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-bold px-3 py-1 rounded-full" style={{ backgroundColor: `${accent}20`, color: accent }}>🛍️ পণ্য বাছাই করুন</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="space-y-3">
              {items.map((item, idx) => {
                const cardStyle = getOverride(item.productId).card_style || 'compact';
                return cardStyle === 'detailed'
                  ? renderDetailedCard(item, idx)
                  : renderCompactCard(item, idx);
              })}

              <button type="button" onClick={addItem} className="w-full py-2.5 border-2 border-dashed border-border rounded-xl text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                + আরও একটি আইটেম যোগ করুন
              </button>

              {/* Product Picker */}
              {showProductPicker && products.length > 1 && (
                <div className="border border-border rounded-xl p-3 bg-card space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">কোন পণ্যটি যোগ করতে চান?</p>
                  <div className="grid grid-cols-1 gap-2">
                    {products.map((p: any) => {
                      const pImg = p.images?.[0];
                      const hasSale = p.original_price && p.original_price > 0 && p.original_price < p.price;
                      const displayPrice = hasSale ? p.original_price : p.price;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => { addItemForProduct(p); setShowProductPicker(false); }}
                          className="flex items-center gap-3 p-2 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-all text-left"
                        >
                          {pImg && <img src={pImg} alt="" className="w-10 h-12 object-cover rounded-md shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{p.name_bn || p.name}</p>
                            <p className="text-xs font-bold" style={{ color: accent }}>
                              {hasSale && <span className="line-through text-muted-foreground mr-1">৳{p.price}</span>}
                              ৳{displayPrice}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <button type="button" onClick={() => setShowProductPicker(false)} className="w-full text-xs text-muted-foreground hover:text-foreground py-1">
                    বাতিল
                  </button>
                </div>
              )}

              {/* Color Picker for compact cards */}
              {colorPickerProduct && (() => {
                const cpProduct = colorPickerProduct;
                const cpColors: string[] = getProductColors(cpProduct);
                return (
                  <div className="border border-border rounded-xl p-3 bg-card space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">কোন কালারটি যোগ করতে চান?</p>
                    <div className="grid grid-cols-2 gap-2">
                      {cpColors.map((c) => {
                        const cImg = getColorPrimaryImage((cpProduct.variant_images as any)?.color_images, c) || cpProduct.images?.[0];
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => { addSingleColorItem(cpProduct, c); setColorPickerProduct(null); }}
                            className="flex items-center gap-2.5 p-2 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-all text-left"
                          >
                            {cImg && <img src={cImg} alt={c} className="w-10 h-12 object-cover rounded-md shrink-0" />}
                            <span className="text-sm font-medium truncate">{c}</span>
                          </button>
                        );
                      })}
                    </div>
                    <button type="button" onClick={() => setColorPickerProduct(null)} className="w-full text-xs text-muted-foreground hover:text-foreground py-1">
                      বাতিল
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Duplicate order banner */}
          {duplicateOrder && (
            <DuplicateOrderBanner
              existingOrder={duplicateOrder}
              onDismiss={() => setDuplicateOrder(null)}
              newItems={selectedItems.map(it => {
                const p = getProduct(it.productId);
                const { price } = getProductPricing(p, it.size);
                return {
                  product_name: p?.name_bn || p?.name || 'পণ্য',
                  quantity: it.qty,
                  price,
                  size: it.size,
                  color: it.color,
                };
              })}
            />
          )}

          {/* ── Customer Info Card ── */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-bold px-3 py-1 rounded-full" style={{ backgroundColor: `${accent}20`, color: accent }}>📋 আপনার তথ্য</span>
            </div>
            <div>
              <Label className="text-sm font-semibold mb-1 block" style={labelStyle}>👤 আপনার নাম *</Label>
              <Input name="name" autoComplete="name" value={form.customer_name} onChange={e => setForm(p => ({ ...p, customer_name: e.target.value }))} placeholder={namePlaceholder || 'সম্পূর্ণ নাম'} maxLength={100} required style={inputStyle} />
            </div>
            <div>
              <Label className="text-sm font-semibold mb-1 block" style={labelStyle}>📞 মোবাইল নম্বর *</Label>
              <Input name="phone" type="tel" autoComplete="tel" value={form.customer_phone} onChange={e => setForm(p => ({ ...p, customer_phone: e.target.value }))} placeholder={phonePlaceholder || '01XXXXXXXXX'} maxLength={14} required style={inputStyle} />
            </div>
            <div>
              <Label className="text-sm font-semibold mb-1 block" style={labelStyle}>📍 সম্পূর্ণ ঠিকানা *</Label>
              <Textarea name="address" autoComplete="street-address" value={form.customer_address} onChange={e => setForm(p => ({ ...p, customer_address: e.target.value }))} placeholder={addressPlaceholder || 'বাড়ি নম্বর, রোড, এলাকা, থানা, জেলা'} maxLength={500} rows={2} required style={inputStyle} />
            </div>
            {showEmail && (
              <div>
                <Label className="text-sm font-semibold mb-1 block" style={labelStyle}>📧 ইমেইল</Label>
                <Input name="email" type="email" autoComplete="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="example@email.com" style={inputStyle} />
              </div>
            )}
            {showOrderNote && (
              <div>
                <Label className="text-sm font-semibold mb-1 block" style={labelStyle}>📝 অর্ডার নোট</Label>
                <Textarea value={form.order_note} onChange={e => setForm(p => ({ ...p, order_note: e.target.value }))} placeholder="বিশেষ কোনো নির্দেশনা থাকলে লিখুন..." rows={2} maxLength={500} style={inputStyle} />
              </div>
            )}
          </div>

          {/* ── Order Summary Card ── */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-bold px-3 py-1 rounded-full" style={{ backgroundColor: `${accent}20`, color: accent }}>🧾 অর্ডার সামারি</span>
            </div>

            {/* Selected items summary */}
            {selectedItems.length > 0 ? (
              <div className="space-y-1.5">
                {selectedItems.map((it, i) => {
                  const prod = getProduct(it.productId);
                  const { price } = getProductPricing(prod, it.size);
                  return (
                    <div key={i} className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <Check className="h-3 w-3 shrink-0" style={{ color: accent }} />
                        <span className="truncate">{it.color ? `${it.color}` : (prod.name_bn || prod.name)}{it.size ? ` • ${it.size}` : ''}</span>
                      </div>
                      <span className="font-semibold shrink-0 ml-2">৳{price * it.qty} <span className="text-muted-foreground font-normal">×{it.qty}</span></span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-2">কোনো আইটেম সিলেক্ট করা হয়নি</p>
            )}

            {/* Delivery area */}
            <div>
              <Label className="text-sm font-semibold mb-2 block" style={labelStyle}>🚚 ডেলিভারি এলাকা</Label>
              <RadioGroup value={form.delivery_area} onValueChange={val => { setForm(p => ({ ...p, delivery_area: val })); if (!paymentInfoFired.current) { paymentInfoFired.current = true; trackMetaAddPaymentInfo(subtotal); } }} className="space-y-0">
                {(() => {
                  const allAreas = [
                    { value: 'dhaka_inside', label: 'ঢাকা সিটি', price: charges.dhaka_inside },
                    { value: 'dhaka_suburb', label: 'ঢাকা সাব-এরিয়া', price: charges.dhaka_suburb },
                    { value: 'dhaka_outside', label: 'সারাদেশে (ঢাকার বাইরে)', price: charges.dhaka_outside },
                  ];
                  const order = deliveryAreaOrder || ['dhaka_outside', 'dhaka_suburb', 'dhaka_inside'];
                  return order.map(v => allAreas.find(a => a.value === v)!).filter(Boolean);
                })().map(opt => (
                  <label key={opt.value} className={cn('flex items-center gap-2.5 px-3 py-2 cursor-pointer rounded-lg')} style={form.delivery_area === opt.value ? { backgroundColor: `${accent}15` } : {}}>
                    <RadioGroupItem value={opt.value} />
                    <span className="flex-1 text-sm font-medium">{opt.label}</span>
                    <span className={cn('text-sm font-bold', form.delivery_area !== opt.value && 'text-muted-foreground')} style={form.delivery_area === opt.value ? { color: accent } : {}}>৳{opt.price}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>

            {/* Coupon */}
            <div className="pt-1">
              <CouponApply subtotal={subtotal} onApply={setCoupon} applied={coupon} accentColor={accent} />
            </div>

            {/* Price summary */}
            <div className="border-t border-border pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">সাবটোটাল ({selectedItems.reduce((s, i) => s + i.qty, 0)}টি পণ্য)</span><span className="font-medium">৳{subtotal}</span></div>
              {couponDiscount > 0 && (
                <div className="flex justify-between" style={{ color: accent }}><span>কুপন ছাড়</span><span className="font-medium">-৳{couponDiscount}</span></div>
              )}
              <div className="flex justify-between"><span className="text-muted-foreground">ডেলিভারি চার্জ</span><span className="font-medium">৳{deliveryCharge}</span></div>
              <div className="flex justify-between font-bold text-lg pt-2 border-t border-border">
                <span>সর্বমোট</span>
                <span style={{ color: priceColor }}>৳{total}</span>
              </div>
            </div>

            {/* Submit */}
            <Button type="submit" size="lg" className={cn('w-full text-base font-semibold py-6 animate-glow-pulse-btn badge-shimmer', submitRounded ? 'rounded-full' : 'rounded-lg')} style={{ backgroundColor: submitColor || '#429B39', ...(submitTextColor ? { color: submitTextColor } : {}) }} disabled={loading}>
              {loading ? 'অর্ডার হচ্ছে...' : `🛒 ${submitText || 'অর্ডার কনফার্ম করুন'}`}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}
