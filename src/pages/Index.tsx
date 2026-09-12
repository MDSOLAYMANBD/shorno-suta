import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Phone, MessageCircle, ExternalLink, Package, Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { sanitizeHtml, sanitizeCss } from '@/lib/sanitize';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import Layout from '@/components/layout/Layout';
import ProductCard from '@/components/product/ProductCard';
import ProductSlider from '@/components/product/ProductSlider';
import { Skeleton } from '@/components/ui/skeleton';
import { useCategories } from '@/hooks/useCategories';
import { useBestSellingProducts, useFeaturedProducts, useNewProducts, useHomepageAllProducts, useHomepageAllProductsCount, useProductSalesCounts, useProductViewCounts, useCategoryPreviewImages, resolveTileImages, useProductCardsByIds } from '@/hooks/useProducts';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { useSiteConfig, DEFAULT_HOMEPAGE_CONFIG } from '@/hooks/useSiteConfig';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import { useEffect, useCallback, useMemo, useState, useRef } from 'react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import SEOHead from '@/components/SEOHead';
import useEmblaCarousel from 'embla-carousel-react';
import { optimizedImageUrl } from '@/lib/imageUrl';
import { cn } from '@/lib/utils';
import { applyClearanceList } from '@/lib/clearancePrice';
import { estimateReviewCount } from '@/lib/reviewCount';
import SectionErrorBoundary from '@/components/SectionErrorBoundary';
import CategoryPhotoTile from '@/components/category/CategoryPhotoTile';
import { explodeProductsByColor } from '@/lib/productVariants';

function ScrollAnimatedSection({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

const Index = () => {
  const location = useLocation();
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const { data: bestSelling, isLoading: bestSellingLoading } = useBestSellingProducts();
  const { data: newProducts, isLoading: newProductsLoading } = useNewProducts();
  const { data: settings, isLoading: settingsLoading } = useStoreSettings();
  const { data: savedConfig, isLoading: configLoading } = useSiteConfig('homepage_config');
  const { data: pagesConfigData } = useSiteConfig('pages_config');
  const { data: savedBtnConfig } = useSiteConfig('buttons_config');
  const buttonConfig = savedBtnConfig?.product_card;
  const allProductsPageSize = useMemo(() => {
    if (!savedConfig) return 8;
    const merged = { ...DEFAULT_HOMEPAGE_CONFIG.all_products, ...savedConfig?.all_products };
    return merged.limit || 8;
  }, [savedConfig]);
  const [allProductsLimit, setAllProductsLimit] = useState(allProductsPageSize);
  useEffect(() => { setAllProductsLimit(allProductsPageSize); }, [allProductsPageSize]);
  const { data: homepageAllProducts, isLoading: allProductsLoading } = useHomepageAllProducts(allProductsLimit);
  const { data: allProductsTotal } = useHomepageAllProductsCount();
  const { data: salesMap } = useProductSalesCounts();
  const { data: viewsMap } = useProductViewCounts();

  // Auto-scroll to #reviews — element is now always in DOM via Layout
  useEffect(() => {
    if (location.hash !== '#reviews') return;
    requestAnimationFrame(() => {
      document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth' });
    });
  }, [location.hash]);
  
  const [activeSlide, setActiveSlide] = useState(0);
  const cfg = useMemo(() => {
    if (!savedConfig) return DEFAULT_HOMEPAGE_CONFIG;
    const merged: any = {};
    for (const key of Object.keys(DEFAULT_HOMEPAGE_CONFIG)) {
      const def = (DEFAULT_HOMEPAGE_CONFIG as any)[key];
      if (typeof def === 'object' && !Array.isArray(def)) {
        merged[key] = { ...def, ...savedConfig[key] };
      } else {
        merged[key] = savedConfig[key] ?? def;
      }
    }
    if (savedConfig.testimonials?.items) merged.testimonials.items = savedConfig.testimonials.items;
    if (savedConfig.section_order) {
      let order = [...savedConfig.section_order];
      // Auto-inject newer built-in sections if missing from user's saved order
      if (!order.includes('stock_clearance')) {
        const idx = order.indexOf('best_selling');
        if (idx >= 0) order.splice(idx, 0, 'stock_clearance');
        else order.push('stock_clearance');
      }
      if (!order.includes('trending')) {
        const idx = order.indexOf('stock_clearance');
        if (idx >= 0) order.splice(idx + 1, 0, 'trending');
        else {
          const bs = order.indexOf('best_selling');
          if (bs >= 0) order.splice(bs, 0, 'trending');
          else order.push('trending');
        }
      }
      merged.section_order = order;
    }
    // Preserve html_block_*, page_block_*, and product_block_* keys
    for (const key of Object.keys(savedConfig)) {
      if (key.startsWith('html_block_') || key.startsWith('page_block_') || key.startsWith('product_block_')) {
        merged[key] = savedConfig[key];
      }
    }
    return merged;
  }, [savedConfig]);

  // Preload hero banner image for LCP
  useEffect(() => {
    const banners = cfg?.hero?.hero_banners;
    const heroImg = banners?.[0]?.image || cfg?.hero?.hero_image;
    if (heroImg) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = heroImg;
      document.head.appendChild(link);
      return () => { document.head.removeChild(link); };
    }
  }, [cfg]);

  const orgJsonLd = useMemo(() => {
    const schemas: Record<string, any>[] = [
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Shorno Suta',
        // Every spelling customers actually search with — helps Google's
        // entity understanding surface this as *the* result for any of them,
        // not just the one canonical spelling.
        alternateName: ['স্বর্ণ সুতা', 'Sorno Suta'],
        url: 'https://www.shornosuta.com',
        logo: 'https://www.shornosuta.com/pwa-512x512.png',
        contactPoint: { '@type': 'ContactPoint', telephone: '+8801843711211', contactType: 'customer service' },
        sameAs: ['https://www.facebook.com/shornosuta'],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Shorno Suta',
        url: 'https://www.shornosuta.com',
        potentialAction: { '@type': 'SearchAction', target: 'https://www.shornosuta.com/shop?q={search_term_string}', 'query-input': 'required name=search_term_string' },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'স্বর্ণ সুতা | বাংলাদেশের সেরা অনলাইন শপ',
        url: 'https://www.shornosuta.com',
        description: 'স্বর্ণ সুতা থেকে সেরা মানের পোশাক কিনুন। ঢাকায় ২৪ ঘণ্টায় ডেলিভারি, সারাদেশে ক্যাশ অন ডেলিভারি।',
      },
    ];

    // ItemList for best-selling products
    const productList = bestSelling || [];
    if (productList.length > 0) {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'বেস্ট সেলিং পণ্য - স্বর্ণ সুতা',
        numberOfItems: productList.length,
        itemListElement: productList.slice(0, 20).map((p: any, i: number) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `https://www.shornosuta.com/product/${p.slug}`,
          name: p.name_bn || p.name,
          image: p.images?.[0],
        })),
      });
    }

    return schemas;
  }, [bestSelling?.length]);

  // Show skeleton until critical data is ready — prevents flash of default content
  if (settingsLoading || configLoading) {
    return (
      <Layout>
        <div className="container px-3 sm:px-4 pt-2 sm:pt-4" style={{ minHeight: '100vh' }}>
          <Skeleton className="w-full aspect-[21/9] rounded-2xl" />
          <div className="py-10 flex gap-4 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="shrink-0 w-28">
                <Skeleton className="w-20 h-20 rounded-full mx-auto mb-3" />
                <Skeleton className="h-3 w-3/4 mx-auto" />
              </div>
            ))}
          </div>
          <ProductGridSkeleton />
        </div>
      </Layout>
    );
  }

  const sectionOrder: string[] = cfg.section_order || DEFAULT_HOMEPAGE_CONFIG.section_order;

  const renderSection = (sKey: string) => {
    const sectionCfg = cfg[sKey];
    if (!sectionCfg || sectionCfg.enabled === false) return null;

    const sectionStyle: React.CSSProperties = sectionCfg.bg_color ? { backgroundColor: sectionCfg.bg_color } : {};
    const htmlBefore = sectionCfg.custom_html_before;
    const htmlAfter = sectionCfg.custom_html_after;
    const sectionCss = sectionCfg.custom_css;

    const sanitizedCss = sectionCss ? sanitizeCss(sectionCss) : '';
    const sanitizedBefore = htmlBefore ? sanitizeHtml(htmlBefore) : '';
    const sanitizedAfter = htmlAfter ? sanitizeHtml(htmlAfter) : '';

    const wrapSection = (key: string, content: React.ReactNode) => (
      <div key={key}>
        {sanitizedCss && <style dangerouslySetInnerHTML={{ __html: sanitizedCss }} />}
        {sanitizedBefore && <div dangerouslySetInnerHTML={{ __html: sanitizedBefore }} />}
        {content}
        {sanitizedAfter && <div dangerouslySetInnerHTML={{ __html: sanitizedAfter }} />}
      </div>
    );

    switch (sKey) {
      case 'hero': {
        const hideText = sectionCfg.hide_text === true;
        const secBtnType = sectionCfg.secondary_button_type || 'helpline';
        const secBtnText = sectionCfg.secondary_button_text;

        const renderSecondaryButton = () => {
          if (secBtnType === 'none') return null;
          if (secBtnType === 'whatsapp') {
            const waNum = sectionCfg.whatsapp_number || settings?.whatsapp_number || settings?.helpline_number || '';
            return (
              <Button asChild variant="outline" size="lg" className="gap-2 border-accent text-accent hover:bg-accent/5 hidden sm:inline-flex">
                <a href={`https://wa.me/${waNum.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-4 w-4" />
                  {secBtnText || 'হোয়াটসঅ্যাপে মেসেজ করুন'}
                </a>
              </Button>
            );
          }
          if (secBtnType === 'custom_link') {
            return (
              <Button asChild variant="outline" size="lg" className="gap-2 border-accent text-accent hover:bg-accent/5 hidden sm:inline-flex">
                <a href={sectionCfg.secondary_button_link || '#'} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  {secBtnText || 'ভিজিট করুন'}
                </a>
              </Button>
            );
          }
          // helpline (default)
          return (
            <Button asChild variant="outline" size="lg" className="gap-2 border-accent text-accent hover:bg-accent/5 hidden sm:inline-flex">
              <a href={`tel:${settings?.helpline_number}`}>
                <Phone className="h-4 w-4" />
                {secBtnText || `হেল্পলাইন: ${settings?.helpline_number}`}
              </a>
            </Button>
          );
        };

        // Resolve banners (backward compatible)
        const banners = sectionCfg.hero_banners?.length > 0
          ? sectionCfg.hero_banners
          : sectionCfg.hero_image
            ? [{ image: sectionCfg.hero_image, link: sectionCfg.hero_image_link || '' }]
            : [];

        const renderSingleBannerImg = (banner: { image: string; link: string }) => {
          const img = <img src={optimizedImageUrl(banner.image, 900, 70)} alt="Banner" className="w-full h-full object-cover" width={900} {...{ fetchpriority: 'high' }} />;
          return banner.link ? (
            <a href={banner.link} className="block w-full">{img}</a>
          ) : img;
        };

        const hasBanners = banners.length > 0;

        const bannerElement = banners.length > 1 ? (
          <HeroBannerCarousel banners={banners} onSlideChange={setActiveSlide} />
        ) : banners.length === 1 ? (
          <div className="w-full rounded-xl overflow-hidden" style={{ aspectRatio: '21/9' }}>{renderSingleBannerImg(banners[0])}</div>
        ) : (
          <div className="w-full rounded-xl overflow-hidden bg-primary/10 flex items-center justify-center" style={{ aspectRatio: '21/9' }}>
            <div className="text-center">
              <p className="text-6xl mb-2">🛍️</p>
              <p className="font-bold text-xl text-primary">{settings?.store_name_bn || 'মাই স্টোর'}</p>
            </div>
          </div>
        );

        // Per-banner text (fallback to global)
        const currentBanner = banners[activeSlide] || {};
        const displayTitle = (currentBanner as any).title || sectionCfg.title || 'সেরা মানের';
        const displayHighlight = (currentBanner as any).title_highlight || sectionCfg.title_highlight || 'পণ্য';
        const displaySubtitle = (currentBanner as any).subtitle || sectionCfg.subtitle;

        const primaryLink = sectionCfg.primary_button_link || '/shop';
        const isExternal = primaryLink.startsWith('http');
        const btnContent = <>{sectionCfg.button_text || 'শপিং শুরু করুন'} <ArrowRight className="h-4 w-4" /></>;

        const showPrimaryBtn = !sectionCfg.hide_primary_button;

        const buttonsBlock = (
          <div className="flex flex-wrap gap-2 sm:gap-3">
            {showPrimaryBtn && (
              <Button asChild size="default" className="gap-1.5 sm:gap-2 shadow-lg text-xs sm:text-sm h-8 sm:h-10 px-3 sm:px-6">
                {isExternal ? (
                  <a href={primaryLink} target="_blank" rel="noopener noreferrer">{btnContent}</a>
                ) : (
                  <Link to={primaryLink}>{btnContent}</Link>
                )}
              </Button>
            )}
            {renderSecondaryButton()}
          </div>
        );

        return wrapSection(sKey,
          <section style={sectionStyle}>
            <style dangerouslySetInnerHTML={{ __html: sanitizeCss(`
              @keyframes hero-text-in {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
              }
              .hero-text-animate { animation: hero-text-in 0.5s ease-out forwards; }
            `) }} />
            <div className="container px-3 sm:px-4 pt-2 sm:pt-4">
              <div className="relative w-full overflow-hidden rounded-2xl shadow-lg">
                {/* Banner */}
                {bannerElement}
                {/* Gradient overlay — only show when text or buttons are visible */}
                {(!hideText || showPrimaryBtn || (secBtnType !== 'none')) && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent pointer-events-none rounded-2xl" />
                )}
                {/* Text + buttons overlay */}
                <div className="absolute inset-0 flex flex-col justify-end pointer-events-none">
                  <div className="px-3 sm:px-6 pb-4 sm:pb-6 md:pb-12 pointer-events-auto">
                    <div key={activeSlide} className="hero-text-animate space-y-2 sm:space-y-3 md:space-y-4 max-w-2xl">
                      {!hideText && (
                        <>
                          <h1 className="text-lg sm:text-2xl md:text-5xl font-bold leading-tight text-white drop-shadow-lg">
                            {displayTitle}{' '}
                            <span className="text-primary-foreground bg-primary/80 px-1 sm:px-2 rounded text-base sm:text-xl md:text-4xl">{displayHighlight}</span>
                          </h1>
                          {displaySubtitle && (
                            <p className="text-xs sm:text-sm md:text-lg text-white/90 drop-shadow-md line-clamp-2">{displaySubtitle}</p>
                          )}
                        </>
                      )}
                      {buttonsBlock}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      }

      case 'categories':
        return wrapSection(sKey,
          <CategoryCarousel
            categories={categories || []}
            isLoading={categoriesLoading}
            heading={sectionCfg.heading}
            subheading={sectionCfg.subheading}
            sectionStyle={sectionStyle}
          />
        );

      case 'stock_clearance':
        return <StockClearanceSection key={sKey} block={sectionCfg} sectionStyle={sectionStyle} wrapSection={wrapSection} sKey={sKey} />;

      case 'trending':
        return <TrendingNowSection key={sKey} block={sectionCfg} sectionStyle={sectionStyle} wrapSection={wrapSection} sKey={sKey} />;

      case 'best_selling':
        if (!bestSellingLoading && (!bestSelling || bestSelling.length === 0)) return null;
        return wrapSection(sKey,
          <section className="py-6 bg-primary/5" style={sectionStyle}>
              <div className="px-3 md:container">
                <div className="mb-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl md:text-2xl font-bold animate-heading-slide">{sectionCfg.heading}</h2>
                    <Button asChild variant="ghost" size="sm" className="gap-1 btn-arrow-hover">
                      <Link to="/shop?sort=best-selling">সব দেখুন <ArrowRight className="h-4 w-4 arrow-icon" /></Link>
                    </Button>
                  </div>
                  {sectionCfg.subheading && <p className="text-xs md:text-sm text-muted-foreground mt-1 animate-heading-slide">{sectionCfg.subheading}</p>}
                </div>
                {bestSellingLoading ? <ProductGridSkeleton /> : (
                  <ProductSlider products={explodeProductsByColor(bestSelling || [])} buttonConfig={buttonConfig} salesMap={salesMap} viewsMap={viewsMap} />
                )}
              </div>
            </section>
        );

      case 'new_products':
        return wrapSection(sKey,
          <section className="py-6" style={sectionStyle}>
              <div className="px-3 md:container">
                <div className="mb-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl md:text-2xl font-bold animate-heading-slide">{sectionCfg.heading}</h2>
                    <Button asChild variant="ghost" size="sm" className="gap-1 btn-arrow-hover">
                      <Link to="/shop?sort=newest">সব দেখুন <ArrowRight className="h-4 w-4 arrow-icon" /></Link>
                    </Button>
                  </div>
                  {sectionCfg.subheading && <p className="text-xs md:text-sm text-muted-foreground mt-1 animate-heading-slide">{sectionCfg.subheading}</p>}
                </div>
                {newProductsLoading ? <ProductGridSkeleton /> : (
                  <ProductSlider products={explodeProductsByColor(newProducts?.slice(0, sectionCfg.limit || 10) || [])} buttonConfig={buttonConfig} salesMap={salesMap} viewsMap={viewsMap} />
                )}
              </div>
            </section>
        );

      case 'all_products': {
        return wrapSection(sKey,
          <AllProductsSection
            sectionCfg={sectionCfg}
            sectionStyle={sectionStyle}
            allProducts={homepageAllProducts}
            isLoading={allProductsLoading}
            buttonConfig={buttonConfig}
            salesMap={salesMap}
            viewsMap={viewsMap}
            totalCount={allProductsTotal}
            onLoadMore={(next: number) => setAllProductsLimit(prev => Math.max(prev, next))}
            currentLimit={allProductsLimit}
          />
        );
      }

      case 'testimonials':
        // Rendered globally via Layout > GlobalReviewSection
        return null;

      default:
        if (sKey.startsWith('html_block_')) {
          const block = cfg[sKey];
          if (!block || block.enabled === false || !block.html) return null;
          return wrapSection(sKey,
            <section style={sectionStyle}>
              <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.html) }} />
            </section>
          );
        }
        if (sKey.startsWith('page_block_')) {
          const block = cfg[sKey];
          if (!block || block.enabled === false || !block.page_id) return null;
          const pageData = pagesConfigData?.pages?.find((p: any) => p.id === block.page_id && p.enabled);
          if (!pageData?.sections?.length) return null;
          return wrapSection(sKey,
            <section className="py-10" style={sectionStyle}>
              <div className="container">
                <div className="text-center mb-6">
                  {pageData.icon && <span className="text-3xl">{pageData.icon}</span>}
                  <h2 className="text-2xl md:text-3xl font-bold mt-2">{pageData.title}</h2>
                  {pageData.subtitle && <p className="text-muted-foreground text-sm mt-1">{pageData.subtitle}</p>}
                </div>
                <div className="max-w-3xl mx-auto space-y-4">
                  {pageData.sections.map((section: any, idx: number) => {
                    if (section.type === 'html_blog') {
                      return (
                        <div key={idx} className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.body) }} />
                      );
                    }
                    return (
                      <Card key={idx}>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-lg">
                            {section.icon && <span>{section.icon}</span>}
                            {section.heading}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-foreground text-sm" dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.body.replace(/\n/g, '<br/>')) }} />
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        }
        if (sKey.startsWith('product_block_')) {
          const block = cfg[sKey];
          if (!block || block.enabled === false) return null;
          return <ProductBlockSection key={sKey} block={block} sectionStyle={sectionStyle} wrapSection={wrapSection} sKey={sKey} />;
        }
        return null;
    }
  };

  return (
    <Layout>
      <SEOHead
        title="স্বর্ণ সুতা | বাংলাদেশের সেরা অনলাইন শপ"
        description="স্বর্ণ সুতা থেকে সেরা মানের পোশাক কিনুন। ঢাকায় ২৪ ঘণ্টায় ডেলিভারি, সারাদেশে ক্যাশ অন ডেলিভারি।"
        canonical="/"
        jsonLd={orgJsonLd}
        keywords="স্বর্ণ সুতা, Shorno Suta, অনলাইন শপিং, বাংলাদেশ, থ্রি পিস, শাড়ি, কুর্তি, বোরকা, পাঞ্জাবি, মেয়েদের জামা, ফ্রি ডেলিভারি, কিনুন, online shopping bangladesh"
      />
      {cfg.global?.custom_css && <style dangerouslySetInnerHTML={{ __html: sanitizeCss(cfg.global.custom_css) }} />}
      {cfg.global?.custom_html && <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(cfg.global.custom_html) }} />}
      {sectionOrder.map((sKey) => (
        <SectionErrorBoundary key={sKey} name={sKey}>{renderSection(sKey)}</SectionErrorBoundary>
      ))}
    </Layout>
  );
};

function HeroBannerCarousel({ banners, onSlideChange }: { banners: { image: string; link: string }[]; onSlideChange?: (index: number) => void }) {
  const [autoplayPlugin, setAutoplayPlugin] = useState<any[]>([]);
  useEffect(() => {
    import('embla-carousel-autoplay').then((mod) => {
      setAutoplayPlugin([mod.default({ delay: 4000, stopOnInteraction: false })]);
    });
  }, []);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, autoplayPlugin);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      onSlideChange?.(emblaApi.selectedScrollSnap());
    };
    emblaApi.on('select', onSelect);
    onSelect();
    return () => { emblaApi.off('select', onSelect); };
  }, [emblaApi, onSlideChange]);

  return (
    <div ref={emblaRef} className="overflow-hidden w-full rounded-xl">
      <div className="flex">
        {banners.map((b, i) => {
          const img = <img key={i} src={optimizedImageUrl(b.image, 900, 70)} alt={`Banner ${i + 1}`} className="w-full h-full object-cover" width={900} {...(i === 0 ? { fetchpriority: 'high' } : {})} />;
          const slide = b.link ? (
            <a key={i} href={b.link} className="block w-full h-full">{img}</a>
          ) : img;
          return (
            <div key={i} className="flex-[0_0_100%]" style={{ aspectRatio: '21/9' }}>{slide}</div>
          );
        })}
      </div>
    </div>
  );
}

/* Duplicate TestimonialSlider/ReviewSubmitDialog removed — rendered globally via Layout > GlobalReviewSection */

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="aspect-[3/4] rounded-lg" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}

/* ========== ALL PRODUCTS SECTION with sort + load more ========== */
function AllProductsSection({ sectionCfg, sectionStyle, allProducts, isLoading, buttonConfig, salesMap, viewsMap, totalCount, onLoadMore, currentLimit }: {
  sectionCfg: any;
  sectionStyle: React.CSSProperties;
  allProducts: any[] | undefined;
  isLoading: boolean;
  buttonConfig: any;
  salesMap: Map<string, number> | undefined;
  viewsMap: Map<string, number> | undefined;
  totalCount?: number;
  onLoadMore?: (next: number) => void;
  currentLimit?: number;
}) {
  const PAGE_SIZE = sectionCfg.limit || 40;
  const sortMode = sectionCfg.sort || 'default';
  const allHeading = sectionCfg.heading || 'সব পণ্য';

  const sortedProducts = useMemo(() => {
    if (!allProducts) return [];
    const getSales = (id: string) => salesMap?.get(id) || 0;
    const getTier = (p: any) => {
      const s = getSales(p.id);
      if (s >= 100) return 0; // top rated
      if (s >= 20) return 1;  // trending
      const created = p.created_at ? new Date(p.created_at).getTime() : 0;
      const ageDays = created ? (Date.now() - created) / 86400000 : Infinity;
      if (ageDays <= 30) return 2; // new
      return 3;
    };
    return [...allProducts].sort((a, b) => {
      const ta = getTier(a), tb = getTier(b);
      if (ta !== tb) return ta - tb;
      const sa = getSales(a.id), sb = getSales(b.id);
      if (sa !== sb) return sb - sa;
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  }, [allProducts, salesMap]);

  const loaded = sortedProducts.length;
  const hasMore = totalCount ? loaded < totalCount : false;

  // Exploded only for display — pagination math above stays keyed to raw
  // product rows (matching the server-side count/limit), while the grid
  // itself shows one card per color variant, same as every other section.
  const displayCards = useMemo(() => explodeProductsByColor(sortedProducts), [sortedProducts]);

  return (
    <section className="py-12 bg-accent/5" style={sectionStyle}>
      <div className="px-3 md:px-0 md:container">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">{allHeading}</h2>
            <p className="text-muted-foreground">{sectionCfg.subheading}</p>
          </div>
        </div>
        {isLoading && loaded === 0 ? <ProductGridSkeleton /> : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-6">
              {displayCards.map((p: any) => (
                <ProductCard key={p.linkColor ? `${p.id}::${p.linkColor}` : p.id} id={p.id} slug={p.slug} name={p.name} name_bn={p.name_bn} price={p.price} original_price={p.original_price} image={p.images?.[0]} buttonConfig={buttonConfig} totalSold={salesMap?.get(p.id)} totalViews={viewsMap?.get(p.id)} hasVideo={!!p.video_url} createdAt={p.created_at} clearance_active={p.clearance_active} variant_images={p.variant_images} linkColor={p.linkColor} />
              ))}
            </div>
            {hasMore && (
              <div className="text-center mt-8">
                <Button onClick={() => onLoadMore?.((currentLimit || loaded) + PAGE_SIZE)} disabled={isLoading} size="lg" variant="outline" className="rounded-full gap-2 border-primary text-primary hover:bg-primary/5 btn-pulse-glow btn-arrow-hover">
                  {isLoading ? 'লোড হচ্ছে...' : 'আরো দেখুন'} <ArrowRight className="h-4 w-4 arrow-icon" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function CategoryCarousel({ categories, isLoading, heading, subheading, sectionStyle }: {
  categories: any[];
  isLoading: boolean;
  heading?: string;
  subheading?: string;
  sectionStyle?: React.CSSProperties;
}) {
  const catRef = useScrollAnimation();
  const [autoplayPlugin, setAutoplayPlugin] = useState<any[]>([]);
  useEffect(() => {
    import('embla-carousel-autoplay').then((mod) => {
      setAutoplayPlugin([mod.default({ delay: 3000, stopOnInteraction: false })]);
    });
  }, []);
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: 'start', slidesToScroll: 1 },
    autoplayPlugin
  );
  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  // Subcategory row — its own carousel + autoplay instance so it slides
  // independently of the main category row above it.
  const mainCats = useMemo(() => categories.filter((c: any) => !c.parent_id), [categories]);
  const allSubCats = useMemo(() => categories.filter((c: any) => c.parent_id), [categories]);
  const mainCatsMap = useMemo(() => {
    const map: Record<string, any> = {};
    for (const c of mainCats) map[c.id] = c;
    return map;
  }, [mainCats]);
  const subCatIds = useMemo(() => allSubCats.map((c: any) => c.id), [allSubCats]);
  const { data: previewImages = {} } = useCategoryPreviewImages(subCatIds);

  const [subAutoplayPlugin, setSubAutoplayPlugin] = useState<any[]>([]);
  useEffect(() => {
    import('embla-carousel-autoplay').then((mod) => {
      setSubAutoplayPlugin([mod.default({ delay: 2800, stopOnInteraction: false })]);
    });
  }, []);
  const [subEmblaRef] = useEmblaCarousel(
    { loop: true, align: 'start', slidesToScroll: 1 },
    subAutoplayPlugin
  );

  return (
    <section className="py-10" ref={catRef} style={sectionStyle}>
      <div className="container">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">{heading}</h2>
            {subheading && <p className="text-muted-foreground text-sm">{subheading}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={scrollPrev} className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={scrollNext} className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        {isLoading ? (
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="shrink-0 w-28 animate-pulse">
                <div className="w-20 h-20 bg-muted rounded-full mx-auto mb-3" />
                <div className="h-3 bg-muted rounded w-3/4 mx-auto" />
              </div>
            ))}
          </div>
        ) : (
          <div ref={emblaRef} className="overflow-hidden">
            <div className="flex -ml-3">
              {mainCats.map((category) => {
                return (
                  <div key={category.id} className="min-w-0 shrink-0 grow-0 basis-1/3 sm:basis-1/4 md:basis-1/6 pl-3">
                    <div className="text-center p-3 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-md transition-all duration-300">
                      <Link to={`/shop/${category.slug}`} className="group block">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/10 mx-auto mb-2 flex items-center justify-center group-hover:-translate-y-1 transition-transform">
                          {category.image_url ? (
                            <img src={optimizedImageUrl(category.image_url, 100, 75)} alt={category.name} className="w-10 h-10 sm:w-12 sm:h-12 object-contain rounded-full" />
                          ) : category.icon ? (
                            <span className="text-2xl sm:text-3xl">{category.icon}</span>
                          ) : (
                            <Package className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
                          )}
                        </div>
                        <p className="font-medium text-xs sm:text-sm line-clamp-1 group-hover:text-primary transition-colors">
                          {category.name_bn || category.name}
                        </p>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Subcategory row — live preview slideshow, auto-sliding right to left */}
      {!isLoading && allSubCats.length > 0 && (
        <div className="mt-6 px-3 md:container">
          <div ref={subEmblaRef} className="overflow-hidden">
            <div className="flex -ml-3">
              {allSubCats.map((sub: any) => (
                <div key={sub.id} className="min-w-0 shrink-0 grow-0 basis-[42%] sm:basis-1/3 md:basis-1/4 lg:basis-1/5 pl-3">
                  <CategoryPhotoTile
                    category={sub}
                    parent={mainCatsMap[sub.parent_id]}
                    images={resolveTileImages(sub.id, categories, previewImages)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}


/* ========== PRODUCT BLOCK SECTION ========== */
const PRODUCT_BLOCK_SELECT = 'id, slug, name, name_bn, price, original_price, clearance_price, clearance_active, images, is_active, category_id, stock, colors, sizes, product_type, created_at, variant_images';

function ProductBlockSection({ block, sectionStyle, wrapSection, sKey }: { block: any; sectionStyle: React.CSSProperties; wrapSection: (key: string, content: React.ReactNode) => React.ReactNode; sKey: string }) {
  const { data: savedBtnConfig } = useSiteConfig('buttons_config');
  const { data: salesMap } = useProductSalesCounts();
  const { data: viewsMap } = useProductViewCounts();
  const blockButtonConfig = savedBtnConfig?.product_card;

  const { data: products, isLoading } = useQuery({
    queryKey: ['product-block', sKey, block.source_type, block.category_id, block.min_reviews, block.limit, JSON.stringify(block.product_ids)],
    queryFn: async () => {
      if (block.source_type === 'manual' && block.product_ids?.length > 0) {
        const { data, error } = await supabase
          .from('products')
          .select(PRODUCT_BLOCK_SELECT)
          .eq('is_active', true)
          .in('id', block.product_ids);
        if (error) throw error;
        const idOrder = block.product_ids as string[];
        return (data || []).sort((a: any, b: any) => idOrder.indexOf(a.id) - idOrder.indexOf(b.id));
      }
      if (block.source_type === 'clearance') {
        const { data, error } = await supabase
          .from('products')
          .select(PRODUCT_BLOCK_SELECT)
          .eq('is_active', true)
          .eq('clearance_active', true)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(block.limit || 12);
        if (error) throw error;
        return applyClearanceList(data || []);
      }
      if (block.source_type === 'trending') {
        const { data, error } = await supabase
          .from('products')
          .select(PRODUCT_BLOCK_SELECT)
          .eq('is_active', true)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(2000);
        if (error) throw error;
        return data || [];
      }
      let query = supabase.from('products').select(PRODUCT_BLOCK_SELECT).eq('is_active', true);
      if (block.category_id) {
        query = query.eq('category_id', block.category_id);
      }
      const { data, error } = await query.order('created_at', { ascending: false }).limit(block.limit || 8);
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) return wrapSection(sKey, <section style={sectionStyle}><div className="container py-6"><ProductGridSkeleton /></div></section>);
  if (!products || products.length === 0) return null;

  let displayProducts: any[] = products;
  if (block.source_type === 'trending') {
    const minReviews = Number(block.min_reviews) || 20;
    const lim = Number(block.limit) || 10;
    displayProducts = (products || [])
      .map((p: any) => {
        const sold = salesMap?.get(p.id) || 0;
        const reviewCount = estimateReviewCount(sold);
        return { p, sold, reviewCount };
      })
      .filter((x: any) => x.reviewCount >= minReviews)
      .sort((a: any, b: any) => b.sold - a.sold)
      .slice(0, lim)
      .map((x: any) => x.p);
  } else if (block.source_type === 'manual') {
    displayProducts = products;
  } else {
    displayProducts = products.slice(0, block.limit || 8);
  }
  if (!displayProducts || displayProducts.length === 0) return null;

  // Build "see all" link — manual blocks pass product IDs + title
  const seeAllLink = block.source_type === 'manual' && block.product_ids?.length > 0
    ? `/shop?ids=${block.product_ids.join(',')}&title=${encodeURIComponent(block.heading || '')}`
    : block.source_type === 'trending' ? '/trending'
    : block.source_type === 'clearance' ? '/clearance'
    : '/shop';

  return wrapSection(sKey,
    <section className="py-6" style={sectionStyle}>
      <div className="px-3 md:container">
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl md:text-2xl font-bold animate-heading-slide">{block.heading}</h2>
            <Button asChild variant="ghost" size="sm" className="gap-1 btn-arrow-hover">
              <Link to={seeAllLink}>সব দেখুন <ArrowRight className="h-4 w-4 arrow-icon" /></Link>
            </Button>
          </div>
          {block.subheading && <p className="text-xs md:text-sm text-muted-foreground mt-1 animate-heading-slide">{block.subheading}</p>}
        </div>
        <ProductSlider products={explodeProductsByColor(displayProducts)} buttonConfig={blockButtonConfig} salesMap={salesMap} viewsMap={viewsMap} />
      </div>
    </section>
  );
}

function StockClearanceSection({ block, sectionStyle, wrapSection, sKey }: { block: any; sectionStyle: React.CSSProperties; wrapSection: (key: string, content: React.ReactNode) => React.ReactNode; sKey: string }) {
  const { data: savedBtnConfig } = useSiteConfig('buttons_config');
  const { data: salesMap } = useProductSalesCounts();
  const { data: viewsMap } = useProductViewCounts();
  const blockButtonConfig = savedBtnConfig?.product_card;
  const ids: string[] = block.product_ids || [];
  const limit = block.limit || 10;

  const { data: products, isLoading } = useQuery({
    queryKey: ['stock-clearance', sKey, JSON.stringify(ids), limit],
    queryFn: async () => {
      // 1) Manually selected products (preserve admin order)
      let manual: any[] = [];
      if (ids.length > 0) {
        const { data, error } = await supabase
          .from('products')
          .select(PRODUCT_BLOCK_SELECT)
          .eq('is_active', true)
          .is('deleted_at', null)
          .in('id', ids);
        if (error) throw error;
        manual = (data || []).sort((a: any, b: any) => ids.indexOf(a.id) - ids.indexOf(b.id));
      }

      // 2) Auto-include any product with clearance_active = true (newest first)
      const { data: autoData, error: autoErr } = await supabase
        .from('products')
        .select(PRODUCT_BLOCK_SELECT)
        .eq('is_active', true)
        .eq('clearance_active', true)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(40);
      if (autoErr) throw autoErr;

      // Merge: manual first, then auto (de-duped)
      const seen = new Set(manual.map((p: any) => p.id));
      const merged = [...manual];
      (autoData || []).forEach((p: any) => { if (!seen.has(p.id)) { merged.push(p); seen.add(p.id); } });

      return applyClearanceList(merged);
    },
  });

  if (isLoading) return wrapSection(sKey, <section style={sectionStyle}><div className="container py-6"><ProductGridSkeleton /></div></section>);
  if (!products || products.length === 0) return null;

  const display = products.slice(0, limit);
  const badgeText = block.badge_text || 'CLEARANCE';
  const seeAllLink = block.view_all_link || '/clearance';

  const defaultBg = 'linear-gradient(135deg, hsl(20 100% 96%) 0%, hsl(350 100% 96%) 50%, hsl(40 100% 95%) 100%)';
  const wrapperStyle: React.CSSProperties = block.bg_color
    ? { backgroundColor: block.bg_color }
    : { backgroundImage: defaultBg };

  return wrapSection(sKey,
    <section className="py-6 relative overflow-hidden" style={{ ...wrapperStyle, ...sectionStyle }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes clearance-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.55); }
          50% { transform: scale(1.06); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
        }
        .clearance-pill { animation: clearance-pulse 1.8s ease-in-out infinite; }
        .clearance-slider-wrap > div > div > div > div { position: relative; }
        .clearance-slider-wrap > div > div > div > div::before {
          content: '${badgeText.replace(/'/g, "\\'")}';
          position: absolute; top: 8px; left: 8px; z-index: 5;
          background: linear-gradient(135deg, #ef4444, #db2777);
          color: white; font-weight: 800; font-size: 9px; letter-spacing: 0.5px;
          padding: 3px 7px; border-radius: 4px;
          box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4);
          pointer-events: none;
        }
      ` }} />
      <div className="px-3 md:container">
        <div className="mb-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl md:text-2xl font-bold animate-heading-slide">{block.heading}</h2>
              <span className="clearance-pill inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] md:text-xs font-extrabold text-white bg-gradient-to-r from-red-500 to-rose-600 shadow-md">
                🔥 SALE
              </span>
            </div>
            <Button asChild variant="ghost" size="sm" className="gap-1 btn-arrow-hover">
              <Link to={seeAllLink}>সব দেখুন <ArrowRight className="h-4 w-4 arrow-icon" /></Link>
            </Button>
          </div>
          {block.subheading && <p className="text-xs md:text-sm text-muted-foreground mt-1 animate-heading-slide">{block.subheading}</p>}
        </div>
        <div className="clearance-slider-wrap">
          <ProductSlider products={explodeProductsByColor(display)} buttonConfig={blockButtonConfig} salesMap={salesMap} viewsMap={viewsMap} />
        </div>
      </div>
    </section>
  );
}

/* ========== TRENDING NOW SECTION ========== */
function TrendingNowSection({ block, sectionStyle, wrapSection, sKey }: { block: any; sectionStyle: React.CSSProperties; wrapSection: (key: string, content: React.ReactNode) => React.ReactNode; sKey: string }) {
  const { data: savedBtnConfig } = useSiteConfig('buttons_config');
  const { data: todaySoldProducts, isLoading } = useBestSellingProducts();
  const { data: salesMap } = useProductSalesCounts();
  const { data: viewsMap } = useProductViewCounts();
  const blockButtonConfig = savedBtnConfig?.product_card;

  const badgeText = block.badge_text || 'TRENDING';
  const seeAllLink = block.view_all_link || '/trending';
  const limit = Math.max(Number(block.limit) || 10, 10);
  const minReviews = Number(block.min_reviews ?? 20);

  // Sort by today's sales; rank by lifetime-sales review proxy first, but
  // backfill with the rest of today's sellers so the section never shrinks
  // to just the handful of already-established products.
  const trending = useMemo(() => {
    const list = todaySoldProducts || [];
    const scored = list.map((p: any) => {
      const lifetime = Number(salesMap?.get(p.id) || 0);
      const todaySold = Number((p as any).today_sold) || 0;
      const reviewCount = estimateReviewCount(lifetime);
      return { p, todaySold, reviewCount };
    });
    const bySales = [...scored].sort((a: any, b: any) => b.todaySold - a.todaySold);
    const credible = bySales.filter((x: any) => x.reviewCount >= minReviews);
    const rest = bySales.filter((x: any) => x.reviewCount < minReviews);
    const picked = (credible.length > 0 ? [...credible, ...rest] : bySales)
      .slice(0, limit)
      .map((x: any) => x.p);
    return picked;
  }, [todaySoldProducts, salesMap, minReviews, limit]);

  // Today's sellers rarely fill the whole row, so top up with the site's
  // best lifetime sellers (excluding whoever is already in) until we hit
  // `limit`, instead of showing a half-empty section.
  const fillerIds = useMemo(() => {
    if (!salesMap || trending.length >= limit) return [];
    const already = new Set(trending.map((p: any) => p.id));
    return Array.from(salesMap.entries())
      .filter(([id, count]) => !already.has(id) && Number(count) > 0)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, (limit - trending.length) * 2) // fetch extra in case some are inactive/out of stock
      .map(([id]) => id);
  }, [trending, salesMap, limit]);
  const { data: fillerProducts } = useProductCardsByIds(fillerIds);

  const combinedTrending = useMemo(() => {
    const merged = !fillerProducts || fillerProducts.length === 0
      ? trending
      : [...trending, ...fillerProducts.slice(0, limit - trending.length)];
    return explodeProductsByColor(merged);
  }, [trending, fillerProducts, limit]);

  if (isLoading) return wrapSection(sKey, <section style={sectionStyle}><div className="container py-6"><ProductGridSkeleton /></div></section>);
  if (!combinedTrending || combinedTrending.length === 0) return null;

  const defaultBg = 'linear-gradient(135deg, hsl(40 100% 96%) 0%, hsl(25 100% 95%) 50%, hsl(350 100% 96%) 100%)';
  const wrapperStyle: React.CSSProperties = block.bg_color
    ? { backgroundColor: block.bg_color }
    : { backgroundImage: defaultBg };

  return wrapSection(sKey,
    <section className="py-6 relative overflow-hidden" style={{ ...wrapperStyle, ...sectionStyle }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes trending-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.55); }
          50% { transform: scale(1.06); box-shadow: 0 0 0 10px rgba(249, 115, 22, 0); }
        }
        .trending-pill { animation: trending-pulse 1.8s ease-in-out infinite; }
        .trending-grid-card { position: relative; }
        .trending-grid-card::before {
          content: '${badgeText.replace(/'/g, "\\'")}';
          position: absolute; top: 8px; left: 8px; z-index: 5;
          background: linear-gradient(135deg, #f97316, #f59e0b);
          color: white; font-weight: 800; font-size: 9px; letter-spacing: 0.5px;
          padding: 3px 7px; border-radius: 4px;
          box-shadow: 0 2px 8px rgba(249, 115, 22, 0.4);
          pointer-events: none;
        }
      ` }} />
      <div className="px-3 md:container">
        <div className="mb-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl md:text-2xl font-bold animate-heading-slide">{block.heading}</h2>
              <span className="trending-pill inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] md:text-xs font-extrabold text-white bg-gradient-to-r from-orange-500 to-amber-500 shadow-md">
                ⚡ HOT
              </span>
            </div>
            <Button asChild variant="ghost" size="sm" className="gap-1 btn-arrow-hover">
              <Link to={seeAllLink}>সব দেখুন <ArrowRight className="h-4 w-4 arrow-icon" /></Link>
            </Button>
          </div>
          {block.subheading && <p className="text-xs md:text-sm text-muted-foreground mt-1 animate-heading-slide">{block.subheading}</p>}
        </div>
        {/* Mobile: horizontal snap slider */}
        <div className="sm:hidden -mx-3 px-3 flex gap-2.5 overflow-x-auto snap-x snap-mandatory pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {combinedTrending.map((p: any, idx: number) => (
            <div key={p.linkColor ? `${p.id}::${p.linkColor}` : `${p.id}-${idx}`} className="trending-grid-card shrink-0 w-[45%] snap-start">
              <ProductCard
                id={p.id}
                slug={p.slug}
                name={p.name}
                name_bn={p.name_bn}
                price={p.price}
                original_price={p.original_price}
                image={p.images?.[0]}
                buttonConfig={blockButtonConfig}
                totalSold={salesMap?.get(p.id)}
                totalViews={viewsMap?.get(p.id)}
                hasVideo={!!p.video_url}
                createdAt={p.created_at}
                clearance_active={p.clearance_active}
                variant_images={p.variant_images}
                linkColor={p.linkColor}
              />
            </div>
          ))}
        </div>

        {/* Desktop / tablet: grid */}
        <div className="hidden sm:grid grid-cols-3 lg:grid-cols-5 gap-2 md:gap-3">
          {combinedTrending.map((p: any, idx: number) => (
            <div key={p.linkColor ? `${p.id}::${p.linkColor}` : `${p.id}-${idx}`} className="trending-grid-card min-w-0">
              <ProductCard
                id={p.id}
                slug={p.slug}
                name={p.name}
                name_bn={p.name_bn}
                price={p.price}
                original_price={p.original_price}
                image={p.images?.[0]}
                buttonConfig={blockButtonConfig}
                totalSold={salesMap?.get(p.id)}
                totalViews={viewsMap?.get(p.id)}
                hasVideo={!!p.video_url}
                createdAt={p.created_at}
                clearance_active={p.clearance_active}
                variant_images={p.variant_images}
                linkColor={p.linkColor}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Index;
