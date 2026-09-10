import { useEffect } from 'react';

const SITE_URL = 'https://shorno-suta.vercel.app';

interface ProductMeta {
  price: number;
  currency?: string;
  availability?: 'in stock' | 'out of stock';
  condition?: string;
  brand?: string;
  category?: string;
}

interface SEOHeadProps {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  noindex?: boolean;
  jsonLd?: Record<string, any> | Record<string, any>[];
  keywords?: string;
  productMeta?: ProductMeta;
}

export default function SEOHead({
  title,
  description,
  canonical,
  ogImage,
  ogType = 'website',
  noindex = false,
  jsonLd,
  keywords,
  productMeta,
}: SEOHeadProps) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    const setMeta = (name: string, content: string, attr = 'name') => {
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      const prev = el?.getAttribute('content') || '';
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
      return { el, prev, created: prev === '' };
    };

    const descMeta = setMeta('description', description);
    const ogTitleMeta = setMeta('og:title', title, 'property');
    const ogDescMeta = setMeta('og:description', description, 'property');
    const ogTypeMeta = setMeta('og:type', ogType, 'property');

    const canonicalUrl = canonical ? `${SITE_URL}${canonical}` : undefined;
    const ogUrlMeta = canonicalUrl ? setMeta('og:url', canonicalUrl, 'property') : null;
    const ogImgMeta = ogImage ? setMeta('og:image', ogImage, 'property') : null;

    // Twitter Card meta
    const twitterCard = setMeta('twitter:card', 'summary_large_image');
    const twitterTitle = setMeta('twitter:title', title);
    const twitterDesc = setMeta('twitter:description', description);
    const twitterImg = ogImage ? setMeta('twitter:image', ogImage) : null;

    // Keywords meta
    const keywordsMeta = keywords ? setMeta('keywords', keywords) : null;

    // Facebook Product meta tags
    const productMetas: { el: HTMLMetaElement; prev: string; created: boolean }[] = [];
    if (productMeta) {
      productMetas.push(setMeta('product:price:amount', String(productMeta.price), 'property'));
      productMetas.push(setMeta('product:price:currency', productMeta.currency || 'BDT', 'property'));
      if (productMeta.availability) {
        productMetas.push(setMeta('product:availability', productMeta.availability, 'property'));
      }
      if (productMeta.condition) {
        productMetas.push(setMeta('product:condition', productMeta.condition, 'property'));
      }
      if (productMeta.brand) {
        productMetas.push(setMeta('product:brand', productMeta.brand, 'property'));
      }
      if (productMeta.category) {
        productMetas.push(setMeta('product:category', productMeta.category, 'property'));
      }
    }

    // Canonical link
    let canonicalEl: HTMLLinkElement | null = null;
    if (canonicalUrl) {
      canonicalEl = document.querySelector('link[rel="canonical"]');
      if (!canonicalEl) {
        canonicalEl = document.createElement('link');
        canonicalEl.setAttribute('rel', 'canonical');
        document.head.appendChild(canonicalEl);
      }
      canonicalEl.setAttribute('href', canonicalUrl);
    }

    // Robots noindex
    let robotsEl: HTMLMetaElement | null = null;
    if (noindex) {
      robotsEl = document.querySelector('meta[name="robots"]');
      if (!robotsEl) {
        robotsEl = document.createElement('meta');
        robotsEl.setAttribute('name', 'robots');
        document.head.appendChild(robotsEl);
      }
      robotsEl.setAttribute('content', 'noindex, nofollow');
    }

    // JSON-LD
    const scriptEls: HTMLScriptElement[] = [];
    if (jsonLd) {
      const items = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
      items.forEach((ld) => {
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.textContent = JSON.stringify(ld);
        document.head.appendChild(script);
        scriptEls.push(script);
      });
    }

    return () => {
      document.title = prevTitle;
      descMeta.el.setAttribute('content', descMeta.prev);
      ogTitleMeta.el.setAttribute('content', ogTitleMeta.prev);
      ogDescMeta.el.setAttribute('content', ogDescMeta.prev);
      ogTypeMeta.el.setAttribute('content', ogTypeMeta.prev);
      if (ogUrlMeta) ogUrlMeta.el.setAttribute('content', ogUrlMeta.prev);
      if (ogImgMeta) ogImgMeta.el.setAttribute('content', ogImgMeta.prev);
      twitterCard.el.setAttribute('content', twitterCard.prev);
      twitterTitle.el.setAttribute('content', twitterTitle.prev);
      twitterDesc.el.setAttribute('content', twitterDesc.prev);
      if (twitterImg) twitterImg.el.setAttribute('content', twitterImg.prev);
      if (keywordsMeta) keywordsMeta.el.setAttribute('content', keywordsMeta.prev);
      productMetas.forEach(m => m.el.setAttribute('content', m.prev));
      if (canonicalEl) canonicalEl.remove();
      if (robotsEl) robotsEl.remove();
      scriptEls.forEach((s) => s.remove());
    };
  }, [title, description, canonical, ogImage, ogType, noindex, jsonLd, keywords, productMeta]);

  return null;
}
