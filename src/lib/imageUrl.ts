/**
 * Image URL helpers — routes Supabase Storage images through wsrv.nl
 * (Cloudflare-powered free image proxy) for on-the-fly resize, WebP/AVIF
 * conversion, and aggressive edge caching.
 *
 * This dramatically reduces Supabase egress because:
 *   1. Mobile gets small variants (400px) instead of 1200px originals
 *   2. Repeat views hit Cloudflare edge cache (0 Supabase egress)
 *   3. AVIF/WebP auto-negotiated per browser
 *
 * Non-Supabase URLs are returned untouched.
 */

const PROXY = 'https://wsrv.nl/';

function isSupabaseStorageUrl(url: string): boolean {
  return url.includes('supabase.co/storage/') || url.includes('supabase.in/storage/');
}

function buildProxied(url: string, width: number, quality: number): string {
  // wsrv.nl expects the source URL without the leading https:// scheme prefix
  // (it accepts both forms; we strip to keep URLs short and cache-friendly)
  const src = url.replace(/^https?:\/\//, '');
  const params = new URLSearchParams({
    url: src,
    w: String(width),
    q: String(quality),
    output: 'webp',
    we: '', // "without enlargement" — never upscale beyond source
  });
  return `${PROXY}?${params.toString()}`;
}

/**
 * Returns a single optimized image URL.
 * For Supabase URLs: routes through wsrv.nl proxy with resize + WebP.
 * For other URLs: returns as-is (or appends params for legacy compatibility).
 */
export function optimizedImageUrl(
  url: string | undefined | null,
  width: number = 600,
  quality: number = 75,
): string {
  if (!url) return '';
  if (isSupabaseStorageUrl(url)) {
    return buildProxied(url, width, quality);
  }
  // Non-Supabase: return as-is
  return url;
}

/**
 * Returns a srcset string with multiple width variants for responsive images.
 * Use together with the `sizes` attribute on <img>.
 *
 * Example: srcSetFor(url) -> "https://wsrv.nl/?...&w=400 400w, ...&w=800 800w, ...&w=1200 1200w"
 */
export function srcSetFor(
  url: string | undefined | null,
  widths: number[] = [400, 800, 1200],
  quality: number = 75,
): string {
  if (!url) return '';
  if (!isSupabaseStorageUrl(url)) return '';
  return widths
    .map((w) => `${buildProxied(url, w, quality)} ${w}w`)
    .join(', ');
}
