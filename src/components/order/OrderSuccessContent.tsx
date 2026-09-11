import { CheckCircle, Facebook, MessageCircle, ShoppingBag, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useSiteConfig, DEFAULT_FOOTER_CONFIG } from '@/hooks/useSiteConfig';

export interface OrderSuccessItem {
  name: string;
  image?: string;
  qty: number;
  price: number;
  size?: string;
  color?: string;
}

interface OrderSuccessContentProps {
  orderNumber: string;
  orderId?: string;
  items: OrderSuccessItem[];
  deliveryCharge?: number;
  discount?: number;
  onClose?: () => void;
  closeLabel?: string;
  customerPhone?: string;
}

// Decorative leaf sprig growing in from the success card's corner, curving
// down toward the checkmark — root anchored at the corner so grow/sway
// animate from there. `mirrored` flips it for the right side so the pair
// frames the circle instead of repeating the same shape.
function SuccessLeafSprig({ className, mirrored, style }: { className?: string; mirrored?: boolean; style?: React.CSSProperties }) {
  const leaf = (cx: number, cy: number, rot: number, scale: number) => (
    <g transform={`translate(${cx},${cy}) rotate(${rot}) scale(${scale})`}>
      <path
        d="M0,1 C3,-2 4,-7 8,-13 C11,-19 10,-26 5,-32 C3,-35 0,-36 0,-36 C0,-36 -3,-35 -6,-31 C-10,-25 -10,-18 -7,-12 C-5,-6 -3,-2 0,1 Z"
        fill="url(#success-leaf-fill)"
        stroke="hsl(var(--accent))"
        strokeWidth="0.8"
      />
      <path d="M0,0 C1,-9 0,-20 -1,-27" fill="none" stroke="hsl(var(--accent))" strokeWidth="0.7" strokeLinecap="round" opacity="0.6" />
    </g>
  );
  return (
    <div className={`${className} animate-corner-leaf-grow`} style={style}>
      <div className="w-full h-full animate-corner-leaf-sway" style={style}>
        <svg viewBox="0 0 56 80" className="w-full h-full" style={mirrored ? { transform: 'scaleX(-1)' } : undefined} aria-hidden="true">
          <defs>
            <linearGradient id="success-leaf-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" />
              <stop offset="100%" stopColor="hsl(var(--primary) / 0.75)" />
            </linearGradient>
          </defs>
          <path
            d="M6,4 C10,20 6,34 18,44 C28,52 26,62 36,72"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {leaf(12, 26, -20, 0.8)}
          {leaf(28, 55, 25, 0.7)}
        </svg>
      </div>
    </div>
  );
}

export default function OrderSuccessContent({ orderNumber, orderId, items, deliveryCharge, discount, onClose, closeLabel = 'ঠিক আছে', customerPhone }: OrderSuccessContentProps) {
  const { data: footerConfig } = useSiteConfig('footer_config');
  const config = { ...DEFAULT_FOOTER_CONFIG, ...footerConfig };

  const facebookUrl = config.facebook || DEFAULT_FOOTER_CONFIG.facebook;
  const whatsappNumber = config.whatsapp || DEFAULT_FOOTER_CONFIG.whatsapp;
  const totalQty = items.reduce((s, i) => s + i.qty, 0);
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const grandTotal = subtotal - (discount || 0) + (deliveryCharge || 0);

  const itemLines = items.map(i => {
    const variants = [i.size, i.color].filter(Boolean).join(' | ');
    const variantStr = variants ? ` (${variants})` : '';
    return `• ${i.name}${variantStr} × ${i.qty} = ৳${i.price * i.qty}`;
  }).join('\n');

  const whatsappMessage = `আসসালামু আলাইকুম! 🛒
আমি একটি অর্ডার দিয়েছি।

অর্ডার নম্বর: ${orderNumber}

পণ্য সমূহ:
${itemLines}

সাবটোটাল: ৳${subtotal}${deliveryCharge != null ? `\nডেলিভারি চার্জ: ৳${deliveryCharge}` : ''}
সর্বমোট: ৳${grandTotal}

ধন্যবাদ!`;

  const whatsappUrl = `https://wa.me/880${whatsappNumber.replace(/^0/, '')}?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <div className="relative text-center space-y-4">
      {/* Leaf sprigs growing in from the card's two top corners, curving
          down toward the checkmark. -top-6/-left-6/-right-6 cancel out the
          card's own p-6 padding so they root exactly at its corners. */}
      <SuccessLeafSprig
        className="absolute -top-6 -left-6 w-11 h-16 pointer-events-none"
        style={{ transformOrigin: 'top left' }}
      />
      <SuccessLeafSprig
        className="absolute -top-6 -right-6 w-11 h-16 pointer-events-none"
        style={{ transformOrigin: 'top right' }}
        mirrored
      />

      {/* Success icon */}
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
        <CheckCircle className="h-9 w-9 text-primary" />
      </div>

      <div>
        <h2 className="text-xl font-bold">অর্ডার সম্পন্ন! 🎉</h2>
        <p className="text-muted-foreground text-sm mt-1">
          অর্ডার নম্বর: <strong className="text-primary">{orderNumber}</strong>
        </p>
        <p className="text-xs text-muted-foreground mt-1">শীঘ্রই ফোন করে কনফার্ম করা হবে।</p>
        <p className="text-sm text-primary font-medium mt-2">আমাদের থেকে কেনাকাটা করার জন্য ধন্যবাদ! 💚</p>
      </div>

      {/* Order summary */}
      {items.length > 0 && (
        <div className="bg-muted/50 rounded-xl p-3 space-y-2 text-left">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">অর্ডার সামারি ({totalQty}টি পণ্য)</p>
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2.5">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-background border border-border flex-shrink-0">
                <img
                  src={item.image || '/placeholder.svg'}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-1">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  ৳{item.price} × {item.qty}
                  {item.size && ` | ${item.size}`}
                  {item.color && ` | ${item.color}`}
                </p>
              </div>
              <span className="text-sm font-semibold text-primary whitespace-nowrap">৳{item.price * item.qty}</span>
            </div>
          ))}
          {/* Totals */}
          <div className="border-t border-border pt-2 mt-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">সাবটোটাল</span>
              <span className="font-medium">৳{subtotal}</span>
            </div>
            {discount != null && discount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">ডিসকাউন্ট</span>
                <span className="font-medium text-green-600">-৳{discount}</span>
              </div>
            )}
            {deliveryCharge != null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">ডেলিভারি চার্জ</span>
                <span className="font-medium text-primary">৳{deliveryCharge}</span>
              </div>
            )}
            <div className="flex justify-between font-bold pt-1 border-t border-border">
              <span>সর্বমোট</span>
              <span className="text-primary">৳{grandTotal}</span>
            </div>
          </div>
        </div>
      )}

      {/* Invoice download button */}
      {orderId && (
        <button
          onClick={() => {
            const w = window.open(`/memo/${orderId}?phone=${encodeURIComponent(customerPhone || '')}`, '_blank');
            if (w) setTimeout(() => w.print(), 1500);
          }}
          className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl bg-primary hover:bg-primary/90 active:scale-[0.98] transition-all text-base font-bold text-primary-foreground shadow-lg shadow-primary/25 animate-pulse hover:animate-none"
        >
          <FileDown className="h-5 w-5" />
          📄 ইনভয়েস ডাউনলোড করুন
        </button>
      )}

      {/* Social links */}
      <div className="grid grid-cols-3 gap-2">
        <a
          href={facebookUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-border hover:border-primary/30 hover:bg-primary/5 transition-colors"
        >
          <Facebook className="h-5 w-5 text-[#1877F2]" />
          <span className="text-[10px] font-medium">ফেসবুক পেজ</span>
        </a>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-border hover:border-primary/30 hover:bg-primary/5 transition-colors"
        >
          <MessageCircle className="h-5 w-5 text-[#25D366]" />
          <span className="text-[10px] font-medium">হোয়াটসঅ্যাপ</span>
        </a>
        <Link
          to="/shop"
          className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-border hover:border-primary/30 hover:bg-primary/5 transition-colors"
        >
          <ShoppingBag className="h-5 w-5 text-primary" />
          <span className="text-[10px] font-medium">আরো পণ্য দেখুন</span>
        </Link>
      </div>

      {/* Close button */}
      {onClose && (
        <Button onClick={onClose} className="rounded-full w-full">{closeLabel}</Button>
      )}
    </div>
  );
}
