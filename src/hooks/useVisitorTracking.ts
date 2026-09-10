import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

let sessionId: string | null = null;

export function getSessionId(): string {
  if (sessionId) return sessionId;
  const stored = sessionStorage.getItem('visitor_session_id');
  if (stored) { sessionId = stored; return stored; }
  const id = crypto.randomUUID();
  sessionStorage.setItem('visitor_session_id', id);
  sessionId = id;
  return id;
}

// Classifies where this visit came from — used only for the site_visits.source
// column that ভিজিটর অ্যানালিটিক্স reads. Deliberately separate from
// useUtmCapture's detectSource()/getOrderOrigin(), which drives order
// attribution (order_origin) elsewhere and must keep its existing behavior
// unchanged. This one also falls back to the referrer domain, so organic
// (non-ad-click) Facebook/Google traffic is distinguishable from direct visits
// — detectSource() only catches paid/utm-tagged clicks, which isn't enough to
// answer "কত জন organic ভাবে আসে".
function classifyVisitSource(): string {
  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get('utm_source')?.toLowerCase();
  const fbclid = params.get('fbclid');
  const gclid = params.get('gclid');

  if (fbclid || utmSource === 'facebook' || utmSource === 'fb') return 'facebook';
  if (gclid || utmSource === 'google') return 'google';
  if (utmSource === 'whatsapp') return 'whatsapp';
  if (utmSource === 'tiktok') return 'tiktok';
  if (utmSource === 'instagram') return 'instagram';
  if (utmSource) return utmSource;

  const ref = document.referrer.toLowerCase();
  if (!ref) return 'direct';
  if (ref.includes(window.location.hostname)) return 'direct';
  if (ref.includes('facebook.com') || ref.includes('fb.com')) return 'facebook';
  if (ref.includes('google.')) return 'google';
  if (ref.includes('instagram.com')) return 'instagram';
  if (ref.includes('whatsapp.com')) return 'whatsapp';
  if (ref.includes('tiktok.com')) return 'tiktok';
  if (ref.includes('youtube.com')) return 'youtube';
  return 'referral';
}

export function useVisitorTracking() {
  useEffect(() => {
    const key = 'visitor_tracked';
    if (sessionStorage.getItem(key)) return;

    const run = () => {
      const sid = getSessionId();
      sessionStorage.setItem(key, sid);
      supabase
        .from('site_visits' as any)
        .insert({ session_id: sid, page_path: window.location.pathname, source: classifyVisitSource() } as any)
        .then(() => {});
    };

    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(run, { timeout: 5000 });
    } else {
      setTimeout(run, 3000);
    }
  }, []);
}

// Track visitor activity: product_view, add_to_cart, checkout_start, and
// contact-button clicks (call/whatsapp/messenger) — the latter three exist so
// ভিজিটর অ্যানালিটিক্স can cross-tab them against visitor source (site_visits.source)
// by session_id, answering "which ad channel actually drives contact clicks".
export function trackVisitorActivity(
  activityType: 'product_view' | 'add_to_cart' | 'checkout_start' | 'call_click' | 'whatsapp_click' | 'messenger_click',
  productId?: string,
  productName?: string,
  metadata?: Record<string, any>
) {
  const sid = getSessionId();
  supabase
    .from('visitor_activity' as any)
    .insert({
      session_id: sid,
      activity_type: activityType,
      product_id: productId || null,
      product_name: productName || null,
      metadata: metadata || {},
    } as any)
    .then(() => {});
}

export function useTrackProductView(productId?: string, productName?: string) {
  useEffect(() => {
    if (productId) {
      trackVisitorActivity('product_view', productId, productName);
    }
  }, [productId]);
}
