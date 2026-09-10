import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Phone, Globe, Package, Facebook, Youtube } from 'lucide-react';
import { getOrderDiscount } from '@/lib/orderDiscount';
import MobileBottomNav from '@/components/layout/MobileBottomNav';

export default function PublicMemo() {
  const { orderId } = useParams<{ orderId: string }>();

  // Detect if orderId is a UUID or an order_number (like SD-001606)
  const isUUID = orderId ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId) : false;
  const queryParam = isUUID ? `id=${orderId}` : `order_number=${encodeURIComponent(orderId || '')}`;

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-memo', orderId],
    queryFn: async () => {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/order-memo?${queryParam}`
      );
      if (!res.ok) throw new Error('Order not found');
      return res.json();
    },
    enabled: !!orderId,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-gray-800">মেমো পাওয়া যায়নি</h1>
          <p className="text-sm text-gray-500 mt-1">এই লিংকটি সঠিক নয় অথবা মেয়াদ শেষ হয়ে গেছে।</p>
        </div>
        <MobileBottomNav />
      </div>
    );
  }

  const { order, items, branding } = data;
  const brandColor = branding.brand_color || '#16a34a';
  const discount = getOrderDiscount(order);
  const orderDate = new Date(order.created_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  const makePhoneLink = (ph: string) => {
    if (!ph) return null;
    const cleaned = ph.replace(/[^0-9+]/g, '');
    return (
      <a href={`tel:${cleaned}`} className="text-blue-600 hover:underline font-medium">
        {ph}
      </a>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 py-4 px-3 pb-24">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg overflow-hidden" style={{ fontFamily: 'Arial, sans-serif' }}>

        {/* Header Card */}
        <div className="mx-4 mt-5 mb-2 rounded-lg px-3 py-2 border-2 flex items-stretch gap-2" style={{ borderColor: brandColor }}>
          <div className="flex-1 shrink-0">
            <div className="flex items-center gap-2">
              {branding.logo_url && (
                <img src={branding.logo_url} alt="Logo" className="w-11 h-11 rounded-full object-cover border" style={{ borderColor: brandColor }} />
              )}
              <div className="flex flex-col">
                <span className="text-sm font-bold leading-tight" style={{ color: brandColor }}>
                  {branding.brand_name}
                </span>
                {branding.brand_name_en && (
                  <span className="text-[9px] tracking-widest text-gray-600 uppercase leading-tight">
                    {branding.brand_name_en}
                  </span>
                )}
              </div>
            </div>
            {branding.address && <p className="text-[9px] text-gray-600 max-w-[200px] mt-1">{branding.address}</p>}
            {branding.phone && <p className="text-[9px] text-gray-700">📞 {branding.phone}</p>}
            {branding.whatsapp && <p className="text-[9px] text-gray-700">📲 {branding.whatsapp}</p>}
          </div>
          <div className="text-right shrink-0 self-end">
            <p className="text-[13px] font-bold uppercase tracking-wider mb-2" style={{ color: brandColor }}>
              Delivery Memo
            </p>
            <p className="font-bold text-[11px]" style={{ color: brandColor }}>Memo No: #{order.order_number}</p>
            <p className="text-[10px] text-gray-600 mt-0.5">Date: {orderDate}</p>
          </div>
        </div>

        {/* BILL TO */}
        <div className="mx-4 my-2 border-l-4 px-4 py-2 text-[11px]" style={{ borderColor: brandColor }}>
          <p className="text-[10px] font-bold uppercase text-gray-600 tracking-wide">BILL TO:</p>
          <p className="font-bold text-[12px]">{order.customer_name}</p>
          <p className="text-gray-700">{makePhoneLink(order.customer_phone)}</p>
          <p className="text-gray-700 max-w-[220px] text-[10px]">{order.customer_address}</p>
          {order.city && <p className="text-gray-700 text-[10px]">{order.city}</p>}
        </div>

        {/* Items Table */}
        <div className="px-4">
          <table className="w-full text-[11px]">
            <thead>
              <tr style={{ backgroundColor: brandColor, color: 'white' }}>
                <th className="text-left py-1 px-1.5 rounded-tl w-10">IMG</th>
                <th className="text-left py-1 px-1.5">DESCRIPTION</th>
                <th className="text-center py-1 px-1.5 w-10">QTY</th>
                <th className="text-right py-1 px-1.5 w-16">M.R.P</th>
                <th className="text-right py-1 px-1.5 rounded-tr w-16">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any, idx: number) => {
                const variant = [item.color, item.size].filter(Boolean).join(', ');
                return (
                  <tr key={item.id} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="py-1 px-1.5">
                      {item.image ? (
                        <img src={item.image} alt="" className="w-8 h-8 object-cover rounded" />
                      ) : (
                        <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center text-[8px] text-gray-400">—</div>
                      )}
                    </td>
                    <td className="py-1.5 px-1.5">
                      <span className="font-medium">{item.product_name}</span>
                      {variant && <span className="text-gray-500 text-[10px]"> — {variant}</span>}
                    </td>
                    <td className="text-center py-1.5 px-1.5">{item.quantity}</td>
                    <td className="text-right py-1.5 px-1.5 text-gray-500">
                      {item.regular_price && item.regular_price > item.price ? (
                        <span className="line-through text-[10px]">৳{item.regular_price}</span>
                      ) : (
                        <span className="text-[10px]">৳{item.price}</span>
                      )}
                    </td>
                    <td className="text-right py-1.5 px-1.5 font-medium">৳{item.price * item.quantity}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="px-4 mt-2 flex justify-end">
          <div className="text-[11px] w-44 space-y-0.5">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>৳{order.subtotal}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping:</span>
              <span>{order.free_shipping ? <span className="font-bold text-green-600">FREE</span> : `৳${order.delivery_charge}`}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Discount:</span>
                <span>-৳{discount}</span>
              </div>
            )}
            <div
              className="flex justify-between font-bold text-[12px] rounded px-2 py-1 text-white mt-1"
              style={{ backgroundColor: brandColor }}
            >
              <span>Total:</span>
              <span>৳{order.total}</span>
            </div>
          </div>
        </div>

        {/* Payment Status Card */}
        {(() => {
          const total = Number(order.total) || 0;
          const paid = Number(order.paid_amount) || 0;
          const status = order.payment_status;
          const isPaid = status === 'paid' || paid >= total;
          const isPartial = status === 'partial' || (paid > 0 && paid < total);
          const due = Math.max(0, total - paid);
          const method = order.payment_method === 'cod' ? 'ক্যাশ অন ডেলিভারি'
            : order.payment_method === 'uddoktapay' ? 'অনলাইন পেমেন্ট'
            : order.payment_method === 'bkash' ? 'বিকাশ'
            : order.payment_method ? String(order.payment_method).toUpperCase() : 'অনলাইন';

          if (isPaid) {
            return (
              <div className="mx-4 mt-3 rounded-xl overflow-hidden border-2 border-green-500 bg-gradient-to-br from-green-50 to-emerald-50">
                <div className="px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-lg">✓</div>
                    <div>
                      <p className="text-[13px] font-bold text-green-700 leading-tight">সম্পূর্ণ পরিশোধিত (PAID)</p>
                      <p className="text-[9px] text-green-600 uppercase tracking-wide">Paid via {method}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-green-600 font-semibold">পরিশোধিত</p>
                    <p className="text-[15px] font-bold text-green-700">৳{paid || total}</p>
                  </div>
                </div>
                {(order.payment_invoice_id || order.paid_at) && (
                  <div className="px-4 pb-2 flex flex-wrap gap-x-4 gap-y-0.5 text-[9px] text-green-700/80">
                    {order.payment_invoice_id && <span>Transaction ID: {order.payment_invoice_id}</span>}
                    {order.paid_at && <span>{new Date(order.paid_at).toLocaleString('bn-BD', { dateStyle: 'medium', timeStyle: 'short' })}</span>}
                  </div>
                )}
              </div>
            );
          }
          if (isPartial) {
            return (
              <div className="mx-4 mt-3 rounded-xl overflow-hidden border-2 border-amber-500 bg-gradient-to-br from-amber-50 to-yellow-50">
                <div className="px-4 py-2 flex items-center justify-between border-b border-amber-200">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-white text-sm">◐</div>
                    <div>
                      <p className="text-[13px] font-bold text-amber-800 leading-tight">আংশিক পরিশোধিত</p>
                      <p className="text-[9px] text-amber-700 uppercase tracking-wide">{method}</p>
                    </div>
                  </div>
                </div>
                <div className="px-4 py-2 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[9px] text-gray-600 font-semibold">মোট বিল</p>
                    <p className="text-[12px] font-bold text-gray-800">৳{total}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-green-700 font-semibold">পরিশোধিত</p>
                    <p className="text-[12px] font-bold text-green-700">৳{paid}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-red-600 font-semibold">বকেয়া</p>
                    <p className="text-[12px] font-bold text-red-600">৳{due}</p>
                  </div>
                </div>
              </div>
            );
          }
          return (
            <div className="mx-4 mt-3 rounded-xl overflow-hidden border-2 border-red-400 bg-gradient-to-br from-red-50 to-rose-50">
              <div className="px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white text-lg">!</div>
                  <div>
                    <p className="text-[13px] font-bold text-red-700 leading-tight">বিল বকেয়া</p>
                    <p className="text-[9px] text-red-600 uppercase tracking-wide">Payment Due · {method}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[9px] text-red-600 font-semibold">পরিশোধ্য</p>
                  <p className="text-[15px] font-bold text-red-700">৳{total}</p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Discount/Coupon Card */}
        {(discount > 0 || order.discount_note) && (
          <div className="mx-4 mt-3 rounded-xl border-2 overflow-hidden" style={{ borderColor: brandColor }}>
            <div className="px-4 py-2 flex items-center justify-between" style={{ backgroundColor: brandColor }}>
              <div className="flex items-center gap-2">
                <span className="text-[18px]">{order.order_origin === 'exchange' ? '🙏' : '🎁'}</span>
                <span className="text-white font-bold text-[13px] tracking-wide">
                  {order.order_origin === 'exchange' ? 'ক্ষমা ও পরিবর্তন' : 'উপহার / ছাড়'}
                </span>
              </div>
            </div>
            <div className="px-4 py-3" style={{ backgroundColor: `${brandColor}08` }}>
              {discount > 0 && (
                <span className="text-[14px] font-bold text-red-600">-৳{discount}</span>
              )}
              {order.discount_note && (
                <div className="mt-2 pl-3 py-2" style={{ borderLeft: `3px solid ${brandColor}60` }}>
                  <p className="text-[11px] text-gray-800 leading-relaxed whitespace-pre-line italic">
                    "{order.discount_note}"
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {branding.footer_message && (
          <div className="mx-4 mt-3 rounded-lg px-4 py-2 border-2" style={{ borderColor: brandColor }}>
            <p className="text-[9px] text-gray-800 whitespace-pre-line leading-relaxed">
              {branding.footer_message}
            </p>
          </div>
        )}

        {/* Clickable Contact Footer */}
        <div className="mx-4 mt-3 mb-4 rounded-xl border-2 overflow-hidden" style={{ borderColor: brandColor }}>
          <div className="divide-y" style={{ borderColor: `${brandColor}30` }}>
            {branding.phone && (
              <a href={`tel:${branding.phone.replace(/[^0-9+]/g, '')}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 active:bg-gray-100 transition-colors">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${brandColor}15` }}>
                  <Phone className="h-4 w-4" style={{ color: brandColor }} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">Helpline</p>
                  <p className="text-sm font-bold" style={{ color: brandColor }}>{branding.phone}</p>
                </div>
              </a>
            )}
            {branding.whatsapp && (
              <a href={`https://wa.me/${branding.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 active:bg-gray-100 transition-colors">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-green-50">
                  <span className="text-base">📲</span>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">WhatsApp</p>
                  <p className="text-sm font-bold text-green-600">{branding.whatsapp}</p>
                </div>
              </a>
            )}
            {branding.website && (
              <a href={branding.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 active:bg-gray-100 transition-colors">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${brandColor}15` }}>
                  <Globe className="h-4 w-4" style={{ color: brandColor }} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">Website</p>
                  <p className="text-sm font-bold text-blue-600">{branding.website.replace('https://', '').replace('http://', '')}</p>
                </div>
              </a>
            )}
            {branding.facebook && (
              <a href={branding.facebook} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 active:bg-gray-100 transition-colors">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#1877F215' }}>
                  <Facebook className="h-4 w-4" style={{ color: '#1877F2' }} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">Facebook</p>
                  <p className="text-sm font-bold" style={{ color: '#1877F2' }}>Facebook Page</p>
                </div>
              </a>
            )}
            {branding.youtube && (
              <a href={branding.youtube} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 active:bg-gray-100 transition-colors">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FF000015' }}>
                  <Youtube className="h-4 w-4" style={{ color: '#FF0000' }} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">YouTube</p>
                  <p className="text-sm font-bold" style={{ color: '#FF0000' }}>YouTube Channel</p>
                </div>
              </a>
            )}
          </div>
        </div>

        {/* Brand love */}
        <div className="text-center pb-4">
          <p className="text-[9px] text-gray-400">
            With love from <span className="font-bold" style={{ color: brandColor }}>{branding.brand_name}</span> ❤️
          </p>
        </div>
      </div>

      <MobileBottomNav />
    </div>
  );
}
