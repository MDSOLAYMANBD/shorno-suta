import { useEffect, useMemo, useState } from 'react';
import { Flame } from 'lucide-react';
import useEmblaCarousel from 'embla-carousel-react';
import { usePopularCategories } from '@/hooks/usePopularCategories';
import { useCategories } from '@/hooks/useCategories';
import { useCategoryPreviewImages, resolveTileImages } from '@/hooks/useProducts';
import CategoryPhotoTile from '@/components/category/CategoryPhotoTile';

export default function PopularCategoriesSection() {
  const { data: cats = [], isLoading } = usePopularCategories(12);
  const { data: allCategories = [] } = useCategories();
  const categoryIds = useMemo(() => cats.map((c: any) => c.id), [cats]);
  const { data: previewImages = {} } = useCategoryPreviewImages(categoryIds);

  const [autoplayPlugin, setAutoplayPlugin] = useState<any[]>([]);
  useEffect(() => {
    import('embla-carousel-autoplay').then((mod) => {
      setAutoplayPlugin([mod.default({ delay: 2800, stopOnInteraction: false })]);
    });
  }, []);
  const [emblaRef] = useEmblaCarousel(
    { loop: true, align: 'start', slidesToScroll: 1 },
    autoplayPlugin
  );

  if (!isLoading && cats.length === 0) return null;

  return (
    <section className="py-8 sm:py-10 bg-muted/20 border-t border-border/40">
      <div className="max-w-7xl mx-auto px-3 md:px-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-sm">
            <Flame className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold leading-tight">জনপ্রিয় ক্যাটাগরি</h2>
            <p className="text-[11px] sm:text-xs text-muted-foreground">সবচেয়ে বেশি দেখা ক্যাটাগরি</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex gap-3 sm:gap-4 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="shrink-0 basis-[42%] sm:basis-1/3 md:basis-1/4 lg:basis-1/5 aspect-[3/4] bg-muted rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div ref={emblaRef} className="overflow-hidden">
            <div className="flex -ml-3">
              {cats.map((sub: any) => (
                <div key={sub.id} className="min-w-0 shrink-0 grow-0 basis-[42%] sm:basis-1/3 md:basis-1/4 lg:basis-1/5 pl-3">
                  <CategoryPhotoTile
                    category={sub}
                    parent={allCategories.find((c: any) => c.id === sub.parent_id)}
                    images={resolveTileImages(sub.id, allCategories, previewImages)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
