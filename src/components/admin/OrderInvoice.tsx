import { forwardRef } from 'react';
import { useSiteConfig, DEFAULT_INVOICE_CONFIG, DEFAULT_NAVBAR_CONFIG } from '@/hooks/useSiteConfig';
import { QRCodeSVG } from 'qrcode.react';
import { getOrderDiscount } from '@/lib/orderDiscount';

interface InvoiceProps {
  order: any;
  items: any[];
  coupon?: { code: string; discount_type: string; discount_value: number } | null;
  exchangeData?: any;
}

const OrderInvoice = forwardRef<HTMLDivElement, InvoiceProps>(({ order, items, coupon, exchangeData }, ref) => {
  const { data: savedConfig } = useSiteConfig('invoice_config');
  const { data: navbarConfig } = useSiteConfig('navbar_config');
  const config = { ...DEFAULT_INVOICE_CONFIG, ...savedConfig };
  const navbar = { ...DEFAULT_NAVBAR_CONFIG, ...navbarConfig };

  const brandColor = config.brand_color || '#8C6A1A';
  const websiteUrl = 'https://www.shornosuta.com';
  const waUrl = `https://wa.me/${config.whatsapp?.replace(/[^0-9]/g, '')}`;
  const qrUrl = config.qr_target === 'whatsapp'
    ? waUrl
    : config.qr_target === 'custom' && config.qr_custom_url
    ? config.qr_custom_url
    : websiteUrl;

  const printedAt = new Date().toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });

  const orderDate = new Date(order.created_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <div ref={ref} className="bg-white text-black mx-auto print:m-0 print:shadow-none shadow-lg" style={{ fontFamily: 'Arial, sans-serif', width: '148mm', minHeight: '210mm', display: 'flex', flexDirection: 'column', position: 'relative', boxSizing: 'border-box' }}>

      {/* Main content area */}
      <div className="flex-grow">
        {/* Header Card */}
        <div className="mx-5 mt-7 mb-2 rounded-lg px-3 py-2 border-2 flex items-stretch gap-2" style={{ borderColor: brandColor }}>
          {/* Left side: Logo, brand name, address, phone */}
          <div className="flex-1 shrink-0">
            <div className="flex items-center gap-2">
              {config.logo_url && (
                <img src={config.logo_url} alt="Logo" className="w-11 h-11 rounded-full object-cover border" style={{ borderColor: brandColor }} />
              )}
              <div className="flex flex-col">
                <span className="text-sm font-bold leading-tight" style={{ color: brandColor }}>
                  {navbar.brand_name || 'স্বর্ণ সুতা'}
                </span>
                <span className="text-[9px] tracking-widest text-gray-600 uppercase leading-tight">
                  {navbar.brand_name_en || 'Shorno Suta'}
                </span>
              </div>
            </div>
            <p className="text-[9px] text-gray-600 max-w-[200px] mt-1">{config.address}</p>
            {config.phone && <p className="text-[9px] text-gray-700">📞 {config.phone}</p>}
            {config.whatsapp && <p className="text-[9px] text-gray-700">📲 {config.whatsapp}</p>}
            
          </div>
          {/* Right side: Delivery Memo, Memo No, Date */}
          <div className="text-right shrink-0 self-end">
            <p className="text-[13px] font-bold uppercase tracking-wider mb-2" style={{ color: brandColor }}>
              Delivery Memo
            </p>
            <p className="font-bold text-[11px]" style={{ color: brandColor }}>Memo No: #{order.order_number}</p>
            <p className="text-[10px] text-gray-600 mt-0.5">Date: {orderDate}</p>
            {order.courier_consignment_id && (
              <div
                className="mt-1.5 rounded-md px-2 py-1 inline-block text-right"
                style={{
                  backgroundColor: brandColor,
                  color: '#ffffff',
                  WebkitPrintColorAdjust: 'exact',
                  printColorAdjust: 'exact',
                }}
              >
                <p className="text-[8px] font-bold uppercase tracking-wider opacity-90 leading-none">
                  Courier ID
                </p>
                <p className="text-[11px] font-extrabold font-mono leading-tight mt-0.5">
                  #{order.courier_consignment_id}
                </p>
                {order.courier_tracking_code && (
                  <p className="text-[8px] font-mono opacity-90 leading-tight">
                    Track: {order.courier_tracking_code}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>




        {/* BILL TO Card */}
        <div className="mx-5 my-2 border-l-4 px-4 py-2 flex justify-between text-[11px]" style={{ borderColor: brandColor }}>
          <div>
            <p className="text-[10px] font-bold uppercase text-gray-600 tracking-wide">BILL TO:</p>
            <p className="font-bold text-[12px]">{order.customer_name}</p>
            <p className="text-gray-700">{order.customer_phone}</p>
            <p className="text-gray-700 max-w-[180px] text-[10px]">{order.customer_address}</p>
            <p className="text-gray-700 text-[10px]">{order.city}</p>
          </div>
          {config.enable_qr && (
            <div className="text-center flex flex-col items-center justify-center">
              <QRCodeSVG value={qrUrl} size={52} />
              <p className="text-[7px] text-gray-600 mt-0.5">Scan for Details</p>
            </div>
          )}
        </div>

        {/* Items Table */}
        <div className="px-5">
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
                        <img src={item.image} alt="" className="w-7 h-7 object-cover rounded" />
                      ) : (
                        <div className="w-7 h-7 bg-gray-200 rounded flex items-center justify-center text-[8px] text-gray-400">—</div>
                      )}
                    </td>
                    <td className="py-1 px-1.5">
                      <span className="font-medium">{item.product_name}</span>
                      {variant && <span className="text-gray-500 text-[10px]"> — {variant}</span>}
                    </td>
                    <td className="text-center py-1 px-1.5">{item.quantity}</td>
                    <td className="text-right py-1 px-1.5 text-gray-500">
                      {item.regular_price && item.regular_price > item.price ? (
                        <span className="line-through text-[10px]">৳{item.regular_price}</span>
                      ) : (
                        <span className="text-[10px]">৳{item.price}</span>
                      )}
                    </td>
                    <td className="text-right py-1 px-1.5 font-medium">
                      ৳{item.price * item.quantity}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="px-5 mt-2 flex justify-end">
          <div className="text-[11px] w-44 space-y-0.5">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>৳{order.subtotal}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping:</span>
              <span>{order.free_shipping ? <span className="font-bold text-green-600">FREE</span> : `৳${order.delivery_charge}`}</span>
            </div>
            {(() => {
              const discount = getOrderDiscount(order);
              return discount > 0 ? (
                <div className="flex justify-between text-red-600">
                  <span>Discount:</span>
                  <span>-৳{discount}</span>
                </div>
              ) : null;
            })()}
            <div
              className="flex justify-between font-bold text-[12px] rounded px-2 py-1 text-white mt-1"
              style={{ backgroundColor: brandColor }}
            >
              <span>Total:</span>
              <span>৳{order.total}</span>
            </div>
            {/* Payment breakdown */}
            {order.payment_status === 'paid' ? (
              <div className="mt-1.5 space-y-0.5">
                <div className="flex justify-between text-green-700 font-medium">
                  <span>পরিশোধিত ✓:</span>
                  <span>৳{order.total}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>COD:</span>
                  <span>৳0</span>
                </div>
              </div>
            ) : order.payment_status === 'partial' ? (
              <div className="mt-1.5 space-y-0.5">
                <div className="flex justify-between text-blue-700 font-medium">
                  <span>অগ্রিম পরিশোধ:</span>
                  <span>৳{order.paid_amount || 0}</span>
                </div>
                <div className="flex justify-between font-bold" style={{ color: brandColor }}>
                  <span>COD:</span>
                  <span>৳{order.due_amount || (order.total - (order.paid_amount || 0))}</span>
                </div>
              </div>
            ) : (
              <div className="mt-1.5">
                <div className="flex justify-between font-bold" style={{ color: brandColor }}>
                  <span>COD:</span>
                  <span>৳{order.total}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Exchange Card — for exchange orders */}
        {order.order_origin === 'exchange' && exchangeData && (
          <div className="mx-5 mt-3 rounded-xl border-2 overflow-hidden" style={{ borderColor: brandColor }}>
            <div className="px-4 py-2 flex items-center justify-between" style={{ backgroundColor: brandColor }}>
              <div className="flex items-center gap-2">
                <span className="text-[18px]">🙏</span>
                <span className="text-white font-bold text-[13px] tracking-wide">ক্ষমা ও পরিবর্তন</span>
              </div>
              <span className="text-white/80 text-[9px] tracking-wide">
                {navbar.brand_name || 'স্বর্ণ সুতা'} এর পক্ষ থেকে
              </span>
            </div>
            <div className="px-4 py-3" style={{ backgroundColor: `${brandColor}08` }}>
              {exchangeData.note && (
                <div className="mb-2 pl-3 py-2" style={{ borderLeft: `3px solid ${brandColor}60` }}>
                  <p className="text-[11px] text-gray-800 leading-relaxed whitespace-pre-line italic">
                    "{exchangeData.note}"
                  </p>
                </div>
              )}
              {/* Exchange items comparison */}
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div>
                  <p className="text-[9px] font-bold text-red-600 mb-1">❌ পুরোনো পণ্য</p>
                  {(exchangeData.old_items as any[] || []).map((item: any, i: number) => (
                    <div key={i} className="flex gap-1 mb-1">
                      {item.image && <img src={item.image} alt="" className="w-7 h-7 rounded object-cover shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-[9px] font-medium truncate">{item.product_name}</p>
                        <p className="text-[8px] text-gray-500">{item.quantity}x • {item.size || ''} {item.color || ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-[9px] font-bold text-green-600 mb-1">✅ নতুন পণ্য</p>
                  {(exchangeData.new_items as any[] || []).map((item: any, i: number) => (
                    <div key={i} className="flex gap-1 mb-1">
                      {item.image && <img src={item.image} alt="" className="w-7 h-7 rounded object-cover shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-[9px] font-medium truncate">{item.product_name}</p>
                        <p className="text-[8px] text-gray-500">{item.quantity}x • {item.size || ''} {item.color || ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-4 py-1.5 text-center" style={{ backgroundColor: `${brandColor}10` }}>
              <p className="text-[8px] text-gray-600">
                With love from <span className="font-bold" style={{ color: brandColor }}>{navbar.brand_name || 'স্বর্ণ সুতা'}</span> ❤️
              </p>
            </div>
          </div>
        )}

        {/* Gift / Discount Card — for non-exchange orders */}
        {order.order_origin !== 'exchange' && (() => {
          const discount = getOrderDiscount(order);
          const hasGift = discount > 0 || order.free_shipping || order.discount_note;
          if (!hasGift) return null;
          return (
            <div className="mx-5 mt-3 rounded-xl border-2 overflow-hidden" style={{ borderColor: brandColor }}>
              {/* Card header */}
              <div className="px-4 py-2 flex items-center justify-between" style={{ backgroundColor: brandColor }}>
                <div className="flex items-center gap-2">
                  <span className="text-[18px]">🎁</span>
                  <span className="text-white font-bold text-[13px] tracking-wide">উপহার / ছাড়</span>
                </div>
                <span className="text-white/80 text-[9px] tracking-wide">
                  {navbar.brand_name || 'স্বর্ণ সুতা'} এর পক্ষ থেকে
                </span>
              </div>
              {/* Card body */}
              <div className="px-4 py-3" style={{ backgroundColor: `${brandColor}08` }}>
                <div className="flex items-center gap-2">
                  {discount > 0 && (
                    <span className="text-[14px] font-bold text-red-600">-৳{discount}</span>
                  )}
                  {discount > 0 && order.free_shipping && (
                    <span className="text-gray-300">·</span>
                  )}
                  {order.free_shipping && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: brandColor }}>
                      ফ্রি ডেলিভারি ✓
                    </span>
                  )}
                </div>
                {order.discount_note && (
                  <div className="mt-2 pl-3 py-2" style={{ borderLeft: `3px solid ${brandColor}60` }}>
                    <p className="text-[11px] text-gray-800 leading-relaxed whitespace-pre-line italic">
                      "{order.discount_note}"
                    </p>
                    <p className="text-[10px] text-gray-700 mt-1.5 leading-relaxed">
                      আপনি চাইলে এই কুপন ব্যবহার করে আরও শপিং করতে পারবেন। পরিবার ও বন্ধুদেরও এই কুপন দিয়ে শপিং করিয়ে দিতে পারবেন! 💚
                    </p>
                  </div>
                )}
              </div>
              {/* Card footer */}
              <div className="px-4 py-1.5 text-center" style={{ backgroundColor: `${brandColor}10` }}>
                <p className="text-[8px] text-gray-600">
                  With love from <span className="font-bold" style={{ color: brandColor }}>{navbar.brand_name || 'স্বর্ণ সুতা'}</span> ❤️
                </p>
              </div>
            </div>
          );
        })()}

        {/* Signature */}
        {config.enable_signature && config.signature_url && (
          <div className="px-5 mt-3 flex justify-end">
            <div className="text-center">
              <img src={config.signature_url} alt="Signature" className="h-8 object-contain" />
              <p className="text-[8px] text-gray-400 mt-0.5">Authorized Signature</p>
            </div>
          </div>
        )}
        {/* Coupon Promotion Card */}
        {coupon && (
          <div className="mx-5 mt-3 rounded-xl border-2 overflow-hidden" style={{ borderColor: brandColor }}>
            <div className="px-4 py-1.5 flex items-center gap-2" style={{ backgroundColor: brandColor }}>
              <span className="text-[16px]">🎉</span>
              <span className="text-white font-bold text-[11px]">আপনি এখন আমাদের পরিবারের সদস্য!</span>
            </div>
            <div className="px-4 py-2 text-center" style={{ backgroundColor: `${brandColor}08` }}>
              <p className="text-[9px] text-gray-700 leading-relaxed mb-1.5">
                আলহামদুলিল্লাহ! অর্ডারের জন্য ধন্যবাদ। এই কুপন কোডটি দিয়ে সারাজীবন পাবেন ফ্ল্যাট ডিসকাউন্ট!
              </p>
              <div className="inline-block border-2 border-dashed rounded-lg px-5 py-1.5 my-1" style={{ borderColor: brandColor }}>
                <p className="text-[15px] font-black tracking-widest" style={{ color: brandColor }}>{coupon.code}</p>
                <p className="text-[10px] font-bold text-gray-700">
                  {coupon.discount_type === 'percentage' ? `${coupon.discount_value}% ছাড়` : `৳${coupon.discount_value} ছাড়`}
                </p>
              </div>
              <p className="text-[8px] text-gray-600 mt-1">
                পরিবার ও বন্ধুদেরও কেনাকাটা করিয়ে দিতে পারেন এই কোড দিয়ে! 💚
              </p>
            </div>
            <div className="px-4 py-1 text-center" style={{ backgroundColor: `${brandColor}10` }}>
              <p className="text-[8px] text-gray-500">
                shornosuta.com ❤️
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer - pinned to bottom */}
      <div className="shrink-0 mt-7">
        <div className="mx-7 mb-2 rounded-lg px-4 py-2 border-2" style={{ borderColor: brandColor }}>
          <p className="text-[9px] text-gray-800 whitespace-pre-line leading-relaxed">
            {config.footer_message}
          </p>
        </div>
        <div className="px-5 py-1 text-[8px] text-gray-500 text-right">
          Printed: {printedAt}
        </div>
      </div>
    </div>
  );
});

OrderInvoice.displayName = 'OrderInvoice';
export default OrderInvoice;
