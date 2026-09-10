import { useEffect } from 'react';
import { useTrackingInit } from '@/hooks/useEcommerceTracking';
import { trackMetaPageView } from '@/lib/metaTracking';
import { usePublicSettings } from '@/hooks/useStoreSettings';

/**
 * Lightweight tracking hook for landing pages.
 * - NO GTM script injection (avoids DOM interference)
 * - NO site verification meta tags
 * - Meta Pixel SDK init (single async script, safe)
 * - PageView fires after 5s delay via requestIdleCallback
 * - dataLayer.push() only if GTM already loaded from main site
 */
export function useLandingTracking() {
  const { data: settings } = usePublicSettings();

  // Init Meta Pixel SDK (async, no DOM layout impact)
  useTrackingInit();

  useEffect(() => {
    if (!settings) return;

    const pixelEnabled = settings.meta_pixel_enabled !== 'false';
    if (!settings.facebook_pixel_id || !pixelEnabled) return;

    // Fire PageView after UI is stable
    const timer = setTimeout(() => {
      const fire = () => {
        trackMetaPageView();
        // Push neutral event to dataLayer if GTM was loaded elsewhere
        if (window.dataLayer) {
          window.dataLayer.push({ event: 'lp_page_view', timestamp: new Date().getTime() });
        }
      };

      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(fire, { timeout: 3000 });
      } else {
        fire();
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [settings]);
}
