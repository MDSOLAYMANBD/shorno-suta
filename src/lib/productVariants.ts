// A color's entry in variant_images.color_images can be a single URL (older
// products, saved before multi-image support) or an array of URLs (current
// format — first is primary). These two helpers are the single place that
// normalizes that, so every reader (product page, cart, order list, catalog
// feeds, etc.) treats old and new data the same way.
export type ColorImagesMap = Record<string, string | string[]> | null | undefined;

export function getColorImageList(colorImages: ColorImagesMap, color: string | null | undefined): string[] {
  if (!colorImages || !color) return [];
  const trimmed = color.trim();
  let val = colorImages[trimmed];
  if (val == null) {
    const key = Object.keys(colorImages).find(k => k.toLowerCase() === trimmed.toLowerCase());
    val = key ? colorImages[key] : undefined;
  }
  if (!val) return [];
  return (Array.isArray(val) ? val : [val]).filter(Boolean);
}

export function getColorPrimaryImage(colorImages: ColorImagesMap, color: string | null | undefined): string | null {
  return getColorImageList(colorImages, color)[0] || null;
}

// Explodes a single multi-color product into one virtual card per color for
// grid/listing views, so browsing sees each color as its own thumbnail
// instead of one card the shopper has to click into to discover variants.
// Products without distinct per-color images are left untouched — there'd be
// nothing to tell the cards apart.
export function explodeProductsByColor<T extends { id: string; colors?: string[] | null; variant_images?: any; images?: string[] | null }>(
  products: T[]
): (T & { linkColor?: string; images?: string[] | null })[] {
  const out: (T & { linkColor?: string })[] = [];

  for (const p of products) {
    const colors = p.colors;
    const colorImages = p.variant_images?.color_images;
    if (!colors || colors.length < 2 || !colorImages || typeof colorImages !== 'object') {
      out.push(p);
      continue;
    }

    const seen = new Set<string>();
    let cardsAdded = 0;
    for (const color of colors) {
      const imgs = getColorImageList(colorImages, color);
      if (imgs.length === 0 || seen.has(color)) continue;
      seen.add(color);
      cardsAdded++;
      out.push({
        ...p,
        images: [...imgs, ...((p.images || []).filter((x) => !imgs.includes(x)))],
        linkColor: color,
      });
    }
    if (cardsAdded === 0) out.push(p);
  }

  return out;
}

// Stable React key for an exploded card — falls back to the plain product id
// when it wasn't split by color.
export function productCardKey(p: { id: string; linkColor?: string }): string {
  return p.linkColor ? `${p.id}::${p.linkColor}` : p.id;
}

// Short, URL-safe fingerprint of a color name — used as ?c= on product links
// instead of the raw Bengali name in ?color=, which percent-encodes into a
// long, unreadable string the moment anyone copies the address bar (Chrome
// only *displays* it decoded; the actual copied text is the encoded form).
// This is deliberately NOT a translation (Bengali color names don't reliably
// map to English words) — just a short deterministic hash of the exact text,
// so the same color name always produces the same slug no matter where in
// the colors[] array it sits, and reordering colors later doesn't break
// links already shared.
export function colorSlug(color: string): string {
  const trimmed = color.trim().toLowerCase();
  let hash = 5381;
  for (let i = 0; i < trimmed.length; i++) {
    hash = ((hash << 5) + hash + trimmed.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

// Reverses colorSlug against a product's actual color list — used when
// reading ?c= off an incoming URL.
export function findColorBySlug(colors: string[] | null | undefined, slug: string | null | undefined): string | null {
  if (!colors || !slug) return null;
  return colors.find(c => colorSlug(c) === slug) || null;
}
