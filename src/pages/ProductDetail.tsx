import { useState, useMemo, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import useEmblaCarousel from 'embla-carousel-react';
import Layout from '@/components/layout/Layout';
import { optimizedImageUrl } from '@/lib/imageUrl';
import { useProduct, useProducts, useProductSalesCounts, useProductViewCounts, useProductsByIds } from '@/hooks/useProducts';
import { useApprovedReviews } from '@/hooks/useCustomerReviews';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Minus, Plus, ShoppingBag, Phone, MessageCircle, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Play, X as XIcon, Star, Heart, Zap, Eye, Sparkles, Tag, Flame } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import ProductCard from '@/components/product/ProductCard';
import ProductSlider from '@/components/product/ProductSlider';
import QuickOrderDialog from '@/components/product/QuickOrderDialog';
import { FreeShippingProgress } from '@/components/freeShipping/FreeShippingProgress';
import ImageLightbox from '@/components/product/ImageLightbox';
import { useSiteConfig, DEFAULT_BUTTONS_CONFIG } from '@/hooks/useSiteConfig';
import { trackViewItem } from '@/lib/ecommerceTracking';
import { sanitizeHtml } from '@/lib/sanitize';
import { trackMetaViewContent, trackMetaAddToCart } from '@/lib/metaTracking';
import SEOHead from '@/components/SEOHead';
import ProductCategoryStrip from '@/components/product/ProductCategoryStrip';
import CategoryOrderCounter from '@/components/shop/CategoryOrderCounter';
import { useCategories } from '@/hooks/useCategories';
import { addRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { useWishlist } from '@/hooks/useWishlist';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { trackVisitorActivity } from '@/hooks/useVisitorTracking';
import { useAllSettings } from '@/hooks/useAllSettings';
import { applyClearance } from '@/lib/clearancePrice';
import { getColorImageList, getColorPrimaryImage, findColorBySlug } from '@/lib/productVariants';
const LandingGiftService = lazy(() => import('@/components/landing/LandingGiftService'));

function WishlistButton({ productId }: { productId: string }) {
  const { user } = useCustomerAuth();
  const { isInWishlist, toggleWishlist } = useWishlist();
  if (!user) return null;
  const liked = isInWishlist(productId);
  return (
    <button
      onClick={() => toggleWishlist(productId)}
      className="p-2 rounded-full border border-border hover:bg-muted transition-colors shrink-0"
      title={liked ? 'ফেভারিট থেকে সরান' : 'ফেভারিটে যোগ করুন'}
    >
      <Heart className={`h-5 w-5 transition-colors ${liked ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
    </button>
  );
}

function BumpProductCard({ productId, discount }: { productId: string; discount: number }) {
  const { addItem } = useCart();
  const [bumpData, setBumpData] = useState<any>(null);
  useEffect(() => {
    if (!productId) return;
    supabase.from('products').select('id, name, name_bn, price, original_price, images, slug, clearance_price, clearance_active').eq('id', productId).eq('is_active', true).maybeSingle().then(({ data }) => {
      if (data) setBumpData(applyClearance(data as any));
    });
  }, [productId]);

  if (!bumpData) return null;

  const bumpPrice = (bumpData.original_price && bumpData.original_price < bumpData.price ? bumpData.original_price : bumpData.price) - discount;
  const originalBumpPrice = bumpData.original_price && bumpData.original_price < bumpData.price ? bumpData.original_price : bumpData.price;

  return (
    <div className="border border-border rounded-xl p-3 sm:p-4 bg-muted/30 mb-3 sm:mb-4">
      <p className="text-xs font-semibold text-muted-foreground mb-2">🎁 এটিও পছন্দ হতে পারে</p>
      <div className="flex items-center gap-3">
        {bumpData.images?.[0] && (
          <img src={optimizedImageUrl(bumpData.images[0], 100, 70)} alt="" className="w-16 h-20 rounded-lg object-cover" loading="lazy" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{bumpData.name_bn || bumpData.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm font-bold text-primary">৳{bumpPrice}</span>
            {discount > 0 && (
              <span className="text-xs text-muted-foreground line-through">৳{originalBumpPrice}</span>
            )}
          </div>
        </div>
        <Button
          size="sm"
          className="shrink-0 rounded-full"
          onClick={() => {
            addItem({
              id: bumpData.id,
              name: bumpData.name,
              name_bn: bumpData.name_bn,
              price: bumpPrice,
              original_price: discount > 0 ? originalBumpPrice : undefined,
              image: bumpData.images?.[0] || '',
              slug: bumpData.slug,
            }, 1);
            toast.success('কার্টে যোগ করা হয়েছে!');
          }}
        >
          <ShoppingBag className="h-3.5 w-3.5 mr-1" /> যোগ করুন
        </Button>
      </div>
    </div>
  );
}

export default function ProductDetail() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const { data: product, isLoading } = useProduct(slug || '');
  const queryClient = useQueryClient();
  // Other separately-listed products that are the same design in a different
  // color — shown as swatches that navigate to that product's own page.
  const { data: linkedProductsRaw = [] } = useProductsByIds((product as any)?.linked_product_ids || []);
  const linkedColorProducts = useMemo(
    () => linkedProductsRaw.filter((p: any) => p.is_active !== false),
    [linkedProductsRaw]
  );
  const { addItem, items } = useCart();
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string>();
  const [selectedColor, setSelectedColor] = useState<string>();
  const [qty, setQty] = useState(1);
  const [descExpanded, setDescExpanded] = useState(false);
  const [policyExpanded, setPolicyExpanded] = useState(false);
  const [quickOrderOpen, setQuickOrderOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  const [colorOverride, setColorOverride] = useState(true);
  const [giftExpanded, setGiftExpanded] = useState(false);

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, duration: 20 });
  const [currentSlide, setCurrentSlide] = useState(0);

  const { data: allProducts } = useProducts();
  const { data: allSettings } = useAllSettings();
  const { data: salesMap } = useProductSalesCounts();
  const { data: viewsMap } = useProductViewCounts();
  const navigate = useNavigate();
  // linkedProductsRaw already carries the full product-detail field set (see
  // useProductsByIds), so we can seed the target's ['product', slug] cache
  // before navigating — the page swaps instantly instead of showing a blank/
  // loading flash while useProduct(newSlug) would otherwise refetch from scratch.
  const handleLinkedColorClick = (p: any) => {
    queryClient.setQueryData(['product', p.slug], p);
    navigate(`/product/${p.slug}`);
  };
  const { data: savedBtnConfig } = useSiteConfig('buttons_config');
  const btnCfg = {
    order_button: { ...DEFAULT_BUTTONS_CONFIG.product_detail.order_button, ...savedBtnConfig?.product_detail?.order_button },
    cart_button: { ...DEFAULT_BUTTONS_CONFIG.product_detail.cart_button, ...savedBtnConfig?.product_detail?.cart_button },
    whatsapp_button: { ...DEFAULT_BUTTONS_CONFIG.product_detail.whatsapp_button, ...savedBtnConfig?.product_detail?.whatsapp_button },
    call_button: { ...DEFAULT_BUTTONS_CONFIG.product_detail.call_button, ...savedBtnConfig?.product_detail?.call_button },
    custom_buttons: savedBtnConfig?.product_detail?.custom_buttons || DEFAULT_BUTTONS_CONFIG.product_detail.custom_buttons,
  };

  const variantImages = (product as any)?.variant_images || {};
  const sizeData = variantImages.size_data || {};
  const colorImagesMap: Record<string, string | string[]> = variantImages.color_images || {};
  const colorSizesMap: Record<string, string[]> = variantImages.color_sizes || {};

  // Gallery order: selected color's own photos first (primary photo leads), then
  // whatever general product photos aren't already part of that color's set. This
  // is the same "color images first, then the rest" convention explodeProductsByColor
  // already uses for shop-grid cards — here it drives the actual product-page carousel.
  const images = useMemo(() => {
    const general = product?.images || [];
    const colorList = getColorImageList(colorImagesMap, selectedColor);
    if (colorList.length === 0) return general;
    return [...colorList, ...general.filter((img: string) => !colorList.includes(img))];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, selectedColor]);

  // Embla slide tracking
  const onEmblaSelect = useCallback(() => {
    if (!emblaApi) return;
    const idx = emblaApi.selectedScrollSnap();
    setCurrentSlide(idx);
    setSelectedImage(idx);
    setColorOverride(false);
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onEmblaSelect();
    emblaApi.on('select', onEmblaSelect);
    return () => { emblaApi.off('select', onEmblaSelect); };
  }, [emblaApi, onEmblaSelect]);

  // The `images` array itself gets reordered/reshuffled per color (see the useMemo
  // above), so embla needs reInit() to pick up the new slide count/content — kept
  // separate from the colorOverride jump below so a plain manual swipe (which flips
  // colorOverride to false, not the images reference) doesn't also force a reInit.
  useEffect(() => {
    if (emblaApi) emblaApi.reInit();
  }, [emblaApi, images]);

  // Jump to slide 0 (that color's primary photo, always first now) right after a
  // color swatch click — not on manual swipes, which set colorOverride to false.
  useEffect(() => {
    if (emblaApi && colorOverride) emblaApi.scrollTo(0, true);
  }, [emblaApi, images, colorOverride]);

  const handleMainImageClick = () => {
    setLightboxIndex(currentSlide);
    setLightboxOpen(true);
  };

  // Scroll to top on product change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  // GA4: view_item + Meta: ViewContent — fire once per product, not once per
  // component lifetime (ProductDetail stays mounted across /product/:slug
  // navigations, so a plain boolean ref would only ever fire for the first
  // product a visitor looks at in a session). For a product with colors,
  // wait for selectedColor to resolve from the ?c= param first so the
  // logged view is attributed to the right color from the start — the
  // per-product-id guard below only allows a single fire, so firing early
  // with no color would mean this view never counts toward any color.
  const viewFiredForId = useRef<string | null>(null);
  useEffect(() => {
    if (!product) return;
    if (product.colors?.length && !selectedColor) return;
    if (viewFiredForId.current === product.id) return;
    viewFiredForId.current = product.id;
    trackViewItem({ id: product.id, name: product.name, name_bn: product.name_bn, price: product.price });
    trackMetaViewContent(product);
    trackVisitorActivity('product_view', product.id, product.name, selectedColor ? { color: selectedColor } : undefined);
    addRecentlyViewed(product.id);
  }, [product, selectedColor]);

  // Auto-select default (or first) size and color
  useEffect(() => {
    if (product?.sizes?.length && !selectedSize) {
      const vi = (product as any)?.variant_images || {};
      const def = vi.default_size && product.sizes.includes(vi.default_size) ? vi.default_size : product.sizes[0];
      setSelectedSize(def);
    }
    if (product?.colors?.length && !selectedColor) {
      // A per-color card in the shop grid links here with ?c=<short slug> (or the
      // older ?color=<raw name>, kept for any links already shared) so the page
      // opens already showing that exact color instead of always the first.
      const requestedSlug = searchParams.get('c');
      const requestedColor = searchParams.get('color');
      const match = (requestedSlug && findColorBySlug(product.colors, requestedSlug))
        || (requestedColor && product.colors.find((c: string) => c.trim().toLowerCase() === requestedColor.trim().toLowerCase()));
      setSelectedColor(match || product.colors[0]);
      setColorOverride(true);
    }
  }, [product]);

  // When color changes, auto-adjust selected size if not available in new color
  useEffect(() => {
    if (!selectedColor) return;
    const vi = (product as any)?.variant_images || {};
    const cs: Record<string, string[]> = vi.color_sizes || {};
    if (cs[selectedColor] && cs[selectedColor].length > 0) {
      if (selectedSize && !cs[selectedColor].includes(selectedSize)) {
        setSelectedSize(cs[selectedColor][0]);
      }
    }
  }, [selectedColor]);

  // Ensure colorOverride is always true when color changes
  useEffect(() => {
    if (selectedColor) setColorOverride(true);
  }, [selectedColor]);

  // Filter sizes based on selected color
  const availableSizes = useMemo(() => {
    if (selectedColor && colorSizesMap[selectedColor] && colorSizesMap[selectedColor].length > 0) {
      return colorSizesMap[selectedColor];
    }
    return product?.sizes || [];
  }, [selectedColor, colorSizesMap, product?.sizes]);
  const activeSize = selectedSize || availableSizes[0];
  const showVideoOverlay = variantImages.show_video_overlay === true;
  const videoUrl = product?.video_url || product?.video_file_url;

  // Product-level sale price: original_price < price means it's the sale price
  const productSalePrice = (product?.original_price && product.original_price > 0 && product.original_price < product.price)
    ? product.original_price : null;

  const displayPrice = useMemo(() => {
    const sizePrice = Number(activeSize ? sizeData[activeSize]?.price : 0);
    if (Number.isFinite(sizePrice) && sizePrice > 0) {
      return sizePrice;
    }
    return product?.price || 0;
  }, [activeSize, sizeData, product?.price]);

  const displaySalePrice = useMemo(() => {
    // Priority 1: size-level sale_price
    const sizeSalePrice = Number(activeSize ? sizeData[activeSize]?.sale_price : 0);
    if (Number.isFinite(sizeSalePrice) && sizeSalePrice > 0 && sizeSalePrice < displayPrice) {
      return sizeSalePrice;
    }
    // Priority 2: product-level sale price (original_price field when < price)
    if (productSalePrice) {
      return productSalePrice;
    }
    return null;
  }, [activeSize, sizeData, displayPrice, productSalePrice]);

  const embedUrl = useMemo(() => {
    if (!videoUrl) return null;
    if (videoUrl.includes('youtube.com/shorts/')) {
      return videoUrl.replace('youtube.com/shorts/', 'youtube.com/embed/');
    }
    if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
      return videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/');
    }
    return null;
  }, [videoUrl]);

  const { data: approvedReviews } = useApprovedReviews();

  // Real average rating + count for THIS product, from actual approved
  // customer_reviews rows — not the old hash-of-product-id/sales-derived
  // fake numbers. null when the product has zero real reviews, which
  // callers must treat as "don't show a rating" (both visually and in
  // AggregateRating structured data — Google requires omitting the field
  // entirely rather than showing a fabricated or zero rating).
  const currentProductRating = useMemo(() => {
    if (!product?.id || !approvedReviews) return null;
    const productReviews = approvedReviews.filter((r: any) => r.product_id === product.id);
    if (productReviews.length === 0) return null;
    const sum = productReviews.reduce((s: number, r: any) => s + (r.rating || 0), 0);
    return { rating: Number((sum / productReviews.length).toFixed(1)), count: productReviews.length };
  }, [product?.id, approvedReviews]);

  const relatedProducts = useMemo(() => {
    // Admin-linked cross-sell products always come first, in the order they
    // were linked — regardless of category, since they're a deliberate pairing
    // (e.g. a saree linked to its matching blouse), not an automatic match.
    const suggestedIds: string[] = (product as any)?.suggested_product_ids || [];
    const suggested = suggestedIds
      .map(sid => allProducts?.find(p => p.id === sid))
      .filter(Boolean) as typeof allProducts;

    const filtered = allProducts?.filter(
      p => p.id !== product?.id && p.category_id === product?.category_id && !suggestedIds.includes(p.id)
    ) || [];

    // Build avg rating map from approved reviews
    const sumMap = new Map<string, { sum: number; count: number }>();
    (approvedReviews || []).forEach((r: any) => {
      if (!r.product_id) return;
      const prev = sumMap.get(r.product_id) || { sum: 0, count: 0 };
      sumMap.set(r.product_id, { sum: prev.sum + (r.rating || 0), count: prev.count + 1 });
    });

    const sortedFiltered = filtered.sort((a, b) => {
      const aData = sumMap.get(a.id);
      const bData = sumMap.get(b.id);
      const rA = aData ? aData.sum / aData.count : 0;
      const rB = bData ? bData.sum / bData.count : 0;
      if (rB !== rA) return rB - rA;
      return (salesMap?.get(b.id) || 0) - (salesMap?.get(a.id) || 0);
    });

    return [...suggested, ...sortedFiltered];
  }, [allProducts, product, approvedReviews, salesMap]);

  // Cross-category discovery — picks ONE other (non-current) category based
  // on a stable hash of this product's id, so browsing different products
  // surfaces a different collection each time instead of repeating "সম্পর্কিত
  // পণ্য". Shows that category's best-sellers, topped up with other
  // popular products store-wide if the category alone has too few.
  const discoverySection = useMemo(() => {
    if (!allProducts?.length || !product?.category_id) return null;
    const others = allProducts.filter((p: any) => p.category_id && p.category_id !== product.category_id);
    if (others.length === 0) return null;

    const byCategory = new Map<string, any[]>();
    for (const p of others) {
      const cid = p.category_id as string;
      if (!byCategory.has(cid)) byCategory.set(cid, []);
      byCategory.get(cid)!.push(p);
    }
    const categoryIds = Array.from(byCategory.keys());

    let hash = 0;
    for (let i = 0; i < product.id.length; i++) hash = (hash * 31 + product.id.charCodeAt(i)) >>> 0;
    const chosenId = categoryIds[hash % categoryIds.length];

    const bySales = (arr: any[]) => [...arr].sort((a, b) => (salesMap?.get(b.id) || 0) - (salesMap?.get(a.id) || 0));

    let items = bySales(byCategory.get(chosenId) || []);
    if (items.length < 10) {
      const seen = new Set(items.map((p: any) => p.id));
      for (const p of bySales(others.filter((p: any) => p.category_id !== chosenId))) {
        if (items.length >= 15) break;
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        items = [...items, p];
      }
    }
    items = items.slice(0, 15);
    if (items.length === 0) return null;

    const label = items[0]?.categories?.name_bn || items[0]?.categories?.name || '';
    return { label, items };
  }, [allProducts, product?.id, product?.category_id, salesMap]);

  const categoryName = (product as any)?.categories?.name_bn || (product as any)?.categories?.name || '';
  const categorySlug = (product as any)?.categories?.slug || '';

  const { data: allCategories = [] } = useCategories();
  const currentCategory = useMemo(
    () => allCategories.find((c: any) => c.id === product?.category_id) || null,
    [allCategories, product?.category_id]
  );
  const parentCategory = useMemo(
    () => (currentCategory as any)?.parent_id
      ? allCategories.find((c: any) => c.id === (currentCategory as any).parent_id) || null
      : null,
    [allCategories, currentCategory]
  );
  const categoryProductIds = useMemo(
    () => (allProducts || [])
      .filter((p: any) => p.category_id === product?.category_id)
      .map((p: any) => p.id),
    [allProducts, product?.category_id]
  );

  const productJsonLd = useMemo(() => {
    if (!product) return null;

    const schema: Record<string, any> = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name_bn || product.name,
      image: images,
      description: product.description || product.description_bn || product.name,
      sku: product.id.slice(0, 8),
      mpn: product.id,
      brand: { '@type': 'Brand', name: 'Shorno Suta' },
      ...(categoryName && { category: categoryName }),
      ...(product.colors?.length && { color: product.colors.join(', ') }),
      ...(product.sizes?.length && { size: product.sizes.join(', ') }),
      itemCondition: 'https://schema.org/NewCondition',
      offers: {
        '@type': 'Offer',
        url: `https://www.shornosuta.com/product/${product.slug}`,
        priceCurrency: 'BDT',
        price: displaySalePrice || displayPrice,
        ...(displaySalePrice && { priceValidUntil: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0] }),
        availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder',
        seller: { '@type': 'Organization', name: 'Shorno Suta' },
        shippingDetails: {
          '@type': 'OfferShippingDetails',
          shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'BD' },
          shippingRate: { '@type': 'MonetaryAmount', value: '0', currency: 'BDT' },
          deliveryTime: { '@type': 'ShippingDeliveryTime', handlingTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 3, unitCode: 'DAY' }, transitTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 5, unitCode: 'DAY' } },
        },
        hasMerchantReturnPolicy: {
          '@type': 'MerchantReturnPolicy',
          returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
          merchantReturnDays: 7,
          returnMethod: 'https://schema.org/ReturnByMail',
          applicableCountry: 'BD',
        },
      },
    };

    // Google requires this to reflect real reviews — omit entirely for
    // products with none rather than publishing a fabricated rating.
    if (currentProductRating) {
      schema.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: currentProductRating.rating,
        reviewCount: currentProductRating.count,
        bestRating: 5,
        worstRating: 1,
      };
    }

    return schema;
  }, [product?.id, displayPrice, displaySalePrice, categoryName, currentProductRating]);

  const breadcrumbJsonLd = useMemo(() => {
    if (!product) return null;
    const items: any[] = [
      { '@type': 'ListItem', position: 1, name: 'হোম', item: 'https://www.shornosuta.com/' },
    ];
    if (categoryName && categorySlug) {
      items.push({ '@type': 'ListItem', position: 2, name: categoryName, item: `https://www.shornosuta.com/shop/${categorySlug}` });
      items.push({ '@type': 'ListItem', position: 3, name: product.name_bn || product.name });
    } else {
      items.push({ '@type': 'ListItem', position: 2, name: 'শপ', item: 'https://www.shornosuta.com/shop' });
      items.push({ '@type': 'ListItem', position: 3, name: product.name_bn || product.name });
    }
    return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items };
  }, [product?.id, categoryName, categorySlug]);

  const seoKeywords = useMemo(() => {
    if (!product) return '';
    const kw = (product as any).seo_keywords;
    if (kw) return kw;
    const parts = [product.name_bn, product.name, categoryName, 'বাংলাদেশ', 'অনলাইন শপিং', 'কিনুন', 'Shorno Suta', 'ফ্রি ডেলিভারি'].filter(Boolean);
    return parts.join(', ');
  }, [product?.id, categoryName]);

  const fbProductMeta = useMemo(() => {
    if (!product) return undefined;
    return {
      price: displaySalePrice || displayPrice,
      currency: 'BDT' as const,
      availability: (product.stock > 0 || Boolean((product as any).allow_pre_order) ? 'in stock' : 'out of stock') as 'in stock' | 'out of stock',
      condition: 'new',
      brand: 'Shorno Suta',
      category: categoryName || undefined,
    };
  }, [product?.id, displayPrice, displaySalePrice, categoryName]);

  if (isLoading) return (
    <Layout>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8" aria-busy="true">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 md:gap-12">
          <div>
            <div className="aspect-[3/4] bg-muted rounded-2xl animate-pulse mb-2 sm:mb-3" />
            <div className="flex gap-2 sm:gap-2.5 pb-1 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="w-16 h-20 sm:w-[4.5rem] sm:h-24 rounded-xl bg-muted animate-pulse shrink-0" />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="h-7 sm:h-9 w-3/4 bg-muted rounded animate-pulse" />
            <div className="h-8 w-40 bg-muted rounded animate-pulse" />
            <div className="h-4 w-full bg-muted/70 rounded animate-pulse" />
            <div className="h-4 w-5/6 bg-muted/70 rounded animate-pulse" />
            <div className="h-12 bg-muted rounded-lg animate-pulse mt-4" />
            <div className="h-12 bg-muted rounded-lg animate-pulse" />
          </div>
        </div>
      </div>
    </Layout>
  );
  if (!product) return <Layout><div className="max-w-7xl mx-auto px-4 py-16 text-center text-muted-foreground">পণ্য পাওয়া যায়নি</div></Layout>;

  const actualPrice = displaySalePrice || displayPrice;
  const originalPriceForDisplay = displaySalePrice ? displayPrice : 0;
  const discount = originalPriceForDisplay && originalPriceForDisplay > actualPrice
    ? Math.round(((originalPriceForDisplay - actualPrice) / originalPriceForDisplay) * 100)
    : 0;

  // Case-insensitive color image lookup
  const getColorImage = (color: string | undefined) => getColorPrimaryImage(colorImagesMap, color);

  const colorImage = getColorImage(selectedColor);

  const handleAdd = () => {
    if (product.sizes?.length && !selectedSize) { toast.error('অনুগ্রহ করে সাইজ নির্বাচন করুন'); return; }
    if (product.colors?.length && !selectedColor) { toast.error('অনুগ্রহ করে রঙ নির্বাচন করুন'); return; }
    const itemData = {
      id: product.id,
      name: product.name,
      name_bn: product.name_bn,
      price: actualPrice,
      original_price: originalPriceForDisplay || undefined,
      image: getColorImage(selectedColor) || images[0] || '',
      size: selectedSize,
      color: selectedColor,
      slug: product.slug,
    };
    addItem(itemData, qty);
    trackMetaAddToCart({ id: product.id, name: product.name, name_bn: product.name_bn, price: actualPrice }, qty);
    toast.success('কার্টে যোগ করা হয়েছে!');
  };

  const productUrl = `${window.location.origin}/product/${product.slug}`;
  const discountPct = originalPriceForDisplay && originalPriceForDisplay > actualPrice
    ? Math.round(((originalPriceForDisplay - actualPrice) / originalPriceForDisplay) * 100)
    : 0;
  const priceLine = discountPct > 0
    ? `৳${actualPrice} (আগে ৳${originalPriceForDisplay}, -${discountPct}%)`
    : `৳${actualPrice}`;
  const whatsappMsg = encodeURIComponent(
`━━━━━━━━━━━━━━━━
🛍️ অর্ডার করতে চাই
━━━━━━━━━━━━━━━━
📦 ${product.name_bn || product.name}
💰 দাম: ${priceLine}${selectedSize ? `\n📏 সাইজ: ${selectedSize}` : ''}${selectedColor ? `\n🎨 রঙ: ${selectedColor}` : ''}

🔗 ${productUrl}
━━━━━━━━━━━━━━━━`);

  const seoDesc = (product.description || product.description_bn || product.name).slice(0, 155);

  return (
    <Layout>
      <SEOHead
        title={(product as any).seo_title || `${product.name_bn || product.name} | স্বর্ণ সুতা`}
        description={(product as any).seo_description || seoDesc}
        canonical={`/product/${product.slug}`}
        ogImage={images[0]}
        ogType="product"
        jsonLd={[productJsonLd, breadcrumbJsonLd].filter(Boolean) as Record<string, any>[]}
        keywords={seoKeywords}
        productMeta={fbProductMeta}
      />
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {currentCategory && (
          <CategoryOrderCounter
            productIds={categoryProductIds}
            parentCategory={parentCategory as any}
            currentCategory={currentCategory as any}
            hideCounter
          />
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 md:gap-12">
          {/* Images & Video */}
          <div>
            <div className="aspect-[3/4] bg-muted rounded-2xl overflow-hidden mb-2 sm:mb-3 relative shadow-lg group/gallery">
              {showVideo && videoUrl ? (
                <>
                  {embedUrl ? (
                    <iframe src={embedUrl} className="w-full h-full" allowFullScreen title="Product video" />
                  ) : (
                    <video src={videoUrl} controls autoPlay className="w-full h-full object-cover" />
                  )}
                  <button onClick={() => setShowVideo(false)}
                    className="absolute top-3 right-3 bg-background/80 backdrop-blur-md text-foreground rounded-full p-1.5 shadow-md z-10 hover:bg-background transition-colors">
                    <XIcon className="h-5 w-5" />
                  </button>
                </>
              ) : images.length > 0 ? (
                <>
                  {/* Embla Carousel */}
                  <div ref={emblaRef} className="h-full overflow-hidden">
                    <div className="flex h-full">
                      {images.map((img: string, i: number) => (
                        <div key={i} className="flex-[0_0_100%] min-w-0 h-full">
                          <img
                            src={optimizedImageUrl(img, 800, 80)}
                            alt={i === 0 ? product.name : ''}
                            className="w-full h-full object-cover cursor-pointer"
                            onClick={handleMainImageClick}
                            draggable={false}
                            loading={i === 0 ? 'eager' : 'lazy'}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  {images.length > 1 && (
                    <>
                      <span className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1 rounded-full z-10 pointer-events-none">
                        {currentSlide + 1}/{images.length}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); emblaApi?.scrollPrev(); setColorOverride(false); setShowVideo(false); }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-white/80 backdrop-blur-sm text-foreground hover:bg-white shadow-md rounded-full p-2 transition-all opacity-0 sm:group-hover/gallery:opacity-100"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); emblaApi?.scrollNext(); setColorOverride(false); setShowVideo(false); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-white/80 backdrop-blur-sm text-foreground hover:bg-white shadow-md rounded-full p-2 transition-all opacity-0 sm:group-hover/gallery:opacity-100"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </>
                  )}
                  {showVideoOverlay && videoUrl && (
                    <button onClick={(e) => { e.stopPropagation(); setShowVideo(true); }}
                      className="absolute bottom-3 right-3 bg-white/90 hover:bg-white text-foreground rounded-full p-3 shadow-lg z-10 backdrop-blur-sm animate-video-pulse transition-colors">
                      <Play className="h-6 w-6 fill-current" />
                    </button>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">ছবি নেই</div>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 sm:gap-2.5 overflow-x-auto mb-2 sm:mb-3 pb-1 scrollbar-hide">
                {images.map((img: string, i: number) => (
                  <button key={i} onClick={() => { emblaApi?.scrollTo(i); setShowVideo(false); setColorOverride(false); }}
                    className={cn(
                      'w-16 h-20 sm:w-[4.5rem] sm:h-24 rounded-xl overflow-hidden shrink-0 transition-all duration-200',
                      i === currentSlide && !showVideo
                        ? 'ring-2 ring-primary ring-offset-2 scale-105 opacity-100'
                        : 'opacity-60 hover:opacity-100'
                    )}>
                    <img src={optimizedImageUrl(img, 120, 70)} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
            {/* Non-overlay video fallback */}
            {videoUrl && !showVideoOverlay && (
              <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                {embedUrl ? (
                  <iframe src={embedUrl} className="w-full h-full" allowFullScreen title="Product video" />
                ) : (
                  <video src={videoUrl} controls className="w-full h-full object-cover" />
                )}
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">{product.name_bn || product.name}</h1>
              <WishlistButton productId={product.id} />
            </div>

            {(product as any)?.clearance_active && (
              <Link
                to="/clearance"
                className="group block mb-3 sm:mb-4 rounded-xl overflow-hidden ring-1 ring-rose-300/60 shadow-md hover:shadow-lg transition-all"
                style={{ background: 'linear-gradient(135deg, #ef4444 0%, #e11d48 50%, #f59e0b 100%)' }}
              >
                <style dangerouslySetInnerHTML={{ __html: `@keyframes clr-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.08);opacity:.85}}.clr-flame{animation:clr-pulse 1.4s ease-in-out infinite}` }} />
                <div className="px-3 py-2 sm:px-4 sm:py-2.5 flex items-center gap-2.5 text-white">
                  <Flame className="clr-flame h-5 w-5 sm:h-6 sm:w-6 fill-current shrink-0 drop-shadow" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm sm:text-base font-extrabold leading-tight">🔥 স্টক ক্লিয়ারেন্স সেল চলছে!</div>
                    <div className="text-[11px] sm:text-xs text-white/90 leading-tight mt-0.5">সীমিত সময়ের জন্য বিশেষ ছাড় — দ্রুত শেষ হয়ে যাবে!</div>
                  </div>
                  <span className="hidden sm:inline-flex text-[11px] font-bold bg-white/20 backdrop-blur-sm px-2 py-1 rounded-full ring-1 ring-white/30 group-hover:bg-white/30 transition">সব দেখুন →</span>
                </div>
              </Link>
            )}

            <div className="flex items-center gap-2 sm:gap-3 flex-wrap mb-4 sm:mb-5">
              <span className="text-2xl sm:text-3xl font-bold text-primary">৳{actualPrice}</span>
              {originalPriceForDisplay > 0 && originalPriceForDisplay > actualPrice && (
                <>
                  <span className="text-base sm:text-lg text-muted-foreground line-through">৳{originalPriceForDisplay}</span>
                  <span className="bg-destructive text-destructive-foreground text-xs font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full">-{discount}%</span>
                </>
              )}
              {(product as any)?.clearance_active && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold text-white bg-gradient-to-r from-red-500 to-rose-600 shadow-md ring-1 ring-white/40">
                  <Tag className="h-3 w-3 fill-current" />
                  CLEARANCE
                </span>
              )}
              {/* New product badge — within 30 days of upload */}
              {(product as any)?.created_at && (Date.now() - new Date((product as any).created_at).getTime()) < 30 * 24 * 60 * 60 * 1000 && (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-md ring-1 ring-white/40"
                  title="নতুন এসেছে — গত ৩০ দিনে আপলোড"
                >
                  <Sparkles className="h-3 w-3 fill-current" />
                  <span className="text-[11px] font-bold leading-none tracking-wide">নতুন</span>
                </span>
              )}
              {/* Trending / Top Rated badge */}
              {product.id && salesMap?.get(product.id) && (() => {
                // Popularity badges — gated on real units sold (salesMap),
                // not a fabricated review count. Wording says "বিক্রি" (sold),
                // never claims a review number that doesn't exist.
                const totalSold = salesMap.get(product.id)!;
                if (totalSold >= 100) {
                  return (
                    <button
                      onClick={() => navigate('/trending')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 text-amber-950 shadow-[0_0_12px_rgba(234,179,8,0.5)] ring-1 ring-white/60 hover:scale-105 transition-all cursor-pointer"
                      title={`Top Rated — ${totalSold}+ বিক্রি হয়েছে। সব দেখুন`}
                    >
                      <Star className="h-3 w-3 fill-current" />
                      <span className="text-[11px] font-extrabold leading-none tracking-wide">Top Rated</span>
                    </button>
                  );
                }
                if (totalSold >= 20) {
                  return (
                    <button
                      onClick={() => navigate('/trending')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md ring-1 ring-white/40 hover:scale-105 hover:shadow-lg transition-all cursor-pointer"
                      title={`Trending — ${totalSold}+ বিক্রি হয়েছে। সব Trending products দেখুন`}
                    >
                      <Zap className="h-3 w-3 fill-current" />
                      <span className="text-[11px] font-bold leading-none tracking-wide">Trending</span>
                    </button>
                  );
                }
                return null;
              })()}
              {/* Rating badge — only rendered when the product has real approved reviews. */}
              {currentProductRating && (
                <>
                  <span className="text-muted-foreground/30 text-lg">|</span>
                  <button
                    onClick={() => document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth' })}
                    className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span className="text-sm font-semibold">{currentProductRating.rating}</span>
                    <span className="text-sm text-muted-foreground">({currentProductRating.count})</span>
                  </button>
                </>
              )}
            </div>
            {product.id && (() => {
              const v = viewsMap?.get(product.id) || 0;
              const s = salesMap?.get(product.id) || 0;
              if (v < 1 && s < 1) return null;
              const fmt = (n: number) => n < 1000 ? String(n) : n < 10000 ? (n/1000).toFixed(1).replace(/\.0$/,'') + 'k' : n < 1_000_000 ? Math.floor(n/1000) + 'k' : (n/1_000_000).toFixed(1).replace(/\.0$/,'') + 'M';
              return (
                <div className="flex flex-wrap items-center gap-2 mt-2 mb-3">
                  {v >= 1 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/60 text-[11px] text-muted-foreground">
                      <Eye className="h-3 w-3" />
                      <span className="font-semibold text-foreground">{fmt(v)}</span>
                      <span>জন দেখেছে</span>
                    </span>
                  )}
                  {s >= 1 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-[11px] text-primary">
                      <ShoppingBag className="h-3 w-3" />
                      <span className="font-semibold">{fmt(s)}</span>
                      <span>পিস বিক্রি</span>
                    </span>
                  )}
                </div>
              );
            })()}
            {/* Free shipping progress preview */}
            <FreeShippingProgress
              items={[{ id: product.id, quantity: qty, price: actualPrice }]}
              variant="banner"
              celebrate={false}
              className="mb-3"
            />
            {product.description && (
              <p className="text-sm text-muted-foreground leading-relaxed mb-4 sm:mb-5">
                {product.description}
              </p>
            )}
            {!product.description && <div className="mb-4 sm:mb-5" />}

            {availableSizes.length > 0 && (
              <div className="mb-3 sm:mb-4">
                <label className="text-sm font-semibold mb-1.5 sm:mb-2 block text-accent">সাইজ নির্বাচন করুন</label>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {availableSizes.map((s: string) => (
                    <button key={s} onClick={() => setSelectedSize(s)}
                      className={cn('px-3 py-1.5 sm:px-4 sm:py-2 border rounded-md text-sm transition-all', selectedSize === s ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border hover:border-primary/50')}>
                      {s}
                      {(() => {
                        const regular = Number(sizeData[s]?.price || 0);
                        const sale = Number(sizeData[s]?.sale_price || 0);
                        const shown = sale > 0 && (!regular || sale < regular) ? sale : regular;
                        if (!shown || shown === product.price) return null;
                        const isSale = sale > 0 && shown === sale;
                        return <span className={cn('ml-1 text-xs', isSale ? 'text-primary font-semibold' : 'text-muted-foreground')}>৳{shown}</span>;
                      })()}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(product.colors?.length > 0 || linkedColorProducts.length > 0) && (
              <div className="mb-3 sm:mb-4">
                <label className="text-sm font-semibold mb-1.5 sm:mb-2 block text-accent">রঙ নির্বাচন করুন</label>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  {product.colors?.map((c: string) => (
                    <button key={c} onClick={() => { setSelectedColor(c); setColorOverride(true); }}
                      className={cn('flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 border rounded-md text-sm transition-all', selectedColor === c ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border hover:border-primary/50')}>
                      {getColorImage(c) && (
                        <img src={optimizedImageUrl(getColorImage(c)!, 48, 70)} alt={c} className="w-6 h-6 rounded object-cover" loading="lazy" />
                      )}
                      {c}
                    </button>
                  ))}
                  {linkedColorProducts.length > 0 && (
                    <>
                      <div
                        className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-md overflow-hidden border-2 border-primary ring-2 ring-primary/30 shrink-0"
                        title={product.name_bn || product.name}
                      >
                        <img src={optimizedImageUrl(images[0], 100, 70)} alt={product.name_bn || product.name} className="w-full h-full object-cover" loading="lazy" />
                      </div>
                      {linkedColorProducts.map((p: any) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleLinkedColorClick(p)}
                          className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-md overflow-hidden border-2 border-border hover:border-primary/50 transition-colors shrink-0"
                          title={p.name_bn || p.name}
                        >
                          <img src={optimizedImageUrl(p.images?.[0], 100, 70)} alt={p.name_bn || p.name} className="w-full h-full object-cover" loading="lazy" />
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="flex items-center gap-3 mb-4 sm:mb-5">
              <div className="flex items-center border border-border rounded-md">
                <button onClick={() => setQty(Math.max(1, qty - 1))} className="p-2"><Minus className="h-4 w-4" /></button>
                <span className="px-4 text-sm font-medium">{qty}</span>
                <button onClick={() => setQty(qty + 1)} className="p-2"><Plus className="h-4 w-4" /></button>
              </div>
            </div>




            {/* Action buttons */}
            <div className="space-y-2.5 sm:space-y-3 mb-4 sm:mb-6">

              {btnCfg.order_button?.enabled !== false && (
                <button
                  onClick={() => {
                    if (items.length > 0) {
                      addItem({
                        id: product.id,
                        name: product.name,
                        name_bn: product.name_bn || '',
                        price: actualPrice,
                        original_price: originalPriceForDisplay || undefined,
                        image: getColorImage(selectedColor) || product.images?.[0] || '',
                        slug: product.slug,
                        size: selectedSize || undefined,
                        color: selectedColor || undefined,
                      }, qty);
                      navigate('/cart');
                    } else {
                      setQuickOrderOpen(true);
                    }
                  }}
                  className={cn(
                    'group/btn relative w-full rounded-full font-semibold overflow-hidden shadow-[0_4px_20px_hsl(114_47%_42%/0.4)] hover:shadow-[0_8px_32px_hsl(114_47%_42%/0.55)] active:scale-[0.98] hover:-translate-y-0.5 transition-[transform,box-shadow] [transition-duration:300ms] ease-out animate-fs-glow',
                    !btnCfg.order_button?.bg_color && 'bg-primary text-primary-foreground',
                    btnCfg.order_button?.size === 'sm' ? 'text-xs py-2' : btnCfg.order_button?.size === 'md' ? 'text-sm py-2.5' : 'text-sm sm:text-base py-2.5 sm:py-3'
                  )}
                  style={{
                    ...(btnCfg.order_button?.bg_color ? { backgroundColor: btnCfg.order_button.bg_color } : {}),
                    ...(btnCfg.order_button?.text_color ? { color: btnCfg.order_button.text_color } : {}),
                  }}
                >
                  <span className="relative z-20 inline-flex items-center justify-center gap-2">
                    <Zap className="h-4 w-4 animate-fs-float group-hover/btn:scale-125 group-hover/btn:-rotate-12 transition-transform [transition-duration:300ms]" />
                    {btnCfg.order_button?.text || '🛒 এখনই অর্ডার করুন'}
                  </span>
                  <span className="pointer-events-none absolute top-0 left-0 h-full w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-fs-shimmer z-10" />
                  <span className="pointer-events-none absolute inset-0 rounded-full ring-0 group-hover/btn:ring-2 ring-white/40 transition-all duration-300 z-10" />
                </button>
              )}

              {btnCfg.cart_button?.enabled !== false && (
                <button
                  onClick={handleAdd}
                  className={cn(
                    'group/cart relative w-full rounded-full border font-semibold overflow-hidden shadow-sm hover:shadow-md active:scale-[0.98] hover:-translate-y-0.5 transition-[transform,box-shadow] [transition-duration:300ms] ease-out',
                    !btnCfg.cart_button?.border_color && 'border-primary text-primary',
                    btnCfg.cart_button?.size === 'sm' ? 'text-xs py-2' : btnCfg.cart_button?.size === 'md' ? 'text-sm py-2.5' : 'text-sm sm:text-base py-2.5 sm:py-3'
                  )}
                  style={{
                    ...(btnCfg.cart_button?.bg_color ? { backgroundColor: btnCfg.cart_button.bg_color } : {}),
                    ...(btnCfg.cart_button?.text_color ? { color: btnCfg.cart_button.text_color } : {}),
                    ...(btnCfg.cart_button?.border_color ? { borderColor: btnCfg.cart_button.border_color } : {}),
                  }}
                >
                  <span className="relative z-20 inline-flex items-center justify-center gap-2">
                    <ShoppingBag className="h-4 w-4 animate-fs-float group-hover/cart:scale-125 transition-transform [transition-duration:300ms]" />
                    {btnCfg.cart_button?.text || 'কার্টে যোগ করুন'}
                  </span>
                  <span className="pointer-events-none absolute inset-0 bg-[hsl(var(--primary)/0.1)] opacity-0 group-hover/cart:opacity-100 transition-opacity [transition-duration:300ms] z-10" />
                  <span className="pointer-events-none absolute top-0 left-0 h-full w-1/2 bg-gradient-to-r from-transparent via-[hsl(var(--primary)/0.25)] to-transparent animate-fs-shimmer z-10" />
                </button>
              )}

              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {btnCfg.whatsapp_button?.enabled !== false && (
                  <Button
                    asChild
                    size={btnCfg.whatsapp_button?.size === 'sm' ? 'sm' : btnCfg.whatsapp_button?.size === 'md' ? 'default' : 'lg'}
                    className={cn('rounded-full text-sm sm:text-base', !btnCfg.whatsapp_button?.bg_color && 'bg-primary hover:bg-primary/90')}
                    style={{
                      ...(btnCfg.whatsapp_button?.bg_color ? { backgroundColor: btnCfg.whatsapp_button.bg_color } : {}),
                      ...(btnCfg.whatsapp_button?.text_color ? { color: btnCfg.whatsapp_button.text_color } : {}),
                    }}
                  >
                    <a href={`https://wa.me/8801843711211?text=${whatsappMsg}`} target="_blank" rel="noopener noreferrer" onClick={() => trackVisitorActivity('whatsapp_click')}>
                      <MessageCircle className="mr-1.5 sm:mr-2 h-4 w-4" />
                      {btnCfg.whatsapp_button?.text || 'WhatsApp'}
                    </a>
                  </Button>
                )}
                {btnCfg.call_button?.enabled !== false && (
                  <Button
                    asChild
                    variant="outline"
                    size={btnCfg.call_button?.size === 'sm' ? 'sm' : btnCfg.call_button?.size === 'md' ? 'default' : 'lg'}
                    className={cn('rounded-full text-sm sm:text-base', !btnCfg.call_button?.border_color && 'border-accent text-accent hover:bg-accent/5')}
                    style={{
                      ...(btnCfg.call_button?.bg_color ? { backgroundColor: btnCfg.call_button.bg_color } : {}),
                      ...(btnCfg.call_button?.text_color ? { color: btnCfg.call_button.text_color } : {}),
                      ...(btnCfg.call_button?.border_color ? { borderColor: btnCfg.call_button.border_color } : {}),
                    }}
                  >
                    <a href="tel:+8809617356977" onClick={() => trackVisitorActivity('call_click')}>
                      <Phone className="mr-1.5 sm:mr-2 h-4 w-4" />
                      {btnCfg.call_button?.text || 'কল করুন'}
                    </a>
                  </Button>
                )}
              </div>

              {/* Custom buttons */}
              {btnCfg.custom_buttons?.filter((b: any) => b.enabled).map((btn: any, i: number) => (
                <Button
                  key={i}
                  asChild
                  size="lg"
                  className="w-full rounded-full"
                  style={{
                    ...(btn.bg_color ? { backgroundColor: btn.bg_color } : {}),
                    ...(btn.text_color ? { color: btn.text_color } : {}),
                  }}
                >
                  <a href={btn.link} target="_blank" rel="noopener noreferrer">{btn.text}</a>
                </Button>
              ))}
            </div>

            {/* Add-on Section */}
            {(product as any).addon_config?.name && (
              <div className="border border-dashed border-primary/40 rounded-xl p-3 sm:p-4 bg-primary/5 mb-3 sm:mb-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-5 h-5 rounded border-primary text-primary accent-primary"
                    onChange={(e) => {
                      const ac = (product as any).addon_config;
                      if (e.target.checked) {
                        addItem({
                          id: `${product.id}-addon`,
                          name: ac.name,
                          name_bn: ac.name_bn || ac.name,
                          price: ac.price,
                          image: ac.image || images[0] || '',
                          slug: product.slug,
                          is_addon: true,
                          parent_product_id: product.id,
                        }, 1);
                        toast.success(`${ac.name} যোগ করা হয়েছে!`);
                      }
                    }}
                  />
                  <div className="flex items-center gap-3 flex-1">
                    {(product as any).addon_config.image && (
                      <img src={optimizedImageUrl((product as any).addon_config.image, 90, 70)} alt="" className="w-12 h-12 rounded-lg object-cover" loading="lazy" />
                    )}
                    <div>
                      <p className="text-sm text-foreground"><span className="font-bold">{(product as any).addon_config.name}</span> নিতে পারেন</p>
                      <p className="text-xs text-primary font-bold">৳{(product as any).addon_config.price} — যোগ করুন</p>
                    </div>
                  </div>
                </label>
              </div>
            )}

            {/* Bump Product Section */}
            {(product as any).bump_product_id && <BumpProductCard productId={(product as any).bump_product_id} discount={Number((product as any).bump_discount) || 0} />}

            {/* Accordion Group: Description, Policy, Gift */}
            <div className="space-y-2 sm:space-y-3">
            {/* Description */}
            {product.description_bn && (
              <div className="border border-border rounded-lg overflow-hidden">
                <button onClick={() => setDescExpanded(!descExpanded)} className="flex items-center justify-between w-full text-left px-3 sm:px-4 py-2.5 sm:py-3 bg-muted/50 hover:bg-muted transition-colors">
                  <h3 className="font-semibold text-accent text-sm sm:text-base">📋 বিবরণ</h3>
                  {descExpanded ? <ChevronUp className="h-4 w-4 text-accent" /> : <ChevronDown className="h-4 w-4 text-accent" />}
                </button>
                {descExpanded && (
                  <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-t border-border">
                    {product.description_bn.trim().startsWith('<') ? (
                      <div
                        className="sd-product-desc text-xs sm:text-sm text-foreground leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description_bn) }}
                      />
                    ) : (
                      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                        {product.description_bn}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Policy */}
            <div className="border border-border rounded-lg overflow-hidden">
              <button onClick={() => setPolicyExpanded(!policyExpanded)} className="flex items-center justify-between w-full text-left px-3 sm:px-4 py-2.5 sm:py-3 bg-muted/50 hover:bg-muted transition-colors">
                <h3 className="font-semibold text-accent text-sm sm:text-base">📜 Return, Exchange & Cancellation Policy</h3>
                {policyExpanded ? <ChevronUp className="h-4 w-4 text-accent" /> : <ChevronDown className="h-4 w-4 text-accent" />}
              </button>
              {policyExpanded && (
                <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-t border-border">
                  <div className="text-xs sm:text-sm text-muted-foreground space-y-3">
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">🔄 রিটার্ন পলিসি</h4>
                      <ul className="space-y-1 list-disc list-inside">
                        <li>পণ্য হাতে পাওয়ার ৭ দিনের মধ্যে রিটার্ন রিকোয়েস্ট করতে হবে</li>
                        <li>পণ্য অবশ্যই অব্যবহৃত, অক্ষতিগ্রস্ত এবং অরিজিনাল ট্যাগসহ থাকতে হবে</li>
                        <li>রিটার্নের ক্ষেত্রে ডেলিভারি চার্জ কাস্টমার বহন করবেন</li>
                        <li>রিফান্ড শুধুমাত্র স্টোর ক্রেডিট বা এক্সচেঞ্জ আকারে দেওয়া হবে</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">🔁 এক্সচেঞ্জ পলিসি</h4>
                      <ul className="space-y-1 list-disc list-inside">
                        <li>সাইজ বা রঙ পরিবর্তনের জন্য ৭ দিনের মধ্যে এক্সচেঞ্জ করা যাবে</li>
                        <li>এক্সচেঞ্জ পণ্য স্টকে থাকা সাপেক্ষে দেওয়া হবে</li>
                        <li>এক্সচেঞ্জের ডেলিভারি চার্জ কাস্টমার বহন করবেন</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">❌ ক্যানসেলেশন পলিসি</h4>
                      <ul className="space-y-1 list-disc list-inside">
                        <li>অর্ডার কনফার্ম হওয়ার আগে যেকোনো সময় ক্যানসেল করা যাবে</li>
                        <li>কনফার্ম হয়ে গেলে এবং শিপমেন্টে চলে গেলে ক্যানসেল করা যাবে না</li>
                        <li>ক্যানসেলেশনের জন্য হটলাইনে কল করুন: 09617356977</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Gift Service Section */}
            {(() => {
              let giftConfig: any = null;
              try {
                const defaults = allSettings?.landing_page_defaults ? JSON.parse(allSettings.landing_page_defaults) : null;
                giftConfig = defaults?.gift_service;
              } catch {}
              if (!giftConfig) return null;
              return (
                <div className="border border-border rounded-lg overflow-hidden">
                  <button onClick={() => setGiftExpanded(!giftExpanded)} className="flex items-center justify-between w-full text-left px-3 sm:px-4 py-2.5 sm:py-3 bg-muted/50 hover:bg-muted transition-colors">
                    <h3 className="font-semibold text-accent text-sm sm:text-base">🎁 প্রিয়জনকে সারপ্রাইজ দিন! ফ্রি-তে!</h3>
                    {giftExpanded ? <ChevronUp className="h-4 w-4 text-accent" /> : <ChevronDown className="h-4 w-4 text-accent" />}
                  </button>
                  {giftExpanded && (
                    <div className="border-t border-border">
                      <Suspense fallback={<div className="p-4 text-center text-muted-foreground text-sm">লোড হচ্ছে...</div>}>
                        <LandingGiftService
                          heading={giftConfig.heading}
                          description={giftConfig.description}
                          sampleNote={giftConfig.sample_note}
                          sampleSender={giftConfig.sample_sender}
                          accentColor={giftConfig.accent_color}
                          ctaText={giftConfig.cta_text}
                          sampleImages={giftConfig.sample_images || []}
                          imageCaption={giftConfig.image_caption}
                          hideCta
                        />
                      </Suspense>
                    </div>
                  )}
                </div>
              );
            })()}
            </div> {/* End Accordion Group */}
          </div> {/* End Info column */}
        </div> {/* End grid */}

        {/* Category navigation strip */}
        <ProductCategoryStrip currentCategoryId={product?.category_id} />

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="mt-10 sm:mt-16">
            <h2 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6">সম্পর্কিত পণ্য</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {relatedProducts.map(p => (
                <ProductCard key={p.id} id={p.id} slug={p.slug} name={p.name} name_bn={p.name_bn} price={p.price} original_price={p.original_price} image={p.images?.[0]} totalSold={salesMap?.get(p.id)} totalViews={viewsMap?.get(p.id)} hasVideo={!!p.video_url} createdAt={(p as any).created_at} clearance_active={(p as any).clearance_active} variant_images={(p as any).variant_images} />
              ))}
            </div>
          </div>
        )}

        {/* Popular / trending products — cross-promotes a different category each visit */}
        {discoverySection && (
          <div className="mt-10 sm:mt-16">
            <div className="flex items-center gap-2 mb-4 sm:mb-6">
              <span className="text-xl">🔥</span>
              <div>
                <h2 className="text-lg sm:text-xl font-bold leading-tight">জনপ্রিয় পণ্য</h2>
                {discoverySection.label && (
                  <p className="text-xs text-muted-foreground">{discoverySection.label} থেকে বাছাই করা সেরা পণ্য</p>
                )}
              </div>
            </div>
            <ProductSlider products={discoverySection.items} salesMap={salesMap} viewsMap={viewsMap} />
          </div>
        )}
      </div>

      <QuickOrderDialog
        open={quickOrderOpen}
        onOpenChange={setQuickOrderOpen}
        product={{...product, price: actualPrice, original_price: originalPriceForDisplay || undefined}}
        selectedSize={selectedSize}
        selectedColor={selectedColor}
        qty={qty}
      />

      <ImageLightbox
        images={images}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        initialIndex={lightboxIndex}
      />
    </Layout>
  );
}
