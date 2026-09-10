import { useEffect, useRef } from 'react';
import { AlertTriangle, Phone, MessageCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useStoreSettings } from '@/hooks/useStoreSettings';

interface ExistingOrder {
  order_number: string;
  total: number;
  created_at: string;
  items: { product_name: string; quantity: number; price: number; size?: string; color?: string }[];
}

interface NewItem {
  product_name: string;
  quantity: number;
  price: number;
  size?: string;
  color?: string;
}

interface Props {
  existingOrder: ExistingOrder;
  onDismiss?: () => void;
  newItems?: NewItem[];
}

export default function DuplicateOrderBanner({ existingOrder, onDismiss, newItems }: Props) {
  const { data: settings } = useStoreSettings();
  const whatsappNumber =
    settings?.['whatsapp_number'] ||
    settings?.['helpline_number'] ||
    settings?.['contact_phone'] ||
    '';
  const helplineNumber =
    settings?.['helpline_number'] ||
    settings?.['contact_phone'] ||
    settings?.['whatsapp_number'] ||
    '';

  const buildWaMessage = () => {
    const lines: string[] = [];
    lines.push(`আসসালামু আলাইকুম,`);
    lines.push(`আমার আগের অর্ডার নম্বর: ${existingOrder.order_number}`);
    lines.push('');
    lines.push(`📦 আগের অর্ডারের পণ্যসমূহ:`);
    existingOrder.items.forEach((it, i) => {
      const variant = [it.size, it.color].filter(Boolean).join(', ');
      lines.push(`${i + 1}) ${it.product_name}${variant ? ` (${variant})` : ''} × ${it.quantity} — ৳${it.price * it.quantity}`);
    });
    lines.push(`মোট: ৳${existingOrder.total}`);
    if (newItems && newItems.length > 0) {
      lines.push('');
      lines.push(`➕ নতুন যোগ করতে চাই:`);
      let newTotal = 0;
      newItems.forEach((it, i) => {
        const variant = [it.size, it.color].filter(Boolean).join(', ');
        const sub = it.price * it.quantity;
        newTotal += sub;
        lines.push(`${i + 1}) ${it.product_name}${variant ? ` (${variant})` : ''} × ${it.quantity} — ৳${sub}`);
      });
      lines.push(`নতুন মোট: ৳${newTotal}`);
    }
    lines.push('');
    lines.push(`দয়া করে আমার অর্ডারটি আপডেট করে দিন।`);
    return lines.join('\n');
  };

  const waDigits = (whatsappNumber || '+8801843711211').replace(/[\s-]/g, '').replace(/^\+?88/, '');
  const whatsappLink = `https://wa.me/88${waDigits}?text=${encodeURIComponent(buildWaMessage())}`;

  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
    return () => clearTimeout(t);
  }, [existingOrder.order_number]);

  return (
    <div ref={rootRef}>
    <Card className="border-orange-300 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-700 animate-fade-in shadow-lg shadow-orange-200/50 dark:shadow-orange-900/30">

      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-orange-800 dark:text-orange-300">
              আপনার আগে একটি অর্ডার করা হয়েছে
            </h3>
            <p className="text-xs text-orange-700 dark:text-orange-400">
              অর্ডার নম্বর: <strong>{existingOrder.order_number}</strong>
            </p>
          </div>
        </div>

        {/* Order summary */}
        <div className="bg-white dark:bg-background rounded-lg border border-orange-200 dark:border-orange-800 p-3 space-y-2">
          {existingOrder.items.map((item, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="text-foreground">
                {item.product_name}
                {item.size && ` (${item.size})`}
                {item.color && ` - ${item.color}`}
                {' × '}{item.quantity}
              </span>
              <span className="font-medium">৳{item.price * item.quantity}</span>
            </div>
          ))}
          <div className="flex justify-between text-sm font-bold border-t border-orange-200 dark:border-orange-800 pt-2">
            <span>মোট</span>
            <span>৳{existingOrder.total}</span>
          </div>
        </div>

        {newItems && newItems.length > 0 && (
          <div className="bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800 p-3 space-y-2">
            <p className="text-[11px] font-bold text-green-800 dark:text-green-300 uppercase tracking-wide">
              ➕ নতুন যোগ করতে চান
            </p>
            {newItems.map((item, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-foreground">
                  {item.product_name}
                  {item.size && ` (${item.size})`}
                  {item.color && ` - ${item.color}`}
                  {' × '}{item.quantity}
                </span>
                <span className="font-medium">৳{item.price * item.quantity}</span>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-orange-700 dark:text-orange-400">
          WhatsApp-এ ক্লিক করলে আপনার আগের অর্ডার এবং নতুন যোগ করতে চাওয়া পণ্যের বিস্তারিত সহ মেসেজ চলে যাবে। প্রয়োজনে হটলাইনে কল করুন:{' '}
          <a
            href={`tel:${helplineNumber || '+8801843711211'}`}
            className="font-bold text-orange-900 dark:text-orange-200 underline underline-offset-2 hover:text-green-700"
          >
            {helplineNumber || '+880 9617 888821'}
          </a>
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            asChild
            size="sm"
            className="relative overflow-hidden bg-green-600 hover:bg-green-700 text-white gap-1.5 text-xs shadow-lg shadow-green-500/40 hover:scale-105 transition-transform animate-[pulse_2s_ease-in-out_infinite]"
          >
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_2.2s_infinite]" />
              <MessageCircle className="h-3.5 w-3.5 animate-bounce" />
              WhatsApp করুন
            </a>
          </Button>
          {helplineNumber && (
            <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs hover-scale">
              <a href={`tel:${helplineNumber}`}>
                <Phone className="h-3.5 w-3.5" />
                {helplineNumber}
              </a>
            </Button>
          )}
          {onDismiss && (
            <Button variant="ghost" size="sm" onClick={onDismiss} className="text-xs ml-auto">
              বন্ধ করুন
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
    </div>
  );
}
