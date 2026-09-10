import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogPortal, DialogOverlay } from '@/components/ui/dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight, X as XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { optimizedImageUrl } from '@/lib/imageUrl';

interface ImageLightboxProps {
  images: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialIndex: number;
}

export default function ImageLightbox({ images, open, onOpenChange, initialIndex }: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastTapRef = useRef(0);
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef(1);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const translateStartRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      resetZoom();
    }
  }, [open, initialIndex]);

  const resetZoom = () => {
    setZoom(1);
    setTranslate({ x: 0, y: 0 });
  };

  const goNext = useCallback(() => {
    setCurrentIndex(i => (i + 1) % images.length);
    resetZoom();
  }, [images.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex(i => (i - 1 + images.length) % images.length);
    resetZoom();
  }, [images.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, goNext, goPrev, onOpenChange]);

  const getDistance = (t1: React.Touch, t2: React.Touch) =>
    Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchStartDistRef.current = getDistance(e.touches[0], e.touches[1]);
      pinchStartZoomRef.current = zoom;
      return;
    }
    if (e.touches.length === 1) {
      const now = Date.now();
      const touch = e.touches[0];

      // Double tap detection
      if (now - lastTapRef.current < 300) {
        if (zoom > 1) {
          resetZoom();
        } else {
          setZoom(2.5);
        }
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;

      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: now };

      if (zoom > 1) {
        isDraggingRef.current = true;
        dragStartRef.current = { x: touch.clientX, y: touch.clientY };
        translateStartRef.current = { ...translate };
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDistRef.current !== null) {
      e.preventDefault();
      const dist = getDistance(e.touches[0], e.touches[1]);
      const newZoom = Math.min(4, Math.max(1, pinchStartZoomRef.current * (dist / pinchStartDistRef.current)));
      setZoom(newZoom);
      if (newZoom <= 1) setTranslate({ x: 0, y: 0 });
      return;
    }

    if (isDraggingRef.current && e.touches.length === 1) {
      const touch = e.touches[0];
      const dx = touch.clientX - dragStartRef.current.x;
      const dy = touch.clientY - dragStartRef.current.y;
      setTranslate({
        x: translateStartRef.current.x + dx,
        y: translateStartRef.current.y + dy,
      });
    }
  };

  const handleTouchEnd = () => {
    pinchStartDistRef.current = null;
    isDraggingRef.current = false;

    if (zoom > 1) return; // Don't swipe when zoomed

    if (touchStartRef.current) {
      const deltaX = (touchStartRef.current.x || 0) - (dragStartRef.current.x || touchStartRef.current.x);
      // Use the last known position - but for swipe we track differently
    }

    // Swipe detection (only when not zoomed)
    if (touchStartRef.current && zoom <= 1) {
      // We need the end position - let's use a simpler approach
    }
    touchStartRef.current = null;
  };

  const handleAreaClick = (e: React.MouseEvent) => {
    if (zoom > 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    if (clickX < rect.width / 2) {
      goPrev();
    } else {
      goNext();
    }
  };

  // Simplified swipe using onTouchStart/End directly on wrapper
  const swipeStartRef = useRef<number>(0);

  const onSwipeTouchStart = (e: React.TouchEvent) => {
    if (zoom > 1) return;
    swipeStartRef.current = e.touches[0].clientX;
  };

  const onSwipeTouchEnd = (e: React.TouchEvent) => {
    if (zoom > 1) return;
    const endX = e.changedTouches[0].clientX;
    const diff = swipeStartRef.current - endX;
    if (Math.abs(diff) > 60) {
      if (diff > 0) goNext();
      else goPrev();
    }
  };

  if (!images.length) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="z-[1100]" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-[1100] max-w-none w-screen h-screen p-0 border-none bg-black/95 rounded-none outline-none animate-in fade-in zoom-in-95 duration-200"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 safe-area-top" onClick={e => e.stopPropagation()}>
          <span className="text-white/80 text-sm font-medium backdrop-blur-sm bg-white/5 px-3 py-1 rounded-full">
            {currentIndex + 1} / {images.length}
          </span>
          <button
            onClick={() => onOpenChange(false)}
            className="text-white/90 hover:text-white p-2 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 transition-all"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Image area */}
        <div
          className="w-full h-full flex items-center justify-center overflow-hidden touch-none select-none cursor-pointer"
          onClick={handleAreaClick}
          onTouchStart={(e) => {
            handleTouchStart(e);
            onSwipeTouchStart(e);
          }}
          onTouchMove={handleTouchMove}
          onTouchEnd={(e) => {
            handleTouchEnd();
            onSwipeTouchEnd(e);
          }}
        >
          <img
            key={images[currentIndex]}
            src={optimizedImageUrl(images[currentIndex], 1200, 85)}
            alt=""
            className="max-w-full max-h-full object-contain transition-all duration-300 ease-out"
            style={{
              transform: `scale(${zoom}) translate(${translate.x / zoom}px, ${translate.y / zoom}px)`,
            }}
            draggable={false}
            onError={(e) => {
              const img = e.currentTarget;
              if (img.src !== images[currentIndex]) img.src = images[currentIndex];
            }}
          />
        </div>

        {/* Navigation arrows (desktop) */}
        {images.length > 1 && (
          <button
            onClick={goPrev}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 bg-white/10 backdrop-blur-sm hover:bg-white/25 text-white rounded-full p-2.5 transition-all hidden sm:flex shadow-lg"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {images.length > 1 && (
          <button
            onClick={goNext}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 bg-white/10 backdrop-blur-sm hover:bg-white/25 text-white rounded-full p-2.5 transition-all hidden sm:flex shadow-lg"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}

        {/* Dots */}
        {images.length > 1 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2" onClick={e => e.stopPropagation()}>
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => { setCurrentIndex(i); resetZoom(); }}
                className={cn(
                  'rounded-full transition-all duration-300',
                  i === currentIndex ? 'bg-white w-5 h-2.5 shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'bg-white/40 w-2.5 h-2.5 hover:bg-white/60'
                )}
              />
            ))}
          </div>
        )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
