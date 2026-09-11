import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useCart, CartItem } from '@/contexts/CartContext';
import { usePlaceOrder, isDuplicateOrderError, isBlockedOrderError, DuplicateOrderError } from '@/hooks/useOrders';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { CheckCircle, ShoppingBag, User, Phone, MapPin, Mail, StickyNote, Truck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
// trackEvent removed — trackPurchase handles GA4 dataLayer
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { trackBeginCheckout, trackAddShippingInfo, trackAddPaymentInfo, trackPurchase } from '@/lib/ecommerceTracking';
import { storeThankYouData } from '@/pages/ThankYou';
import { trackMetaInitiateCheckout, trackMetaAddPaymentInfo, trackMetaPurchase } from '@/lib/metaTracking';
import SEOHead from '@/components/SEOHead';
import CouponApply from '@/components/checkout/CouponApply';
import { trackVisitorActivity } from '@/hooks/useVisitorTracking';
import DuplicateOrderBanner from '@/components/checkout/DuplicateOrderBanner';
import { useShippingCharges, resolveShippingCharge } from '@/hooks/useShippingCharges';
import { useCheckoutConfig } from '@/hooks/useCheckoutConfig';
import CustomFieldsRenderer from '@/components/checkout/CustomFieldsRenderer';
import PolicyAgreement from '@/components/checkout/PolicyAgreement';
import { useFreeShipping } from '@/hooks/useFreeShipping';
import { FreeShippingProgress } from '@/components/freeShipping/FreeShippingProgress';
import { useEnabledPaymentMethods } from '@/hooks/usePaymentMethods';
import { optimizedImageUrl } from '@/lib/imageUrl';

export default function Checkout() {
  const { items, subtotal, clearCart } = useCart();
  const navigate = useNavigate();
  const placeOrder = usePlaceOrder();
  const abandonedIdRef = useRef<string | null>(null);
  const { methods: enabledPaymentMethods } = useEnabledPaymentMethods();

  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'uddoktapay' | 'bkash'>('cod');
  const [paymentLoading, setPaymentLoading] = useState(false);

  const { fields: fieldCfg, customFields, shippingZones, defaultZoneId, resolveZonePrice } = useCheckoutConfig();

  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    delivery_area: defaultZoneId,
    notes: '',
    customer_email: '',
  });
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [agreed, setAgreed] = useState(true);

  // Sync default zone once config loads
  useEffect(() => {
    if (defaultZoneId && form.delivery_area === 'dhaka_outside' && defaultZoneId !== 'dhaka_outside') {
      setForm(p => ({ ...p, delivery_area: defaultZoneId }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultZoneId]);

  const { charges } = useShippingCharges();
  const deliveryOptions = shippingZones.map(z => ({ value: z.id, label: z.label, price: z.price }));

  const [coupon, setCoupon] = useState<{ code: string; discount: number; discount_type: string; discount_value: number } | null>(null);
  const [duplicateOrder, setDuplicateOrder] = useState<DuplicateOrderError['existing_order'] | null>(null);
  const couponDiscount = coupon?.discount || 0;

  const baseDeliveryCharge = resolveZonePrice(form.delivery_area);
  const freeShipping = useFreeShipping({
    items: items.map((i) => ({ id: i.id, quantity: i.quantity, price: i.price })),
    appliedCouponCode: coupon?.code,
  });
  const deliveryCharge = freeShipping.isFree ? 0 : baseDeliveryCharge;
  const total = subtotal - couponDiscount + deliveryCharge;

  const checkoutFired = useRef(false);
  useEffect(() => {
    if (!checkoutFired.current && items.length > 0) {
      checkoutFired.current = true;
      // InitiateCheckout tracked via GA4 dataLayer + Meta below
      trackBeginCheckout(items, subtotal);
      trackMetaInitiateCheckout(items, subtotal);
      trackVisitorActivity('checkout_start', undefined, undefined, { item_count: items.length, subtotal });
    }
  }, []);

  useEffect(() => {
    const phoneClean = form.customer_phone.replace(/[\s-]/g, '').replace(/^\+?88/, '');
    if (/^01[3-9]\d{8}$/.test(phoneClean) && items.length > 0 && !abandonedIdRef.current) {
      const save = async () => {
        const { data } = await supabase.functions.invoke('save-abandoned-checkout', {
          body: {
            customer_name: form.customer_name || 'Unknown',
            customer_phone: form.customer_phone,
            customer_address: form.customer_address,
            customer_email: form.customer_email || null,
            cart_data: items,
            subtotal,
          },
        });
        if (data?.id) abandonedIdRef.current = data.id;
      };
      const timer = setTimeout(save, 2000);
      return () => clearTimeout(timer);
    }
  }, [form.customer_phone]);

  // Update abandoned checkout when name/address changes (via edge function to bypass RLS)
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

  if (items.length === 0) {
    navigate('/cart');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) {
      toast.error('অনুগ্রহ করে শর্তাবলীতে সম্মতি দিন');
      return;
    }
    if (!form.customer_name || !form.customer_phone || !form.customer_address) {
      toast.error('অনুগ্রহ করে সব প্রয়োজনীয় তথ্য পূরণ করুন');
      return;
    }
    const phoneClean = form.customer_phone.replace(/[\s-]/g, '').replace(/^\+?88/, '');
    if (!/^01[3-9]\d{8}$/.test(phoneClean)) {
      toast.error('সঠিক ফোন নম্বর দিন (01XXXXXXXXX)');
      return;
    }
    if (form.customer_name.trim().length < 3 || form.customer_name.length > 100) {
      toast.error('নাম ৩-১০০ অক্ষরের মধ্যে হতে হবে');
      return;
    }
    if (form.customer_address.trim().length < 10 || form.customer_address.length > 500) {
      toast.error('সম্পূর্ণ ঠিকানা দিন (কমপক্ষে ১০ অক্ষর)');
      return;
    }
    try {
      const order = await placeOrder.mutateAsync({ orderData: { ...form, custom_fields: Object.keys(customValues).length ? customValues : undefined }, items, subtotal, abandoned_checkout_id: abandonedIdRef.current || undefined, coupon_code: coupon?.code || undefined });

      if (paymentMethod === 'uddoktapay') {
        // Initiate UddoktaPay payment
        setPaymentLoading(true);
        try {
          const { data, error } = await supabase.functions.invoke('uddoktapay-checkout', {
            body: {
              order_id: order.id,
              order_number: order.order_number,
              amount: total,
              customer_name: form.customer_name,
              customer_email: form.customer_email || undefined,
              customer_phone: form.customer_phone,
            },
          });
          if (error || data?.error) {
            toast.error(data?.error || 'পেমেন্ট শুরু করতে সমস্যা হয়েছে');
            setPaymentLoading(false);
            return;
          }
          // Redirect to UddoktaPay
          window.open(data.payment_url, '_blank');
          return;
        } catch {
          toast.error('পেমেন্ট শুরু করতে সমস্যা হয়েছে');
          setPaymentLoading(false);
          return;
        }
      }

      if (paymentMethod === 'bkash') {
        // Initiate bKash payment — same shape/UX as the UddoktaPay branch above.
        setPaymentLoading(true);
        try {
          const { data, error } = await supabase.functions.invoke('bkash-checkout', {
            body: { order_id: order.id },
          });
          if (error || data?.error) {
            toast.error(data?.error || 'পেমেন্ট শুরু করতে সমস্যা হয়েছে');
            setPaymentLoading(false);
            return;
          }
          // Redirect to bKash
          window.open(data.payment_url, '_blank');
          return;
        } catch {
          toast.error('পেমেন্ট শুরু করতে সমস্যা হয়েছে');
          setPaymentLoading(false);
          return;
        }
      }

      // COD flow — tracking in separate try-catch so failures don't block navigation
      try {
        trackPurchase(order.order_number, items, total, deliveryCharge, undefined, {
          customer_name: form.customer_name,
          customer_phone: form.customer_phone,
          customer_address: form.customer_address,
          customer_email: form.customer_email || undefined,
        });
        trackMetaPurchase(order.order_number, items, total, {
          ph: form.customer_phone,
          em: form.customer_email || undefined,
          fn: form.customer_name || undefined,
          client_user_agent: navigator.userAgent,
        });
      } catch (trackErr) {
        console.error('[Tracking] Post-order tracking failed:', trackErr);
      }
      try {
        storeThankYouData({
          orderNumber: order.order_number,
          orderId: order.id,
          items: items.map(item => ({
            name: item.name_bn || item.name,
            image: item.image,
            qty: item.quantity,
            price: item.price,
            size: item.size,
            color: item.color,
          })),
          deliveryCharge,
          customerPhone: form.customer_phone,
          discount: couponDiscount || undefined,
          customerEmail: form.customer_email || undefined,
        });
      } catch {}
      clearCart();
      navigate('/thank-you');
    } catch (err) {
      if (isDuplicateOrderError(err)) {
        setDuplicateOrder(err.existing_order);
      } else if (isBlockedOrderError(err)) {
        toast.error(err.message);
      } else {
        toast.error('অর্ডার দিতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
      }
    }
  };

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <Layout>
      <SEOHead title="চেকআউট | স্বর্ণ সুতা" description="স্বর্ণ সুতায় আপনার অর্ডার সম্পন্ন করুন। নিরাপদ চেকআউট, ক্যাশ অন ডেলিভারি এবং সারা বাংলাদেশে দ্রুত হোম ডেলিভারি সুবিধা।" noindex />
      <div className="bg-gradient-to-b from-primary/5 via-accent/5 to-muted/30 min-h-screen">
        {/* Header with brand gradient */}
        <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground py-4 px-4">
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold">চেকআউট</h1>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-3 py-6">
          {duplicateOrder && (
            <div className="mb-6 max-w-lg mx-auto lg:max-w-none">
              <DuplicateOrderBanner
                existingOrder={duplicateOrder}
                onDismiss={() => setDuplicateOrder(null)}
                newItems={items.map(i => ({
                  product_name: i.name_bn || i.name,
                  quantity: i.quantity,
                  price: i.price,
                  size: i.size,
                  color: i.color,
                }))}
              />
            </div>
          )}
          <form onSubmit={handleSubmit} className="grid lg:grid-cols-5 gap-6 max-w-lg mx-auto lg:max-w-none">
            {/* Left Column - Form */}
            <div className="lg:col-span-3 space-y-4">
              {/* Customer Info Card */}
              <div className="bg-card rounded-xl shadow-sm border border-primary/15 p-4">
                <h2 className="text-base font-semibold text-primary mb-3">
                  👤 কাস্টমার তথ্য
                </h2>
                <div className="space-y-3">
                  {/* নাম */}
                  <div>
                    <Label className="text-sm font-medium flex items-center gap-1.5 mb-1.5">
                      👤 নাম *
                    </Label>
                    <Input
                      value={form.customer_name}
                      onChange={e => update('customer_name', e.target.value)}
                      placeholder="আপনার পূর্ণ নাম"
                      required
                      autoComplete="name"
                      className="rounded-lg border-primary/20 focus-visible:ring-primary/30"
                    />
                  </div>
                  {/* ফোন */}
                  <div>
                    <Label className="text-sm font-medium flex items-center gap-1.5 mb-1.5">
                      📞 ফোন *
                    </Label>
                    <Input
                      value={form.customer_phone}
                      onChange={e => update('customer_phone', e.target.value)}
                      placeholder="01XXXXXXXXX"
                      required
                      autoComplete="tel"
                      className="rounded-lg border-primary/20 focus-visible:ring-primary/30"
                    />
                  </div>
                  {/* ঠিকানা */}
                  <div>
                    <Label className="text-sm font-medium flex items-center gap-1.5 mb-1.5">
                      📍 ঠিকানা *
                    </Label>
                    <Textarea
                      value={form.customer_address}
                      onChange={e => update('customer_address', e.target.value)}
                      placeholder="বিস্তারিত ঠিকানা লিখুন (বাড়ি, রোড, এলাকা, জেলা)"
                      required
                      autoComplete="street-address"
                      className="rounded-lg min-h-[70px] border-primary/20 focus-visible:ring-primary/30"
                      rows={2}
                    />
                  </div>
                  {/* ইমেইল */}
                  {fieldCfg.email.show && (
                    <div>
                      <Label className="text-sm font-medium flex items-center gap-1.5 mb-1.5">
                        📧 {fieldCfg.email.label}
                      </Label>
                      <Input
                        type="email"
                        value={form.customer_email}
                        onChange={e => update('customer_email', e.target.value)}
                        placeholder={fieldCfg.email.placeholder || ''}
                        required={fieldCfg.email.required}
                        autoComplete="email"
                        className="rounded-lg border-primary/20 focus-visible:ring-primary/30"
                      />
                    </div>
                  )}
                  {/* নোট */}
                  {fieldCfg.note.show && (
                    <div>
                      <Label className="text-sm font-medium flex items-center gap-1.5 mb-1.5">
                        📝 {fieldCfg.note.label}
                      </Label>
                      <Input
                        value={form.notes}
                        onChange={e => update('notes', e.target.value)}
                        placeholder={fieldCfg.note.placeholder || ''}
                        required={fieldCfg.note.required}
                        className="rounded-lg border-primary/20 focus-visible:ring-primary/30"
                      />
                    </div>
                  )}
                  {/* Custom fields */}
                  <CustomFieldsRenderer
                    fields={customFields}
                    values={customValues}
                    onChange={(id, v) => setCustomValues(p => ({ ...p, [id]: v }))}
                  />
                </div>
              </div>

              {/* Order Summary Card - after notes */}
              <div className="bg-card rounded-xl shadow-sm border border-primary/15 p-4">
                <h2 className="text-base font-semibold text-primary mb-3">
                  🛍️ অর্ডার সারাংশ
                </h2>
                <div className="space-y-3 mb-4">
                  {items.map(item => (
                    <div key={`${item.id}-${item.size}-${item.color}`} className="flex items-center gap-3 bg-primary/5 rounded-lg p-2">
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0 border border-primary/10">
                        <img
                          src={item.image ? optimizedImageUrl(item.image, 90, 70) : '/placeholder.svg'}
                          alt={item.name_bn || item.name}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-clamp-1">{item.name_bn || item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          ৳{item.price} × {item.quantity}
                          {item.size && ` | ${item.size}`}
                          {item.color && ` | ${item.color}`}
                        </p>
                      </div>
                      <span className="text-sm font-semibold whitespace-nowrap text-primary">৳{item.price * item.quantity}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-sm border-t border-primary/10 pt-3">
                  <span className="text-muted-foreground">সাবটোটাল</span>
                  <span className="font-semibold">৳{subtotal}</span>
                </div>
                <div className="mt-3">
                  <CouponApply subtotal={subtotal} onApply={setCoupon} applied={coupon} />
                </div>
              </div>

              {/* Delivery Charge */}
              <div className="bg-card rounded-xl shadow-sm border border-accent/15 p-4">
                <h2 className="text-base font-semibold text-primary mb-3">
                  🚚 ডেলিভারি চার্জ
                </h2>
                <RadioGroup
                  value={form.delivery_area}
                  onValueChange={(val) => {
                    update('delivery_area', val);
                    const z = shippingZones.find(z => z.id === val);
                    trackAddShippingInfo(items, z?.label || val, subtotal + resolveZonePrice(val));
                  }}
                  className="space-y-0"
                >
                  {deliveryOptions.map((opt, idx) => (
                    <label
                      key={opt.value}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors rounded-lg',
                        form.delivery_area === opt.value ? 'bg-accent/5' : 'hover:bg-muted/50',
                        idx < deliveryOptions.length - 1 && 'border-b border-border'
                      )}
                    >
                      <RadioGroupItem value={opt.value} />
                      <span className="flex-1 text-sm font-medium">{opt.label}</span>
                      <span className={cn(
                        'text-sm font-bold',
                        form.delivery_area === opt.value ? 'text-primary' : 'text-muted-foreground'
                      )}>৳{opt.price}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              {/* Payment Method Card */}
              <div className="bg-card rounded-xl shadow-sm border border-accent/15 p-4">
                <h2 className="text-base font-semibold text-primary mb-3">
                  💳 পেমেন্ট মেথড
                </h2>
                <div className={cn(
                  "grid gap-3",
                  enabledPaymentMethods.length >= 3 ? "grid-cols-3" : "grid-cols-2"
                )}>
                  {enabledPaymentMethods.map((method) => {
                    const Icon = method.icon;
                    const isSelected = paymentMethod === method.id;
                    const brand = method.brand;
                    const watermarkColor = brand ? brand.accentText : 'text-primary';
                    const disabled = !!method.comingSoon;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => { if (!disabled) setPaymentMethod(method.id as typeof paymentMethod); }}
                        aria-disabled={disabled}
                        className={cn(
                          "flex flex-col items-center gap-2 p-4 border-2 rounded-xl transition-all relative overflow-hidden",
                          disabled
                            ? "opacity-60 cursor-not-allowed border-border"
                            : isSelected
                              ? (brand ? brand.selectedBorder : 'border-primary bg-primary/5')
                              : 'border-border hover:border-primary/30',
                          !disabled && (brand ? 'animate-pm-card-glow-pink' : 'animate-pm-card-glow-primary')
                        )}
                      >
                        {/* Watermark icon — fills the card's empty space */}
                        <Icon className={cn("absolute -right-2.5 -bottom-2.5 h-14 w-14 rotate-[-15deg] opacity-[0.08] pointer-events-none", watermarkColor)} />

                        {disabled && (
                          <span className="absolute top-1.5 left-1/2 -translate-x-1/2 z-10 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border whitespace-nowrap">
                            শীঘ্রই আসছে
                          </span>
                        )}

                        <div className="relative z-10 flex flex-col items-center gap-2 mt-2">
                          {isSelected && !disabled && <CheckCircle className={cn("absolute -top-2.5 right-0 h-4 w-4", brand ? brand.accentText : 'text-primary')} />}
                          <div className={cn(
                            "w-12 h-12 rounded-full flex items-center justify-center",
                            brand ? brand.iconBg : 'bg-primary/10',
                            !disabled && brand?.glowClassName
                          )}>
                            <Icon className={cn("h-6 w-6", brand ? brand.iconColor : 'text-primary')} />
                          </div>
                          <span className="text-sm sm:text-base font-semibold text-center">{method.labelBn}</span>
                          <span className="text-[11px] text-muted-foreground">{method.sublabel}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column - Grand Total & Submit (Desktop) */}
            <div className="lg:col-span-2">
              <div className="bg-card rounded-xl shadow-sm border border-primary/15 p-4 lg:sticky lg:top-24">
                <h2 className="text-base font-semibold text-primary mb-3">
                  🧾 মোট হিসাব
                </h2>

                {/* Compact items list */}
                <div className="space-y-2 mb-4">
                  {items.map(item => (
                    <div key={`${item.id}-${item.size}-${item.color}`} className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-md overflow-hidden bg-muted flex-shrink-0 border border-primary/10">
                        <img
                          src={item.image ? optimizedImageUrl(item.image, 90, 70) : '/placeholder.svg'}
                          alt={item.name_bn || item.name}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium line-clamp-1">{item.name_bn || item.name}</p>
                        <p className="text-[11px] text-muted-foreground">৳{item.price} × {item.quantity}</p>
                      </div>
                      <span className="text-xs font-semibold whitespace-nowrap">৳{item.price * item.quantity}</span>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="border-t border-primary/10 pt-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">সাবটোটাল</span>
                    <span>৳{subtotal}</span>
                  </div>
                  {couponDiscount > 0 && (
                    <div className="flex justify-between text-primary">
                      <span>কুপন ছাড়</span>
                      <span className="font-medium">-৳{couponDiscount}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ডেলিভারি চার্জ</span>
                    {freeShipping.isFree ? (
                      <span className="text-emerald-600 font-semibold">ফ্রি 🎉</span>
                    ) : (
                      <span className="text-primary font-medium">৳{deliveryCharge}</span>
                    )}
                  </div>
                  <FreeShippingProgress
                    items={items.map((i) => ({ id: i.id, quantity: i.quantity, price: i.price }))}
                    appliedCouponCode={coupon?.code}
                    variant="inline"
                  />
                  <div className="flex justify-between font-bold text-lg pt-2 border-t border-primary/10">
                    <span>সর্বমোট</span>
                    <span className="text-primary">৳{total}</span>
                  </div>
                </div>

                {/* Policy Agreement */}
                <div className="mt-4">
                  <PolicyAgreement checked={agreed} onChange={setAgreed} />
                </div>

                {/* Submit */}
                <Button
                  type="submit"
                  size="lg"
                  className="w-full mt-3 rounded-full text-base font-semibold h-12"
                  disabled={placeOrder.isPending || paymentLoading || !agreed}
                >
                  {placeOrder.isPending || paymentLoading
                    ? 'প্রসেস হচ্ছে...'
                    : (paymentMethod === 'uddoktapay' || paymentMethod === 'bkash')
                      ? 'পেমেন্ট করুন'
                      : 'অর্ডার কনফার্ম করুন'}
                </Button>
              </div>
            </div>
          </form>
        </div>

        {/* Spacer so the bottom nav doesn't sit flush against the form's own submit button */}
        <div className="lg:hidden h-20" />
      </div>
    </Layout>
  );
}
