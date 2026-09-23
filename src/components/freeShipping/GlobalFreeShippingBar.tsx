import { useEffect, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { FreeShippingProgress } from './FreeShippingProgress';

const DISMISS_KEY = 'shorno-suta-fs-bar-dismissed';

/**
 * Floating global free shipping progress bar — visible on every customer page
 * whenever there are items in the cart. Shows progress towards the next
 * free-shipping unlock so customers see it before reaching checkout.
 */
export default function GlobalFreeShippingBar() {
  const { items, subtotal } = useCart();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });

  // Hide on admin / auth / checkout-flow / landing pages
  const path = location.pathname;
  const hide =
    path.startsWith('/admin') ||
    path.startsWith('/staff') ||
    path.startsWith('/account') ||
    path.startsWith('/auth') ||
    path.startsWith('/lp/') ||
    path === '/checkout' ||
    path === '/cart' ||
    path === '/thank-you' ||
    path === '/order-status' ||
    path === '/payment-result';

  const cartItems = useMemo(
    () => items.map((i) => ({ id: i.id, quantity: i.quantity, price: i.price })),
    [items],
  );

  useEffect(() => {
    if (items.length > 0) {
      setDismissed(false);
      try { sessionStorage.removeItem(DISMISS_KEY); } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  if (hide) return null;
  if (items.length === 0) return null;
  if (dismissed) return null;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1rem)] max-w-md px-1 animate-in slide-in-from-bottom-2 fade-in"
      style={{ bottom: isMobile ? 'calc(min(env(safe-area-inset-bottom), 0.5rem) + 72px)' : '1rem' }}
    >
      <div className="relative">
        <FreeShippingProgress
          items={cartItems}
          variant="compact"
          className="shadow-lg backdrop-blur-md bg-background/90 pr-7"
        />
        <button
          type="button"
          aria-label="বন্ধ করুন"
          onClick={() => {
            setDismissed(true);
            try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch {}
          }}
          className="absolute top-1.5 right-1.5 rounded-full p-0.5 hover:bg-background/60 text-foreground/70"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
