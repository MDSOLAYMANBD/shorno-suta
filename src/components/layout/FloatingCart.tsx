import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useCart } from '@/contexts/CartContext';
import { cn } from '@/lib/utils';

const POS_KEY = 'shorno-suta-floating-cart-pos';
const DRAG_THRESHOLD = 5;

type Pos = { x: number; y: number };

export default function FloatingCart() {
  const { totalItems, subtotal } = useCart();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [bump, setBump] = useState(false);
  const prev = useRef(totalItems);

  const [position, setPosition] = useState<Pos | null>(() => {
    try {
      const raw = localStorage.getItem(POS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  const [dragging, setDragging] = useState(false);
  const btnRef = useRef<HTMLAnchorElement>(null);
  const dragState = useRef<{
    startX: number; startY: number;
    baseX: number; baseY: number;
    offsetX: number; offsetY: number;
    moved: boolean; pointerId: number;
    lastX: number; lastY: number;
    rafId: number | null;
  } | null>(null);

  useEffect(() => {
    if (totalItems > prev.current) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 600);
      prev.current = totalItems;
      return () => clearTimeout(t);
    }
    prev.current = totalItems;
  }, [totalItems]);

  const clampPos = useCallback((x: number, y: number): Pos => {
    const el = btnRef.current;
    const w = el?.offsetWidth ?? 50;
    const h = el?.offsetHeight ?? 90;
    const pad = 4;
    const maxX = window.innerWidth - w - pad;
    const maxY = window.innerHeight - h - pad;
    return {
      x: Math.max(pad, Math.min(x, maxX)),
      y: Math.max(pad, Math.min(y, maxY)),
    };
  }, []);

  // Re-clamp on viewport resize
  useEffect(() => {
    if (!position) return;
    const onResize = () => {
      setPosition((p) => p ? clampPos(p.x, p.y) : p);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [position, clampPos]);

  const onPointerDown = (e: React.PointerEvent<HTMLAnchorElement>) => {
    if (e.button !== undefined && e.button !== 0) return;
    const el = btnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: rect.left,
      baseY: rect.top,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      moved: false,
      pointerId: e.pointerId,
      lastX: e.clientX,
      lastY: e.clientY,
      rafId: null,
    };
    try { el.setPointerCapture(e.pointerId); } catch {}
  };

  const applyTransform = useCallback(() => {
    const s = dragState.current;
    const el = btnRef.current;
    if (!s || !el) return;
    s.rafId = null;
    const target = clampPos(s.lastX - s.offsetX, s.lastY - s.offsetY);
    const dx = target.x - s.baseX;
    const dy = target.y - s.baseY;
    el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
  }, [clampPos]);

  const onPointerMove = (e: React.PointerEvent<HTMLAnchorElement>) => {
    const s = dragState.current;
    if (!s || s.pointerId !== e.pointerId) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (!s.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!s.moved) {
      s.moved = true;
      setDragging(true);
      const el = btnRef.current;
      if (el) el.style.willChange = 'transform';
    }
    e.preventDefault();
    s.lastX = e.clientX;
    s.lastY = e.clientY;
    if (s.rafId == null) {
      s.rafId = requestAnimationFrame(applyTransform);
    }
  };

  const finishDrag = (e: React.PointerEvent<HTMLAnchorElement>) => {
    const s = dragState.current;
    if (!s || s.pointerId !== e.pointerId) return;
    const wasDrag = s.moved;
    if (s.rafId != null) cancelAnimationFrame(s.rafId);
    const el = btnRef.current;
    try { el?.releasePointerCapture(e.pointerId); } catch {}
    if (wasDrag) {
      const final = clampPos(s.lastX - s.offsetX, s.lastY - s.offsetY);
      if (el) {
        el.style.transform = '';
        el.style.willChange = '';
      }
      dragState.current = null;
      setPosition(final);
      try { localStorage.setItem(POS_KEY, JSON.stringify(final)); } catch {}
      setDragging(false);
      e.preventDefault();
    } else {
      dragState.current = null;
    }
  };

  const onClick = (e: React.MouseEvent) => {
    if (dragging) {
      e.preventDefault();
      e.stopPropagation();
      // brief delay to clear flag
      setTimeout(() => setDragging(false), 0);
    }
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    try { localStorage.removeItem(POS_KEY); } catch {}
    setPosition(null);
  };

  if (pathname.startsWith('/cart') || pathname.startsWith('/checkout')) return null;

  const empty = totalItems === 0;
  const hasCustomPos = position !== null;

  return (
    <Link
      ref={btnRef}
      to="/cart"
      aria-label="View cart (drag to move, double-tap to reset)"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={(e) => e.preventDefault()}
      style={hasCustomPos ? {
        left: position!.x,
        top: position!.y,
        right: 'auto',
        transform: 'none',
        touchAction: 'none',
      } : { touchAction: 'none' }}
      className={cn(
        'flex fixed z-40 select-none',
        !hasCustomPos && 'right-2 lg:right-5 top-1/2 -translate-y-1/2',
        'flex-col items-center justify-center gap-0.5 lg:gap-1',
        'w-[46px] lg:w-[88px] py-1.5 lg:py-4 px-1 lg:px-2 rounded-xl lg:rounded-2xl',
        'bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground',
        'shadow-[0_10px_40px_-10px_hsl(var(--primary)/0.6)]',
        'ring-1 ring-primary-foreground/10',
        'transition-shadow duration-200',
        !dragging && 'transition-all duration-300 hover:scale-110 hover:shadow-[0_20px_50px_-10px_hsl(var(--primary)/0.8)] animate-in slide-in-from-right-8 fade-in duration-500',
        dragging && 'cursor-grabbing scale-105 shadow-[0_25px_60px_-10px_hsl(var(--primary)/0.9)] ring-2 ring-primary-foreground/40',
        !dragging && 'cursor-grab',
        empty && 'opacity-90',
        bump && !dragging && 'animate-bounce',
      )}
    >
      {!empty && !dragging && (
        <span className="absolute inset-0 rounded-xl lg:rounded-2xl bg-primary/40 animate-ping opacity-20 pointer-events-none" />
      )}

      <div className="relative pointer-events-none">
        <ShoppingBag className="h-4 w-4 lg:h-7 lg:w-7" strokeWidth={2.2} />
        {totalItems > 0 && (
          <span className="absolute -top-1.5 -right-2 min-w-[14px] h-3.5 lg:min-w-[20px] lg:h-5 px-1 rounded-full bg-background text-primary text-[8px] lg:text-[11px] font-bold flex items-center justify-center shadow-md ring-2 ring-primary">
            {totalItems}
          </span>
        )}
      </div>

      <div className="text-[8px] lg:text-[11px] font-medium opacity-95 leading-tight pointer-events-none">
        {totalItems > 0 ? `${totalItems}টি` : 'খালি'}
      </div>

      <div className="mt-0.5 px-1 lg:px-2 py-0.5 rounded-full bg-background/95 text-primary text-[9px] lg:text-[12px] font-bold shadow-inner pointer-events-none">
        ৳{subtotal.toLocaleString('en-US')}
      </div>
    </Link>
  );
}
