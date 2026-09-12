import { writeFileSync, readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// Minimal .env loader for local `npm run dev` — Vercel injects these directly in production.
if (existsSync(resolve(".env"))) {
  for (const line of readFileSync(resolve(".env"), "utf-8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SITE_URL = "https://www.shornosuta.com";

async function generateSitemap() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase.from('products').select('slug, created_at').eq('is_active', true),
    supabase.from('categories').select('slug, created_at'),
  ]);

  const today = new Date().toISOString().split('T')[0];

  const staticPages = [
    { path: '/', priority: '1.0', changefreq: 'daily' },
    { path: '/shop', priority: '0.9', changefreq: 'daily' },
    { path: '/trending', priority: '0.8', changefreq: 'daily' },
    { path: '/clearance', priority: '0.8', changefreq: 'daily' },
    { path: '/about', priority: '0.5', changefreq: 'monthly' },
    { path: '/contact', priority: '0.5', changefreq: 'monthly' },
    { path: '/policies', priority: '0.3', changefreq: 'monthly' },
    { path: '/return-policy', priority: '0.3', changefreq: 'monthly' },
    { path: '/refund-policy', priority: '0.3', changefreq: 'monthly' },
    { path: '/Return-ExchangePolicy', priority: '0.3', changefreq: 'monthly' },
    { path: '/order-status', priority: '0.3', changefreq: 'monthly' },
  ];

  const urls = staticPages.map(p => `  <url>
    <loc>${SITE_URL}${p.path}</loc>
    <lastmod>${today}</lastmod>
    ${p.changefreq ? `<changefreq>${p.changefreq}</changefreq>` : ''}
    ${p.priority ? `<priority>${p.priority}</priority>` : ''}
  </url>`);

  if (categories) {
    for (const cat of categories) {
      urls.push(`  <url>
    <loc>${SITE_URL}/shop/${encodeURIComponent(cat.slug)}</loc>
    <lastmod>${(cat.created_at)?.split('T')[0] || today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);
    }
  }

  if (products) {
    for (const p of products) {
      urls.push(`  <url>
    <loc>${SITE_URL}/product/${encodeURIComponent(p.slug)}</loc>
    <lastmod>${(p.created_at)?.split('T')[0] || today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`);
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

  writeFileSync(resolve("public/sitemap.xml"), xml);
  console.log(`sitemap.xml written (${urls.length} entries)`);
}

generateSitemap().catch(err => {
  console.error('Failed to generate sitemap:', err);
  process.exit(1);
});
