import { useCallback, useEffect, useState, forwardRef } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ProductCard from '@/components/product/ProductCard';

interface Product {
  id: string;
  slug: string;
  name: string;
  name_bn: string;
  price: number;
  original_price?: number | null;
  images?: string[] | null;
  video_url?: string | null;
  created_at?: string | null;
  clearance_active?: boolean | null;
  variant_images?: any;
  linkColor?: string;
  __key?: string;
}

interface ProductSliderProps {
  products: Product[];
  buttonConfig?: any;
  salesMap?: Map<string, number>;
  viewsMap?: Map<string, number>;
}

const ProductSlider = forwardRef<HTMLDivElement, ProductSliderProps>(({ products, buttonConfig, salesMap, viewsMap }, ref) => {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    slidesToScroll: 1,
    containScroll: 'trimSnaps',
    dragFree: true,
  });

  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    return () => { emblaApi.off('select', onSelect); };
  }, [emblaApi, onSelect]);

  return (
    <div className="relative group" ref={ref}>
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex -ml-2">
          {products.map((p: any, idx) => (
            <div key={p.linkColor ? `${p.id}::${p.linkColor}` : (p.__key || `${p.id}-${idx}`)} className="shrink-0 basis-[42%] md:basis-[20%] pl-2 min-w-0">
              <ProductCard
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
                linkColor={p.linkColor}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Desktop nav arrows */}
      {canScrollPrev && (
        <Button
          variant="outline"
          size="icon"
          className="absolute left-1 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full bg-background/90 shadow-md hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => emblaApi?.scrollPrev()}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
      )}
      {canScrollNext && (
        <Button
          variant="outline"
          size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full bg-background/90 shadow-md hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => emblaApi?.scrollNext()}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
});

ProductSlider.displayName = 'ProductSlider';

export default ProductSlider;
