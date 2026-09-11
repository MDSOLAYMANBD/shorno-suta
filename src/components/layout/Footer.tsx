import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { Phone, MapPin, Facebook, Instagram, Youtube, MessageCircle, Sparkles } from 'lucide-react';
import { useSiteConfig, DEFAULT_FOOTER_CONFIG } from '@/hooks/useSiteConfig';
import SeamVineMotif from './SeamVineMotif';

/** Hand-drawn line-art paisley (কলকা) motif — classic Bengali textile print. */
function KolkaMotif({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 100 130" className={className} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M62 8 C 90 22, 92 58, 68 82 C 50 100, 50 112, 66 122 C 44 126, 24 112, 22 90 C 20 66, 40 58, 52 66 C 62 72, 60 84, 48 84 C 40 84, 36 76, 40 70" />
      <circle cx="70" cy="30" r="2" fill="currentColor" stroke="none" />
      <circle cx="78" cy="42" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Nakshi-kantha inspired stitched floral rosette. */
function KanthaRosette({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <circle cx="50" cy="50" r="42" strokeDasharray="1 6" />
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <path
          key={deg}
          d="M50 50 Q 58 34 50 20 Q 42 34 50 50"
          transform={`rotate(${deg} 50 50)`}
        />
      ))}
      <circle cx="50" cy="50" r="7" />
    </svg>
  );
}

/** Thread spool, needle & trailing stitch — the brand's own "golden thread" mark. */
function ThreadSpoolMotif({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 200 200" className={className} fill="none" stroke="currentColor">
      <circle cx="100" cy="100" r="92" strokeWidth="1" strokeDasharray="1 5" strokeLinecap="round" />
      <circle cx="100" cy="100" r="80" strokeWidth="0.75" />
      <line x1="52" y1="152" x2="148" y2="56" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="139" cy="65" r="8" strokeWidth="2.5" />
      <path
        d="M52 152 C 26 142, 14 110, 40 93 C 62 79, 80 98, 64 114 C 54 124, 40 117, 47 106"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path d="M118 38 C 129 26, 147 28, 153 43 C 141 47, 124 47, 118 38 Z" fill="currentColor" stroke="none" opacity="0.7" />
      <path d="M134 22 C 142 16, 154 19, 157 29 C 148 31, 137 29, 134 22 Z" fill="currentColor" stroke="none" opacity="0.5" />
    </svg>
  );
}

/** Palm-leaf & vine branch — anchors the opposite corner, mirrors the logo's leaf flourish. */
function LeafBranchMotif({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 120 180" className={className} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <path d="M20 175 C 22 130, 18 80, 30 20" />
      {[
        [30, 150, 60, 140, 40, 128],
        [30, 120, 65, 108, 42, 98],
        [30, 92, 68, 78, 44, 68],
        [30, 62, 64, 46, 42, 40],
        [28, 34, 55, 18, 38, 14],
      ].map(([sx, sy, ex, ey, mx], i) => (
        <path key={i} d={`M${sx} ${sy} Q ${mx} ${(sy + ey) / 2} ${ex} ${ey}`} />
      ))}
    </svg>
  );
}


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
    <footer className="mt-16 bg-accent relative rounded-t-3xl sm:rounded-t-[2.5rem]">
      {/* Growing vines at the seam — climb out of the maroon footer into the white
          page above it, softly swaying, so the boundary feels alive rather than a
          flat cut between two stacked colour blocks. */}
      <div className="absolute -top-[100px] sm:-top-[123px] left-0 w-[175px] sm:w-[230px] h-[207px] sm:h-[272px] z-10 pointer-events-none overflow-hidden">
        <SeamVineMotif className="w-full h-full animate-seam-vine-grow" variant="a" animationClass="animate-seam-vine-sway" />
      </div>
      <div className="absolute -top-[73px] sm:-top-[89px] right-0 w-[145px] sm:w-[190px] h-[171px] sm:h-[225px] z-10 pointer-events-none overflow-hidden">
        <SeamVineMotif className="w-full h-full animate-seam-vine-grow" variant="b" animationClass="animate-seam-vine-sway-slow" />
      </div>

      {/* Brand illustration set — Bengali textile motifs (কলকা, নকশিকাঁথা, সুতা-সুচ), scattered densely like a hand-drawn signature rather than generic icons. Visible at every breakpoint (site is mostly mobile traffic) so the background never reads as bare. */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <LeafBranchMotif className="absolute -bottom-4 -left-2 w-24 sm:w-32 text-white/[0.15]" />
        <LeafBranchMotif className="absolute -top-3 -right-3 w-16 sm:w-20 text-white/[0.13] scale-x-[-1]" />
        <ThreadSpoolMotif className="absolute -bottom-10 -right-10 w-64 sm:w-80 text-primary/[0.18]" />
        <KolkaMotif className="absolute top-[6%] right-[8%] w-12 sm:w-16 text-white/[0.17] rotate-[-15deg]" />
        <KolkaMotif className="absolute top-[42%] left-[4%] w-10 sm:w-14 text-white/[0.15] rotate-[12deg]" />
        <KolkaMotif className="absolute bottom-[30%] right-[20%] w-10 sm:w-14 text-primary/[0.16] rotate-[-8deg]" />
        <KanthaRosette className="absolute top-[3%] left-[12%] w-10 sm:w-12 text-white/[0.17]" />
        <KanthaRosette className="absolute top-[58%] right-[6%] w-9 sm:w-12 text-white/[0.15]" />
        <KanthaRosette className="absolute bottom-[42%] left-[22%] w-8 sm:w-10 text-white/[0.13]" />
        <KanthaRosette className="absolute top-[24%] right-[32%] w-8 sm:w-10 text-white/[0.12]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 text-white">
        {/* Brand */}
        <div className="text-center sm:text-left">
          <div className={`flex items-center gap-3 mb-4 justify-center sm:justify-start ${cfg.logo_mode === 'wide_logo' && cfg.wide_logo_url ? (cfg.wide_logo_align === 'center' ? 'justify-center' : '') : ''}`}>
            {cfg.logo_mode === 'wide_logo' && cfg.wide_logo_url ? (
              <img src={cfg.wide_logo_url} alt={cfg.brand_name || 'Logo'} className="h-12 object-contain" />
            ) : (
              <>
                {cfg.logo_url ? (
                  <img src={cfg.logo_url} alt={cfg.brand_name || 'Logo'} className="w-16 h-16 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl shrink-0">{(cfg.brand_name || 'স').charAt(0)}</div>
                )}
                <h3 className="text-xl font-bold">{cfg.brand_name || 'স্বর্ণ সুতা'}</h3>
              </>
            )}
          </div>
          {/* Decorative sparkle divider — signature touch */}
          <div className="flex items-center gap-2 mb-3 justify-center sm:justify-start" aria-hidden="true">
            <span className="h-px w-8 bg-gradient-to-r from-transparent via-primary/60 to-primary/60" />
            <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="h-px w-8 bg-gradient-to-l from-transparent via-primary/60 to-primary/60 sm:hidden" />
          </div>

          <p className="text-[15px] sm:text-base opacity-90 leading-relaxed mb-5 max-w-xs mx-auto sm:mx-0 font-light">{cfg.brand_description}</p>
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
              href="https://maps.app.goo.gl/6yTAKU5mCaJ8ajYH9"
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
