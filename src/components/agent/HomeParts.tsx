import Link from 'next/link';
import { ArrowRight, CalendarClock, CheckCircle2 } from 'lucide-react';
import { cx } from '@/components/ui';
import { AthleteAvatar } from '@/components/portfolio';
import {
  ATTENTION_LABEL, dueText, type AgentHomeSummary, type AthletePreviewRow, type AttentionItem, type DueState,
} from '@/lib/domain/agent-home';

/** Enlace de acción que registra el evento y lleva al destino (`/app/go` valida que sea una ruta interna). */
export const tracked = (kind: string, href: string) => `/app/go?k=${encodeURIComponent(kind)}&to=${encodeURIComponent(href)}`;

const BAR: Record<DueState, string> = { overdue: 'bg-danger', today: 'bg-danger', soon: 'bg-warn', upcoming: 'bg-line-strong', new: 'bg-brass' };
const DUE_TONE: Record<DueState, string> = { overdue: 'text-danger', today: 'text-danger', soon: 'text-warn', upcoming: 'text-muted', new: 'text-brass' };

/** Resumen: cinco cifras con contexto; cada una lleva a donde se resuelve. */
export function SummaryStrip({ s, className }: { s: AgentHomeSummary; className?: string }) {
  const items: { label: string; value: number; note: string; href: string; alert?: boolean }[] = [
    { label: 'Atletas', value: s.athletes, note: 'representados', href: '/app/portfolio' },
    { label: 'Necesitan atención', value: s.needAttention, note: 'acciones pendientes', href: '#hoy', alert: s.needAttention > 0 },
    { label: 'Oportunidades', value: s.activeOpportunities, note: 'abiertas que encajan', href: '/app/opportunities' },
    { label: 'Ofertas', value: s.offers, note: 'vivas', href: '/app/portfolio' },
    { label: 'Plazos hoy', value: s.deadlinesToday, note: s.deadlinesToday ? 'vencen hoy' : 'ninguno hoy', href: '#hoy', alert: s.deadlinesToday > 0 },
  ];
  return (
    <section aria-label="Resumen" className={cx('grid grid-cols-2 overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface sm:grid-cols-5', className)}>
      {items.map((i, n) => (
        <Link key={i.label} href={i.href} className={cx('group min-w-0 border-line px-5 py-5 transition-colors hover:bg-ink focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brass', n > 0 && 'sm:border-l', n % 2 === 1 && 'border-l sm:border-l', n >= 2 && 'border-t sm:border-t-0', n === 4 && 'col-span-2 sm:col-span-1')}>
          <span className="flex items-center gap-2 truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-muted"><i aria-hidden className="not-italic tabular-nums text-brass">{String(n + 1).padStart(2, '0')}</i>{i.label}</span>
          <span className={cx('mt-3 block font-display text-[48px] leading-none tabular-nums transition-colors', i.alert ? 'text-danger' : 'text-paper group-hover:text-brass')}>{i.value}</span>
          <span className="mt-1 block truncate text-xs text-faint">{i.note}</span>
        </Link>
      ))}
    </section>
  );
}

/** «Lo que toca hoy»: una fila por elemento, exactamente un botón de acción por fila. */
export function AttentionList({ items, today, limit = 6, className }: { items: AttentionItem[]; today: string; limit?: number; className?: string }) {
  const actionable = items.filter((i) => i.rank <= 4);
  const head = items.slice(0, limit);
  const rest = items.slice(limit);
  return (
    <section id="hoy" aria-labelledby="hoy-h" className={cx('scroll-mt-20 overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <h2 id="hoy-h" className="font-display text-xl text-paper">
          Lo que toca <em>hoy</em>
          {actionable.length > 0 && <span className="ml-2 rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">{actionable.length}</span>}
        </h2>
        <Link href="/app/pipeline" className="shrink-0 text-sm font-semibold text-brass hover:underline">Procesos</Link>
      </div>
      {items.length === 0 ? (
        <p className="flex items-center gap-2 px-5 py-6 text-sm text-muted"><CheckCircle2 className="h-5 w-5 text-ok" aria-hidden /> Todo al día: no hay ofertas que caduquen, vencidos, respuestas ni visitas pendientes.</p>
      ) : (
        <>
          <ol className="divide-y divide-line">{head.map((i) => <AttentionRow key={i.key} i={i} today={today} />)}</ol>
          {rest.length > 0 && (
            <details className="border-t border-line">
              <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-brass">Ver {rest.length} más</summary>
              <ol className="divide-y divide-line border-t border-line">{rest.map((i) => <AttentionRow key={i.key} i={i} today={today} />)}</ol>
            </details>
          )}
        </>
      )}
    </section>
  );
}

function AttentionRow({ i, today }: { i: AttentionItem; today: string }) {
  const primary = i.rank <= 2;
  return (
    <li className="relative flex flex-col gap-2 py-3 pl-5 pr-4 sm:flex-row sm:items-center sm:gap-3 sm:pr-5" data-kind={i.kind}>
      <span className={cx('absolute bottom-3 left-2 top-3 w-1 rounded-full', BAR[i.dueState])} aria-hidden />
      <span className="hidden sm:ml-1 sm:block"><AthleteAvatar name={i.athleteName} src={null} size="sm" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-paper sm:truncate">{i.title}</p>
        <p className="text-[13px] text-muted sm:truncate">
          <span className="font-medium text-paper/80">{i.athleteName}</span> · {i.context}
        </p>
        <p className="mt-0.5 text-xs">
          <span className="text-muted">{ATTENTION_LABEL[i.kind]}</span>
          {i.kind !== 'new_opportunity' && i.kind !== 'university_reply' && <> · <span className={cx('font-semibold', DUE_TONE[i.dueState])}>{dueText(i.due, today)}</span></>}
        </p>
      </div>
      <Link
        href={tracked(i.kind, i.cta.href)}
        data-cta="primary"
        className={cx(
          'inline-flex h-11 shrink-0 items-center justify-center rounded-lg px-3.5 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass sm:h-10',
          primary ? 'bg-brass text-ink hover:bg-brass-deep' : 'border border-line-strong text-paper hover:border-brass hover:text-brass',
        )}
      >
        {i.cta.label}
      </Link>
    </li>
  );
}

/** Pipeline en 6 fases; cada fase lleva al tablero de procesos. */
export function PipelineStrip({ stages, className }: { stages: { id: string; label: string; count: number }[]; className?: string }) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  const total = stages.reduce((n, s) => n + s.count, 0);
  return (
    <section aria-labelledby="pipe-h" className={cx('rounded-[var(--radius-card)] border border-line bg-surface', className)}>
      <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
        <h2 id="pipe-h" className="font-display text-xl text-paper">Procesos <em>por fase</em> <span className="text-sm font-normal text-muted">· {total} {total === 1 ? 'proceso' : 'procesos'}</span></h2>
        <Link href="/app/pipeline" className="text-sm font-semibold text-brass hover:underline">Tablero</Link>
      </div>
      <ol className="space-y-1 p-3">
        {stages.map((s) => (
          <li key={s.id}>
            <Link href="/app/pipeline" className="grid grid-cols-[110px_1fr_28px] items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-ink focus-visible:outline-2 focus-visible:outline-brass">
              <span className="truncate text-muted">{s.label}</span>
              <span className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden><span className="block h-full rounded-full bg-brass" style={{ width: `${(s.count / max) * 100}%` }} /></span>
              <span className="text-right font-semibold tabular-nums text-paper">{s.count}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

const rel = (iso: string | null, today: string) => {
  if (!iso) return '—';
  const n = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${iso.slice(0, 10)}T00:00:00Z`)) / 864e5);
  return n <= 0 ? 'hoy' : n === 1 ? 'ayer' : `hace ${n} días`;
};

/** Mis atletas: estado, siguiente acción, nº de procesos y última actividad. La fila entera abre la ficha. */
export function AthletesPreview({ rows, total, today, className }: { rows: AthletePreviewRow[]; total: number; today: string; className?: string }) {
  return (
    <section aria-labelledby="ath-h" className={cx('overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface', className)}>
      <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
        <h2 id="ath-h" className="font-display text-xl text-paper">Mis atletas</h2>
        <Link href="/app/portfolio" className="inline-flex items-center gap-1 text-sm font-semibold text-brass hover:underline">Ver los {total} <ArrowRight className="h-4 w-4" aria-hidden /></Link>
      </div>
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Tus atletas representados, primero los que necesitan atención</caption>
        <thead className="hidden text-xs text-muted lg:table-header-group">
          <tr className="border-b border-line">
            <th scope="col" className="px-5 py-2 font-semibold">Atleta</th>
            <th scope="col" className="px-3 py-2 font-semibold">Estado</th>
            <th scope="col" className="px-3 py-2 font-semibold">Siguiente acción</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">Procesos</th>
            <th scope="col" className="px-5 py-2 text-right font-semibold">Actividad</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.id} className="group relative hover:bg-ink">
              <td className="px-4 py-2.5 sm:px-5">
                <Link href={`/app/portfolio/${r.id}`} className="flex items-center gap-3 after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-brass">
                  <AthleteAvatar name={r.name} src={null} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-paper">{r.name}{r.needsAttention && <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-danger align-middle" aria-label="necesita atención" />}</span>
                    <span className="block truncate text-xs text-muted">{r.meta || '—'}</span>
                    <span className="block truncate text-xs text-muted lg:hidden">{r.status} · {r.nextAction ?? 'Sin siguiente paso'}</span>
                  </span>
                </Link>
              </td>
              <td className="hidden px-3 py-2.5 lg:table-cell"><span className="whitespace-nowrap rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-paper">{r.status}</span></td>
              <td className="hidden max-w-[240px] px-3 py-2.5 lg:table-cell">
                <span className="block truncate text-paper">{r.nextAction ?? <span className="text-muted">Sin siguiente paso</span>}</span>
                {r.nextDue && <span className="inline-flex items-center gap-1 text-xs text-muted"><CalendarClock className="h-3 w-3" aria-hidden />{dueText(r.nextDue, today)}</span>}
              </td>
              <td className="hidden px-3 py-2.5 text-right tabular-nums lg:table-cell">{r.processes}</td>
              <td className="hidden px-5 py-2.5 text-right text-xs text-muted lg:table-cell">{rel(r.lastActivityAt, today)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** Carga: misma silueta que la página para que nada salte al llegar los datos. */
export function AgentHomeSkeleton() {
  const bar = 'animate-pulse rounded-lg bg-surface-2';
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando tu inicio…</span>
      <div className={cx(bar, 'h-10 w-72')} />
      <div className={cx(bar, 'h-[84px]')} />
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-2 rounded-[var(--radius-card)] border border-line bg-surface p-4">{[0, 1, 2, 3].map((n) => <div key={n} className={cx(bar, 'h-14')} />)}</div>
        <div className={cx(bar, 'h-64')} />
      </div>
    </div>
  );
}
