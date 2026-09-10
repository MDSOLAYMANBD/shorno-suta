import { useEffect, useRef, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { optimizedImageUrl } from '@/lib/imageUrl';
import { cn } from '@/lib/utils';

interface Props {
  src: string;
  alt?: string;
  children: ReactNode;
  /** Preview size in px (square). Default 256 desktop, capped on mobile. */
  size?: number;
  className?: string;
}

/**
 * Wraps a thumbnail with desktop-hover and mobile-long-press preview.
 * - Desktop: hover 200ms → show floating large image; leave → hide.
 * - Mobile: long-press 350ms → show; touchend / move / scroll → hide.
 */
export default function HoverImagePreview({ src, alt = '', children, size = 256, className }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const showTimer = useRef<number | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);

  const clearTimer = () => {
    if (showTimer.current !== null) {
      window.clearTimeout(showTimer.current);
      showTimer.current = null;
    }
  };

  const computePos = (clientX: number, clientY: number) => {
    const pad = 12;
    const isMobile = window.matchMedia('(max-width: 640px)').matches;
    const previewSize = isMobile ? Math.min(280, window.innerWidth - 32) : size;
    let left = clientX + 16;
    let top = clientY + 16;
    // Flip horizontally if overflow right
    if (left + previewSize + pad > window.innerWidth) {
      left = clientX - previewSize - 16;
    }
    if (left < pad) left = pad;
    // Flip vertically if overflow bottom
    if (top + previewSize + pad > window.innerHeight) {
      top = clientY - previewSize - 16;
    }
    if (top < pad) top = pad;
    return { left, top };
  };

  const handleMouseEnter = (e: React.MouseEvent) => {
    const x = e.clientX;
    const y = e.clientY;
    clearTimer();
    showTimer.current = window.setTimeout(() => {
      setPos(computePos(x, y));
      setOpen(true);
    }, 200);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (open) setPos(computePos(e.clientX, e.clientY));
  };

  const handleMouseLeave = () => {
    clearTimer();
    setOpen(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    touchStartPos.current = { x: t.clientX, y: t.clientY };
    clearTimer();
    showTimer.current = window.setTimeout(() => {
      setPos(computePos(t.clientX, t.clientY));
      setOpen(true);
    }, 350);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const t = e.touches[0];
    const start = touchStartPos.current;
    if (!t || !start) return;
    const dx = Math.abs(t.clientX - start.x);
    const dy = Math.abs(t.clientY - start.y);
    if (dx > 8 || dy > 8) {
      clearTimer();
      setOpen(false);
    }
  };

  const handleTouchEnd = () => {
    clearTimer();
    touchStartPos.current = null;
    // Slight delay so user actually sees it on tap-and-release; keep open until they tap elsewhere
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onScroll = () => setOpen(false);
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [open]);

  useEffect(() => () => clearTimer(), []);

  return (
    <>
      <span
        ref={wrapRef}
        className={cn('inline-block', className)}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {children}
      </span>
      {open && src && createPortal(
        <div
          className="fixed z-[1100] pointer-events-auto animate-in fade-in zoom-in-95 duration-150"
          style={{ left: pos.left, top: pos.top }}
          onMouseEnter={() => { clearTimer(); setOpen(true); }}
          onMouseLeave={() => setOpen(false)}
        >
          <div className="rounded-lg overflow-hidden border-2 border-background shadow-2xl bg-background">
            <img
              src={optimizedImageUrl(src, 600, 80)}
              alt={alt}
              className="block object-cover"
              style={{
                width: `min(${size}px, 80vw)`,
                height: `min(${size}px, 80vw)`,
              }}
              draggable={false}
              onError={(e) => {
                const img = e.currentTarget;
                if (img.src !== src) img.src = src;
              }}
            />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
