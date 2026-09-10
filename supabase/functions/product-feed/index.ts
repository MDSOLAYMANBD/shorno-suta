import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// TODO: update to the real domain once one is set (currently the Vercel placeholder).
const SITE_URL = 'https://shorno-suta.vercel.app';

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
    three_piece: 'Three Piece Dress', burka: 'Burka', coord: 'Co-ord Set',
    kurti: 'Kurti', saree: 'Saree', salwar: 'Salwar Kameez',
    gown: 'Gown', tops: 'Tops', pants: 'Pants', hijab: 'Hijab', clothing: 'Clothing',
  };
  return map[type] || 'Clothing';
}

function getGoogleCategoryId(type: string): string {
  const map: Record<string, string> = {
    three_piece: '2271', burka: '5598', coord: '5466', kurti: '2271',
    saree: '2271', salwar: '5466', gown: '2271', tops: '212',
    pants: '204', hijab: '177', clothing: '1604',
  };
  return map[type] || '1604';
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

function getProductTypeHierarchy(type: string): string {
  const map: Record<string, string> = {
    three_piece: 'Women > Three Piece > Cotton Three Piece',
    burka: 'Women > Islamic Clothing > Burka',
    coord: 'Women > Co-ord Set', kurti: 'Women > Kurti',
    saree: 'Women > Saree', salwar: 'Women > Salwar Kameez',
    gown: 'Women > Gown', tops: 'Women > Tops',
    pants: 'Women > Pants', hijab: 'Women > Hijab & Scarf',
    clothing: 'Women > Clothing',
  };
  return map[type] || 'Women > Clothing';
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

// Pick a usable public video URL. video_file_url (directly hosted) is preferred
// when present; video_url is often a YouTube link but some saved values are
// studio.youtube.com editor links (login-only, not a real video URL) — reject those.
function getFeedVideoLink(videoUrl: string | null, videoFileUrl: string | null): string {
  if (videoFileUrl && /^https?:\/\//.test(videoFileUrl)) return videoFileUrl;
  if (videoUrl && /^https?:\/\//.test(videoUrl) && !videoUrl.includes('studio.youtube.com')) return videoUrl;
  return '';
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';
}

// Same-product-different-color items (linked via colors[] + variant_images.color_images,
// exactly like the "রঙ নির্বাচন করুন" swatches on the product page) must appear as
// separate catalog entries — one per color — each with that color's own photo. Without
// this, Facebook/Google only ever see ONE item per product row, no matter how many
// colors it actually has, and that one item always shows the same (first) photo.
// A color's entry can be a single URL (older products) or an array (current
// format — first is primary); this is the one place that normalizes both.
function getColorImage(images: string[] | null, colorImages: Record<string, string | string[]> | undefined, color: string): string {
  if (colorImages) {
    let val = colorImages[color];
    if (val == null) {
      const key = Object.keys(colorImages).find(k => k.toLowerCase() === color.toLowerCase());
      val = key ? colorImages[key] : undefined;
    }
    const primary = Array.isArray(val) ? val[0] : val;
    if (primary) return primary;
  }
  return images?.[0] || '';
}

const MAX_VARIANTS = 12;

function buildVariantCombos(colors: string[] | null, sizes: string[] | null): { color: string; size: string }[] {
  const rawColors = Array.isArray(colors) && colors.length > 0 ? colors.map(c => c.trim()).filter(Boolean) : ['Multicolor'];
  const rawSizes = Array.isArray(sizes) && sizes.length > 0 ? sizes.map(s => s.trim()).filter(Boolean) : ['Free Size'];
  const combos: { color: string; size: string }[] = [];
  outer: for (const c of rawColors) {
    for (const s of rawSizes) {
      combos.push({ color: c, size: s });
      if (combos.length >= MAX_VARIANTS) break outer;
    }
  }
  return combos;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const format = url.searchParams.get('format') || 'google';

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: products } = await supabase.from('products').select('*, categories(name)')
      .eq('is_active', true).order('created_at', { ascending: false });

    if (!products || products.length === 0) {
      return new Response('No products found', { status: 404, headers: corsHeaders });
    }

    if (format === 'google') {
      const items = products.flatMap((p: any) => {
        const categoryName = p.categories?.name || '';
        const type = detectProductType(p.name, categoryName);
        const cleanTitle = buildOptimizedTitle(p.name, type, p.feed_title);
        const cleanDesc = buildOptimizedDescription(type, p.feed_description);
        const productUrl = `${SITE_URL}/product/${encodeURIComponent(p.slug)}`;

        const { regularPrice, salePrice } = getPrices(p.price, p.original_price);
        const colorImages: Record<string, string | string[]> | undefined = (p.variant_images || {}).color_images;
        const videoLink = getFeedVideoLink(p.video_url, p.video_file_url);
        const combos = buildVariantCombos(p.colors, p.sizes);

        return combos.map(({ color, size }) => {
          // Stable id based on color+size (not index) so the feed doesn't churn between
          // refreshes; single-variant products keep using the plain product id.
          const itemId = combos.length === 1 ? p.id : `${p.id}-${slugify(color)}-${slugify(size)}`;
          const primaryImage = getColorImage(p.images, colorImages, color);
          const additionalImages = (p.images || []).filter((img: string) => img !== primaryImage).slice(0, 9)
            .map((img: string) => `    <g:additional_image_link>${img}</g:additional_image_link>`)
            .join('\n');

          return `  <item>
    <g:id>${itemId}</g:id>
    <g:title><![CDATA[${cleanTitle}]]></g:title>
    <g:description><![CDATA[${cleanDesc}]]></g:description>
    <g:link>${productUrl}</g:link>
    <g:image_link>${primaryImage}</g:image_link>
${additionalImages ? additionalImages + '\n' : ''}    <g:price>${regularPrice} BDT</g:price>
${salePrice ? `    <g:sale_price>${salePrice} BDT</g:sale_price>\n` : ''}    <g:availability>${p.stock > 0 ? 'in_stock' : 'out_of_stock'}</g:availability>
    <g:condition>new</g:condition>
    <g:brand>Shorno Suta</g:brand>
    <g:identifier_exists>no</g:identifier_exists>
    <g:gender>female</g:gender>
    <g:age_group>adult</g:age_group>
    <g:product_type>${escapeXml(getProductTypeHierarchy(type))}</g:product_type>
    <g:google_product_category>${getGoogleCategoryId(type)}</g:google_product_category>
${p.categories?.name ? `    <g:product_type>${escapeXml(p.categories.name)}</g:product_type>\n` : ''}    <g:color><![CDATA[${color}]]></g:color>
    <g:size><![CDATA[${size}]]></g:size>
${videoLink ? `    <g:video_link>${videoLink}</g:video_link>\n` : ''}${p.is_featured ? `    <g:custom_label_0>Featured</g:custom_label_0>\n` : ''}    <g:shipping>
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
  <description>Shorno Suta Product Feed</description>
${items}
</channel>
</rss>`;

      return new Response(xml, {
        headers: { ...corsHeaders, 'Content-Type': 'application/xml; charset=utf-8' },
      });
    }

    if (format === 'facebook') {
      const header = 'id\ttitle\tdescription\tavailability\tcondition\tprice\tlink\timage_link\tadditional_image_link\tbrand\tsale_price\tgender\tage_group\tproduct_type\tgoogle_product_category\tcolor\tsize\tvideo_link\tinventory\tcustom_label_0';
      const rows = products.flatMap((p: any) => {
        const categoryName = p.categories?.name || '';
        const type = detectProductType(p.name, categoryName);
        const cleanTitle = p.name.replace(/\t/g, ' ').replace(/\n/g, ' ');
        const cleanDesc = buildOptimizedDescription(type, p.feed_description).replace(/\t/g, ' ').replace(/\n/g, ' ');
        const productUrl = `${SITE_URL}/product/${encodeURIComponent(p.slug)}`;
        const { regularPrice, salePrice } = getPrices(p.price, p.original_price);
        const typeLabel = getProductTypeLabel(type);
        const colorImages: Record<string, string | string[]> | undefined = (p.variant_images || {}).color_images;
        const videoLink = getFeedVideoLink(p.video_url, p.video_file_url);
        const customLabel0 = p.is_featured ? 'Featured' : '';
        const combos = buildVariantCombos(p.colors, p.sizes);

        return combos.map(({ color, size }) => {
          const itemId = combos.length === 1 ? p.id : `${p.id}-${slugify(color)}-${slugify(size)}`;
          const primaryImage = getColorImage(p.images, colorImages, color);
          // Meta's TSV/CSV catalog feed takes extra photos as comma-separated URLs
          // in one additional_image_link column (unlike Google's repeated XML tags).
          const additionalImages = (p.images || []).filter((img: string) => img !== primaryImage).slice(0, 9).join(',');
          const colorClean = color.replace(/\t/g, ' ');
          const sizeClean = size.replace(/\t/g, ' ');

          return `${itemId}\t${cleanTitle}\t${cleanDesc}\t${p.stock > 0 ? 'in stock' : 'out of stock'}\tnew\t${regularPrice} BDT\t${productUrl}\t${primaryImage}\t${additionalImages}\tShorno Suta\t${salePrice ? salePrice + ' BDT' : ''}\tfemale\tadult\t${typeLabel}\t${getGoogleCategoryId(type)}\t${colorClean}\t${sizeClean}\t${videoLink}\t${p.stock ?? 0}\t${customLabel0}`;
        });
      }).join('\n');

      return new Response(`${header}\n${rows}`, {
        headers: { ...corsHeaders, 'Content-Type': 'text/tab-separated-values; charset=utf-8' },
      });
    }

    throw new Error('Invalid format. Use ?format=google or ?format=facebook');
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
