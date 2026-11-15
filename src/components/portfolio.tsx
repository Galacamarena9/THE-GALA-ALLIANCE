import Link from 'next/link';
import { SPORT_TONE_CLASS, sportTone } from '@/lib/domain/sport-tone';
import {
  CalendarCheck2, CalendarClock, FileSignature, StickyNote, UserCheck, UserMinus, UserX, Undo2, type LucideIcon,
} from 'lucide-react';
import { cx } from '@/components/ui';
import { CountUp } from '@/components/CountUp';
import {
  REP_META, dueText, initials, relativeTime,
  type EventKind, type NextStep, type RepStatus, type TimelineEvent,
} from '@/lib/domain/portfolio';

/* Componentes de presentación del Agent Workspace (sin estado, válidos en servidor). */

const PILL: Record<string, string> = {
  ok: 'bg-ok/10 text-ok ring-ok/25',
  warn: 'bg-warn/10 text-warn ring-warn/30',
  danger: 'bg-danger/10 text-danger ring-danger/25',
  neutral: 'bg-surface-2 text-muted ring-line-strong',
};

export function StatusPill({ status, className }: { status: RepStatus; className?: string }) {
  const m = REP_META[status];
  return (
    <span title={m.hint} className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset', PILL[m.tone], className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {m.label}
    </span>
  );
}

const AVATAR_SIZE = { sm: 'h-8 w-8 text-[11px]', md: 'h-10 w-10 text-xs', lg: 'h-14 w-14 text-base', xl: 'h-20 w-20 text-2xl' } as const;

/** Avatar del atleta. Sin foto, muestra sus iniciales sobre el color de su deporte (el deporte siempre va también en texto al lado). */
export function AthleteAvatar({ name, src, sport, size = 'md', className }: { name: string; src: string | null; sport?: string | null; size?: keyof typeof AVATAR_SIZE; className?: string }) {
  return (
    <span className={cx('relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold', SPORT_TONE_CLASS[sportTone(sport)], AVATAR_SIZE[size], className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatares de dominios variables
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

export function KpiTile({
  label, value, icon: Icon, hint, hintTone = 'muted', href,
}: { label: string; value: number; icon: LucideIcon; hint?: string; hintTone?: 'muted' | 'danger' | 'ok'; href?: string }) {
  const inner = (
    <div className="hover-lift group flex h-full flex-col items-start gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 transition-all duration-200 hover:border-brass/40 sm:flex-row sm:gap-4 sm:p-5">
      <span className="flex h-10 w-10 shrink-0 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-brass/10 text-brass ring-1 ring-brass/20 transition-transform group-hover:scale-105">
        <Icon className="h-5 w-5" aria-hidden strokeWidth={1.8} />
      </span>
      <span className="min-w-0">
        <span className="block text-xs text-muted">{label}</span>
        <CountUp value={value} className="mt-0.5 block font-display text-[34px] font-bold leading-none tabular-nums text-paper" />
        {hint && <span className={cx('mt-1.5 block text-[11px]', hintTone === 'danger' ? 'text-danger' : hintTone === 'ok' ? 'text-ok' : 'text-faint')}>{hint}</span>}
      </span>
    </div>
  );
  return href ? <Link href={href} className="block rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/50">{inner}</Link> : inner;
}

export function Panel({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-[var(--radius-card)] border border-line bg-surface', className)}>
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
        <h2 className="font-display text-xl font-bold uppercase leading-none text-paper">{title}</h2>
        {action}
      </header>
      <div className="p-2 sm:p-3">{children}</div>
    </section>
  );
}

export function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="text-xs font-medium text-brass hover:underline">{children}</Link>;
}

const EVENT_STYLE: Record<EventKind, { icon: LucideIcon; cls: string }> = {
  requested: { icon: FileSignature, cls: 'bg-warn/10 text-warn' },
  accepted: { icon: UserCheck, cls: 'bg-ok/10 text-ok' },
  declined: { icon: UserX, cls: 'bg-danger/10 text-danger' },
  withdrawn: { icon: Undo2, cls: 'bg-surface-2 text-muted' },
  ended: { icon: UserMinus, cls: 'bg-surface-2 text-muted' },
  note: { icon: StickyNote, cls: 'bg-brass/10 text-brass' },
  follow_up: { icon: CalendarClock, cls: 'bg-trust/15 text-trust' },
  follow_up_done: { icon: CalendarCheck2, cls: 'bg-ok/10 text-ok' },
};

export function ActivityFeed({ events, showAthlete = true, empty = 'Todavía no hay actividad.' }: { events: TimelineEvent[]; showAthlete?: boolean; empty?: string }) {
  if (!events.length) return <p className="px-3 py-8 text-center text-sm text-muted">{empty}</p>;
  return (
    <ol className="relative space-y-0.5">
      {events.map((ev) => {
        const { icon: Icon, cls } = EVENT_STYLE[ev.kind];
        const body = (
          <div className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface-2/60">
            <span className={cx('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', cls)}>
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-paper">{ev.title}</span>
              <span className="block truncate text-xs text-faint">
                {showAthlete ? `${ev.athleteName} · ` : ''}
                <time dateTime={ev.at}>{relativeTime(ev.at)}</time>
              </span>
              {ev.detail && <span className="mt-1 line-clamp-2 block text-xs text-muted">{ev.detail}</span>}
            </span>
          </div>
        );
        return (
          <li key={ev.id}>
            {showAthlete ? <Link href={`/app/portfolio/${ev.athleteId}`} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/50">{body}</Link> : body}
          </li>
        );
      })}
    </ol>
  );
}

export function NextStepsList({ steps, showAthlete = true, empty = 'Sin seguimientos pendientes.', action }: {
  steps: NextStep[]; showAthlete?: boolean; empty?: string; action?: (s: NextStep) => React.ReactNode;
}) {
  if (!steps.length) return <p className="px-3 py-8 text-center text-sm text-muted">{empty}</p>;
  return (
    <ul className="space-y-0.5">
      {steps.map((s) => (
        <li key={s.id} className="flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-2/60">
          <span className={cx('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', s.overdue ? 'bg-danger/10 text-danger' : s.dueToday ? 'bg-warn/10 text-warn' : 'bg-surface-2 text-muted')}>
            <CalendarClock className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 block text-sm font-medium text-paper">{s.title}</span>
            <span className="block text-xs text-faint">
              {showAthlete && <><Link href={`/app/portfolio/${s.athleteId}`} className="hover:text-brass hover:underline">{s.athleteName}</Link> · </>}
              <span className={s.overdue ? 'text-danger' : s.dueToday ? 'text-warn' : undefined}>{dueText(s.dueDate)}</span>
            </span>
          </span>
          {action?.(s)}
        </li>
      ))}
    </ul>
  );
}
