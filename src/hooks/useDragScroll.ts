import { useCallback, useEffect, useRef } from 'react';

/**
 * Smooth click-and-drag horizontal scroll for a chip strip (desktop mouse).
 * Mobile keeps native touch/momentum scroll. Suppresses the click that
 * follows a drag so chips don't navigate while panning.
 */
export function useDragScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const dragState = useRef({ active: false, startX: 0, startScroll: 0, moved: 0 });

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el || e.button !== 0) return;
    dragState.current = { active: true, startX: e.clientX, startScroll: el.scrollLeft, moved: 0 };
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragState.current.active) return;
      const el = ref.current;
      if (!el) return;
      const dx = e.clientX - dragState.current.startX;
      dragState.current.moved = Math.max(dragState.current.moved, Math.abs(dx));
      el.scrollLeft = dragState.current.startScroll - dx;
      if (dragState.current.moved > 4) e.preventDefault();
    };
    const onUp = () => {
      if (!dragState.current.active) return;
      const wasDrag = dragState.current.moved > 4;
      dragState.current.active = false;
      if (wasDrag) {
        const blocker = (ev: MouseEvent) => {
          ev.stopPropagation();
          ev.preventDefault();
          window.removeEventListener('click', blocker, true);
        };
        window.addEventListener('click', blocker, true);
        setTimeout(() => window.removeEventListener('click', blocker, true), 50);
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  return { ref, onMouseDown };
}
