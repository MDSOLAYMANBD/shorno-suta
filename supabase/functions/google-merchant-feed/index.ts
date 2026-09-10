import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// TODO: update to the real domain once one is set (currently the Vercel placeholder).
const SITE_URL = 'https://shorno-suta.vercel.app';
const FEED_IMAGE_PROXY = 'https://wsrv.nl/';

function stripEmoji(str: string): string {
  return str
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '')
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '')
    .replace(/[\u{2702}-\u{27B0}]/gu, '')
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/[\u{200D}]/gu, '')
    .replace(/[\u{20E3}]/gu, '')
    .replace(/[\u{E0020}-\u{E007F}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildAdSafeImageUrl(url: string | null | undefined): string {
  if (!url) return '';

  // Google Ads can reject tall product photos with "Invalid image aspect ratio".
  // Keep the original product photo intact, but place it on a white 1:1 canvas
  // so every catalog item has an ad-safe square image.
  const params = new URLSearchParams({
    url,
    w: '1200',
    h: '1200',
    fit: 'contain',
    cbg: 'white',
    output: 'jpg',
    q: '90',
  });

  return `${FEED_IMAGE_PROXY}?${params.toString()}`;
}

// Sanitize text to remove words that trigger Google flags
function sanitizeFeedText(str: string): string {
  const banned = ['alcoholic', 'alcohol', 'beverage', 'wine', 'beer', 'liquor', 'vodka', 'whiskey', 'rum', 'cocktail'];
  let result = str;
  for (const word of banned) {
    result = result.replace(new RegExp(word, 'gi'), '');
  }
  return result.replace(/\s+/g, ' ').trim();
}

function detectProductType(name: string, categoryName: string): string {
  const combined = `${name} ${categoryName}`.toLowerCase();
  if (combined.includes('three piece') || combined.includes('থ্রি পিস') || combined.includes('3 piece')) return 'three_piece';
  if (combined.includes('two piece') || combined.includes('টু পিস') || combined.includes('2 piece')) return 'coord';
  if (combined.includes('burka') || combined.includes('বোরকা') || combined.includes('borka')) return 'burka';
  if (combined.includes('co-ord') || combined.includes('coord') || combined.includes('কো-অর্ড')) return 'coord';
  if (combined.includes('kurti') || combined.includes('কুর্তি')) return 'kurti';
  if (combined.includes('saree') || combined.includes('শাড়ি') || combined.includes('sari')) return 'saree';
  if (combined.includes('salwar') || combined.includes('সালোয়ার')) return 'salwar';
  if (combined.includes('gown') || combined.includes('গাউন')) return 'gown';
  if (combined.includes('tops') || combined.includes('top') || combined.includes('টপস')) return 'tops';
  if (combined.includes('pant') || combined.includes('প্যান্ট') || combined.includes('palazzo')) return 'pants';
  if (combined.includes('hijab') || combined.includes('হিজাব') || combined.includes('scarf')) return 'hijab';
  return 'clothing';
}

function getProductTypeLabel(type: string): string {
  const map: Record<string, string> = {
    three_piece: 'Three Piece Dress',
    burka: 'Burka',
    coord: 'Co-ord Set',
    kurti: 'Kurti',
    saree: 'Saree',
    salwar: 'Salwar Kameez',
    gown: 'Gown',
    tops: 'Tops',
    pants: 'Pants',
    hijab: 'Hijab',
    clothing: 'Clothing',
  };
  return map[type] || 'Clothing';
}

function getProductTypeHierarchy(type: string): string {
  const map: Record<string, string> = {
    three_piece: 'Women > Three Piece > Cotton Three Piece',
    burka: 'Women > Islamic Clothing > Burka',
    coord: 'Women > Co-ord Set',
    kurti: 'Women > Kurti',
    saree: 'Women > Saree',
    salwar: 'Women > Salwar Kameez',
    gown: 'Women > Gown',
    tops: 'Women > Tops',
    pants: 'Women > Pants',
    hijab: 'Women > Hijab & Scarf',
    clothing: 'Women > Clothing',
  };
  return map[type] || 'Women > Clothing';
}

// Google Product Category numeric IDs
function getGoogleCategoryId(type: string): string {
  const map: Record<string, string> = {
    three_piece: '2271',   // Apparel > Clothing > Dresses
    burka: '5598',         // Apparel > Clothing > Outerwear
    coord: '5466',         // Apparel > Clothing > Suits
    kurti: '2271',         // Apparel > Clothing > Dresses
    saree: '2271',         // Apparel > Clothing > Dresses
    salwar: '5466',        // Apparel > Clothing > Suits
    gown: '2271',          // Apparel > Clothing > Dresses
    tops: '212',           // Apparel > Clothing > Tops
    pants: '204',          // Apparel > Clothing > Pants
    hijab: '177',          // Apparel > Clothing Accessories > Scarves & Shawls
    clothing: '1604',      // Apparel > Clothing
  };
  return map[type] || '1604';
}

// Correct price logic: higher = regular, lower = sale
function getPrices(price: number, originalPrice: number | null) {
  if (originalPrice && originalPrice > 0 && originalPrice !== price) {
    const higher = Math.max(price, originalPrice);
    const lower = Math.min(price, originalPrice);
    return { regularPrice: higher, salePrice: lower };
  }
  return { regularPrice: price, salePrice: null };
}

function buildOptimizedTitle(name: string, type: string, feedTitle: string | null): string {
  if (feedTitle) return sanitizeFeedText(feedTitle);
  
  const cleanName = stripEmoji(name);
  const typeLabel = getProductTypeLabel(type);
  const featureKeywords = ['embroidery', 'printed', 'block print', 'hand work', 'lace', 'georgette', 'silk', 'cotton', 'linen', 'chiffon', 'net', 'katan', 'muslin'];
  const nameLower = cleanName.toLowerCase();
  const features: string[] = [];
  let fabric = '';

  for (const kw of featureKeywords) {
    if (nameLower.includes(kw)) {
      if (['cotton', 'silk', 'linen', 'chiffon', 'georgette', 'net', 'katan', 'muslin'].includes(kw)) {
        fabric = kw.charAt(0).toUpperCase() + kw.slice(1);
      } else {
        features.push(kw.charAt(0).toUpperCase() + kw.slice(1));
      }
    }
  }

  const parts = ["Women's"];
  if (fabric) parts.push(fabric);
  parts.push(typeLabel);
  let title = parts.join(' ');
  if (features.length > 0) title += ' – ' + features.join(', ');
  title += ' | Shorno Suta';
  return sanitizeFeedText(title);
}

function buildOptimizedDescription(type: string, feedDescription: string | null): string {
  if (feedDescription) return sanitizeFeedText(feedDescription);
  const typeLabel = getProductTypeLabel(type).toLowerCase();
  return `Premium women's ${typeLabel} from Shorno Suta. High quality fabric with comfortable fitting. Perfect for daily wear and special occasions. Home delivery available across Bangladesh.`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: products } = await supabase.from('products').select('*, categories(name)')
      .eq('is_active', true).order('created_at', { ascending: false });

    if (!products || products.length === 0) {
      return new Response('No products found', { status: 404, headers: corsHeaders });
    }

    const normalize = (s: string) => s.trim();
    const items = products.flatMap((p: any) => {
      const categoryName = p.categories?.name || '';
      const type = detectProductType(p.name, categoryName);
      const optimizedTitle = buildOptimizedTitle(p.name, type, p.feed_title);
      const optimizedDesc = buildOptimizedDescription(type, p.feed_description);
      const productUrl = `${SITE_URL}/product/${encodeURIComponent(p.slug)}`;

      const { regularPrice, salePrice } = getPrices(p.price, p.original_price);

      // Use ORIGINAL image URLs so Google can verify them against the landing page.
      // (Proxied images via wsrv.nl often get disapproved as "image not found / mismatch".)
      // Per-color cover photo (matches the "রঙ নির্বাচন করুন" swatches on the product
      // page) — falls back to the first product photo when a color has none set.
      // A color's entry can be a single URL (older products) or an array (current
      // format — first is primary); this normalizes both.
      const colorImages: Record<string, string | string[]> | undefined = (p.variant_images || {}).color_images;
      const getColorImage = (color: string): string => {
        if (colorImages) {
          let val = colorImages[color];
          if (val == null) {
            const key = Object.keys(colorImages).find(k => k.toLowerCase() === color.toLowerCase());
            val = key ? colorImages[key] : undefined;
          }
          const primary = Array.isArray(val) ? val[0] : val;
          if (primary) return primary;
        }
        return p.images?.[0] || '';
      };

      // Ensure color & size for Google apparel eligibility
      const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';
      const rawColors: string[] = Array.isArray(p.colors) && p.colors.length > 0
        ? p.colors.map(normalize).filter(Boolean)
        : ['Multicolor'];
      const rawSizes: string[] = Array.isArray(p.sizes) && p.sizes.length > 0
        ? p.sizes.map(normalize).filter(Boolean)
        : ['Free Size'];

      // Cap variants to keep feed size reasonable (max 12 per product)
      const MAX_VARIANTS = 12;
      const combos: { color: string; size: string }[] = [];
      outer: for (const c of rawColors) {
        for (const s of rawSizes) {
          combos.push({ color: c, size: s });
          if (combos.length >= MAX_VARIANTS) break outer;
        }
      }

      return combos.map(({ color, size }) => {
        // Stable variant id based on color+size (not index) so Google doesn't
        // see items as churning between feed refreshes.
        const variantId = combos.length === 1 ? p.id : `${p.id}-${slug(color)}-${slug(size)}`;
        const primaryImage = getColorImage(color);
        const additionalImages = (p.images || []).filter((img: string) => img !== primaryImage).slice(0, 9)
          .map((img: string) => `    <g:additional_image_link>${escapeXml(img)}</g:additional_image_link>`)
          .join('\n');
        return `  <item>
    <g:id>${variantId}</g:id>
    <g:item_group_id>${p.id}</g:item_group_id>
    <g:title><![CDATA[${optimizedTitle}]]></g:title>
    <g:description><![CDATA[${optimizedDesc}]]></g:description>
    <g:link>${escapeXml(productUrl)}</g:link>
    <g:image_link>${escapeXml(primaryImage)}</g:image_link>
${additionalImages ? additionalImages + '\n' : ''}    <g:price>${regularPrice} BDT</g:price>
${salePrice ? `    <g:sale_price>${salePrice} BDT</g:sale_price>\n` : ''}    <g:availability>${p.stock > 0 ? 'in_stock' : 'out_of_stock'}</g:availability>
    <g:condition>new</g:condition>
    <g:brand>Shorno Suta</g:brand>
    <g:identifier_exists>no</g:identifier_exists>
    <g:gender>female</g:gender>
    <g:age_group>adult</g:age_group>
    <g:color>${escapeXml(color)}</g:color>
    <g:size>${escapeXml(size)}</g:size>
    <g:size_system>BD</g:size_system>
    <g:size_type>regular</g:size_type>
    <g:product_type>${escapeXml(getProductTypeHierarchy(type))}</g:product_type>
    <g:google_product_category>${getGoogleCategoryId(type)}</g:google_product_category>
    <g:shipping>
      <g:country>BD</g:country>
      <g:service>Standard</g:service>
      <g:price>0 BDT</g:price>
    </g:shipping>
  </item>`;
      });
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
<channel>
  <title>Shorno Suta</title>
  <link>${SITE_URL}</link>
  <description>Shorno Suta – Google Merchant Center Optimized Product Feed</description>
${items}
</channel>
</rss>`;

    return new Response(xml, {
      headers: { ...corsHeaders, 'Content-Type': 'application/xml; charset=utf-8' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
