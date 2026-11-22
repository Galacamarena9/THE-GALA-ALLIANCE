'use client';

/*
 * Piezas de movimiento de la portada «Élite deportiva».
 * Todas respetan «reducir movimiento» (MotionConfig reducedMotion="user" + comprobación propia
 * en las que no son transformaciones) y dejan el contenido legible sin JavaScript.
 */
import {
  MotionConfig, animate, motion, useInView, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform,
} from 'motion/react';
import { useEffect, useRef, useState, type ReactNode, type PointerEvent } from 'react';

const EASE = [0.16, 1, 0.3, 1] as const;

export function MotionRoot({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

/** Titular que entra palabra a palabra. `parts` permite marcar palabras en <em> (serif dorada). */
export function WordsIn({ parts, className, delay = 0.15 }: { parts: (string | { em: string })[]; className?: string; delay?: number }) {
  const words: { text: string; em: boolean }[] = [];
  for (const p of parts) {
    if (typeof p === 'string') p.split(/\s+/).filter(Boolean).forEach((w) => words.push({ text: w, em: false }));
    else words.push({ text: p.em, em: true });
  }
  return (
    <span className={className}>
      {words.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
          <motion.span
            className="inline-block"
            initial={{ y: '105%' }}
            animate={{ y: '0%' }}
            transition={{ duration: 0.9, ease: EASE, delay: delay + i * 0.07 }}
          >
            {w.em ? <em>{w.text}</em> : w.text}
          </motion.span>
          {i < words.length - 1 ? ' ' : null}
        </span>
      ))}
    </span>
  );
}

/** Aparece al entrar en pantalla (desplazamiento corto + opacidad). */
export function Rise({ children, className, delay = 0, y = 32 }: { children: ReactNode; className?: string; delay?: number; y?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration: 0.8, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Fondo de portada con zoom lento y parallax al hacer scroll. */
export function ParallaxMedia({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '22%']);
  const scale = useTransform(scrollYProgress, [0, 1], [1.08, 1.18]);
  return (
    <div ref={ref} className={`absolute inset-0 overflow-hidden ${className ?? ''}`}>
      <motion.div className="absolute inset-0" style={{ y, scale }}>{children}</motion.div>
    </div>
  );
}

/** Cifra que cuenta hasta su valor al aparecer. */
export function CountUp({ to, suffix = '', prefix = '', className }: { to: number; suffix?: string; prefix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' });
  const reduce = useReducedMotion();
  const [val, setVal] = useState(to);
  useEffect(() => {
    if (!inView || reduce) return;
    const c = animate(0, to, { duration: 1.6, ease: EASE, onUpdate: (v) => setVal(Math.round(v)) });
    return () => c.stop();
  }, [inView, reduce, to]);
  return <span ref={ref} className={className}>{prefix}{val}{suffix}</span>;
}

/** Tarjeta que se inclina levemente siguiendo el ratón (solo con puntero fino). */
export function Tilt({ children, className }: { children: ReactNode; className?: string }) {
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const sx = useSpring(rx, { stiffness: 180, damping: 18 });
  const sy = useSpring(ry, { stiffness: 180, damping: 18 });
  const reduce = useReducedMotion();
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 7);
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 7);
  };
  const reset = () => { rx.set(0); ry.set(0); };
  return (
    <motion.div
      className={className}
      style={{ rotateX: sx, rotateY: sy, transformPerspective: 1000 }}
      onPointerMove={onMove}
      onPointerLeave={reset}
    >
      {children}
    </motion.div>
  );
}

/** Línea dorada que se dibuja al bajar por la sección. */
export function DrawLine({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 85%', 'end 40%'] });
  const scaleX = useTransform(scrollYProgress, [0, 1], [0, 1]);
  return (
    <div ref={ref} className={className} aria-hidden>
      <motion.div className="h-px w-full origin-left bg-gradient-to-r from-brass-deep via-brass to-transparent" style={{ scaleX }} />
    </div>
  );
}

/** Cabecera transparente sobre la portada que se vuelve sólida al hacer scroll. */
export function ScrollSolid({ children, className, solidClass }: { children: ReactNode; className: string; solidClass: string }) {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 24);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return <header className={`${className} ${solid ? solidClass : ''}`}>{children}</header>;
}
