import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const variantClass: Record<Variant, string> = {
  primary: 'btn-shine bg-brass font-bold text-ink shadow-[var(--shadow-gold)] hover:bg-brass-soft disabled:bg-brass-deep disabled:text-ink/70',
  secondary: 'border border-line-strong bg-surface/60 text-paper backdrop-blur-sm hover:border-brass/50 hover:bg-surface-2',
  ghost: 'text-muted hover:bg-surface hover:text-paper',
  danger: 'border border-danger/40 text-danger hover:bg-danger/10',
};
const base =
  'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] disabled:cursor-not-allowed disabled:hover:scale-100';

type Size = 'sm' | 'md';
/** sm: acciones dentro de listas y tarjetas (mín. 36 px de alto); md: acción principal (mín. 44 px, táctil). */
const sizeClass: Record<Size, string> = {
  sm: 'min-h-9 rounded-full px-3.5 py-1.5 text-xs',
  md: 'min-h-11 rounded-full px-5 py-2.5 text-sm',
};

/** Clase única de botón para formularios de servidor y enlaces: toda la app usa la misma línea visual. */
export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cx(base, variantClass[variant], sizeClass[size], className);
}

export function Button({ variant = 'primary', size = 'md', className, ...props }: ComponentProps<'button'> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({ variant = 'primary', size = 'md', className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function Card({ className, children, ...props }: ComponentProps<'section'>) {
  return (
    <section className={cx('rounded-[var(--radius-card)] bg-surface p-5 shadow-[0_1px_2px_rgb(15_26_20/0.04),0_10px_28px_-16px_rgb(15_26_20/0.18)] ring-1 ring-line/60 transition-colors duration-300 sm:p-6', className)} {...props}>
      {children}
    </section>
  );
}

export function CardTitle({ children, kicker, action }: { children: ReactNode; kicker?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        {kicker && <p className="kicker mb-2">{kicker}</p>}
        <h2 className="font-display text-[22px] font-bold uppercase leading-none text-paper">{children}</h2>
      </div>
      {action}
    </div>
  );
}

type Tone = 'neutral' | 'brass' | 'ok' | 'warn' | 'danger';
const toneClass: Record<Tone, string> = {
  neutral: 'border-line-strong text-muted',
  brass: 'border-brass/40 bg-brass/10 text-brass',
  ok: 'border-ok/30 bg-ok/10 text-ok',
  warn: 'border-warn/40 bg-warn/10 text-warn',
  danger: 'border-danger/40 bg-danger/10 text-danger',
};
export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium', toneClass[tone], className)}>
      {children}
    </span>
  );
}

const STADIUM_PHOTOS = ['/media/club-training-sm.webp', '/media/hero-athletes-sm.webp', '/media/university-campus-sm.webp', '/media/arena-bg-sm.webp', '/media/agent-workspace-sm.webp'];

/** Foto de la banda «Estadio» estable por pantalla (misma pantalla, misma foto). */
export function stadiumPhoto(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return STADIUM_PHOTOS[h % STADIUM_PHOTOS.length];
}

/** Cabecera de pantalla v6 «Estadio»: banda verde con foto, etiqueta flúor y titular de marcador. */
export function PageHeader({ kicker, title, description, action, photo }: { kicker?: string; title: ReactNode; description?: ReactNode; action?: ReactNode; photo?: string }) {
  const seed = `${kicker ?? ''}${typeof title === 'string' ? title : ''}`;
  return (
    <header className="stadium mb-8 flex flex-col gap-5 px-6 py-7 sm:flex-row sm:items-end sm:justify-between sm:px-9 sm:py-9" style={{ ['--stadium-photo' as string]: `url(${photo ?? stadiumPhoto(seed)})` }}>
      <div className="min-w-0 max-w-4xl">
        {kicker && <p className="stadium-tag mb-4">{kicker}</p>}
        <h1 className="font-display text-[2.1rem] leading-[0.95] text-white sm:text-[2.6rem] lg:text-[3rem]">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">{description}</p>}
      </div>
      {action}
    </header>
  );
}

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: string; error?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-paper">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-faint">{hint}</p>}
      {error && <p className="text-xs text-danger" role="alert">{error}</p>}
    </div>
  );
}

export const inputClass =
  'w-full rounded-xl border border-line-strong bg-ink/60 px-3 py-2.5 text-sm text-paper placeholder:text-faint transition-all duration-200 hover:border-faint focus:border-brass/60 focus:outline-none focus:ring-2 focus:ring-brass/20';

/** Estado vacío «Estadio»: franja verde con foto propia arriba, titular de marcador y una acción clara. */
export function EmptyState({ title, children, action, photo }: { title: string; children?: ReactNode; action?: ReactNode; photo?: string }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] bg-surface text-center shadow-[0_1px_2px_rgb(15_26_20/0.04),0_10px_28px_-16px_rgb(15_26_20/0.18)] ring-1 ring-line/60">
      <div className="stadium flex h-24 items-center justify-center !rounded-none" style={{ ['--stadium-photo' as string]: `url(${photo ?? stadiumPhoto(title)})` }} aria-hidden>
        <span className="block h-4 w-12 -skew-x-12 bg-lime" />
      </div>
      <div className="flex flex-col items-center px-6 pb-10 pt-7">
        <p className="font-display text-[22px] font-bold uppercase leading-none text-paper">{title}</p>
        {children && <div className="mt-2 max-w-md text-sm text-muted">{children}</div>}
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}

export function Notice({ tone = 'brass', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cx('rounded-xl border px-4 py-3 text-sm leading-relaxed', toneClass[tone], tone === 'neutral' && 'bg-surface')}>{children}</div>
  );
}

export function Meter({ value, label }: { value: number; label: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs text-muted">
        <span>{label}</span>
        <span className="tabular-nums text-paper">{v}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="h-full rounded-full bg-brass transition-[width] duration-500" style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

export { cx };
