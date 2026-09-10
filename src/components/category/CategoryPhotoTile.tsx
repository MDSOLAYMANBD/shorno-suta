import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package } from 'lucide-react';
import { optimizedImageUrl } from '@/lib/imageUrl';

const CELL_COUNT = 4;
const CYCLE_MS = 2600; // how often one cell (of the 4) advances to its next photo

// A single grid cell — shows a static photo. When the `src` it's given
// changes, the new one "pops" in on top and quietly becomes the resting image.
function PhotoCell({ src, alt }: { src: string; alt: string }) {
  const [bgSrc, setBgSrc] = useState(src);
  const [incomingSrc, setIncomingSrc] = useState<string | null>(null);
  const prevSrc = useRef(src);

  useEffect(() => {
    if (src === prevSrc.current) return;
    prevSrc.current = src;
    setIncomingSrc(src);
  }, [src]);

  const handlePopEnd = () => {
    setBgSrc((current) => incomingSrc || current);
    setIncomingSrc(null);
  };

  return (
    <div className="relative overflow-hidden bg-background">
      <img
        src={optimizedImageUrl(bgSrc, 150, 75)}
        alt={alt}
        loading="lazy"
        className="absolute inset-0 w-full h-full object-cover"
      />
      {incomingSrc && (
        <img
          key={incomingSrc}
          src={optimizedImageUrl(incomingSrc, 150, 75)}
          alt={alt}
          className="absolute inset-0 w-full h-full object-cover animate-tile-pop-in"
          onAnimationEnd={handlePopEnd}
        />
      )}
    </div>
  );
}

// A category/subcategory tile that shows a live collage of real product
// photos. The 4 cells are coordinated from here (not independently) so the
// same photo can never appear in two cells at once — a new photo only ever
// rotates in once every one already showing has been accounted for. One cell
// "pops" in its next photo at a time, continuously. Shared between the
// homepage carousel and the shop page's category grids.
export default function CategoryPhotoTile({ category, parent, images }: { category: any; parent?: any; images: string[] }) {
  // Dedupe and key on content (not array identity) so re-renders from the
  // parent — which typically rebuilds this array fresh each time — don't
  // reset the rotation state below.
  const poolKey = images.join('|');
  const pool = useMemo(() => Array.from(new Set(images)), [poolKey]);
  const canRotate = pool.length > CELL_COUNT;

  const [slots, setSlots] = useState<string[]>(() =>
    pool.length === 0 ? [] : Array.from({ length: CELL_COUNT }, (_, i) => pool[i % pool.length])
  );
  const cursorRef = useRef(CELL_COUNT % Math.max(pool.length, 1));

  useEffect(() => {
    setSlots(pool.length === 0 ? [] : Array.from({ length: CELL_COUNT }, (_, i) => pool[i % pool.length]));
    cursorRef.current = CELL_COUNT % Math.max(pool.length, 1);
  }, [pool]);

  useEffect(() => {
    if (!canRotate) return;
    let turn = 0;
    const id = setInterval(() => {
      setSlots((prev) => {
        const next = [...prev];
        let candidate = cursorRef.current;
        let guard = 0;
        while (next.includes(pool[candidate]) && guard < pool.length) {
          candidate = (candidate + 1) % pool.length;
          guard++;
        }
        next[turn % CELL_COUNT] = pool[candidate];
        cursorRef.current = (candidate + 1) % pool.length;
        return next;
      });
      turn++;
    }, CYCLE_MS / CELL_COUNT);
    return () => clearInterval(id);
  }, [canRotate, pool]);

  const hasImages = slots.length > 0;
  const alt = category.name_bn || category.name;

  return (
    <Link to={`/shop/${category.slug}`} className="group block">
      <div className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden bg-muted border border-border/60 shadow-sm group-hover:shadow-xl group-hover:border-primary/30 transition-all duration-300">
        {hasImages ? (
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0.5">
            {slots.map((src, i) => (
              <PhotoCell key={i} src={src} alt={alt} />
            ))}
          </div>
        ) : category.banner_image_url ? (
          <img
            src={optimizedImageUrl(category.banner_image_url, 300, 75)}
            alt={alt}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10">
            {category.image_url ? (
              <img src={optimizedImageUrl(category.image_url, 80, 75)} alt={category.name} className="w-12 h-12 object-contain rounded-full" />
            ) : category.icon ? (
              <span className="text-4xl opacity-60">{category.icon}</span>
            ) : (
              <Package className="w-10 h-10 text-primary/30" />
            )}
          </div>
        )}
      </div>

      <div className="mt-2 px-0.5">
        <h3 className="font-semibold text-xs sm:text-sm line-clamp-1 group-hover:text-primary transition-colors">
          {alt}
        </h3>
        {parent && (
          <span className="text-[10px] text-muted-foreground line-clamp-1">
            {parent.icon ? `${parent.icon} ` : ''}{parent.name_bn || parent.name}
          </span>
        )}
      </div>
    </Link>
  );
}
