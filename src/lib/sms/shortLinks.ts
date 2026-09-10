// SMS short-link utilities — used by send pipeline AND visitor redirect.
import { supabase } from '@/integrations/supabase/client';

const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<>'"]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>'"]*)?)/gi;
const VISITOR_COOKIE = 'sms_visitor';

/**
 * Automas accepts the same payload shape for order/test/campaign sends, but
 * campaign short links were the first byte-level message-body difference:
 * `https://shorno-suta.vercel.app/...` vs the working order SMS
 * `shorno-suta.vercel.app/...`. Keep campaign links clickable while matching the
 * provider-accepted order-confirmation URL format.
 */
export function formatSmsUrlForProvider(url: string): string {
  return url
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '');
}

function normalizeSmsTargetUrl(url: string): string {
  const clean = url.replace(/[.,;!?)]+$/, '').trim();
  if (/^https?:\/\//i.test(clean)) return clean;
  return `https://${clean.replace(/^www\./i, '')}`;
}

export function formatSmsUrlsForProvider(body: string): string {
  if (!body) return body;
  return body.replace(URL_RE, (match) => {
    const trailing = match.match(/[.,;!?)]+$/)?.[0] || '';
    const clean = trailing ? match.slice(0, -trailing.length) : match;
    return formatSmsUrlForProvider(clean) + trailing;
  });
}

export function extractUrls(text: string): string[] {
  if (!text) return [];
  const out = new Set<string>();
  const m = text.match(URL_RE);
  if (m) m.forEach((u) => out.add(u.replace(/[.,;!?)]+$/, '')));
  return [...out];
}

/** Rewrite `body` by registering a short-link per URL for one recipient. */
export async function rewriteBodyForRecipient(opts: {
  campaignId: string;
  recipientId: string;
  body: string;
  base: string; // e.g. https://shorno-suta.vercel.app/s
  expiresAt?: string | null;
  forceNew?: boolean;
}): Promise<string> {
  const urls = extractUrls(opts.body);
  if (urls.length === 0) return opts.body;
  let out = opts.body;
  for (const original of urls) {
    try {
      const originalTarget = normalizeSmsTargetUrl(original);
      const { data: token, error } = await (supabase.rpc as any)('sms_register_short_link', {
        p_campaign_id: opts.campaignId,
        p_recipient_id: opts.recipientId,
        p_original_url: originalTarget,
        p_expires_at: opts.expiresAt ?? null,
        p_force_new: !!opts.forceNew,
      });
      if (error || !token) continue;
      const short = formatSmsUrlForProvider(`${opts.base.replace(/\/+$/, '')}/${token}`);
      out = out.split(original).join(short);
    } catch {
      /* keep original URL on failure */
    }
  }
  return out;
}

// ─── Visitor-side cookie helpers ─────────────────────────────────────

export function getOrCreateVisitorKey(): string {
  if (typeof document === 'undefined') return '';
  const existing = readCookie(VISITOR_COOKIE);
  if (existing) return existing;
  const key = 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  writeCookie(VISITOR_COOKIE, key, 365);
  return key;
}

export function getVisitorClickKeys(): string[] {
  const k = readCookie(VISITOR_COOKIE);
  return k ? [k] : [];
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string, days: number) {
  if (typeof document === 'undefined') return;
  const d = new Date();
  d.setTime(d.getTime() + days * 86400_000);
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=/;SameSite=Lax`;
}
