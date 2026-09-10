import { useMemo } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Eye, X } from 'lucide-react';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { useProducts } from '@/hooks/useProducts';
import { LazyImage } from '@/components/ui/lazy-image';
import { optimizedImageUrl } from '@/lib/imageUrl';

function formatPrice(n: number) {
  return `৳${Math.round(n).toLocaleString('en-US')}`;
}

export default function RecentlyViewedSection() {
  const { ids, clear } = useRecentlyViewed();
  const { data: products } = useProducts();
  const location = useLocation();

  // Extract current product slug if on product detail
  const currentSlug = location.pathname.startsWith('/product/')
    ? location.pathname.replace('/product/', '').split('/')[0]
    : null;

  const items = useMemo(() => {
    if (!products || ids.length === 0) return [];
    const map = new Map<string, any>((products as any[]).map((p) => [p.id, p]));
    return ids
      .map((id) => map.get(id))
      .filter(Boolean)
      .filter((p) => p.slug !== currentSlug)
      .slice(0, 12);
  }, [ids, products, currentSlug]);

  if (items.length === 0) return null;

  return (
    <section className="bg-muted/30 border-y border-border/50 py-6 sm:py-8">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <Eye className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold leading-tight">এই মাত্র দেখেছেন</h2>
              <p className="text-xs text-muted-foreground hidden sm:block">আপনার সাম্প্রতিক দেখা পণ্য</p>
            </div>
          </div>
          <button
            onClick={clear}
            className="text-xs text-muted-foreground hover:text-destructive inline-flex items-center gap-1 transition-colors"
            aria-label="ক্লিয়ার হিস্ট্রি"
          >
            <X className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">ক্লিয়ার</span>
          </button>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent mb-4" />

        <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0 snap-x">
          {items.map((p: any) => {
            const img = p.images?.[0];
            const hasBoth = p.original_price && p.original_price > 0 && p.original_price !== p.price;
            const salePrice = hasBoth ? Math.min(p.price, p.original_price) : p.price;
            const regularPrice = hasBoth ? Math.max(p.price, p.original_price) : null;
            return (
              <Link
                key={p.id}
                to={`/product/${p.slug}`}
                className="snap-start shrink-0 w-32 sm:w-40 group"
              >
                <div className="aspect-square rounded-lg overflow-hidden bg-muted border border-border group-hover:border-primary/50 group-hover:shadow-md transition-all">
                  {img ? (
                    <LazyImage
                      src={optimizedImageUrl(img, 320)}
                      alt={p.name_bn || p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted" />
                  )}
                </div>
                <div className="mt-2">
                  <p className="text-xs sm:text-sm font-medium line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                    {p.name_bn || p.name}
                  </p>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-sm font-bold text-primary">{formatPrice(salePrice)}</span>
                    {regularPrice && (
                      <span className="text-[10px] text-muted-foreground line-through">
                        {formatPrice(regularPrice)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
