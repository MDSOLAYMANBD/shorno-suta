import Layout from '@/components/layout/Layout';
import ProductCard from '@/components/product/ProductCard';
import SEOHead from '@/components/SEOHead';
import { useClearanceProducts, useProductSalesCounts, useProductViewCounts } from '@/hooks/useProducts';
import { useSiteConfig } from '@/hooks/useSiteConfig';
import { Tag, Flame } from 'lucide-react';

export default function ClearanceProducts() {
  const { data: products, isLoading } = useClearanceProducts();
  const { data: salesMap } = useProductSalesCounts();
  const { data: viewsMap } = useProductViewCounts();
  const { data: btnConfig } = useSiteConfig('buttons_config');
  const buttonConfig = btnConfig?.product_card;

  return (
    <Layout>
      <SEOHead
        title="স্টক ক্লিয়ারেন্স সেল - Shorno Suta"
        description="সীমিত সময়ের জন্য বিশেষ ছাড়ে স্টক ক্লিয়ারেন্স প্রোডাক্ট। দ্রুত শেষ হয়ে যাবে — অর্ডার করুন এখনই।"
      />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-rose-500 via-red-500 to-amber-500 text-white">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute -top-10 -left-10 w-64 h-64 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute -bottom-10 -right-10 w-72 h-72 rounded-full bg-yellow-200/30 blur-3xl" />
        </div>
        <div className="container mx-auto px-4 py-8 sm:py-12 relative">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm ring-1 ring-white/30 mb-3">
            <Flame className="h-3.5 w-3.5 fill-current" />
            <span className="text-[11px] font-bold tracking-wide uppercase">Limited Time Offer</span>
          </div>
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold leading-tight flex items-center gap-2 flex-wrap">
            <Tag className="h-7 w-7 sm:h-10 sm:w-10 fill-current drop-shadow" />
            স্টক ক্লিয়ারেন্স সেল
          </h1>
          <p className="mt-2 text-sm sm:text-base text-white/90 max-w-2xl">
            সীমিত সময়ের জন্য বিশেষ ছাড়ে — দ্রুত শেষ হয়ে যাবে! যত দ্রুত পারেন অর্ডার করে নিন।
          </p>
          {!isLoading && products && (
            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-rose-600 shadow-md">
              <span className="text-sm font-extrabold">🔥 {products.length} টি প্রোডাক্ট</span>
            </div>
          )}
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
        ) : !products || products.length === 0 ? (
          <div className="text-center py-20">
            <Tag className="h-14 w-14 mx-auto text-muted-foreground/40 mb-3" />
            <h2 className="text-lg font-semibold mb-1">এই মুহূর্তে কোনো ক্লিয়ারেন্স অফার নেই</h2>
            <p className="text-sm text-muted-foreground">শীঘ্রই নতুন অফার আসছে — চোখ রাখুন!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {products.map((p: any) => (
              <ProductCard
                key={p.id}
                id={p.id}
                slug={p.slug}
                name={p.name}
                name_bn={p.name_bn}
                price={p.price}
                original_price={p.original_price}
                image={p.images?.[0]}
                buttonConfig={buttonConfig}
                totalSold={salesMap?.get(p.id)}
                totalViews={viewsMap?.get(p.id)}
                hasVideo={!!p.video_url}
                createdAt={p.created_at}
                clearance_active={p.clearance_active}
                variant_images={p.variant_images}
              />
            ))}
          </div>
        )}
      </section>
    </Layout>
  );
}
