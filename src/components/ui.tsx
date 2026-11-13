import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const variantClass: Record<Variant, string> = {
  primary: 'btn-shine bg-brass font-semibold text-ink shadow-[var(--shadow-gold)] hover:bg-brass-soft disabled:bg-brass-deep disabled:text-ink/70',
  secondary: 'border border-line-strong bg-surface/60 text-paper backdrop-blur-sm hover:border-brass/50 hover:bg-surface-2',
  ghost: 'text-muted hover:bg-surface hover:text-paper',
  danger: 'border border-danger/40 text-danger hover:bg-danger/10',
};
const base =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] disabled:cursor-not-allowed disabled:hover:scale-100';

export function Button({ variant = 'primary', className, ...props }: ComponentProps<'button'> & { variant?: Variant }) {
  return <button className={cx(base, variantClass[variant], className)} {...props} />;
}

export function ButtonLink({ variant = 'primary', className, ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={cx(base, variantClass[variant], className)} {...props} />;
}

export function Card({ className, children, ...props }: ComponentProps<'section'>) {
  return (
    <section className={cx('rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)] transition-colors duration-300 sm:p-6', className)} {...props}>
      {children}
    </section>
  );
}

export function CardTitle({ children, kicker, action }: { children: ReactNode; kicker?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        {kicker && <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-brass">{kicker}</p>}
        <h2 className="text-lg font-bold leading-snug text-paper sm:text-xl">{children}</h2>
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
  warn: 'border-warn/40 text-warn',
  danger: 'border-danger/40 text-danger',
};
export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium', toneClass[tone], className)}>
      {children}
    </span>
  );
}

export function PageHeader({ kicker, title, description, action }: { kicker?: string; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {kicker && <p className="mb-3 inline-flex items-center rounded-full border border-line bg-surface px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-brass">{kicker}</p>}
        <h1 className="text-3xl font-bold tracking-tight text-paper sm:text-4xl">{title}</h1>
        {description && <p className="mt-3 text-[15px] leading-relaxed text-muted">{description}</p>}
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

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-line-strong px-6 py-12 text-center">
      <p className="font-display text-lg font-bold text-paper">{title}</p>
      {children && <div className="mt-2 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Notice({ tone = 'brass', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div className={cx('rounded-lg border px-4 py-3 text-sm leading-relaxed', toneClass[tone], 'bg-surface')}>{children}</div>
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
