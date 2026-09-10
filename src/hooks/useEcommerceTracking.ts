import { useEffect, useRef } from 'react';
import { usePublicSettings } from '@/hooks/useStoreSettings';
import { setTrackingConfig, setGoogleAdsConfig } from '@/lib/ecommerceTracking';
import { initMetaPixel, setCapiEnabled, markTrackingReady } from '@/lib/metaTracking';

/**
 * Hook to initialize tracking config from store settings.
 * Call once at app level (e.g., in useMarketingScripts).
 */
export function useTrackingInit() {
  const { data: settings } = usePublicSettings();
  const initialized = useRef(false);

  useEffect(() => {
    if (!settings || initialized.current) return;
    initialized.current = true;

    // GA4 config
    setTrackingConfig(settings.store_currency || 'BDT', settings.store_name_bn || '');

    // Meta Pixel init
    const pixelId = settings.facebook_pixel_id;
    const pixelEnabled = settings.meta_pixel_enabled !== 'false';
    if (pixelId && /^[0-9]{15,16}$/.test(pixelId) && pixelEnabled) {
      initMetaPixel(pixelId);
    }

    // CAPI config
    const capiEnabled = settings.meta_capi_enabled === 'true';
    setCapiEnabled(capiEnabled);

    // Google Ads client-side conversion config — one or more accounts
    setGoogleAdsConfig(settings.google_ads_accounts);

    // Release any Meta events that were queued while settings were loading.
    markTrackingReady();
  }, [settings]);
}

/**
 * Hook to prevent duplicate event firing on SPA navigation.
 * Returns a function that returns true only on first call per key.
 */
export function useEventGuard() {
  const firedRef = useRef<Set<string>>(new Set());

  return (key: string): boolean => {
    if (firedRef.current.has(key)) return false;
    firedRef.current.add(key);
    return true;
  };
}
