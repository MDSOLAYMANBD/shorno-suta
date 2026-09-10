import { useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import SEOHead from '@/components/SEOHead';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Minus, Plus, Trash2, ShoppingBag, Copy } from 'lucide-react';
import { trackViewCart } from '@/lib/ecommerceTracking';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { applyClearanceList } from '@/lib/clearancePrice';
import { FreeShippingProgress } from '@/components/freeShipping/FreeShippingProgress';
import { optimizedImageUrl } from '@/lib/imageUrl';
import { getColorPrimaryImage } from '@/lib/productVariants';

export default function Cart() {
  const { items, updateQuantity, removeItem, subtotal, addItem, updateItemSize, updateItemColor } = useCart();

  const defaultsApplied = useRef<Set<string>>(new Set());

  const viewCartFired = useRef(false);
  useEffect(() => {
    if (items.length > 0 && !viewCartFired.current) {
      viewCartFired.current = true;
      trackViewCart(items);
    }
  }, [items.length]);

  // Fetch product details
  const productIds = useMemo(() => {
    const ids = new Set<string>();
    items.forEach(i => {
      const realId = i.is_addon ? i.parent_product_id : i.id;
      if (realId) ids.add(realId);
    });
    return Array.from(ids);
  }, [items]);

  const { data: productDetails } = useQuery({
    queryKey: ['cart-product-details', productIds],
    enabled: productIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (productIds.length === 0) return {};
      const { data, error } = await supabase
        .from('products')
        .select('id, sizes, colors, variant_images, bump_product_id, bump_discount, addon_config, price, original_price, images, name, name_bn, slug, clearance_price, clearance_active')
        .in('id', productIds)
        .eq('is_active', true);
      if (error) throw error;
      const map: Record<string, any> = {};
      applyClearanceList(data || []).forEach((p: any) => { map[p.id] = p; });
      return map;
    },
  });

  // Collect bump product IDs (from bump_product_id only, addon_config is inline)
  const bumpProductIds = useMemo(() => {
    if (!productDetails) return [];
    const ids = new Set<string>();
    Object.values(productDetails).forEach((p: any) => {
      if (p.bump_product_id) ids.add(p.bump_product_id);
    });
    return Array.from(ids);
  }, [productDetails]);

  const { data: bumpProducts } = useQuery({
    queryKey: ['cart-bump-products', bumpProductIds],
    enabled: bumpProductIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (bumpProductIds.length === 0) return {};
      const { data, error } = await supabase
        .from('products')
        .select('id, name, name_bn, price, original_price, images, slug, clearance_price, clearance_active')
        .in('id', bumpProductIds)
        .eq('is_active', true);
      if (error) throw error;
      const map: Record<string, any> = {};
      applyClearanceList(data || []).forEach((p: any) => { map[p.id] = p; });
      return map;
    },
  });

  // Auto-select default size/color for items added without variants (e.g. from ProductCard)
  useEffect(() => {
    if (!productDetails || Object.keys(productDetails).length === 0) return;
    items.forEach(item => {
      if (item.is_addon) return;
      const pd = productDetails[item.id];
      if (!pd) return;
      const key = `${item.id}-${item.size || ''}-${item.color || ''}`;
      if (defaultsApplied.current.has(key)) return;

      const colors = (pd.colors as string[]) || [];
      const sizes = (pd.sizes as string[]) || [];
      const vi = pd.variant_images as any;
      const colorSizesMap: Record<string, string[]> = vi?.color_sizes || {};
      const colorImagesMap = vi?.color_images;

      let needsColor = !item.color && colors.length > 0;
      let needsSize = !item.size && sizes.length > 0;

      if (!needsColor && !needsSize) return;
      defaultsApplied.current.add(key);

      const defaultColor = needsColor ? colors[0] : item.color;
      let availSizes = sizes;
      if (defaultColor && colorSizesMap[defaultColor]?.length > 0) {
        availSizes = colorSizesMap[defaultColor];
      }
      const defaultSize = needsSize ? availSizes[0] : item.size;

      // Get correct image for color
      let newImage = item.image;
      const colorImg = defaultColor ? getColorPrimaryImage(colorImagesMap, defaultColor) : null;
      if (colorImg) newImage = colorImg;

      // Get correct price for size
      const sizeResult = defaultSize ? getPriceForSize(item.id, defaultSize, defaultColor) : undefined;
      const newPrice = sizeResult?.price ?? item.price;
      const newOriginal = sizeResult?.originalPrice ?? item.original_price;

      // Apply color first, then size
      if (needsColor && defaultColor) {
        updateItemColor(item.id, item.size, item.color, defaultColor, newImage, sizeResult?.price, item.instance_id);
      }
      if (needsSize && defaultSize) {
        updateItemSize(item.id, item.size, defaultColor || item.color, defaultSize, newPrice, newOriginal, item.instance_id);
      }
    });
  }, [productDetails, items]);


  const getAvailableSizes = (item: typeof items[0]) => {
    if (item.is_addon) return [];
    const pd = productDetails?.[item.id];
    if (!pd || !pd.sizes || pd.sizes.length === 0) return [];
    const vi = pd.variant_images as any;
    const colorSizesMap: Record<string, string[]> = vi?.color_sizes || {};
    if (item.color && colorSizesMap[item.color] && colorSizesMap[item.color].length > 0) {
      return colorSizesMap[item.color];
    }
    return pd.sizes as string[];
  };

  // Helper: get available colors
  const getAvailableColors = (item: typeof items[0]) => {
    if (item.is_addon) return [];
    const pd = productDetails?.[item.id];
    if (!pd || !pd.colors || pd.colors.length === 0) return [];
    return pd.colors as string[];
  };

  // Helper: get sale price and original price for a specific size (from size_data)
  const getPriceForSize = (productId: string, size: string, color?: string): { price: number; originalPrice?: number } | undefined => {
    const pd = productDetails?.[productId];
    if (!pd) return undefined;
    const vi = pd.variant_images as any;
    const sizeData = vi?.size_data;
    if (!sizeData) return undefined;

    // Pick the right size entry (color-specific or global)
    const sd = (color && sizeData[color]?.[size]) ? sizeData[color][size] : sizeData[size];
    if (!sd) return undefined;

    // If size has its own sale_price, use it
    if (sd.sale_price && Number(sd.sale_price) > 0) {
      return { price: Number(sd.sale_price), originalPrice: sd.price ? Number(sd.price) : undefined };
    }

    if (sd.price) {
      const sizeRegular = Number(sd.price);
      const baseActive = (pd.original_price && pd.original_price > 0) ? Math.min(pd.price, pd.original_price) : pd.price;
      const baseRegular = (pd.original_price && pd.original_price > 0) ? Math.max(pd.price, pd.original_price) : pd.price;
      if (baseActive < baseRegular) {
        // Product is on sale — use base sale price, size regular as strikethrough
        return { price: baseActive, originalPrice: sizeRegular };
      }
      return { price: sizeRegular };
    }
    return undefined;
  };

  // Helper: get image for a specific color (from color_images)
  const getImageForColor = (productId: string, color: string): string | undefined => {
    const pd = productDetails?.[productId];
    if (!pd) return undefined;
    const vi = pd.variant_images as any;
    return getColorPrimaryImage(vi?.color_images, color) || undefined;
  };

  const handleSizeChange = (item: typeof items[0], newSize: string) => {
    const result = getPriceForSize(item.id, newSize, item.color);
    if (result) {
      updateItemSize(item.id, item.size, item.color, newSize, result.price, result.originalPrice, item.instance_id);
    } else {
      updateItemSize(item.id, item.size, item.color, newSize, undefined, undefined, item.instance_id);
    }
  };

  const handleColorChange = (item: typeof items[0], newColor: string) => {
    const newImage = getImageForColor(item.id, newColor);
    const result = item.size ? getPriceForSize(item.id, item.size, newColor) : undefined;
    updateItemColor(item.id, item.size, item.color, newColor, newImage, result?.price, item.instance_id);
  };

  // Check if a bump/addon is already in cart
  const isInCart = (id: string) => items.some(i => i.id === id);
  const isAddonInCart = (addonName: string, parentId: string) =>
    items.some(i => i.is_addon && i.parent_product_id === parentId && i.name === addonName);

  // Get bump/addon suggestions for a cart item
  const getBumpSuggestions = (item: typeof items[0]) => {
    if (item.is_addon) return { linked: [], inline: null };
    const pd = productDetails?.[item.id];
    if (!pd) return { linked: [], inline: null };

    const linked: { data: any; discount: number }[] = [];

    // 1. bump_product_id
    if (pd.bump_product_id && bumpProducts?.[pd.bump_product_id]) {
      linked.push({ data: bumpProducts[pd.bump_product_id], discount: Number(pd.bump_discount) || 0 });
    }

    // 2. addon_config as inline object { name, name_bn, price, image }
    const ac = pd.addon_config as { name?: string; name_bn?: string; price?: number; image?: string } | null;
    const inline = ac && ac.name ? { ...ac, parentId: item.id } : null;

    return { linked, inline };
  };

  if (items.length === 0) {
    return (
      <Layout>
        <SEOHead title="কার্ট | স্বর্ণ সুতা" description="আপনার শপিং কার্ট দেখুন এবং অর্ডার সম্পন্ন করুন। স্বর্ণ সুতায় সেরা মানের পোশাক সাশ্রয়ী দামে সারা বাংলাদেশে ডেলিভারি।" noindex />
        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">আপনার কার্ট খালি</h1>
          <p className="text-muted-foreground mb-6">পণ্য যোগ করতে শপিং শুরু করুন।</p>
          <Button asChild className="rounded-full"><Link to="/shop">পণ্য দেখুন</Link></Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <SEOHead title="কার্ট | স্বর্ণ সুতা" description="আপনার শপিং কার্ট দেখুন এবং অর্ডার সম্পন্ন করুন। স্বর্ণ সুতায় সেরা মানের পোশাক সাশ্রয়ী দামে সারা বাংলাদেশে ডেলিভারি।" noindex />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">শপিং কার্ট</h1>

        <div className="space-y-4 mb-8">
          {items.map(item => {
            const key = `${item.id}-${item.size || ''}-${item.color || ''}-${item.instance_id || ''}`;
            const availableSizes = getAvailableSizes(item);
            const availableColors = getAvailableColors(item);
            const { linked: bumpLinked, inline: bumpInline } = getBumpSuggestions(item);

            return (
              <div key={key}>
                <div className="relative flex gap-3 p-2.5 pr-8 pb-9 border border-border rounded-lg bg-card">
                  {/* Trash button — top-right of card */}
                  <button
                    onClick={() => removeItem(item.id, item.size, item.color, item.instance_id)}
                    className="absolute top-1.5 right-1.5 p-1 rounded-md text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
                    title="ডিলিট"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  <div className="w-16 h-16 bg-muted rounded-md overflow-hidden shrink-0">
                    {item.image ? <img src={optimizedImageUrl(item.image, 100, 70)} alt={item.name} className="w-full h-full object-cover" loading="lazy" /> : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link to={`/product/${item.slug}`} className="font-medium text-sm hover:underline line-clamp-1">{item.name_bn || item.name}</Link>

                    {/* Color selector */}
                    {availableColors.length > 1 && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] text-muted-foreground">রঙ:</span>
                        <div className="flex flex-wrap gap-1">
                          {availableColors.map(c => (
                            <button
                              key={c}
                              onClick={() => handleColorChange(item, c)}
                              className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-colors ${
                                item.color === c
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-border text-muted-foreground hover:border-primary/50'
                              }`}
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {availableColors.length <= 1 && item.color && (
                      <span className="text-[10px] text-muted-foreground mt-0.5 block">রঙ: {item.color}</span>
                    )}

                    {/* Size selector */}
                    {availableSizes.length > 1 ? (
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] text-muted-foreground">সাইজ:</span>
                        <div className="flex flex-wrap gap-1">
                          {availableSizes.map(s => (
                            <button
                              key={s}
                              onClick={() => handleSizeChange(item, s)}
                              className={`text-[10px] min-w-[26px] px-1.5 py-0.5 rounded border transition-colors ${
                                item.size === s
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-border text-muted-foreground hover:border-primary/50'
                              }`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : item.size ? (
                      <span className="text-[10px] text-muted-foreground mt-0.5 block">সাইজ: {item.size}</span>
                    ) : null}

                    <div className="flex items-center justify-between mt-1.5 gap-2">
                      <div className="flex items-center border border-border rounded-md">
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1, item.size, item.color, item.instance_id)} className="p-1"><Minus className="h-3 w-3" /></button>
                        <span className="px-2.5 text-xs">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1, item.size, item.color, item.instance_id)} className="p-1"><Plus className="h-3 w-3" /></button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm">৳{item.price * item.quantity}</span>
                        {item.original_price && item.original_price > item.price && (
                          <span className="text-[10px] text-muted-foreground line-through">৳{item.original_price * item.quantity}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Copy button — bottom-right corner of card */}
                  <button
                    onClick={() => {
                      const newInstanceId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                      addItem({
                        id: item.id,
                        name: item.name,
                        name_bn: item.name_bn,
                        price: item.price,
                        original_price: item.original_price,
                        image: item.image,
                        slug: item.slug,
                        size: item.size,
                        color: item.color,
                        is_addon: item.is_addon,
                        parent_product_id: item.parent_product_id,
                        instance_id: newInstanceId,
                      } as any, 1);
                      toast.success('কপি করা হয়েছে!');
                    }}
                    className="absolute bottom-1.5 right-1.5 flex items-center gap-1 px-2 py-1 rounded-md border border-primary/30 bg-primary/5 hover:bg-primary/15 text-primary text-[11px] font-medium transition-colors"
                    title="ডুপ্লিকেট"
                  >
                    <Copy className="h-3 w-3" />
                    <span>কপি</span>
                  </button>
                </div>


                {/* Linked Bump Product Suggestions */}
                {bumpLinked.map(({ data: bumpData, discount: bumpDiscount }) => {
                  if (isInCart(bumpData.id)) return null;
                  const basePrice = bumpData.price;
                  return (
                    <div key={bumpData.id} className="ml-4 mt-1 border border-dashed border-primary/30 rounded-lg p-3 bg-primary/5">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">🎁 এটিও পছন্দ হতে পারে</p>
                      <div className="flex items-center gap-3">
                        {bumpData.images?.[0] && (
                          <img src={optimizedImageUrl(bumpData.images[0], 90, 70)} alt="" className="w-12 h-14 rounded-lg object-cover" loading="lazy" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">{bumpData.name_bn || bumpData.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-bold text-primary">৳{basePrice - bumpDiscount}</span>
                            {bumpDiscount > 0 && (
                              <span className="text-[10px] text-muted-foreground line-through">৳{basePrice}</span>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0 rounded-full text-xs h-7 px-3 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                          onClick={() => {
                            addItem({
                              id: bumpData.id,
                              name: bumpData.name,
                              name_bn: bumpData.name_bn,
                              price: basePrice - bumpDiscount,
                              original_price: bumpDiscount > 0 ? basePrice : undefined,
                              image: bumpData.images?.[0] || '',
                              slug: bumpData.slug,
                            }, 1);
                            toast.success('কার্টে যোগ করা হয়েছে!');
                          }}
                        >
                          <ShoppingBag className="h-3 w-3 mr-1" /> যোগ করুন
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {/* Inline Addon (addon_config object) */}
                {bumpInline && !isAddonInCart(bumpInline.name!, item.id) && (
                  <div className="ml-4 mt-1 border border-dashed border-primary/30 rounded-lg p-3 bg-primary/5">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">🎁 এটিও নিতে পারেন</p>
                    <div className="flex items-center gap-3">
                      {bumpInline.image && (
                        <img src={optimizedImageUrl(bumpInline.image, 90, 70)} alt="" className="w-12 h-14 rounded-lg object-cover" loading="lazy" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{bumpInline.name_bn || bumpInline.name}</p>
                        <span className="text-xs font-bold text-primary">৳{bumpInline.price}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 rounded-full text-xs h-7 px-3 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                        onClick={() => {
                          addItem({
                            id: `addon-${item.id}-${bumpInline.name}`,
                            name: bumpInline.name!,
                            name_bn: bumpInline.name_bn || bumpInline.name!,
                            price: Number(bumpInline.price) || 0,
                            image: bumpInline.image || '',
                            slug: item.slug,
                            is_addon: true,
                            parent_product_id: item.id,
                          }, 1);
                          toast.success('কার্টে যোগ করা হয়েছে!');
                        }}
                      >
                        <ShoppingBag className="h-3 w-3 mr-1" /> যোগ করুন
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t border-border pt-6 pb-20 lg:pb-0">
          <FreeShippingProgress
            items={items.map(i => ({ id: (i.is_addon ? i.parent_product_id : i.id) as string, quantity: i.quantity, price: i.price }))}
            variant="banner"
            className="mb-4"
          />
          <div className="flex justify-between items-center mb-2">
            <span className="text-muted-foreground">সাবটোটাল</span>
            <span className="font-semibold">৳{subtotal}</span>
          </div>
          <p className="text-xs text-muted-foreground mb-6">ডেলিভারি চার্জ চেকআউটে যোগ হবে।</p>
          <Button asChild size="lg" className="w-full rounded-full hidden lg:flex">
            <Link to="/checkout">অর্ডার করুন</Link>
          </Button>
        </div>
      </div>

      {/* Sticky mobile checkout button */}
      <div className="fixed bottom-16 left-0 right-0 z-40 bg-background border-t border-border p-3 lg:hidden">
        <Button asChild size="lg" className="w-full rounded-full">
          <Link to="/checkout" className="flex items-center justify-center gap-2">
            অর্ডার করুন — ৳{subtotal}
          </Link>
        </Button>
      </div>
    </Layout>
  );
}
