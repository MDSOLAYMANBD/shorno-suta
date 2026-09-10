import { useMemo } from 'react';
import Layout from '@/components/layout/Layout';
import ProductCard from '@/components/product/ProductCard';
import SEOHead from '@/components/SEOHead';
import { useHomepageAllProducts, useProductSalesCounts, useProductViewCounts } from '@/hooks/useProducts';
import { estimateReviewCount } from '@/lib/reviewCount';
import { Zap, Flame, TrendingUp, Sparkles } from 'lucide-react';

export default function TrendingProducts() {
  const { data: products, isLoading } = useHomepageAllProducts(2000);
  const { data: salesMap } = useProductSalesCounts();
  const { data: viewsMap } = useProductViewCounts();

  const trending = useMemo(() => {
    if (!products || !salesMap) return [];
    return products
      .map((p: any) => {
        const sold = salesMap.get(p.id) || 0;
        const reviewCount = estimateReviewCount(sold);
        return { p, sold, reviewCount };
      })
      .filter((x) => x.reviewCount >= 20)
      .sort((a, b) => b.sold - a.sold);
  }, [products, salesMap]);

  const topRatedCount = trending.filter((x) => x.reviewCount >= 100).length;
  const trendingCount = trending.length - topRatedCount;

  return (
    <Layout>
      <SEOHead
        title="Trending Products - Shorno Suta"
        description="এখনকার সবচেয়ে জনপ্রিয় ও বেশি বিক্রি হওয়া trending products এক জায়গায়।"
      />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 text-white">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute -top-10 -left-10 w-48 sm:w-64 h-48 sm:h-64 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute -bottom-10 -right-10 w-56 sm:w-72 h-56 sm:h-72 rounded-full bg-yellow-200/30 blur-3xl" />
        </div>
        <div className="container mx-auto px-4 py-5 sm:py-14 relative">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-sm ring-1 ring-white/30 mb-2 sm:mb-3">
            <Flame className="h-3 w-3 sm:h-3.5 sm:w-3.5 fill-current" />
            <span className="text-[10px] sm:text-[11px] font-bold tracking-wide uppercase">Hot Right Now</span>
          </div>
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold leading-tight flex items-center gap-2 flex-wrap">
            <Zap className="h-6 w-6 sm:h-10 sm:w-10 fill-current drop-shadow" />
            Trending এখন
          </h1>
          <p className="mt-1.5 sm:mt-2 text-xs sm:text-base text-white/90 max-w-2xl leading-relaxed">
            যে product গুলো আমাদের customer-রা সবচেয়ে বেশি কিনছেন ও পছন্দ করছেন।
          </p>

          {/* Stat cards */}
          <div className="mt-4 sm:mt-5 grid grid-cols-2 gap-2.5 sm:gap-3 max-w-md">
            {topRatedCount > 0 && (
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-yellow-300 to-amber-400 text-amber-950 shadow-lg ring-1 ring-white/60 p-3 sm:p-4">
                <Sparkles className="absolute -top-2 -right-2 h-10 w-10 sm:h-12 sm:w-12 opacity-30 fill-current" />
                <div className="flex items-center gap-1 mb-1">
                  <Sparkles className="h-3.5 w-3.5 fill-current" />
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wide">Top Rated</span>
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold leading-none">{topRatedCount}</div>
                <div className="text-[10px] sm:text-xs font-medium mt-1 opacity-80">১০০+ রিভিউ</div>
              </div>
            )}
            <div className="relative overflow-hidden rounded-2xl bg-white text-orange-600 shadow-lg p-3 sm:p-4">
              <TrendingUp className="absolute -top-2 -right-2 h-10 w-10 sm:h-12 sm:w-12 opacity-20" />
              <div className="flex items-center gap-1 mb-1">
                <TrendingUp className="h-3.5 w-3.5" />
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wide">Trending</span>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold leading-none">{trendingCount}</div>
              <div className="text-[10px] sm:text-xs font-medium mt-1 opacity-80">২০+ রিভিউ</div>
            </div>
          </div>
        </div>
      </section>

      {/* Grid */}
      <section className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : trending.length === 0 ? (
          <div className="text-center py-20">
            <Zap className="h-14 w-14 mx-auto text-muted-foreground/40 mb-3" />
            <h2 className="text-lg font-semibold mb-1">এখনো কোনো Trending Product নেই</h2>
            <p className="text-sm text-muted-foreground">শীঘ্রই যোগ হবে — চোখ রাখুন!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {trending.map(({ p, sold }) => (
              <ProductCard
                key={p.id}
                id={p.id}
                slug={p.slug}
                name={p.name}
                name_bn={p.name_bn}
                price={p.price}
                original_price={p.original_price}
                image={p.images?.[0]}
                totalSold={sold}
                totalViews={viewsMap?.get(p.id)}
                hasVideo={!!p.video_url}
                createdAt={(p as any).created_at}
                clearance_active={(p as any).clearance_active}
                variant_images={(p as any).variant_images}
              />
            ))}
          </div>
        )}
      </section>
    </Layout>
  );
}
