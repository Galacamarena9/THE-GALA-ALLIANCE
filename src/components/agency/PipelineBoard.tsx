import Link from 'next/link';
import { AlertTriangle, Clock, Hourglass } from 'lucide-react';
import { PIPELINE_BUCKETS, dueText } from '@/lib/domain/agent-home';
import { stageLabel } from '@/lib/domain/agency-cases';
import { ACTOR_LABEL, STATE_LABEL, TURN_LABEL, compareActions, type ActionState, type NextAction } from '@/lib/domain/next-action';
import { initials } from '@/lib/domain/portfolio';
import { Badge, Card } from '@/components/ui';
import type { CaseRow } from '@/lib/data/agency-cases';

const STATE_TONE: Record<ActionState, string> = {
  blocked: 'border-danger/50 bg-danger/10 text-danger',
  overdue: 'border-danger/50 bg-danger/10 text-danger',
  today: 'border-brass/50 bg-brass/10 text-brass',
  soon: 'border-brass/40 bg-brass/5 text-brass',
  ready: 'border-line-strong bg-surface-2 text-paper',
  waiting: 'border-line-strong bg-surface-2 text-muted',
  done: 'border-ok/40 bg-ok/10 text-ok',
};
const fallback = (c: CaseRow): NextAction => ({ key: 'none', action: c.nextAction ?? 'Revisar el proceso', actor: 'agent', due: c.nextActionDue, state: 'ready', blocker: null, cta: { label: 'Abrir proceso', href: `/app/pipeline/${c.id}` } });

/**
 * Pipeline en 5 fases (fase 9). Cada tarjeta: atleta, organización, contexto, UNA siguiente acción (motor determinista),
 * como mucho UN bloqueo y UN botón principal. Server component sin datos propios: lo usan la página y el probador.
 */
export function PipelineBoard({ cases, view, sportName, actions, today = new Date().toISOString().slice(0, 10) }: {
  cases: CaseRow[]; view: 'board' | 'table'; sportName: Map<string, string>; actions: Map<string, NextAction>; today?: string;
}) {
  const open = cases.filter((c) => c.stage !== 'closed');
  const closed = cases.length - open.length;
  const na = (c: CaseRow) => actions.get(c.id) ?? fallback(c);
  const columns = PIPELINE_BUCKETS.map((b) => ({
    ...b,
    items: open.filter((c) => (b.stages as readonly string[]).includes(c.stage)).sort((x, y) => compareActions(na(x), na(y)) || x.athleteName.localeCompare(y.athleteName, 'es')),
  }));

  if (view === 'table') {
    return (
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-line text-xs text-faint">
            <tr>{['Atleta', 'Organización', 'Fase', 'Siguiente acción', 'Quién', 'Plazo'].map((h) => <th key={h} scope="col" className="px-4 py-3 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {[...open].sort((x, y) => compareActions(na(x), na(y))).map((c) => {
              const a = na(c);
              return (
                <tr key={c.id} className="border-b border-line last:border-0 hover:bg-surface-2/60">
                  <td className="px-4 py-3"><Link href={`/app/pipeline/${c.id}`} className="font-semibold text-paper hover:text-brass">{c.athleteName}</Link></td>
                  <td className="px-4 py-3 text-muted">{c.institutionName}</td>
                  <td className="px-4 py-3"><Badge>{PIPELINE_BUCKETS.find((b) => (b.stages as readonly string[]).includes(c.stage))?.label ?? stageLabel(c.stage)}</Badge></td>
                  <td className="px-4 py-3 text-paper">{a.action}{a.blocker && <span className="block text-xs text-danger">{a.blocker}</span>}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{ACTOR_LABEL[a.actor]}</td>
                  <td className={`whitespace-nowrap px-4 py-3 ${a.state === 'overdue' ? 'text-danger' : 'text-muted'}`}>{a.due ? dueText(a.due, today) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    );
  }

  return (
    <>
      <div className="-mx-1 grid snap-x auto-cols-[minmax(260px,1fr)] grid-flow-col gap-4 overflow-x-auto px-1 pb-4 xl:grid-flow-row xl:grid-cols-5">
        {columns.map((col) => (
          <section key={col.id} aria-labelledby={`ph-${col.id}`} data-testid={`phase-${col.id}`} className="flex min-w-0 snap-start flex-col rounded-[var(--radius-card)] border border-line bg-surface-2/40 p-3">
            <header className="mb-3 flex items-center justify-between gap-2 px-1">
              <h2 id={`ph-${col.id}`} className="text-xl text-paper">{col.label}</h2>
              <span className="rounded-full bg-night px-2 py-0.5 text-xs font-bold text-brass">{col.items.length}</span>
            </header>
            {col.items.length ? (
              <ul className="space-y-3">
                {col.items.map((c) => {
                  const a = na(c);
                  const mine = a.actor === 'agent';
                  return (
                    <li key={c.id} data-testid="case-card" data-state={a.state} className="rounded-2xl border border-line bg-surface p-4">
                      <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-night font-display text-sm text-brass" aria-hidden>{initials(c.athleteName)}</span>
                        <div className="min-w-0">
                          <Link href={`/app/pipeline/${c.id}`} className="block truncate font-semibold text-paper hover:text-brass">{c.athleteName}</Link>
                          <p className="truncate text-sm text-muted">{c.institutionName}</p>
                          <p className="text-xs text-faint">{[c.cycle, c.sportId ? sportName.get(c.sportId) : null, stageLabel(c.stage)].filter(Boolean).join(' · ')}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${STATE_TONE[a.state]}`}>
                          {a.state === 'blocked' ? <AlertTriangle className="h-3 w-3" aria-hidden /> : a.state === 'waiting' ? <Hourglass className="h-3 w-3" aria-hidden /> : <Clock className="h-3 w-3" aria-hidden />}
                          {STATE_LABEL[a.state]}
                        </span>
                        <span className="text-xs text-muted">{TURN_LABEL[a.actor]}</span>
                      </div>
                      <p className="mt-2 text-sm text-paper" data-testid="next-action">{a.action}</p>
                      {a.blocker && <p className="mt-1 text-xs text-danger" data-testid="blocker">{a.blocker}</p>}
                      {a.due && <p className={`mt-1 text-xs ${a.state === 'overdue' ? 'text-danger' : 'text-faint'}`}>{dueText(a.due, today)}</p>}
                      <Link href={a.cta.href} data-testid="case-cta"
                        className={`mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-xl px-3 text-sm font-semibold ${mine && a.state !== 'done' ? 'bg-brass text-ink hover:bg-brass-soft' : 'border border-line-strong text-paper hover:border-brass'}`}>
                        {a.cta.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-1 text-sm text-faint">Nada en esta fase.</p>
            )}
          </section>
        ))}
      </div>
      {closed > 0 && <p className="mt-2 text-sm text-faint">{closed} {closed === 1 ? 'proceso cerrado' : 'procesos cerrados'} (no aparecen aquí; los ves en la ficha de cada atleta).</p>}
    </>
  );
}
