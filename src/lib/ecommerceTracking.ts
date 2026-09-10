// GA4 Ecommerce DataLayer Tracking
// Debug: set window.TRACKING_DEBUG = true in console

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
    TRACKING_DEBUG?: boolean;
    __purchasedTxns?: Set<string>;
  }
}

// Initialize dataLayer
if (typeof window !== 'undefined') {
  window.dataLayer = window.dataLayer || [];
  window.__purchasedTxns = window.__purchasedTxns || new Set();
}

interface GA4Item {
  item_id: string;
  item_name: string;
  item_brand?: string;
  item_category?: string;
  item_variant?: string;
  price: number;
  quantity: number;
  index?: number;
}

let _currency = 'BDT';
let _brand = '';

export function setTrackingConfig(currency?: string, brand?: string) {
  if (currency) _currency = currency;
  if (brand) _brand = brand;
}

export interface GoogleAdsAccount {
  id: string;
  label: string;
}

/**
 * Multiple Google Ads accounts can run ads for the same site at once, each
 * needing its own conversion event. Setting is one "ID:LABEL" pair per line
 * (or comma-separated) so a merchant can list every active account.
 */
export function parseGoogleAdsAccounts(raw?: string): GoogleAdsAccount[] {
  if (!raw) return [];
  return raw
    .split(/[\n,]/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(pair => {
      const [id, label] = pair.split(':').map(p => p?.trim() || '');
      return { id, label };
    })
    .filter(a => a.id && a.label);
}

let _googleAdsAccounts: GoogleAdsAccount[] = [];

export function setGoogleAdsConfig(raw?: string) {
  const parsed = parseGoogleAdsAccounts(raw);
  if (parsed.length) _googleAdsAccounts = parsed;
}

// Bangladesh-only phone numbers → E.164 for Google Ads Enhanced Conversions
// (Google hashes this client-side once passed to gtag('set','user_data',...)).
function toE164BD(phone?: string): string | undefined {
  if (!phone) return undefined;
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('880')) digits = digits.slice(3);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  return digits ? `+880${digits}` : undefined;
}

function fireGoogleAdsConversion(
  transactionId: string,
  value: number,
  userData?: { email?: string; phone?: string },
) {
  if (!_googleAdsAccounts.length || !window.gtag) return;
  // Enhanced Conversions — improves match rate for the accounts that have it
  // turned on; harmless no-op for accounts that don't.
  const email = userData?.email?.trim();
  const phone = toE164BD(userData?.phone);
  if (email || phone) {
    window.gtag('set', 'user_data', {
      ...(email ? { email } : {}),
      ...(phone ? { phone_number: phone } : {}),
    });
  }
  for (const acc of _googleAdsAccounts) {
    window.gtag('event', 'conversion', {
      send_to: `AW-${acc.id}/${acc.label}`,
      value,
      currency: _currency,
      transaction_id: transactionId,
    });
  }
  if (window.TRACKING_DEBUG) {
    console.log('%c[Google Ads] conversion', 'color: #4285f4; font-weight: bold;', { transactionId, value, accounts: _googleAdsAccounts.length, enhancedConversions: !!(email || phone) });
  }
}

function pushEvent(event: string, ecommerce: any) {
  // Clear previous ecommerce data
  window.dataLayer.push({ ecommerce: null });
  const payload = { event, ecommerce };
  window.dataLayer.push(payload);

  if (window.TRACKING_DEBUG) {
    console.log(`%c[GA4 DataLayer] ${event}`, 'color: #4285f4; font-weight: bold;', ecommerce);
  }
}

function toGA4Item(item: any, index?: number): GA4Item {
  return {
    item_id: item.id || item.item_id || '',
    item_name: item.name_bn || item.name || item.item_name || '',
    ...(item.brand || _brand ? { item_brand: item.brand || _brand } : {}),
    ...(item.category ? { item_category: item.category } : {}),
    ...(item.size || item.color ? { item_variant: [item.size, item.color].filter(Boolean).join(' / ') } : {}),
    price: Number(item.price) || 0,
    quantity: item.quantity || item.qty || 1,
    ...(index !== undefined ? { index } : {}),
  };
}

/** GA4 recommended event — fires once per distinct query when a site search yields results. */
export function trackViewSearchResults(searchTerm: string) {
  const term = searchTerm.trim();
  if (!term) return;
  window.dataLayer.push({ event: 'view_search_results', search_term: term });
  if (window.TRACKING_DEBUG) {
    console.log('%c[GA4 DataLayer] view_search_results', 'color: #4285f4; font-weight: bold;', { search_term: term });
  }
}

export function trackViewItemList(products: any[], listName = 'Shop') {
  if (!products?.length) return;
  const items = products.map((p, i) => toGA4Item(p, i));
  const value = items.reduce((s, it) => s + it.price * it.quantity, 0);
  pushEvent('view_item_list', {
    currency: _currency,
    item_list_name: listName,
    value,
    items,
  });
}

export function trackSelectItem(product: any, listName = 'Shop', index = 0) {
  pushEvent('select_item', {
    currency: _currency,
    item_list_name: listName,
    items: [toGA4Item(product, index)],
  });
}

export function trackViewItem(product: any) {
  const item = toGA4Item(product);
  pushEvent('view_item', {
    currency: _currency,
    value: item.price * item.quantity,
    items: [item],
  });
}

export function trackAddToCart(product: any, quantity = 1) {
  const item = toGA4Item({ ...product, quantity });
  pushEvent('add_to_cart', {
    currency: _currency,
    value: item.price * quantity,
    items: [item],
  });
}

export function trackRemoveFromCart(product: any, quantity = 1) {
  const item = toGA4Item({ ...product, quantity });
  pushEvent('remove_from_cart', {
    currency: _currency,
    value: item.price * quantity,
    items: [item],
  });
}

export function trackViewCart(cartItems: any[]) {
  if (!cartItems?.length) return;
  const items = cartItems.map((it, i) => toGA4Item(it, i));
  const value = items.reduce((s, it) => s + it.price * it.quantity, 0);
  pushEvent('view_cart', {
    currency: _currency,
    value,
    items,
  });
}

export function trackBeginCheckout(cartItems: any[], value: number) {
  const items = cartItems.map((it, i) => toGA4Item(it, i));
  pushEvent('begin_checkout', {
    currency: _currency,
    value,
    items,
  });
}

export function trackAddShippingInfo(cartItems: any[], shippingTier: string, value: number) {
  const items = cartItems.map((it, i) => toGA4Item(it, i));
  pushEvent('add_shipping_info', {
    currency: _currency,
    value,
    shipping_tier: shippingTier,
    items,
  });
}

export function trackAddPaymentInfo(cartItems: any[], paymentType: string, value: number) {
  const items = cartItems.map((it, i) => toGA4Item(it, i));
  pushEvent('add_payment_info', {
    currency: _currency,
    value,
    payment_type: paymentType,
    items,
  });
}

/**
 * Track GA4 purchase event with global deduplication.
 * Returns true if fired, false if duplicate.
 */
export function trackPurchase(
  transactionId: string,
  cartItems: any[],
  value: number,
  shipping: number,
  coupon?: string,
  userData?: {
    customer_name?: string;
    customer_phone?: string;
    customer_address?: string;
    customer_email?: string;
  },
): boolean {
  // Duplicate guard — never fire the same transaction twice
  if (window.__purchasedTxns?.has(transactionId)) {
    if (window.TRACKING_DEBUG) {
      console.log('%c[GA4] PURCHASE DEDUP — skipped', 'color: #f59e0b; font-weight: bold;', transactionId);
    }
    return false;
  }
  window.__purchasedTxns?.add(transactionId);
  fireGoogleAdsConversion(transactionId, value, {
    email: userData?.customer_email,
    phone: userData?.customer_phone,
  });

  const items = cartItems.map((it, i) => toGA4Item(it, i));

  const userDataPayload = userData ? {
    user_data: {
      ...(userData.customer_name ? { customer_name: userData.customer_name } : {}),
      ...(userData.customer_phone ? { phone_number: userData.customer_phone } : {}),
      ...(userData.customer_address ? { address: userData.customer_address } : {}),
      ...(userData.customer_email ? { email_address: userData.customer_email } : {}),
    },
  } : {};

  pushEvent('purchase', {
    currency: _currency,
    transaction_id: transactionId,
    value,
    tax: 0,
    shipping,
    ...(coupon ? { coupon } : {}),
    ...userDataPayload,
    items,
  });

  if (window.TRACKING_DEBUG) {
    console.log('%c[GA4] PURCHASE FIRED', 'color: #22c55e; font-weight: bold;', { transactionId, value, userData });
  }
  return true;
}
