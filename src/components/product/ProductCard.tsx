import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Star, Heart, Play, Zap, Eye, ShoppingBag, Sparkles } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';
import { memo, useState } from 'react';
import QuickOrderDialog from '@/components/product/QuickOrderDialog';
import { LazyImage } from '@/components/ui/lazy-image';
import { useSiteConfig, DEFAULT_BUTTONS_CONFIG } from '@/hooks/useSiteConfig';
import { trackSelectItem } from '@/lib/ecommerceTracking';
import { trackMetaAddToCart } from '@/lib/metaTracking';
import { optimizedImageUrl } from '@/lib/imageUrl';
import { estimateReviewCount } from '@/lib/reviewCount';
import { useWishlist } from '@/hooks/useWishlist';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { colorSlug } from '@/lib/productVariants';

interface ButtonConfig {
  order_button?: { text?: string; bg_color?: string; text_color?: string; enabled?: boolean };
  cart_button?: { bg_color?: string; text_color?: string; border_color?: string; enabled?: boolean };
}

interface ProductCardProps {
  slug: string;
  name: string;
  name_bn: string;
  price: number;
  original_price?: number | null;
  image?: string;
  id?: string;
  buttonConfig?: ButtonConfig;
  totalSold?: number;
  totalViews?: number;
  hasVideo?: boolean;
  createdAt?: string | null;
  clearance_active?: boolean | null;
  variant_images?: any;
  // Set when this card represents one color of a multi-color product (grid
  // "explode by color" view) — carries the color into the product page link,
  // cart item, and quick-order dialog so it doesn't default back to color #1.
  linkColor?: string;
}

// Format big numbers compactly: 1234 -> 1.2k, 15678 -> 15k
const formatCompact = (n: number): string => {
  if (n < 1000) return String(n);
  if (n < 10000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  if (n < 1_000_000) return Math.floor(n / 1000) + 'k';
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
};

const resolveCardSalePrice = (price: number, originalPrice?: number | null, variantImages?: any): number | null => {
  const productSale = Number(originalPrice || 0);
  if (!(productSale > 0 && productSale < price)) return null;

  // Defensive guard for stale/list caches that were previously rewritten to the
  // cheapest size sale price. Product cards should show the product-level/primary
  // সেল মূল্য, not the lowest variant-only sale (e.g. "সেলাই ছাড়া" ৳990).
  const sizeData = variantImages?.size_data;
  if (!sizeData || typeof sizeData !== 'object') return productSale;

  const counts = new Map<number, number>();
  Object.values(sizeData).forEach((item: any) => {
    const sale = Number(item?.sale_price || 0);
    if (Number.isFinite(sale) && sale > 0 && sale < price) {
      counts.set(sale, (counts.get(sale) || 0) + 1);
    }
  });
  if (counts.size <= 1) return productSale;

  const primaryVariantSale = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0];
  const minVariantSale = Math.min(...counts.keys());
  return productSale === minVariantSale && primaryVariantSale > productSale ? primaryVariantSale : productSale;
};

const ProductCard = memo(function ProductCard({ slug, name, name_bn, price, original_price, image, id, buttonConfig, totalSold, totalViews, hasVideo, createdAt, clearance_active, variant_images, linkColor }: ProductCardProps) {
  // Sale price logic: original_price < price means original_price is the sale price
  const resolvedSalePrice = resolveCardSalePrice(price, original_price, variant_images);
  const isSale = !!resolvedSalePrice;
  const displayPrice = resolvedSalePrice || price;
  const strikethroughPrice = isSale ? price : null;
  const discount = isSale ? Math.round(((price - displayPrice) / price) * 100) : 0;
  const reviewCount = estimateReviewCount(totalSold || 0);
  const isTopRated = reviewCount >= 100;
  const isTrending = reviewCount >= 20 && reviewCount < 100;
  const isNew = createdAt ? (Date.now() - new Date(createdAt).getTime()) < 30 * 24 * 60 * 60 * 1000 : false;
  const { addItem, items } = useCart();
  const [quickOrderOpen, setQuickOrderOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { data: savedBtnConfig } = useSiteConfig(buttonConfig ? '__skip__' : 'buttons_config');
  const externalCfg = buttonConfig || savedBtnConfig?.product_card;
  const cardCfg = {
    order_button: { ...DEFAULT_BUTTONS_CONFIG.product_card.order_button, ...externalCfg?.order_button },
    cart_button: { ...DEFAULT_BUTTONS_CONFIG.product_card.cart_button, ...externalCfg?.cart_button },
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!id) return;
    addItem({
      id,
      name,
      name_bn,
      price: displayPrice,
      original_price: isSale ? price : undefined,
      image: image || '',
      slug,
      color: linkColor,
    });
    trackMetaAddToCart({ id, name, name_bn, price: displayPrice }, 1);
    toast.success('কার্টে যোগ করা হয়েছে!');
  };

  const handleOrder = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (items.length > 0 && id) {
      addItem({
        id,
        name,
        name_bn,
        price: displayPrice,
        original_price: isSale ? price : undefined,
        image: image || '',
        slug,
        color: linkColor,
      });
      trackMetaAddToCart({ id, name, name_bn, price: displayPrice }, 1);
      navigate('/cart');
    } else {
      setQuickOrderOpen(true);
    }
  };

  const productData = {
    id: id || '',
    name,
    name_bn,
    price: displayPrice,
    original_price: isSale ? price : undefined,
    images: image ? [image] : [],
    slug,
    stock: 1,
  };

  return (
    <>
      <div className="group relative rounded-xl bg-card shadow-sm ring-1 ring-border/60 hover:ring-primary/30 hover:shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.25)] hover:-translate-y-1 transition-all duration-300 overflow-hidden">
        <Link to={linkColor ? `/product/${slug}?c=${colorSlug(linkColor)}` : `/product/${slug}`} className="block" onClick={() => trackSelectItem({ id, name, name_bn, price }, 'Shop')}>
          <div className="relative aspect-[3/4] bg-muted overflow-hidden">
            {/* Subtle top gradient sheen */}
            <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/5 to-transparent pointer-events-none z-[2]" />

            {image ? (
              <LazyImage
                src={optimizedImageUrl(image, 400, 75)}
                sourceUrl={image}
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                alt={name}
                className="w-full h-full group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">ছবি নেই</div>
            )}
            {discount > 0 && (
              <span className="absolute top-1 left-1 bg-destructive text-destructive-foreground text-xs font-bold px-1.5 py-px rounded-full z-[2]">
                -{discount}%
              </span>
            )}
            {isNew && (
              <span
                className={`absolute right-2 ${(isTopRated || isTrending) ? 'bottom-9' : 'bottom-2'} flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-md ring-1 ring-white/40 backdrop-blur-sm z-[2]`}
                title="নতুন এসেছে — গত ৩০ দিনে আপলোড"
              >
                <Sparkles className="h-2.5 w-2.5 fill-current" />
                <span className="text-[9px] font-bold leading-none tracking-wide">নতুন</span>
              </span>
            )}
            <div className="absolute inset-0 shadow-[inset_0_0_30px_rgba(0,0,0,0.08)] pointer-events-none z-[1]" />
            {hasVideo && (
              <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm rounded-full p-1.5 shadow-md animate-video-pulse">
                <Play className="h-4 w-4 text-foreground fill-current" />
              </div>
            )}
            {isTopRated && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate('/trending'); }}
                className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 text-amber-950 shadow-[0_0_10px_rgba(234,179,8,0.5)] ring-1 ring-white/60 backdrop-blur-sm hover:scale-110 transition-transform cursor-pointer"
                title={`Top Rated — ${reviewCount}+ রিভিউ. সব দেখুন`}
                aria-label="View top rated products"
              >
                <Star className="h-2.5 w-2.5 fill-current" />
                <span className="text-[9px] font-extrabold leading-none tracking-wide">Top Rated</span>
              </button>
            )}
            {isTrending && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate('/trending'); }}
                className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg ring-1 ring-white/40 backdrop-blur-sm hover:scale-110 transition-transform cursor-pointer"
                title={`Trending — ${reviewCount}+ রিভিউ. সব Trending products দেখুন`}
                aria-label="View all trending products"
              >
                <Zap className="h-2.5 w-2.5 fill-current" />
                <span className="text-[9px] font-bold leading-none tracking-wide">Trending</span>
              </button>
            )}
            {user && id && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWishlist(id); }}
                className="absolute top-1 right-1 p-1.5 rounded-full bg-background/80 backdrop-blur-sm shadow-sm transition-colors hover:bg-background"
              >
                <Heart className={`h-4 w-4 transition-colors ${isInWishlist(id) ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
              </button>
            )}
          </div>
          <div className="px-2 pt-1.5 pb-1">
            <h3 className="text-[11px] font-semibold leading-tight line-clamp-1 tracking-tight">{name_bn || name}</h3>

            <div className="flex items-center gap-0.5 mt-0.5 overflow-hidden whitespace-nowrap">
              <span className="text-[11px] font-bold text-primary">৳{displayPrice}</span>
              {strikethroughPrice && (
                <span className="text-[9px] text-muted-foreground line-through">৳{strikethroughPrice}</span>
              )}
              {clearance_active && (
                <span className="ml-1 px-1.5 py-px rounded-sm text-[8px] font-extrabold text-white bg-gradient-to-r from-red-500 to-rose-600 shadow-sm leading-none">
                  🏷️ ক্লিয়ারেন্স
                </span>
              )}
              {totalSold && totalSold > 0 && id ? (() => {
                const reviewCount = estimateReviewCount(totalSold);
                const hash = parseInt(id.replace(/-/g, '').slice(0, 8), 16);
                const rating = (4.5 + (hash % 6) / 10).toFixed(1);
                return (
                  <>
                    <span className="text-muted-foreground/40">|</span>
                    <Star className="h-2 w-2 fill-amber-400 text-amber-400 shrink-0" />
                    <span className="text-[9px] font-medium text-foreground">{rating}</span>
                    <span className="text-[9px] text-muted-foreground">({reviewCount})</span>
                  </>
                );
              })() : null}
            </div>
            {((totalViews ?? 0) >= 1 || (totalSold ?? 0) >= 1) && (
              <div className="flex items-center gap-1.5 mt-1 text-[9px] text-muted-foreground overflow-hidden whitespace-nowrap">
                {totalViews && totalViews >= 1 ? (
                  <span className="flex items-center gap-0.5">
                    <Eye className="h-2.5 w-2.5" />
                    <span className="font-medium">{formatCompact(totalViews)}</span>
                    <span>দেখেছে</span>
                  </span>
                ) : null}
                {totalViews && totalViews >= 50 && totalSold && totalSold >= 1 ? (
                  <span className="text-muted-foreground/40">·</span>
                ) : null}
                {totalSold && totalSold >= 1 ? (
                  <span className="flex items-center gap-0.5">
                    <ShoppingBag className="h-2.5 w-2.5" />
                    <span className="font-medium">{formatCompact(totalSold)}</span>
                    <span>বিক্রি</span>
                  </span>
                ) : null}
              </div>
            )}
          </div>
        </Link>
        {/* Action buttons */}
        <div className="flex gap-1 px-2 pb-2">
          {cardCfg.order_button?.enabled !== false && (
            <button
              onClick={handleOrder}
              className="group/btn relative flex-1 text-[12px] font-semibold py-1 rounded-md min-h-[32px] overflow-hidden shadow-sm hover:shadow-md active:scale-[0.96] hover:-translate-y-0.5 transition-[transform,box-shadow] [transition-duration:300ms] ease-out animate-fs-glow"
              style={{
                backgroundColor: cardCfg.order_button?.bg_color || 'hsl(var(--primary))',
                color: cardCfg.order_button?.text_color || 'hsl(var(--primary-foreground))',
              }}
            >
              <span className="relative z-20 inline-flex items-center justify-center gap-1">
                <Zap className="h-3 w-3 animate-fs-float group-hover/btn:scale-125 group-hover/btn:-rotate-12 transition-transform [transition-duration:300ms]" />
                {cardCfg.order_button?.text || 'অর্ডার করুন'}
              </span>
              <span className="pointer-events-none absolute top-0 left-0 h-full w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-fs-shimmer z-10" />
              <span className="pointer-events-none absolute inset-0 rounded-md ring-0 group-hover/btn:ring-2 ring-white/40 transition-all duration-300 z-10" />
            </button>
          )}
          {cardCfg.cart_button?.enabled !== false && (
            <button
              onClick={handleAddToCart}
              className="group/cart relative flex items-center justify-center w-8 min-h-[32px] rounded-md border overflow-hidden shadow-sm hover:shadow-md active:scale-[0.92] hover:-translate-y-0.5 transition-[transform,box-shadow] [transition-duration:300ms] ease-out"
              title="কার্টে যোগ করুন"
              style={{
                borderColor: cardCfg.cart_button?.border_color || 'hsl(var(--primary) / 0.4)',
                color: cardCfg.cart_button?.text_color || 'hsl(var(--primary))',
                backgroundColor: cardCfg.cart_button?.bg_color || 'transparent',
              }}
            >
              <ShoppingCart className="h-3.5 w-3.5 relative z-20 animate-fs-float group-hover/cart:scale-125 transition-transform [transition-duration:300ms]" />
              <span className="pointer-events-none absolute inset-0 bg-[hsl(var(--primary)/0.12)] opacity-0 group-hover/cart:opacity-100 transition-opacity [transition-duration:300ms] z-10" />
              <span className="pointer-events-none absolute top-0 left-0 h-full w-1/2 bg-gradient-to-r from-transparent via-[hsl(var(--primary)/0.25)] to-transparent animate-fs-shimmer z-10" />
            </button>
          )}
        </div>
      </div>

      {quickOrderOpen && (
        <QuickOrderDialog
          open={quickOrderOpen}
          onOpenChange={setQuickOrderOpen}
          product={productData}
          selectedColor={linkColor}
          qty={1}
        />
      )}
    </>
  );
});

export default ProductCard;
