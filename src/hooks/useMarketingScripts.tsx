import { useEffect } from 'react';
import { usePublicSettings } from '@/hooks/useStoreSettings';
import { useTrackingInit } from '@/hooks/useEcommerceTracking';
import { trackMetaPageView } from '@/lib/metaTracking';
import { parseGoogleAdsAccounts } from '@/lib/ecommerceTracking';

declare global {
  interface Window {
    dataLayer: any[];
    fbq: (...args: any[]) => void;
    _fbq: any;
    gtag: (...args: any[]) => void;
  }
}

const isValidGTMId = (id: string) => /^GTM-[A-Z0-9]{7,8}$/.test(id);

/** Extract content value from a full meta tag or return raw value */
const extractMetaContent = (val: string): string => {
  const match = val.match(/content=["']([^"']+)["']/);
  return match ? match[1] : val.trim();
};

export function useMarketingScripts() {
  const { data: settings } = usePublicSettings();

  // Initialize GA4 dataLayer + Meta Pixel/CAPI from store settings
  useTrackingInit();

  // Inject site verification meta tags
  useEffect(() => {
    if (!settings) return;
    const tags: HTMLMetaElement[] = [];
    const verifications: [string, string][] = [
      ['pinterest_verification', 'p:domain_verify'],
      ['google_verification', 'google-site-verification'],
      ['facebook_domain_verification', 'facebook-domain-verification'],
    ];
    for (const [key, name] of verifications) {
      const raw = settings[key];
      if (raw) {
        const content = extractMetaContent(raw);
        const meta = document.createElement('meta');
        meta.setAttribute('name', name);
        meta.setAttribute('content', content);
        document.head.appendChild(meta);
        tags.push(meta);
      }
    }
    return () => { tags.forEach(t => t.remove()); };
  }, [settings]);

  useEffect(() => {
    if (!settings) return;

    // CRITICAL — Meta Pixel PageView must fire promptly for attribution.
    // Schedule on idle with a short timeout so it never blocks INP but also
    // never gets delayed by seconds. Do NOT defer this behind GTM.
    const firePixelPageView = () => {
      const pixelEnabled = settings.meta_pixel_enabled !== 'false';
      if (settings.facebook_pixel_id && pixelEnabled) {
        trackMetaPageView();
      }
    };
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(firePixelPageView, { timeout: 800 });
    } else {
      setTimeout(firePixelPageView, 200);
    }

    // Google Ads gtag — loaded directly (not via GTM) so conversion tracking
    // doesn't depend on GTM container config. Multiple Google Ads accounts
    // can run ads for this site at once — one gtag.js load is enough, but
    // every account needs its own gtag('config', 'AW-...') call.
    const initGoogleAdsGtag = () => {
      const accounts = parseGoogleAdsAccounts(settings.google_ads_accounts);
      if (!accounts.length || document.getElementById('google-ads-gtag')) return;
      window.dataLayer = window.dataLayer || [];
      if (!window.gtag) {
        window.gtag = function (...args: any[]) { window.dataLayer.push(args); };
      }
      window.gtag('js', new Date());
      accounts.forEach(acc => window.gtag('config', `AW-${acc.id}`));
      const script = document.createElement('script');
      script.id = 'google-ads-gtag';
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=AW-${accounts[0].id}`;
      document.head.appendChild(script);
    };
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(initGoogleAdsGtag, { timeout: 800 });
    } else {
      setTimeout(initGoogleAdsGtag, 200);
    }

    // GTM container is non-critical for initial paint — defer until browser idle.
    const initGtm = () => {
      const gtmId = settings.gtm_id;
      if (gtmId && isValidGTMId(gtmId) && !document.getElementById('gtm-script')) {
        window.dataLayer = window.dataLayer || [];
        const script = document.createElement('script');
        script.id = 'gtm-script';
        script.innerHTML = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`;
        document.head.appendChild(script);
      }
    };
    const timer = setTimeout(initGtm, 2500);
    return () => clearTimeout(timer);
  }, [settings]);
}

// Legacy trackEvent — now fires GA4 dataLayer + Meta Pixel
export function trackEvent(event: string, data?: any) {
  // GA4 dataLayer
  if (window.dataLayer) {
    window.dataLayer.push({ event, ...data });
  }
  // FB Pixel
  if (window.fbq) {
    window.fbq('track', event, data);
  }
}
