'use client';

import { useEffect, useRef, useState } from 'react';

/** Cifra que sube desde 0 al aparecer en pantalla. Respeta "reducir movimiento" y sin JS muestra el valor final. */
export function CountUp({ value, duration = 900, className }: { value: number; duration?: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || value <= 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const run = () => {
      const t0 = performance.now();
      const step = (t: number) => {
        const p = Math.min(1, (t - t0) / duration);
        setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame((t) => { setShown(0); step(t); });
    };
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) { started.current = true; run(); io.disconnect(); }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value, duration]);

  return <span ref={ref} className={className} aria-label={String(value)}>{shown}</span>;
}
