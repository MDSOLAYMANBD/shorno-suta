import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { optimizedImageUrl, srcSetFor } from '@/lib/imageUrl';

interface Props {
  colors: string[];
  sizes: string[];
  variantImages: Record<string, string>;
  images: string[];
}

export default function LandingGallery({ colors, sizes, variantImages, images }: Props) {
  const [lightbox, setLightbox] = useState<string | null>(null);

  const galleryItems = colors.length > 0
    ? colors.map(c => ({ color: c, image: variantImages[c] || images[0] || '/placeholder.svg' }))
    : images.map((img, i) => ({ color: `Variant ${i + 1}`, image: img }));

  if (galleryItems.length === 0) return null;

  return (
    <section className="py-8 sm:py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-xl sm:text-2xl font-bold text-center mb-2">কালার ও সাইজ</h2>
        {sizes.length > 0 && (
          <div className="flex justify-center gap-2 mb-6">
            {sizes.map(s => (
              <Badge key={s} variant="outline" className="text-sm px-3 py-1">{s}</Badge>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {galleryItems.map((item, i) => (
            <button key={i} onClick={() => setLightbox(item.image)} className="group text-center">
              <div className="aspect-[3/4] rounded-lg overflow-hidden border border-border bg-muted">
                <img
                  src={optimizedImageUrl(item.image, 400, 75)}
                  srcSet={srcSetFor(item.image, [300, 600], 75)}
                  sizes="(max-width: 640px) 50vw, 25vw"
                  alt={item.color}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  loading="lazy"
                  onError={(e) => { const img = e.currentTarget; if (img.src !== item.image) { img.srcset = ''; img.src = item.image; } }}
                />
              </div>
              <p className="text-sm font-medium mt-1.5">{item.color}</p>
            </button>
          ))}
        </div>
      </div>

      <Dialog open={!!lightbox} onOpenChange={() => setLightbox(null)}>
        <DialogContent className="max-w-lg p-2">
          {lightbox && <img src={optimizedImageUrl(lightbox, 1200, 85)} alt="Preview" className="w-full rounded-lg" onError={(e) => { const img = e.currentTarget; if (img.src !== lightbox) img.src = lightbox; }} />}
        </DialogContent>
      </Dialog>
    </section>
  );
}
