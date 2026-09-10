import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// TODO: update to the real domain once one is set (currently the Vercel placeholder).
const SITE_URL = 'https://shorno-suta.vercel.app';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const [{ data: products }, { data: categories }] = await Promise.all([
      supabase.from('products').select('slug, created_at').eq('is_active', true),
      supabase.from('categories').select('slug, created_at'),
    ]);

    const today = new Date().toISOString().split('T')[0];

    const staticPages = [
      { loc: '/', priority: '1.0', changefreq: 'daily' },
      { loc: '/shop', priority: '0.9', changefreq: 'daily' },
      { loc: '/about', priority: '0.5', changefreq: 'monthly' },
      { loc: '/contact', priority: '0.5', changefreq: 'monthly' },
      { loc: '/policies', priority: '0.3', changefreq: 'monthly' },
      { loc: '/return-policy', priority: '0.3', changefreq: 'monthly' },
      { loc: '/refund-policy', priority: '0.3', changefreq: 'monthly' },
      { loc: '/Return-ExchangePolicy', priority: '0.3', changefreq: 'monthly' },
      { loc: '/order-status', priority: '0.3', changefreq: 'monthly' },
    ];

    let urls = staticPages.map(p => `  <url>
    <loc>${SITE_URL}${p.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`);

    if (categories) {
      for (const cat of categories) {
        urls.push(`  <url>
    <loc>${SITE_URL}/shop/${encodeURIComponent(cat.slug)}</loc>
    <lastmod>${cat.created_at?.split('T')[0] || today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);
      }
    }

    if (products) {
      for (const p of products) {
        urls.push(`  <url>
    <loc>${SITE_URL}/product/${encodeURIComponent(p.slug)}</loc>
    <lastmod>${p.created_at?.split('T')[0] || today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`);
      }
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

    return new Response(xml, {
      headers: { ...corsHeaders, 'Content-Type': 'application/xml; charset=utf-8' },
    });
  } catch (e) {
    return new Response(`Error: ${e.message}`, { status: 500, headers: corsHeaders });
  }
});
