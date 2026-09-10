import { useEffect, useState } from 'react';

/** Eases a displayed number toward `target` over `duration` ms — used by
 * live-count badges so ticks feel smooth instead of jumping. */
export function useAnimatedNumber(target: number, duration = 700) {
  const [val, setVal] = useState(target);
  useEffect(() => {
    const start = performance.now();
    const from = val;
    if (from === target) return;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);
  return val;
}
