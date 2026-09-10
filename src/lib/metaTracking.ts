// Meta (Facebook) Pixel + CAPI Tracking
// Debug: set window.META_DEBUG = true in console
// GDPR: set window.__META_CONSENT = true to allow firing

import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    fbq: (...args: any[]) => void;
    _fbq: any;
    META_DEBUG?: boolean;
    __META_CONSENT?: boolean;
  }
}

let _pixelInitialized = false;
let _pixelId = '';
let _capiEnabled = false;

// Store settings (pixel id, CAPI on/off) load asynchronously. Any trackMetaEvent
// call that happens before that resolves used to be silently dropped — no queue,
// no retry. Queue calls until settings are known, then flush once in order.
let _settingsReady = false;
let _pendingCalls: Array<() => void> = [];
let _readyFallbackTimer: ReturnType<typeof setTimeout> | null = null;

/** Called once store-settings-driven pixel/CAPI init has run (success or not). */
export function markTrackingReady() {
  if (_settingsReady) return;
  _settingsReady = true;
  if (_readyFallbackTimer) {
    clearTimeout(_readyFallbackTimer);
    _readyFallbackTimer = null;
  }
  const queued = _pendingCalls;
  _pendingCalls = [];
  queued.forEach(fn => fn());
}

function queueUntilReady(fn: () => void) {
  _pendingCalls.push(fn);
  // Safety net: if settings never resolve (network failure etc.), don't hold
  // events forever — flush best-effort after 5s so nothing is silently lost.
  if (!_readyFallbackTimer) {
    _readyFallbackTimer = setTimeout(markTrackingReady, 5000);
  }
}

export function initMetaPixel(pixelId: string) {
  if (!pixelId || _pixelInitialized) return;
  _pixelId = pixelId;

  // Load FB Pixel SDK
  if (!window.fbq) {
    const n: any = (window.fbq = function (...args: any[]) {
      n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
    });
    if (!window._fbq) window._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];
    const t = document.createElement('script');
    t.async = true;
    t.src = 'https://connect.facebook.net/en_US/fbevents.js';
    const s = document.getElementsByTagName('script')[0];
    s?.parentNode?.insertBefore(t, s);
  }

  window.fbq('init', pixelId);
  _pixelInitialized = true;

  if (window.META_DEBUG) {
    console.log('%c[Meta Pixel] Initialized:', 'color: #1877F2; font-weight: bold;', pixelId);
  }
}

export function setCapiEnabled(enabled: boolean) {
  _capiEnabled = enabled;
}

function isConsentGiven(): boolean {
  return window.__META_CONSENT !== false;
}

interface MetaEventData {
  content_name?: string;
  content_ids?: string[];
  contents?: Array<{ id: string; quantity: number; item_price?: number }>;
  content_type?: string;
  currency?: string;
  value?: number;
  num_items?: number;
}

export interface MetaUserData {
  em?: string; // raw email
  ph?: string; // raw phone
  fn?: string; // raw first name
  ln?: string; // raw last name
  client_user_agent?: string;
  client_ip?: string;
}

/**
 * Fire a Meta event on both Pixel (browser) and CAPI (server).
 * Uses a shared event_id for deduplication.
 * Pass a deterministic eventId for purchase-type events.
 */
export function trackMetaEvent(
  eventName: string,
  data: MetaEventData = {},
  userData?: MetaUserData,
  deterministicEventId?: string,
) {
  if (!isConsentGiven()) return;

  // Pixel/CAPI init depends on an async store-settings fetch. If this fires
  // before that resolves, queue it (with a fixed event_id so Pixel+CAPI still
  // dedup correctly) instead of silently dropping it.
  if (!_settingsReady) {
    const eventId = deterministicEventId || crypto.randomUUID();
    queueUntilReady(() => trackMetaEvent(eventName, data, userData, eventId));
    return;
  }

  const eventId = deterministicEventId || crypto.randomUUID();
  const eventTime = Math.floor(Date.now() / 1000);

  // Browser-side Pixel
  if (_pixelInitialized && window.fbq) {
    window.fbq('track', eventName, data, { eventID: eventId });
    if (window.META_DEBUG) {
      console.log(`%c[Meta Pixel] ${eventName}`, 'color: #1877F2; font-weight: bold;', { data, eventId });
    }
  }

  // Server-side CAPI
  if (_capiEnabled) {
    const enrichedUserData: MetaUserData = {
      ...userData,
      client_user_agent: userData?.client_user_agent || navigator.userAgent,
    };

    const capiPayload: any = {
      event_name: eventName,
      event_time: eventTime,
      event_id: eventId,
      user_data: enrichedUserData,
      custom_data: data,
      event_source_url: window.location.href,
    };

    supabase.functions.invoke('meta-capi', { body: capiPayload }).catch(err => {
      if (window.META_DEBUG) {
        console.error('[Meta CAPI] Error:', err);
      }
    });

    if (window.META_DEBUG) {
      console.log(`%c[Meta CAPI] ${eventName}`, 'color: #42B72A; font-weight: bold;', capiPayload);
      if (enrichedUserData.ph || enrichedUserData.em || enrichedUserData.fn) {
        console.log('%c[Meta] USER DATA OK', 'color: #22c55e; font-weight: bold;', enrichedUserData);
      }
    }
  }
}

// Convenience functions
export function trackMetaPageView() {
  if (!isConsentGiven() || !_pixelInitialized) return;
  window.fbq?.('track', 'PageView');
  if (window.META_DEBUG) {
    console.log('%c[Meta Pixel] PageView', 'color: #1877F2; font-weight: bold;');
  }
}

export function trackMetaViewContent(product: any, userData?: MetaUserData) {
  trackMetaEvent('ViewContent', {
    content_name: product.name_bn || product.name,
    content_ids: [product.id],
    content_type: 'product',
    currency: 'BDT',
    value: product.price,
  }, userData);
}

export function trackMetaAddToCart(product: any, quantity = 1, userData?: MetaUserData) {
  trackMetaEvent('AddToCart', {
    content_ids: [product.id],
    contents: [{ id: product.id, quantity }],
    content_type: 'product',
    currency: 'BDT',
    value: product.price * quantity,
  }, userData);
}

export function trackMetaInitiateCheckout(items: any[], value: number, userData?: MetaUserData) {
  trackMetaEvent('InitiateCheckout', {
    content_ids: items.map(i => i.id || i.product_id),
    contents: items.map(i => ({ id: i.id || i.product_id, quantity: i.quantity || i.qty || 1 })),
    content_type: 'product',
    currency: 'BDT',
    value,
    num_items: items.length,
  }, userData);
}

export function trackMetaAddPaymentInfo(value: number, userData?: MetaUserData) {
  trackMetaEvent('AddPaymentInfo', {
    currency: 'BDT',
    value,
  }, userData);
}

/**
 * Track Meta Purchase with deterministic event_id for Pixel↔CAPI dedup.
 * event_id = "purchase_{orderId}" — same on both Pixel and CAPI.
 */
export function trackMetaPurchase(
  orderId: string,
  items: any[],
  value: number,
  userData?: MetaUserData,
) {
  const deterministicEventId = `purchase_${orderId}`;
  trackMetaEvent('Purchase', {
    content_ids: items.map(i => i.id || i.product_id),
    contents: items.map(i => ({ id: i.id || i.product_id, quantity: i.quantity || i.qty || 1, item_price: i.price })),
    content_type: 'product',
    currency: 'BDT',
    value,
    num_items: items.length,
  }, userData, deterministicEventId);
}
