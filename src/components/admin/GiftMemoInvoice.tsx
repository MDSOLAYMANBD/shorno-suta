import { forwardRef } from 'react';
import { useSiteConfig, DEFAULT_INVOICE_CONFIG, DEFAULT_NAVBAR_CONFIG } from '@/hooks/useSiteConfig';
import { QRCodeSVG } from 'qrcode.react';

interface GiftStats {
  totalGifts: number;
  totalRecipients: number;
  recipientGiftNumber: number;
  totalGiftValue: number;
}

interface GiftMemoProps {
  order: any;
  items: any[];
  senderName?: string;
  giftNote?: string;
  giftStats?: GiftStats;
}

const toBanglaNum = (n: number) => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[parseInt(d)]);
const toBanglaOrdinal = (n: number) => {
  const bn = toBanglaNum(n);
  if (n === 1) return `${bn}ম`;
  if (n === 2) return `${bn}য়`;
  if (n === 3) return `${bn}য়`;
  if (n === 4) return `${bn}র্থ`;
  return `${bn}তম`;
};

const GiftMemoInvoice = forwardRef<HTMLDivElement, GiftMemoProps>(({ order, items, senderName, giftNote, giftStats }, ref) => {
  const { data: savedConfig } = useSiteConfig('invoice_config');
  const { data: navbarConfig } = useSiteConfig('navbar_config');
  const config = { ...DEFAULT_INVOICE_CONFIG, ...savedConfig };
  const navbar = { ...DEFAULT_NAVBAR_CONFIG, ...navbarConfig };

  const brandColor = config.brand_color || '#16a34a';
  const giftColor = '#d81b60';
  const giftColorSoft = '#f8bbd0';
  const giftColorLight = '#fce4ec';
  const websiteUrl = 'https://shorno-suta.vercel.app';
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
    <div ref={ref} className="text-black mx-auto print:m-0 print:shadow-none shadow-lg overflow-hidden" style={{ fontFamily: 'Arial, sans-serif', width: '148mm', height: '210mm', display: 'flex', flexDirection: 'column', position: 'relative', boxSizing: 'border-box', overflow: 'hidden', background: 'linear-gradient(to bottom right, #fff5f7, #ffffff, #fff0f3)' }}>

      {/* Main content area */}
      <div className="flex-grow">
        {/* Header Card */}
        <div className="mx-5 mt-7 mb-2 rounded-lg px-3 py-2 border-2 border-dashed flex items-stretch gap-2" style={{ borderColor: '#e91e6340' }}>
          <div className="flex-1 shrink-0">
            <div className="flex items-center gap-2">
              {config.logo_url && (
                <img src={config.logo_url} alt="Logo" className="w-11 h-11 rounded-full object-cover border" style={{ borderColor: brandColor }} />
              )}
              <div className="flex flex-col">
                <span className="text-sm font-bold leading-tight" style={{ color: giftColor }}>
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
          <div className="text-right shrink-0 self-end">
            <p className="text-[13px] font-bold uppercase tracking-wider mb-2" style={{ color: giftColor }}>
              🎁 Gift Memo
            </p>
            <p className="font-bold text-[11px]" style={{ color: giftColor }}>Memo No: #{order.order_number}</p>
            <p className="text-[10px] text-gray-600 mt-0.5">Date: {orderDate}</p>
          </div>
        </div>

        {/* BILL TO Card */}
        <div className="mx-5 my-2 border-l-4 px-4 py-2 flex justify-between text-[11px]" style={{ borderColor: giftColorSoft }}>
          <div>
            <p className="text-[10px] font-bold uppercase text-gray-600 tracking-wide">DELIVER TO:</p>
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

        {/* Items Table - no prices */}
        <div className="px-5">
          <table className="w-full text-[11px]">
            <thead>
              <tr style={{ backgroundColor: giftColorLight, color: '#c2185b' }}>
                <th className="text-left py-1 px-1.5 rounded-tl w-10 font-bold">IMG</th>
                <th className="text-left py-1 px-1.5 font-bold">DESCRIPTION</th>
                <th className="text-center py-1 px-1.5 w-10 font-bold">QTY</th>
                <th className="text-center py-1 px-1.5 rounded-tr w-16 font-bold">🎁</th>
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
                    <td className="text-center py-1 px-1.5">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold" style={{ backgroundColor: giftColorLight, color: '#c2185b' }}>
                        Gift
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Gift Card Section */}
        <div className="mx-5 mt-4 rounded-xl border-2 border-dashed overflow-hidden" style={{ borderColor: '#e91e6340' }}>
          {/* Card header */}
          <div className="px-4 py-2 flex items-center justify-between" style={{ background: `linear-gradient(135deg, ${giftColorSoft}, ${giftColorLight})` }}>
            <div className="flex items-center gap-2">
              <span className="text-[18px]">🎁</span>
              <span className="font-bold text-[13px] tracking-wide" style={{ color: '#c2185b' }}>Gift Card</span>
            </div>
            <span className="text-[9px] tracking-wide" style={{ color: '#c2185b' }}>
              {navbar.brand_name || 'স্বর্ণ সুতা'} এর পক্ষ থেকে
            </span>
          </div>
          {/* Card body */}
          <div className="px-4 py-3" style={{ backgroundColor: giftColorLight }}>
            {senderName && (
              <div className="mb-2">
                <span className="text-[10px] text-gray-600 uppercase tracking-wide">From:</span>
                <p className="text-[13px] font-bold mt-0.5" style={{ color: giftColor }}>{senderName}</p>
              </div>
            )}
            {giftNote && (
              <div className="mt-2 pl-3 py-2" style={{ borderLeft: `3px solid ${giftColorSoft}` }}>
                <p className="text-[11px] text-gray-800 leading-relaxed whitespace-pre-line italic">
                  "{giftNote}"
                </p>
              </div>
            )}
            {!senderName && !giftNote && (
              <p className="text-[11px] text-gray-500 italic text-center py-2">
                A special gift just for you! 🎀
              </p>
            )}
          </div>
          {/* Card footer */}
          <div className="px-4 py-1.5 text-center" style={{ backgroundColor: giftColorLight }}>
            <p className="text-[8px] text-gray-600">
              With love from <span className="font-bold" style={{ color: giftColor }}>{navbar.brand_name || 'স্বর্ণ সুতা'}</span> ❤️
            </p>
          </div>
        </div>

        {/* Giveaway Stats Card */}
        {giftStats && (
          <div className="mx-5 mt-3 rounded-lg border-2 border-dashed overflow-hidden" style={{ borderColor: '#e91e6340' }}>
            <div className="px-3 py-1.5 flex items-center gap-1.5" style={{ background: `linear-gradient(135deg, ${giftColorSoft}, ${giftColorLight})` }}>
              <span className="text-[14px]">📊</span>
              <span className="font-bold text-[11px] tracking-wide" style={{ color: '#c2185b' }}>গিভঅ্যাওয়ে পরিসংখ্যান</span>
            </div>
            <div className="px-3 py-2 flex items-center gap-2">
              {/* 3 stats */}
              <div className="flex-1 flex gap-1">
                <div className="flex-1 text-center py-1.5 rounded-lg" style={{ backgroundColor: giftColorLight }}>
                  <p className="text-[15px] font-extrabold" style={{ color: giftColor }}>{toBanglaNum(giftStats.totalRecipients)}</p>
                  <p className="text-[7px] text-gray-600 leading-tight">মোট<br/>বিজয়ী</p>
                </div>
                <div className="flex-1 text-center py-1.5 rounded-lg" style={{ backgroundColor: giftColorLight }}>
                  <p className="text-[15px] font-extrabold" style={{ color: giftColor }}>{toBanglaOrdinal(giftStats.recipientGiftNumber)}</p>
                  <p className="text-[7px] text-gray-600 leading-tight">আপনি কততম<br/>গিফট পাচ্ছেন</p>
                </div>
                <div className="flex-1 text-center py-1.5 rounded-lg" style={{ backgroundColor: giftColorLight }}>
                  <p className="text-[15px] font-extrabold" style={{ color: giftColor }}>৳{toBanglaNum(giftStats.totalGiftValue)}</p>
                  <p className="text-[7px] text-gray-600 leading-tight">মোট গিফট<br/>মূল্য</p>
                </div>
              </div>
              {/* QR */}
              <div className="shrink-0 text-center flex flex-col items-center">
                <QRCodeSVG value="https://shorno-suta.vercel.app/giveaway" size={48} />
                <p className="text-[6px] text-gray-600 mt-0.5 max-w-[52px] leading-tight">সকল বিজয়ী দেখুন</p>
              </div>
            </div>
          </div>
        )}

        {/* Signature */}
        {config.enable_signature && config.signature_url && (
          <div className="px-5 mt-3 flex justify-end">
            <div className="text-center">
              <img src={config.signature_url} alt="Signature" className="h-8 object-contain" />
              <p className="text-[8px] text-gray-400 mt-0.5">Authorized Signature</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 mt-7">
        <div className="mx-7 mb-2 rounded-lg px-4 py-2 border-2 border-dashed" style={{ borderColor: '#e91e6340' }}>
          <p className="text-[9px] text-gray-800 whitespace-pre-line leading-relaxed">
            🎁 গিফটটি ভালো লাগলে আমাদের জানাবেন!{'\n'}📸 আনবক্সিং ভিডিও বা ছবি তুলে আমাদের Facebook পেজে রিভিউ দিতে পারেন — আপনার মতামত আমাদের অনুপ্রেরণা!{'\n\n'}স্বর্ণ সুতা-এর পক্ষ থেকে শুভকামনা 🎀{'\n'}আমাদের পাশেই থাকবেন — খুশির কেনাকাটা হোক স্বর্ণ সুতা-এর সাথে ❤️
          </p>
        </div>
        <div className="px-5 py-1 text-[8px] text-gray-500 text-right">
          Printed: {printedAt}
        </div>
      </div>
    </div>
  );
});

GiftMemoInvoice.displayName = 'GiftMemoInvoice';
export default GiftMemoInvoice;
