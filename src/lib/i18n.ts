// Shorno Suta: Bangla / English on the website (the shop customers see). Bangla is the
// default; the reader's choice is kept in this browser, and a link with ?lang=en opens the
// website in English. The admin has its own switch (lib/adminLang.ts); staff pages and the
// shop's landing pages stay in Bangla. The same as Shadamon Shop and the CORE Shop engine.
//
// Texts are written in place, both languages side by side:  tr('কার্টে যোগ করুন', 'Add to cart').
// Words the shop wrote stay as written; the texts we know (menus, headings, promises …) are
// translated by known() from lib/i18nKnown.ts. The same as the CORE Shop engine's lib/i18n.ts.
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { KNOWN_EN, KNOWN_PREFIX_EN } from './i18nKnown';

/** The shop's name in each language (welcome messages, copyright …). */
const STORE = { nameBn: 'স্বর্ণ সুতা', nameEn: 'Shorno Suta' };

export type Lang = 'bn' | 'en';
export type LangScope = 'shop' | 'admin';

const KEYS: Record<LangScope, string> = { shop: 'shop_lang', admin: 'admin_lang' };
const cache: Partial<Record<LangScope, Lang>> = {};
const listeners = new Set<() => void>();

/** Pages that stay in Bangla: the admin, the reseller panel, staff and the partners' pages,
 *  and the shop's landing pages (/lp/… and the one-word links the shop made, like /eid-offer). */
const BANGLA_ONLY = /^\/(admin|staff|hishab|lp|install)(\/|$)/;

// The website's own pages with one word (App.tsx); any other one-word link is a landing page.
const SITE_PAGES = new Set([
  '', 'order-status', 'shop', 'trending', 'clearance', 'product', 'cart', 'checkout', 'about', 'contact',
  'policies', 'return-policy', 'refund-policy', 'Return-ExchangePolicy', 'privacy-policy', 'account-deletion',
  'terms-and-conditions', 'page', 'app', 'payment-result', 'thank-you', 'c', 'memo', 's', 'auth',
  'giveaway', 'account', 'sitemap.xml', 'feeds',
]);

/** The pages in Bangla only ("admin"); everything else is the website. */
export const scopeOf = (path?: string): LangScope => {
  const p = path ?? (typeof window !== 'undefined' ? window.location.pathname : '/');
  if (BANGLA_ONLY.test(p)) return 'admin';
  const first = p.split('/')[1] ?? '';
  return SITE_PAGES.has(first) ? 'shop' : 'admin';
};

function read(scope: LangScope): Lang {
  try {
    const saved = localStorage.getItem(KEYS[scope]);
    if (saved === 'en' || saved === 'bn') return saved;
  } catch {
    /* storage blocked: Bangla */
  }
  return 'bn';
}

export function getLang(scope: LangScope = scopeOf()): Lang {
  if (scope === 'admin') return 'bn';
  return (cache[scope] ??= read(scope));
}

export function setLang(lang: Lang, scope: LangScope = scopeOf()) {
  if (scope === 'admin' || getLang(scope) === lang) return;
  cache[scope] = lang;
  try {
    localStorage.setItem(KEYS[scope], lang);
  } catch {
    /* kept for this visit only */
  }
  if (scope === scopeOf()) document.documentElement.lang = lang;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** For code outside React (toasts, messages): the language of the current page. */
export const trNow = <T,>(bn: T, en: T): T => (getLang() === 'en' ? en : bn);

/** A text the platform wrote for the shop, in English when it is one we know. */
export function knownIn(lang: Lang, text: string): string;
export function knownIn(lang: Lang, text: string | null | undefined): string | null | undefined;
export function knownIn(lang: Lang, text: string | null | undefined) {
  if (lang !== 'en' || !text) return text;
  const t = text.trim();
  const whole = lookup(t);
  if (whole) return whole;
  // the same words with an emoji before or after them ("🌸 … স্বাগতম", "… 🌸")
  const lead = t.match(EMOJI_LEAD)?.[0] ?? '';
  const trail = t.slice(lead.length).match(EMOJI_TRAIL)?.[0] ?? '';
  const core = t.slice(lead.length, t.length - trail.length);
  if (core !== t) {
    const hit = lookup(core);
    if (hit) return lead + hit + trail;
  }
  for (const [bn, en] of KNOWN_PREFIX_EN) if (core.startsWith(bn)) return lead + en + core.slice(bn.length) + trail;
  return text;
}

const EMOJI_LEAD = /^[\p{Extended_Pictographic}\uFE0F\u200D]+\s*/u;
const EMOJI_TRAIL = /\s*[\p{Extended_Pictographic}\uFE0F\u200D]+$/u;

function lookup(t: string): string | undefined {
  if (KNOWN_EN[t]) return KNOWN_EN[t];
  // the shop's name inside (welcome messages, copyright …)
  const shopBn = STORE.nameBn;
  if (shopBn && t.includes(shopBn)) {
    const hit = KNOWN_EN[t.split(shopBn).join('{shop}')];
    if (hit) return hit.split('{shop}').join(STORE.nameEn || shopBn);
  }
  return undefined;
}

// Bangla letters and digits; the taka sign (৳) is in English text too
const BANGLA = /[\u0980-\u09F2\u09F4-\u09FF]/;
/** Has Bangla letters (text we could not translate). */
export const hasBangla = (text: string) => BANGLA.test(text);

/**
 * Text the owner may have written (hero, section headings): on the English website a text
 * we know is translated, English stays as written, and Bangla we cannot translate gives way
 * to the English default, so the page reads in one language.
 */
export function ownIn(lang: Lang, text: string | null | undefined, enDefault: string): string {
  if (lang !== 'en' || !text) return text || '';
  const known = knownIn('en', text);
  if (known !== text) return known;
  return BANGLA.test(text) ? enDefault : text;
}

/**
 * An owner's text kept in both languages (pages, the footer's places …: the Bangla, and the
 * English when written). In English: the English, else the English of a ready-written text,
 * else the Bangla as written.
 */
export function pickIn(lang: Lang, bn?: string | null, en?: string | null): string {
  if (lang !== 'en') return bn || en || '';
  return (en || '').trim() || knownIn('en', bn || '') || '';
}

/** A name kept in both languages (categories: name_bn + name); either may be empty. */
export const nameIn = (lang: Lang, bn?: string | null, en?: string | null) =>
  (lang === 'en' ? en || bn : bn || en) || '';

// The English of a menu link the shop named in Bangla we cannot translate, from where it goes.
const PAGE_EN: Record<string, string> = {
  '/': 'Home', '/shop': 'Shop', '/contact': 'Contact', '/about': 'About us', '/order-status': 'Track order',
  '/cart': 'Cart', '/checkout': 'Checkout', '/account': 'Account', '/trending': 'Trending', '/clearance': 'Clearance sale',
  '/reseller': 'Become a reseller', '/giveaway': 'Giveaway', '/install': 'Get the app', '/policies': 'Policies',
  '/return-policy': 'Return policy', '/refund-policy': 'Exchange & refund', '/privacy-policy': 'Privacy policy',
  '/terms-and-conditions': 'Terms & ordering', '/cancellation-policy': 'Cancellation policy', '/paikari': 'Wholesale',
};

/** A menu link's name: translated when we know it, else (English website) named after its page. */
export function menuIn(lang: Lang, label: string, to?: string | null): string {
  const known = knownIn(lang, label);
  if (lang !== 'en' || !to || !BANGLA.test(known || '')) return known || '';
  const path = String(to || '').split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  if (PAGE_EN[path]) return PAGE_EN[path];
  const last = path.split('/').filter(Boolean).pop() || '';
  if (!/^[a-z0-9-]+$/i.test(last)) return known;
  const words = last.replace(/-+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : known;
}

/** knownIn / ownIn in the current page's language, for code outside React. */
export const knownNow = (text: string | null | undefined) => knownIn(getLang(), text) || '';
export const ownNow = (text: string | null | undefined, enDefault: string) => ownIn(getLang(), text, enDefault);

/** pickIn in the current page's language, for code outside React. */
export const pickNow = (bn?: string | null, en?: string | null) => pickIn(getLang(), bn, en);

/** nameIn in the current page's language, for code outside React. */
export const nameNow = (bn?: string | null, en?: string | null) => nameIn(getLang(), bn, en);

export function useLang() {
  const lang = useSyncExternalStore(subscribe, () => getLang(), () => 'bn' as Lang);
  // moving between the website and the admin (each has its own language)
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return useMemo(() => {
    const en = lang === 'en';
    return {
      lang,
      en,
      setLang: (next: Lang) => setLang(next),
      tr: <T,>(bnText: T, enText: T): T => (en ? enText : bnText),
      known: <T extends string | null | undefined>(text: T): T => knownIn(lang, text) as T,
      own: (text: string | null | undefined, enDefault: string) => ownIn(lang, text, enDefault),
      name: (bn?: string | null, enName?: string | null) => nameIn(lang, bn, enName),
      /** a menu link's name (menuIn) */
      menu: (label: string, to?: string | null) => menuIn(lang, label, to),
      /** an owner's text in both languages (pickIn) */
      pick: (bn?: string | null, enText?: string | null) => pickIn(lang, bn, enText),
      /** Numbers as the reader counts: ১২৩ in Bangla, 123 in English. */
      num: (n: number) => (en ? n.toLocaleString('en-US') : n.toLocaleString('bn-BD')),
    };
  }, [lang]);
}

// First visit of this page: ?lang=en / ?lang=bn picks the website's language, and the page
// says which language it is in (screen readers, Google, the browser's translate offer).
if (typeof window !== 'undefined') {
  try {
    const asked = new URLSearchParams(window.location.search).get('lang');
    if ((asked === 'en' || asked === 'bn') && scopeOf() === 'shop') setLang(asked, 'shop');
  } catch {
    /* no URL */
  }
  document.documentElement.lang = getLang();
  // Another tab changed it.
  window.addEventListener('storage', (e) => {
    const scope = (Object.keys(KEYS) as LangScope[]).find((s) => KEYS[s] === e.key);
    if (!scope) return;
    delete cache[scope];
    if (scope === scopeOf()) document.documentElement.lang = getLang(scope);
    listeners.forEach((l) => l());
  });
}
