import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import ProductCard from '@/components/product/ProductCard';
import { useProducts, useProductSalesCounts, useProductViewCounts, useCategoryPreviewImages, resolveTileImages } from '@/hooks/useProducts';
import { useCategories, getCategoryTree } from '@/hooks/useCategories';
import { cn } from '@/lib/utils';
import { trackViewItemList } from '@/lib/ecommerceTracking';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import SEOHead from '@/components/SEOHead';
import { useAllSettings } from '@/hooks/useAllSettings';
import { useIsMobile } from '@/hooks/use-mobile';
import useEmblaCarousel from 'embla-carousel-react';
import CategoryOrderCounter from '@/components/shop/CategoryOrderCounter';
import CategoryPhotoTile from '@/components/category/CategoryPhotoTile';
import { optimizedImageUrl } from '@/lib/imageUrl';
import { explodeProductsByColor, productCardKey } from '@/lib/productVariants';

function useProductsByIds(ids: string[]) {
  return useQuery({
    queryKey: ['products-by-ids', ids],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(name, name_bn, slug)')
        .eq('is_active', true)
        .in('id', ids);
      if (error) throw error;
      // Preserve original order
      return (data || []).sort((a: any, b: any) => ids.indexOf(a.id) - ids.indexOf(b.id));
    },
    enabled: ids.length > 0,
  });
}

function useSortedProducts(sortParam: string | null, categorySlug?: string, idsParam?: string | null) {
  const ids = useMemo(() => (idsParam ? idsParam.split(',').filter(Boolean) : []), [idsParam]);
  const idsQuery = useProductsByIds(ids);
  const regularProducts = useProducts(categorySlug, ids.length === 0);
  
  const bestSellingQuery = useQuery({
    queryKey: ['best-selling-all'],
    queryFn: async () => {
      const { data: bestIds, error: rpcError } = await supabase
        .rpc('get_best_selling_product_ids', { p_limit: 1000 });
      if (rpcError) throw rpcError;
      if (!bestIds || bestIds.length === 0) return [];

      const salesMap = new Map<string, number>();
      const fetchIds: string[] = [];
      bestIds.forEach((item: any) => {
        fetchIds.push(item.product_id);
        salesMap.set(item.product_id, item.total_sold);
      });

      let query = supabase.from('products').select('id, slug, name, name_bn, price, original_price, clearance_price, clearance_active, images, is_featured, is_active, category_id, stock, allow_pre_order, colors, sizes, product_type, video_url, created_at, bump_product_id, bump_discount, addon_config, variant_images, categories(name, name_bn, slug)').eq('is_active', true).eq('is_hidden_from_shop', false).in('id', fetchIds);
      if (categorySlug) {
        const { data: cat } = await supabase.from('categories').select('id').eq('slug', categorySlug).maybeSingle();
        if (cat) query = query.eq('category_id', cat.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).sort((a, b) => (salesMap.get(b.id) || 0) - (salesMap.get(a.id) || 0));
    },
    enabled: sortParam === 'best-selling' && ids.length === 0,
  });

  if (ids.length > 0) return idsQuery;
  if (sortParam === 'best-selling') return bestSellingQuery;
  return regularProducts;
}

function ShopBannerSlider({ banners, categoryName, showOverlay }: { banners: { url: string; tagline?: string }[]; categoryName: string; showOverlay: boolean }) {
  const autoplayRef = useRef<any>(null);
  const [pluginsReady, setPluginsReady] = useState(banners.length <= 1);

  useEffect(() => {
    if (banners.length > 1) {
      import('embla-carousel-autoplay').then((mod) => {
        autoplayRef.current = mod.default;
        setPluginsReady(true);
      });
    }
  }, [banners.length]);

  const plugins = useMemo(() => {
    if (autoplayRef.current) return [autoplayRef.current({ delay: 4000, stopOnInteraction: false })];
    return [];
  }, [pluginsReady]);

  const [emblaRef] = useEmblaCarousel({ loop: true }, plugins);
  const single = banners.length === 1;

  const renderSlide = (b: { url: string; tagline?: string }, idx: number) => (
    <div key={idx} className={single ? '' : 'min-w-0 shrink-0 grow-0 basis-full'}>
      <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: '21/9' }}>
        <img src={optimizedImageUrl(b.url, 1200, 78)} alt={categoryName} className="w-full h-full object-cover" loading={idx === 0 ? 'eager' : 'lazy'} />
        {showOverlay && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent flex flex-col justify-end p-6 md:p-8">
            <h1 className="text-2xl md:text-4xl font-bold text-white drop-shadow-lg">{categoryName}</h1>
            {b.tagline && <p className="text-sm md:text-base text-white/85 mt-1 max-w-xl italic">{b.tagline}</p>}
          </div>
        )}
      </div>
    </div>
  );

  if (single) return <div className="mb-8">{renderSlide(banners[0], 0)}</div>;

  if (!pluginsReady) {
    return <div className="mb-8"><div className="rounded-xl overflow-hidden animate-pulse bg-muted" style={{ aspectRatio: '21/9' }} /></div>;
  }

  return (
    <div className="mb-8 overflow-hidden rounded-xl" ref={emblaRef}>
      <div className="flex">
        {banners.map((b, i) => renderSlide(b, i))}
      </div>
    </div>
  );
}

interface ShopProps {
  collectionIds?: string;
  collectionTitle?: string;
}

export default function Shop({ collectionIds, collectionTitle }: ShopProps = {}) {
  const { category } = useParams();
  const [searchParams] = useSearchParams();
  const sortParam = searchParams.get('sort');
  const idsParam = collectionIds || searchParams.get('ids');
  const titleParam = collectionTitle || searchParams.get('title');
  
  const { data: products = [], isLoading } = useSortedProducts(sortParam, category, idsParam);
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  const categoryTree = useMemo(() => getCategoryTree(categories), [categories]);
  const { data: salesMap } = useProductSalesCounts();
  const { data: viewsMap } = useProductViewCounts();
  const { data: allSettings } = useAllSettings();
  const isMobile = useIsMobile();
  const overlayConfig = useMemo(() => {
    if (!allSettings) return null;
    try {
      return allSettings.banner_overlay_config ? JSON.parse(allSettings.banner_overlay_config) : { show_on_desktop: false, show_on_mobile: false };
    } catch { return { show_on_desktop: false, show_on_mobile: false }; }
  }, [allSettings]);
  const showOverlay = overlayConfig ? (isMobile ? overlayConfig.show_on_mobile === true : overlayConfig.show_on_desktop === true) : false;

  const parentCategories = useMemo(() => (categories || []).filter((c: any) => !c.parent_id), [categories]);
  const subCategories = useMemo(() => (categories || []).filter((c: any) => c.parent_id), [categories]);
  const allCategoryIds = useMemo(() => (categories || []).map((c: any) => c.id), [categories]);
  const { data: categoryPreviewImages = {} } = useCategoryPreviewImages(allCategoryIds);

  // Cache category counts to keep loading skeleton dimensions identical to the
  // resolved layout — prevents CLS on /shop when data resolves.
  const [cachedCounts, setCachedCounts] = useState<{ parents: number; subs: number }>(() => {
    try {
      const raw = localStorage.getItem('shop_cat_counts');
      if (raw) return JSON.parse(raw);
    } catch {}
    return { parents: 6, subs: 8 };
  });
  useEffect(() => {
    if (!categoriesLoading && categories.length > 0) {
      const next = { parents: parentCategories.length, subs: subCategories.length };
      if (next.parents !== cachedCounts.parents || next.subs !== cachedCounts.subs) {
        setCachedCounts(next);
        try { localStorage.setItem('shop_cat_counts', JSON.stringify(next)); } catch {}
      }
    }
  }, [categoriesLoading, categories.length, parentCategories.length, subCategories.length]);

  // On /shop root (no category), shuffle products for a randomized mix of new/trending/top-rated
  const filtered = useMemo(() => {
    if (category || idsParam) return products;
    const arr = [...(products || [])];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [products, category, idsParam]);

  // Multi-color products get one card per color here (each thumbnailed with
  // that color's own image) — analytics below still track the underlying
  // products, not the exploded per-color cards.
  const displayCards = useMemo(() => explodeProductsByColor(filtered), [filtered]);

  // GA4: view_item_list
  const viewListFired = useRef(false);
  useEffect(() => {
    if (filtered.length > 0 && !viewListFired.current) {
      viewListFired.current = true;
      trackViewItemList(
        filtered.map((p: any) => ({ id: p.id, name: p.name, name_bn: p.name_bn, price: p.price, category: category || '' })),
        category ? `Category: ${category}` : 'Shop'
      );
    }
  }, [filtered.length]);

  const currentCategory = categories.find((c: any) => c.slug === category);

  // All product ids ever in this category (+ subcategories), regardless of
  // is_active/stock/hidden status — used for the live order counter so a
  // product going out of stock or getting disabled doesn't silently drop its
  // historical sold count out of the category total.
  const counterCategoryIds = useMemo(() => {
    if (!currentCategory) return [];
    const subIds = (categories || []).filter((c: any) => c.parent_id === currentCategory.id).map((c: any) => c.id);
    return [currentCategory.id, ...subIds];
  }, [currentCategory, categories]);
  const { data: allCategoryProductIds = [] } = useQuery({
    queryKey: ['all-category-product-ids', counterCategoryIds.slice().sort().join(',')],
    enabled: counterCategoryIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id')
        .in('category_id', counterCategoryIds)
        .is('deleted_at', null);
      if (error) throw error;
      return (data || []).map((p: any) => p.id as string);
    },
  });

  // Shop banner gallery
  const shopGallery = useMemo(() => {
    if (!currentCategory?.id || !allSettings) return [];
    const key = `cat_banners_shop_${currentCategory.id}`;
    try { return allSettings[key] ? JSON.parse(allSettings[key]) : []; } catch { return []; }
  }, [currentCategory?.id, allSettings]);
  const shopTitle = currentCategory ? `${currentCategory.name_bn || currentCategory.name} | স্বর্ণ সুতা` : 'শপ | স্বর্ণ সুতা';
  const shopDesc = currentCategory
    ? `${currentCategory.name_bn || currentCategory.name} ক্যাটেগরির সেরা পণ্য কিনুন স্বর্ণ সুতা থেকে।`
    : 'স্বর্ণ সুতার সকল পণ্য দেখুন। সেরা মানের পোশাক সেরা দামে।';

  const shopJsonLd = useMemo(() => {
    const schemas: Record<string, any>[] = [];
    // BreadcrumbList
    const breadcrumbItems: any[] = [
      { '@type': 'ListItem', position: 1, name: 'হোম', item: 'https://shorno-suta.vercel.app/' },
      { '@type': 'ListItem', position: 2, name: 'শপ', item: 'https://shorno-suta.vercel.app/shop' },
    ];
    if (currentCategory) {
      breadcrumbItems.push({ '@type': 'ListItem', position: 3, name: currentCategory.name_bn || currentCategory.name });
    }
    schemas.push({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: breadcrumbItems });

    // ItemList for first 20 products
    if (filtered.length > 0) {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: currentCategory ? (currentCategory.name_bn || currentCategory.name) : 'স্বর্ণ সুতা পণ্য',
        numberOfItems: filtered.length,
        itemListElement: filtered.slice(0, 20).map((p: any, i: number) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `https://shorno-suta.vercel.app/product/${p.slug}`,
          name: p.name_bn || p.name,
          image: p.images?.[0],
        })),
      });
    }

    // CollectionPage for category pages
    if (currentCategory) {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: currentCategory.name_bn || currentCategory.name,
        url: `https://shorno-suta.vercel.app/shop/${currentCategory.slug}`,
        description: shopDesc,
      });
    }

    return schemas;
  }, [filtered.length, currentCategory?.id]);

  return (
    <Layout>
      <SEOHead
        title={shopTitle}
        description={shopDesc}
        canonical={category ? `/shop/${category}` : '/shop'}
        jsonLd={shopJsonLd}
        keywords={currentCategory ? `${currentCategory.name_bn}, ${currentCategory.name}, অনলাইন শপিং, বাংলাদেশ, কিনুন, Shorno Suta` : 'অনলাইন শপিং, বাংলাদেশ, পোশাক, থ্রি পিস, শাড়ি, কুর্তি, Shorno Suta'}
      />
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Category Banner or Title */}
        {category && categoriesLoading ? (
          <div className="rounded-xl animate-pulse bg-muted mb-8" style={{ aspectRatio: '21/9' }} />
        ) : currentCategory ? (() => {
          const shopBanner = (currentCategory as any).shop_banner_url || currentCategory.banner_image_url;
          const shopTagline = (currentCategory as any).shop_banner_tagline || currentCategory.banner_tagline;
          const banners = shopGallery.length > 0 ? shopGallery : shopBanner ? [{ url: shopBanner, tagline: shopTagline }] : [];
          return banners.length > 0 ? (
            <ShopBannerSlider banners={banners} categoryName={currentCategory.name_bn || currentCategory.name} showOverlay={showOverlay} />
          ) : (
            <div className="relative rounded-xl overflow-hidden mb-8 bg-gradient-to-r from-primary/10 to-accent/10" style={{ aspectRatio: '21/9' }}>
              <div className="absolute inset-0 flex flex-col justify-center items-center p-6">
                <h1 className="text-2xl md:text-4xl font-bold text-foreground">
                  {currentCategory.name_bn || currentCategory.name}
                </h1>
              </div>
            </div>
          );
        })() : (
          <h1 className="text-3xl font-bold mb-8">
            {titleParam ? decodeURIComponent(titleParam) : 'শপ'}
          </h1>
        )}

        <div className="flex flex-col md:flex-row gap-8">
          {/* Mobile: horizontal chips — hidden on category/subcategory pages (breadcrumb shown instead) */}
          {!category && (
            <div className="md:hidden flex gap-2 overflow-x-auto pb-2 -mx-4 px-4" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <Link
                to="/shop"
                className={cn('shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition-colors', !category ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground')}
              >
                সব পণ্য
              </Link>
              {categoryTree.map(({ category: cat, depth }) => (
                <Link
                  key={cat.id}
                  to={`/shop/${cat.slug}`}
                  className={cn('shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition-colors', category === cat.slug ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground')}
                >
                  {depth > 0 ? `↳ ${cat.name_bn || cat.name}` : (cat.name_bn || cat.name)}
                </Link>
              ))}
            </div>
          )}

          {/* Desktop: sidebar */}
          <aside className="hidden md:block md:w-56 shrink-0 sticky top-24 self-start">
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-3">ক্যাটেগরি</h3>
            <div className="space-y-1">
              <Link
                to="/shop"
                className={cn('block text-sm py-1.5 px-2 rounded', !category ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                সব পণ্য
              </Link>
              {categoryTree.map(({ category: cat, depth }) => (
                <Link
                  key={cat.id}
                  to={`/shop/${cat.slug}`}
                  className={cn('block text-sm py-1.5 px-2 rounded', depth > 0 && 'ml-3 text-[13px]', category === cat.slug ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
                >
                  {depth > 0 ? `↳ ${cat.name_bn || cat.name}` : (cat.name_bn || cat.name)}
                </Link>
              ))}
            </div>
          </aside>

          {/* Products */}
          <div className="flex-1">
            {category && filtered.length > 0 && (
              <CategoryOrderCounter
                productIds={allCategoryProductIds}
                parentCategory={
                  currentCategory && (currentCategory as any).parent_id
                    ? (categories.find((c: any) => c.id === (currentCategory as any).parent_id) as any) || null
                    : null
                }
                currentCategory={currentCategory as any}
              />
            )}



            {!category && !idsParam && (
              <>
                {categoriesLoading ? (
                  <>
                    <section className="mb-6" aria-busy="true">
                      <div className="h-5 sm:h-6 w-24 bg-muted rounded animate-pulse mb-3" />
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {Array.from({ length: cachedCounts.parents }).map((_, i) => (
                          <div key={i} className="rounded-2xl bg-muted aspect-[3/4] animate-pulse" />
                        ))}
                      </div>
                    </section>
                    <section className="mb-6" aria-busy="true">
                      <div className="h-5 sm:h-6 w-32 bg-muted rounded animate-pulse mb-3" />
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {Array.from({ length: cachedCounts.subs }).map((_, i) => (
                          <div key={i} className="rounded-2xl bg-muted aspect-[3/4] animate-pulse" />
                        ))}
                      </div>
                    </section>
                    <div className="h-5 sm:h-6 w-24 bg-muted rounded animate-pulse mb-3" />
                  </>
                ) : (
                  <>
                    {parentCategories.length > 0 && (
                      <section className="mb-6">
                        <h2 className="text-base sm:text-lg font-bold mb-3">ক্যাটাগরি</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                          {parentCategories.map((cat: any) => (
                            <CategoryPhotoTile
                              key={cat.id}
                              category={cat}
                              images={resolveTileImages(cat.id, categories, categoryPreviewImages)}
                            />
                          ))}
                        </div>
                      </section>
                    )}

                    {subCategories.length > 0 && (
                      <section className="mb-6">
                        <h2 className="text-base sm:text-lg font-bold mb-3">সাব-ক্যাটাগরি</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                          {subCategories.map((cat: any) => (
                            <CategoryPhotoTile
                              key={cat.id}
                              category={cat}
                              parent={categories.find((c: any) => c.id === cat.parent_id)}
                              images={resolveTileImages(cat.id, categories, categoryPreviewImages)}
                            />
                          ))}
                        </div>
                      </section>
                    )}

                    <h2 className="text-base sm:text-lg font-bold mb-3">সেরা পণ্য</h2>
                  </>
                )}
              </>
            )}



            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-[3/4] bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ) : displayCards.length === 0 ? (
              <p className="text-muted-foreground text-center py-16">কোনো পণ্য পাওয়া যায়নি।</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                {displayCards.map((p: any) => (
                  <ProductCard
                    key={productCardKey(p)}
                    id={p.id}
                    slug={p.slug}
                    name={p.name}
                    name_bn={p.name_bn}
                    price={p.price}
                    original_price={p.original_price}
                    image={p.images?.[0]}
                    totalSold={salesMap?.get(p.id)}
                    totalViews={viewsMap?.get(p.id)}
                    hasVideo={!!p.video_url}
                    createdAt={p.created_at}
                    clearance_active={(p as any).clearance_active}
                    variant_images={(p as any).variant_images}
                    linkColor={p.linkColor}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
