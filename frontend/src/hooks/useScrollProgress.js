import { useState, useEffect, useRef } from 'react';

/**
 * High-performance hook for tracking scroll progress inside a container or window.
 * Uses requestAnimationFrame and passive event listeners to ensure 60fps buttery smooth transitions.
 */
export function useScrollProgress(containerRef) {
  const [progress, setProgress] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const rafId = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      if (rafId.current) return;

      rafId.current = requestAnimationFrame(() => {
        if (containerRef && containerRef.current) {
          const el = containerRef.current;
          const rect = el.getBoundingClientRect();
          const windowHeight = window.innerHeight;
          const totalScrollable = el.offsetHeight - windowHeight;

          if (totalScrollable > 0) {
            // How much of the container has been scrolled past the top
            const currentScroll = -rect.top;
            const rawFraction = currentScroll / totalScrollable;
            const clamped = Math.min(Math.max(rawFraction, 0), 1);
            setProgress(clamped);
          }
        } else {
          const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
          const current = window.scrollY;
          setProgress(maxScroll > 0 ? Math.min(Math.max(current / maxScroll, 0), 1) : 0);
        }

        setScrollY(window.scrollY);
        rafId.current = null;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
    };
  }, [containerRef]);

  return { progress, scrollY };
}

export default useScrollProgress;
