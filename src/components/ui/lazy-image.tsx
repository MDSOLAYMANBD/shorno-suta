import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { srcSetFor } from '@/lib/imageUrl';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  placeholderClass?: string;
  /** Original (un-proxied) Supabase URL, used to derive srcSet variants. If omitted, srcSet is skipped. */
  sourceUrl?: string;
  /** Comma-separated <img sizes> attribute, e.g. "(max-width: 640px) 50vw, 25vw" */
  sizes?: string;
  /** Widths to generate in srcSet. Defaults to [400, 800, 1200]. */
  widths?: number[];
}

export function LazyImage({
  src,
  alt,
  className,
  placeholderClass,
  sourceUrl,
  sizes,
  widths,
  ...props
}: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const [inView, setInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const currentSrc = useRef(src);

  // Reset loaded only when src actually changes
  useEffect(() => {
    if (currentSrc.current !== src) {
      currentSrc.current = src;
      setLoaded(false);
      setErrored(false);
    }
  }, [src]);

  // Check if image is already cached when it mounts
  const handleRef = useCallback((el: HTMLImageElement | null) => {
    (imgRef as any).current = el;
    if (el && el.complete && el.naturalWidth > 0) {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Check if already in viewport on mount
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight + 400 && rect.bottom > -400) {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '400px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // If proxy fails, fall back to the original source URL (direct Supabase)
  const handleError = () => {
    if (!errored && sourceUrl && imgRef.current) {
      setErrored(true);
      imgRef.current.srcset = '';
      imgRef.current.src = sourceUrl;
    }
  };

  const srcSet = sourceUrl && !errored ? srcSetFor(sourceUrl, widths) : undefined;

  return (
    <div ref={containerRef} className={cn('relative overflow-hidden', className)}>
      {/* Static placeholder */}
      <div
        className={cn(
          'absolute inset-0 bg-muted transition-opacity duration-300',
          loaded ? 'opacity-0' : 'opacity-100',
          placeholderClass
        )}
      />
      {inView && (
        <img
          ref={handleRef}
          src={src}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={handleError}
          className={cn(
            'w-full h-full object-cover transition-opacity duration-300',
            loaded ? 'opacity-100' : 'opacity-0'
          )}
          {...props}
        />
      )}
    </div>
  );
}
