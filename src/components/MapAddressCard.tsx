import { MapPin } from 'lucide-react';
import { useSiteConfig, DEFAULT_FOOTER_CONFIG } from '@/hooks/useSiteConfig';

export default function MapAddressCard() {
  const { data: savedFooterConfig } = useSiteConfig('footer_config');
  const cfg: any = savedFooterConfig ? { ...DEFAULT_FOOTER_CONFIG, ...savedFooterConfig } : DEFAULT_FOOTER_CONFIG;
  const address = cfg?.address || '';
  if (!address) return null;

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 mt-6 sm:mt-8">
      <a
        href="https://maps.app.goo.gl/bSsZ9Y7UvPECVUE48"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Google Maps এ আমাদের ঠিকানা দেখুন"
        className="group relative block rounded-2xl border border-border bg-card hover:bg-accent/30 hover:border-primary/40 p-3 sm:p-4 transition-all duration-300 hover:shadow-[0_6px_24px_-8px_hsl(var(--primary)/0.35)]"
      >
        <div className="flex items-start gap-3">
          <span className="relative shrink-0 mt-0.5">
            <span className="absolute inset-0 rounded-full bg-red-500/30 blur-md animate-pulse" />
            <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md ring-2 ring-red-500">
              <MapPin className="h-5 w-5 fill-red-500 text-red-500" />
            </span>
          </span>
          <div className="min-w-0 flex-1 text-left">
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <span className="font-bold text-xs tracking-tight">
                <span style={{ color: '#4285F4' }}>G</span>
                <span style={{ color: '#EA4335' }}>o</span>
                <span style={{ color: '#FBBC05' }}>o</span>
                <span style={{ color: '#4285F4' }}>g</span>
                <span style={{ color: '#34A853' }}>l</span>
                <span style={{ color: '#EA4335' }}>e</span>
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Maps</span>
              <span className="ml-auto text-[10px] sm:text-xs font-semibold text-emerald-600 group-hover:text-emerald-700">
                লোকেশন দেখুন →
              </span>
            </div>
            <p className="text-sm leading-snug text-foreground group-hover:text-primary transition-colors">
              {address}
            </p>
          </div>
        </div>
      </a>
    </div>
  );
}
