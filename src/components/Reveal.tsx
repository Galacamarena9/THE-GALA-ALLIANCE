'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Aparición suave al entrar en pantalla (equivalente ligero a framer-motion whileInView).
 * Respeta prefers-reduced-motion (globals.css) y, sin JavaScript, el contenido se ve desde el principio.
 */
export function Reveal({
  children,
  className = '',
  delay = 0,
  variant = 'up',
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  variant?: 'up' | 'left' | 'scale';
  as?: 'div' | 'li' | 'section' | 'article';
}) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const variantClass = variant === 'left' ? 'reveal-left' : variant === 'scale' ? 'reveal-scale' : '';
  return (
    <Tag
      ref={ref as never}
      className={`reveal ${variantClass} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
