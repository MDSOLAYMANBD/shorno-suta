import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SESSION_KEY = 'order_origin_source';
const LANDING_URL_KEY = 'order_landing_url';
const REFERRER_KEY = 'order_referrer';
const DEVICE_KEY = 'order_device_type';
const PAGE_VIEWS_KEY = 'order_page_views';

function detectSource(): string {
  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get('utm_source')?.toLowerCase();
  const fbclid = params.get('fbclid');
  const gclid = params.get('gclid');

  if (fbclid || utmSource === 'facebook' || utmSource === 'fb') return 'facebook';
  if (gclid || utmSource === 'google') return 'google';
  if (utmSource === 'whatsapp') return 'whatsapp';
  if (utmSource === 'tiktok') return 'tiktok';
  if (utmSource === 'instagram') return 'instagram';
  return 'website';
}

function detectDeviceType(): string {
  const ua = navigator.userAgent.toLowerCase();
  const width = window.innerWidth;
  if (/tablet|ipad|playbook|silk/i.test(ua) || (width >= 600 && width <= 1024)) return 'Tablet';
  if (/mobile|iphone|ipod|android.*mobile|windows phone/i.test(ua) || width < 600) return 'Mobile';
  return 'Desktop';
}

/**
 * Call once at app level to capture UTM/fbclid/gclid from the landing URL.
 * Also captures landing URL, referrer, device type, and tracks page views.
 */
export function useUtmCapture() {
  const location = useLocation();

  useEffect(() => {
    // Only capture on first load (don't overwrite if already set)
    if (sessionStorage.getItem(SESSION_KEY)) return;
    const source = detectSource();
    sessionStorage.setItem(SESSION_KEY, source);
    sessionStorage.setItem(LANDING_URL_KEY, window.location.pathname + window.location.search);
    sessionStorage.setItem(REFERRER_KEY, document.referrer || '');
    sessionStorage.setItem(DEVICE_KEY, detectDeviceType());
    sessionStorage.setItem(PAGE_VIEWS_KEY, '1');
  }, []);

  // Increment page views on route change
  useEffect(() => {
    const current = parseInt(sessionStorage.getItem(PAGE_VIEWS_KEY) || '0', 10);
    if (current > 0) {
      sessionStorage.setItem(PAGE_VIEWS_KEY, String(current + 1));
    }
  }, [location.pathname]);
}

/**
 * Returns the detected order origin source.
 * Call this when placing an order.
 */
export function getOrderOrigin(): string {
  return sessionStorage.getItem(SESSION_KEY) || 'website';
}

/**
 * Returns order attribution data for tracking.
 * Call this when placing an order.
 */
export function getOrderAttribution(): Record<string, any> {
  return {
    origin: sessionStorage.getItem(SESSION_KEY) || 'website',
    landing_url: sessionStorage.getItem(LANDING_URL_KEY) || '/',
    referrer: sessionStorage.getItem(REFERRER_KEY) || '',
    device_type: sessionStorage.getItem(DEVICE_KEY) || 'Unknown',
    page_view_count: parseInt(sessionStorage.getItem(PAGE_VIEWS_KEY) || '1', 10),
  };
}
