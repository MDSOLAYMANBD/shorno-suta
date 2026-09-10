import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { Phone, MapPin, Facebook, Instagram, Youtube, MessageCircle } from 'lucide-react';
import { useSiteConfig, DEFAULT_FOOTER_CONFIG } from '@/hooks/useSiteConfig';

const FLOATING_EMOJIS = [
  { emoji: '🛍️', top: '8%', left: '5%', delay: '0s', duration: '7s', size: 'text-3xl' },
  { emoji: '🛒', top: '60%', left: '85%', delay: '1.5s', duration: '9s', size: 'text-2xl' },
  { emoji: '📦', top: '25%', left: '90%', delay: '3s', duration: '8s', size: 'text-xl' },
  { emoji: '🎁', top: '70%', left: '10%', delay: '2s', duration: '6s', size: 'text-3xl' },
  { emoji: '✨', top: '15%', left: '50%', delay: '4s', duration: '5s', size: 'text-2xl' },
  { emoji: '💝', top: '80%', left: '45%', delay: '0.5s', duration: '10s', size: 'text-xl' },
  { emoji: '🏷️', top: '40%', left: '75%', delay: '2.5s', duration: '7.5s', size: 'text-2xl' },
  { emoji: '👗', top: '35%', left: '20%', delay: '1s', duration: '8.5s', size: 'text-3xl' },
  { emoji: '👜', top: '50%', left: '60%', delay: '3.5s', duration: '7s', size: 'text-2xl' },
  { emoji: '💎', top: '20%', left: '70%', delay: '2.2s', duration: '6.5s', size: 'text-xl' },
  { emoji: '🌸', top: '85%', left: '70%', delay: '4.5s', duration: '9s', size: 'text-2xl' },
  { emoji: '⭐', top: '5%', left: '30%', delay: '1.8s', duration: '5.5s', size: 'text-xl' },
  { emoji: '🛵', top: '55%', left: '35%', delay: '3.2s', duration: '11s', size: 'text-3xl' },
  { emoji: '💐', top: '90%', left: '25%', delay: '0.8s', duration: '8s', size: 'text-2xl' },
  { emoji: '🎀', top: '30%', left: '40%', delay: '2.8s', duration: '6.8s', size: 'text-xl' },
];


export default function Footer() {
  const { data: savedFooterConfig } = useSiteConfig('footer_config');
  const cfg = savedFooterConfig ? { ...DEFAULT_FOOTER_CONFIG, ...savedFooterConfig } : DEFAULT_FOOTER_CONFIG;

  useEffect(() => {
    if (document.getElementById('google-merchant-widget-script')) return;
    const script = document.createElement('script');
    script.id = 'google-merchant-widget-script';
    script.src = 'https://apis.google.com/js/platform.js?onload=renderBadge';
    script.async = true;
    script.defer = true;
    (window as any).renderBadge = function () {
      try {
        (window as any).gapi.load('ratingbadge', function () {
          (window as any).gapi.ratingbadge.render(document.getElementById('google-customer-reviews-badge'), {
            merchant_id: 5372768452,
            position: 'BOTTOM_RIGHT',
          });
        });
      } catch (e) {
        console.error('[Google Reviews Badge] Failed:', e);
      }
    };
    if ((window as any).gapi?.load) {
      (window as any).renderBadge();
    }
    document.head.appendChild(script);
  }, []);

  const quickLinks = cfg.quick_links || DEFAULT_FOOTER_CONFIG.quick_links;
  const policyLinks = cfg.policy_links || DEFAULT_FOOTER_CONFIG.policy_links;
  const paymentMethods = cfg.payment_methods || DEFAULT_FOOTER_CONFIG.payment_methods;

  return (
    <footer className="mt-16 bg-accent relative overflow-hidden">
      {/* Floating shopping emojis */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {FLOATING_EMOJIS.map((item, i) => (
          <span
            key={i}
            className={`absolute ${item.size} opacity-[0.22] animate-footer-emoji-float drop-shadow-[0_0_8px_rgba(255,255,255,0.35)]`}
            style={{
              top: item.top,
              left: item.left,
              animationDelay: item.delay,
              animationDuration: item.duration,
            }}
          >
            {item.emoji}
          </span>
        ))}
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 text-white">
        {/* Brand */}
        <div className="text-center sm:text-left">
          <div className={`flex items-center gap-2 mb-4 justify-center sm:justify-start ${cfg.logo_mode === 'wide_logo' && cfg.wide_logo_url ? (cfg.wide_logo_align === 'center' ? 'justify-center' : '') : ''}`}>
            {cfg.logo_mode === 'wide_logo' && cfg.wide_logo_url ? (
              <img src={cfg.wide_logo_url} alt={cfg.brand_name || 'Logo'} className="h-10 object-contain" />
            ) : (
              <>
                {cfg.logo_url ? (
                  <img src={cfg.logo_url} alt={cfg.brand_name || 'Logo'} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">{(cfg.brand_name || 'স').charAt(0)}</div>
                )}
                <h3 className="text-lg font-bold">{cfg.brand_name || 'স্বর্ণ সুতা'}</h3>
              </>
            )}
          </div>
          <p className="text-sm opacity-80 leading-relaxed mb-4">{cfg.brand_description}</p>
          <div className="flex items-center gap-3 justify-center sm:justify-start">
            {cfg.facebook && (
              <a href={cfg.facebook} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full backdrop-blur-sm bg-white/10 border border-white/20 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:bg-white/20 hover:shadow-[0_0_14px_hsl(var(--primary)/0.5)]">
                <Facebook className="h-4 w-4" />
              </a>
            )}
            {cfg.instagram && (
              <a href={cfg.instagram} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full backdrop-blur-sm bg-white/10 border border-white/20 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:bg-white/20 hover:shadow-[0_0_14px_hsl(var(--primary)/0.5)]">
                <Instagram className="h-4 w-4" />
              </a>
            )}
            {cfg.youtube && (
              <a href={cfg.youtube} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full backdrop-blur-sm bg-white/10 border border-white/20 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:bg-white/20 hover:shadow-[0_0_14px_hsl(var(--primary)/0.5)]">
                <Youtube className="h-4 w-4" />
              </a>
            )}
            {cfg.tiktok && (
              <a href={cfg.tiktok} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full backdrop-blur-sm bg-white/10 border border-white/20 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:bg-white/20 hover:shadow-[0_0_14px_hsl(var(--primary)/0.5)]">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1 0-5.78c.27 0 .54.04.8.1v-3.5a6.37 6.37 0 0 0-.8-.05A6.34 6.34 0 0 0 3.15 15.3a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.98a8.2 8.2 0 0 0 3.76.92V6.69z"/></svg>
              </a>
            )}
          </div>
        </div>

        {/* Quick Links + Policies */}
        <div className="grid grid-cols-2 sm:grid-cols-1 gap-4 sm:contents">
          <div className="text-center sm:text-left">
            <h4 className="text-sm font-semibold mb-1 uppercase tracking-wider">কুইক লিঙ্কস</h4>
            <div className="h-0.5 w-10 mx-auto sm:mx-0 mb-4 rounded-full bg-gradient-to-r from-primary to-primary/30" />
            <div className="space-y-2">
              {quickLinks.map((l: any) => (
                <Link key={l.to + l.label} to={l.to} className="group block text-sm opacity-80 hover:opacity-100 transition-all duration-200">
                  <span className="inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform duration-200">
                    {l.label}
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">→</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
          <div className="text-center sm:text-left">
            <h4 className="text-sm font-semibold mb-1 uppercase tracking-wider">পলিসি</h4>
            <div className="h-0.5 w-10 mx-auto sm:mx-0 mb-4 rounded-full bg-gradient-to-r from-primary to-primary/30" />
            <div className="space-y-2">
              {policyLinks.map((l: any) => (
                <Link key={l.to + l.label} to={l.to} className="group block text-sm opacity-80 hover:opacity-100 transition-all duration-200">
                  <span className="inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform duration-200">
                    {l.label}
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">→</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="text-center sm:text-left">
          <h4 className="text-sm font-semibold mb-1 uppercase tracking-wider">যোগাযোগ</h4>
          <div className="h-0.5 w-10 mx-auto sm:mx-0 mb-4 rounded-full bg-gradient-to-r from-primary to-primary/30" />
          <div className="space-y-3 text-sm opacity-90 mb-4">
            <a
              href="https://maps.app.goo.gl/bSsZ9Y7UvPECVUE48"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Google Maps এ আমাদের ঠিকানা দেখুন"
              className="group relative block rounded-2xl border border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/40 backdrop-blur-sm p-3 transition-all duration-300 hover:shadow-[0_0_20px_hsl(var(--primary)/0.25)]"
            >
              <div className="flex items-start gap-3">
                {/* Google Maps style pin */}
                <span className="relative shrink-0 mt-0.5">
                  <span className="absolute inset-0 rounded-full bg-red-500/40 blur-md animate-pulse" />
                  <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md ring-2 ring-red-500">
                    <MapPin className="h-5 w-5 fill-red-500 text-red-500" />
                  </span>
                </span>
                <div className="min-w-0 flex-1 text-left">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {/* Google G colors */}
                    <span className="font-bold text-[11px] tracking-tight">
                      <span style={{ color: '#4285F4' }}>G</span>
                      <span style={{ color: '#EA4335' }}>o</span>
                      <span style={{ color: '#FBBC05' }}>o</span>
                      <span style={{ color: '#4285F4' }}>g</span>
                      <span style={{ color: '#34A853' }}>l</span>
                      <span style={{ color: '#EA4335' }}>e</span>
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest opacity-70">Maps</span>
                    <span className="ml-auto text-[10px] font-medium text-emerald-300 opacity-90 group-hover:opacity-100">
                      লোকেশন দেখুন →
                    </span>
                  </div>
                  <p className="text-sm leading-snug group-hover:text-primary transition-colors">
                    {cfg.address}
                  </p>
                </div>
              </div>
            </a>
          </div>

          <div className="flex flex-col gap-2 mb-4">
            {cfg.phone && (
              <a href={`tel:+88${cfg.phone}`} className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/30 rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-300 hover:shadow-[0_0_16px_hsl(var(--primary)/0.3)] animate-footer-btn-pulse">
                <Phone className="h-4 w-4" />
                কল করুন — {cfg.phone}
              </a>
            )}
            {cfg.whatsapp && (
              <a href={`https://wa.me/88${cfg.whatsapp}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-300 animate-glow-pulse-btn">
                <MessageCircle className="h-4 w-4" />
                WhatsApp — {cfg.whatsapp}
              </a>
            )}
          </div>

          <h4 className="text-sm font-semibold mt-3 mb-1 uppercase tracking-wider">পেমেন্ট ও ডেলিভারি</h4>
          <div className="h-0.5 w-10 mx-auto sm:mx-0 mb-3 rounded-full bg-gradient-to-r from-primary to-primary/30" />
          <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
            {paymentMethods.map((m: string) => (
              <span key={m} className="text-xs px-3 py-1 rounded-full border border-white/30 opacity-80 transition-all duration-300 hover:scale-105 hover:bg-white/15 badge-shimmer">{m}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Gradient divider */}
      <div className="relative z-10 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

      <div id="google-customer-reviews-badge" className="relative z-10 flex justify-center py-2" />

      <div className="relative z-10 text-center py-4 pb-20 lg:pb-4 text-xs text-white/60">
        {(cfg.copyright || '© {year} স্বর্ণ সুতা। সর্বস্বত্ব সংরক্ষিত।').replace('{year}', new Date().getFullYear().toString())}
      </div>
    </footer>
  );
}
