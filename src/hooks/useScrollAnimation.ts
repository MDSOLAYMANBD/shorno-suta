import { useEffect, useRef } from 'react';

export function useScrollAnimation() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    // Observe the element itself and all .animate-on-scroll children
    const targets = el.querySelectorAll('.animate-on-scroll');
    targets.forEach((t) => observer.observe(t));
    if (el.classList.contains('animate-on-scroll')) observer.observe(el);

    return () => observer.disconnect();
  }, []);

  return ref;
}
