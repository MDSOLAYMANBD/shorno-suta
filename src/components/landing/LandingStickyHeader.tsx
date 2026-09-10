import { useState, useEffect } from 'react';
import { Phone, MessageCircle, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { trackVisitorActivity } from '@/hooks/useVisitorTracking';

interface Props {
  helpline?: string;
  brandName?: string;
  ctaText?: string;
  brandColor?: string;
  logoUrl?: string;
  showCallButton?: boolean;
  showWhatsappButton?: boolean;
  whatsappNumber?: string;
  showCtaButton?: boolean;
  pageTitle?: string;
  products?: { name: string; price: number; original_price?: number }[];
  ctaColor?: string;
  ctaTextColor?: string;
  bgColor?: string;
  textColor?: string;
  showShadow?: boolean;
  logoMode?: 'icon_text' | 'wide_logo';
  wideLogoUrl?: string;
  wideLogoAlign?: 'left' | 'center';
}

interface ActionButton {
  id: string;
  render: (primary: boolean) => React.ReactNode;
}

export default function LandingStickyHeader({
  helpline, brandName, ctaText, brandColor, logoUrl,
  showCallButton = true, showWhatsappButton = false, whatsappNumber,
  showCtaButton = true,
  ctaColor, ctaTextColor, bgColor, textColor, showShadow = true,
  logoMode = 'icon_text', wideLogoUrl, wideLogoAlign = 'left',
  pageTitle, products,
}: Props) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const scrollToForm = () => {
    document.getElementById('order-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const color = brandColor || '#429B39';
  const headerBg = bgColor || '#ffffff';
  const brandTextColor = textColor || color;
  const buttonBg = ctaColor || color;
  const buttonTextColor = ctaTextColor || '#ffffff';
  let waNumber = (whatsappNumber || helpline || '').replace(/[^0-9]/g, '');
  if (waNumber.startsWith('0')) waNumber = '880' + waNumber.slice(1);

  // Build WhatsApp pre-filled message
  const waMessage = (() => {
    if (!pageTitle && (!products || products.length === 0)) return '';
    let msg = 'আসসালামু আলাইকুম,';
    if (pageTitle) msg += `\nআমি "${pageTitle}" পেজ থেকে মেসেজ করছি।`;
    if (products && products.length > 0) {
      msg += '\n\nপ্রোডাক্ট:';
      products.forEach(p => {
        const priceText = p.original_price && p.original_price > p.price
          ? `৳${p.price.toLocaleString()} (আগে ৳${p.original_price.toLocaleString()})`
          : `৳${p.price.toLocaleString()}`;
        msg += `\n• ${p.name} - ${priceText}`;
      });
    }
    msg += '\n\nআমি অর্ডার করতে চাই।';
    return msg;
  })();
  const waUrl = `https://wa.me/${waNumber}${waMessage ? `?text=${encodeURIComponent(waMessage)}` : ''}`;

  // Build active buttons list
  const activeButtons: ActionButton[] = [];

  if (showCallButton && helpline) {
    activeButtons.push({
      id: 'call',
      render: (primary) => (
        <a key="call" href={`tel:${helpline}`} onClick={() => trackVisitorActivity('call_click')} className={primary
          ? 'flex items-center gap-1.5 text-sm font-medium bg-muted rounded-full px-3 py-1.5 text-muted-foreground hover:text-foreground'
          : 'flex items-center justify-center h-9 w-9 rounded-full bg-muted text-muted-foreground hover:text-foreground sm:h-auto sm:w-auto sm:rounded-md sm:bg-transparent sm:px-0'
        }>
          <Phone className="h-4 w-4" />
          <span className={primary ? 'inline text-xs' : 'hidden sm:inline'}>{helpline}</span>
        </a>
      ),
    });
  }

  if (showWhatsappButton && waNumber) {
    activeButtons.push({
      id: 'wa',
      render: (primary) => (
        <a key="wa" href={waUrl} target="_blank" rel="noopener noreferrer" onClick={() => trackVisitorActivity('whatsapp_click')}
          className={primary
            ? 'flex items-center gap-1.5 text-sm font-medium bg-green-50 rounded-full px-3 py-1.5 text-green-600 hover:text-green-700'
            : 'flex items-center justify-center h-9 w-9 rounded-full bg-green-50 text-green-600 hover:text-green-700 sm:h-auto sm:w-auto sm:rounded-md sm:bg-transparent sm:px-0'
          }>
          <MessageCircle className="h-4 w-4" />
          <span className={primary ? 'inline text-xs' : 'hidden sm:inline'}>WhatsApp</span>
        </a>
      ),
    });
  }

  if (showCtaButton) {
    activeButtons.push({
      id: 'cta',
      render: (primary) => primary ? (
        <Button key="cta" size="sm" onClick={scrollToForm}
          className="rounded-full text-xs sm:text-sm px-3 sm:px-5"
          style={{ backgroundColor: buttonBg, color: buttonTextColor }}>
          {ctaText || 'এখনই অর্ডার করুন'}
        </Button>
      ) : (
        <button key="cta" onClick={scrollToForm}
          className="flex items-center justify-center h-9 w-9 rounded-full sm:h-auto sm:w-auto sm:rounded-full sm:px-3 sm:py-1.5"
          style={{ backgroundColor: buttonBg, color: buttonTextColor }}>
          <ShoppingBag className="h-4 w-4 sm:hidden" />
          <span className="hidden sm:inline text-xs font-medium">{ctaText || 'এখনই অর্ডার করুন'}</span>
        </button>
      ),
    });
  }

  return (
    <header
      className={`transition-shadow h-[60px] sm:h-[70px] flex items-center px-4 sm:px-6 ${scrolled && showShadow ? 'shadow-md' : ''}`}
      style={{ backgroundColor: headerBg }}
    >
      <div className="max-w-5xl mx-auto w-full flex items-center justify-between">
        <a href="/" className={`flex items-center gap-2 no-underline ${logoMode === 'wide_logo' && wideLogoUrl ? (wideLogoAlign === 'center' ? 'justify-center' : '') : ''}`}>
          {logoMode === 'wide_logo' && wideLogoUrl ? (
            <img src={wideLogoUrl} alt="Logo" className="h-10 sm:h-11 object-contain" />
          ) : (
            <>
              <Avatar className="h-10 w-10 sm:h-11 sm:w-11 border-2 border-border shadow-sm">
                {logoUrl && <AvatarImage src={logoUrl} alt="Logo" loading="eager" className="object-cover" />}
                <AvatarFallback className="text-sm font-bold" style={{ backgroundColor: color, color: '#fff' }}>
                  {(brandName || 'S').charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className="text-xl sm:text-2xl font-bold" style={{ color: brandTextColor }}>
                {brandName || 'স্বর্ণ সুতা'}
              </span>
            </>
          )}
        </a>
        <div className="flex items-center gap-2 sm:gap-3">
          {activeButtons.map((btn, idx) => btn.render(idx === 0))}
        </div>
      </div>
    </header>
  );
}
