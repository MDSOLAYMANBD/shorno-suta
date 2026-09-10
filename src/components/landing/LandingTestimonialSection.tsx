import { useMemo, useCallback, useEffect, useState } from 'react';
import { Star, ChevronLeft, ChevronRight, BadgeCheck, Quote } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import useEmblaCarousel from 'embla-carousel-react';
import { optimizedImageUrl } from '@/lib/imageUrl';
import { useSiteConfig, DEFAULT_HOMEPAGE_CONFIG } from '@/hooks/useSiteConfig';
import { useApprovedReviews } from '@/hooks/useCustomerReviews';

function TestimonialImageGrid({ images, onClickImage }: { images: string[]; onClickImage: (idx: number) => void }) {
  if (!images || images.length === 0) return null;

  if (images.length === 1) {
    return (
      <div className="relative rounded-lg overflow-hidden bg-muted/40 cursor-pointer group border border-primary/20 shadow-sm hover:border-primary/40 transition-all" onClick={() => onClickImage(0)}>
        <img src={optimizedImageUrl(images[0], 400, 80)} alt="রিভিউ ছবি" className="w-full max-h-32 sm:max-h-72 object-contain group-hover:scale-[1.02] transition-transform duration-500" />
      </div>
    );
  }

  if (images.length === 2) {
    return (
      <div className="grid grid-cols-2 gap-1">
        {images.map((img, idx) => (
          <div key={idx} className="relative rounded-lg overflow-hidden bg-muted/40 cursor-pointer group aspect-square border border-primary/20 shadow-sm hover:border-primary/40 transition-all" onClick={() => onClickImage(idx)}>
            <img src={optimizedImageUrl(img, 300, 80)} alt={`ছবি ${idx + 1}`} className="w-full h-full object-contain group-hover:scale-[1.03] transition-transform" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="relative rounded-lg overflow-hidden bg-muted/40 cursor-pointer group border border-primary/20 shadow-sm hover:border-primary/40 transition-all" onClick={() => onClickImage(0)}>
        <img src={optimizedImageUrl(images[0], 400, 80)} alt="রিভিউ ছবি" className="w-full max-h-28 sm:max-h-60 object-contain group-hover:scale-[1.02] transition-transform duration-500" />
      </div>
      <div className="grid grid-cols-3 gap-1">
        {images.slice(1, 4).map((img, idx) => (
          <div key={idx} className="relative rounded overflow-hidden bg-muted/40 cursor-pointer group aspect-square border border-primary/20 shadow-sm hover:border-primary/40 transition-all" onClick={() => onClickImage(idx + 1)}>
            <img src={optimizedImageUrl(img, 200, 75)} alt={`ছবি ${idx + 2}`} className="w-full h-full object-contain group-hover:scale-105 transition-transform" />
            {idx === 2 && images.length > 4 && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="text-white text-sm font-bold">+{images.length - 4}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface LandingTestimonialSectionProps {
  source: 'homepage' | 'manual';
  manualItems?: { name: string; text: string; rating?: number }[];
  bgColor?: string;
  customCss?: string;
}

export default function LandingTestimonialSection({ source, manualItems = [], bgColor }: LandingTestimonialSectionProps) {
  const { data: savedConfig } = useSiteConfig('homepage_config');
  const { data: dbReviews = [] } = useApprovedReviews();

  const items = useMemo(() => {
    if (source === 'manual') {
      return manualItems.map(item => ({
        name: item.name,
        text: item.text,
        rating: item.rating || 5,
        location: '',
        images: [] as string[],
      }));
    }
    // Homepage source: manual testimonials from homepage_config + approved DB reviews
    const config = savedConfig?.testimonials || DEFAULT_HOMEPAGE_CONFIG.testimonials;
    const configItems = (config.items || []).map((item: any) => ({
      name: item.name,
      text: item.text,
      rating: item.rating || 5,
      location: item.location || '',
      images: item.images || [],
    }));
    const dbItems = dbReviews.map(r => ({
      name: r.customer_name,
      location: r.customer_location || '',
      text: r.review_text || '',
      rating: r.rating,
      images: r.images || [],
    }));
    return [...configItems, ...dbItems];
  }, [source, manualItems, savedConfig, dbReviews]);

  const useLoop = items.length >= 3;
  const useAutoplay = items.length >= 3;

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: useLoop,
    align: 'start',
    active: items.length > 1,
  });
  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIdx, setLightboxIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const openLightbox = (images: string[], idx: number) => {
    setLightboxImages(images);
    setLightboxIdx(idx);
    setLightboxOpen(true);
  };

  useEffect(() => {
    if (!emblaApi || !useAutoplay) return;
    let interval: ReturnType<typeof setInterval>;

    const start = () => { interval = setInterval(() => emblaApi.scrollNext(), 4000); };
    const stop = () => clearInterval(interval);

    // Pause when tab is hidden
    const onVisibility = () => { document.hidden ? stop() : start(); };
    document.addEventListener('visibilitychange', onVisibility);

    if (!document.hidden) start();

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [emblaApi, useAutoplay]);

  if (items.length === 0) return null;

  return (
    <>
      <div style={{ backgroundColor: bgColor || undefined }} className="py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">কাস্টমার রিভিউ</h2>
            <div className="flex items-center gap-2">
              <button onClick={scrollPrev} className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={scrollNext} className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div ref={emblaRef} className="overflow-hidden">
            <div className="flex -ml-2 sm:-ml-4">
              {items.map((t, i) => {
                const hasImages = t.images && t.images.length > 0;
                return (
                  <div key={i} className="min-w-0 shrink-0 grow-0 basis-1/2 lg:basis-1/3 pl-2 sm:pl-4">
                    <Card className="border-primary/10 hover:border-primary/30 hover:shadow-lg transition-all duration-300 h-full overflow-hidden bg-gradient-to-br from-primary/5 to-primary/10">
                      <CardContent className="p-0">
                        <div className="h-1 bg-gradient-to-r from-primary/40 via-primary/20 to-transparent" />
                        {/* User info */}
                        <div className="px-2 sm:px-3 pt-2 sm:pt-2.5 pb-1.5 sm:pb-2">
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary/15 flex items-center justify-center text-[10px] sm:text-xs font-bold text-primary ring-2 ring-primary/10 shrink-0">
                              {(t.name || '?')[0]}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1 sm:gap-1.5">
                                <p className="text-[11px] sm:text-sm font-semibold leading-tight text-foreground truncate max-w-[70px] sm:max-w-none">{t.name}</p>
                                <span className="inline-flex items-center gap-0.5 bg-green-50 border border-green-200 rounded-full px-1 sm:px-1.5 py-0.5 shrink-0">
                                  <BadgeCheck className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-green-600 fill-green-100" />
                                  <span className="text-[7px] sm:text-[9px] font-semibold text-green-700 leading-none">Verified</span>
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {t.location && <p className="text-[9px] sm:text-[11px] text-muted-foreground truncate">{t.location}</p>}
                                <div className="flex gap-0.5 shrink-0">
                                  {Array.from({ length: 5 }).map((_, si) => (
                                    <Star key={si} className={`h-2 w-2 sm:h-3.5 sm:w-3.5 ${si < (t.rating || 5) ? 'text-yellow-500 fill-yellow-500' : 'text-muted'}`} />
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Images */}
                        {hasImages && (
                          <div className="px-2 sm:px-3 pb-1.5 sm:pb-2">
                            <TestimonialImageGrid images={t.images} onClickImage={(idx) => openLightbox(t.images, idx)} />
                          </div>
                        )}

                        {/* Review text */}
                        {t.text && (
                          <div className="px-2 sm:px-3 pb-2 sm:pb-3">
                            <div className="bg-background/80 backdrop-blur-sm rounded-2xl rounded-tl-sm px-1.5 sm:px-3.5 py-1 sm:py-2.5 shadow-sm border border-primary/10">
                              <p className="text-[11px] sm:text-sm text-foreground/90 leading-relaxed line-clamp-2 sm:line-clamp-none">"{t.text}"</p>
                            </div>
                          </div>
                        )}

                        {!hasImages && !t.text && (
                          <div className="relative px-3 pb-3 flex items-center justify-center min-h-[50px] sm:min-h-[80px]">
                            <Quote className="absolute h-16 w-16 text-primary/[0.06]" />
                            <p className="text-xs text-muted-foreground text-center italic">🙏 ধন্যবাদ</p>
                          </div>
                        )}

                        <div className="hidden sm:block px-2 sm:px-3 pb-2 sm:pb-2.5">
                          <span className="text-[9px] sm:text-[10px] text-primary/50 font-medium">🙏 মূল্যবান মতামতের জন্য ধন্যবাদ</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-3xl p-2 sm:p-4 bg-background border border-border">
          <DialogTitle className="sr-only">ছবি দেখুন</DialogTitle>
          {lightboxImages.length > 0 && (
            <div className="relative">
              <img src={optimizedImageUrl(lightboxImages[lightboxIdx], 800, 90)} alt="রিভিউ ছবি" className="w-full max-h-[70vh] object-contain rounded-lg" />
              {lightboxImages.length > 1 && (
                <>
                  <button onClick={() => setLightboxIdx(i => (i - 1 + lightboxImages.length) % lightboxImages.length)} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/80 border flex items-center justify-center">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button onClick={() => setLightboxIdx(i => (i + 1) % lightboxImages.length)} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/80 border flex items-center justify-center">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
