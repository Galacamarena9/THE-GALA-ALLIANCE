import Link from 'next/link';
import { FileText, Search, ShieldCheck, UserRound } from 'lucide-react';
import { dueText } from '@/lib/domain/agent-home';
import { STATE_LABEL, TURN_LABEL, phaseOf, type NextAction } from '@/lib/domain/next-action';
import { THREAD_STATUS_LABEL, type InboxGroup } from '@/lib/domain/inbox';
import { Badge, EmptyState, PageHeader } from '@/components/ui';

const when = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

/** Bandeja única del agente: una fila por atleta con lo más urgente de sus procesos y sus conversaciones debajo. */
export function AgentInboxView({ groups, today = new Date().toISOString().slice(0, 10), tx = (s: string) => s }: { groups: InboxGroup[]; today?: string; tx?: (s: string) => string }) {
  return (
    <>
      <PageHeader kicker="Mensajes · Por atleta" title={<>Conversaciones que <em>avanzan</em></>} description="Una sola bandeja, ordenada por atleta. Cada conversación lleva su contexto: en qué fase está y qué toca hacer." />
      {!groups.length ? (
        <EmptyState title="Sin conversaciones todavía" action={<Link href="/app/portfolio" className="text-sm font-semibold text-brass underline underline-offset-4">Ir a mis atletas</Link>}>
          Cuando un atleta acepte tu representación o tu agencia abra una conversación, aparecerá aquí agrupada por atleta.
        </EmptyState>
      ) : (
        <ul className="space-y-4" aria-label="Conversaciones por atleta">
          {groups.map((g) => (
            <li key={g.athleteId} data-testid="inbox-group" className="rounded-[var(--radius-card)] border border-line bg-surface">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
                <div className="min-w-0">
                  <h2 className="text-2xl text-paper">{g.athleteName}</h2>
                  {g.isMinor && <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted"><ShieldCheck className="h-3.5 w-3.5 text-brass" aria-hidden />Menor: la familia ve la conversación</p>}
                  {g.awaiting > 0 && <p className="mt-1 text-xs font-semibold text-warn">{tx(g.awaiting === 1 ? '1 conversación espera tu respuesta' : `${g.awaiting} conversaciones esperan tu respuesta`)}</p>}
                </div>
                {g.top ? (
                  <div className="max-w-sm text-right" data-testid="group-context">
                    <p className="text-xs uppercase tracking-wide text-faint">{STATE_LABEL[g.top.state]} · {TURN_LABEL[g.top.actor].toLowerCase()}</p>
                    <p className="text-sm text-paper">{g.top.action}</p>
                    {g.top.due && <p className={`text-xs ${g.top.state === 'overdue' ? 'text-danger' : 'text-faint'}`}>{dueText(g.top.due, today)}</p>}
                  </div>
                ) : <p className="text-xs text-faint">Sin procesos abiertos</p>}
              </div>
              <ul className="divide-y divide-line">
                {g.threads.map((t) => (
                  <li key={t.id}>
                    {/* La contraparte es el atleta (y su familia si es menor), nunca tu propia agencia (QA agente, hallazgo 5). */}
                    <Link href={`/app/inbox/${t.id}`} data-testid="inbox-thread" data-unread={t.unread ? 'true' : undefined} data-awaiting={t.awaitingReply ? 'true' : undefined}
                      aria-label={[t.isMinor ? tx(`Conversación con ${t.athleteName} y su familia`) : tx(`Conversación con ${t.athleteName}`), t.unread ? tx('sin leer') : null, t.awaitingReply ? tx('te toca responder') : null].filter(Boolean).join(', ')}
                      className="flex min-h-14 items-center justify-between gap-3 px-5 py-3 hover:bg-surface-2/60">
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          {t.unread && <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-brass" aria-hidden />}
                          <span className={`truncate text-paper ${t.unread ? 'font-bold' : 'font-semibold'}`}>{t.isMinor ? tx(`${t.athleteName} y su familia`) : t.athleteName}</span>
                          {t.awaitingReply && <Badge tone="warn">{tx('Te toca responder')}</Badge>}
                        </span>
                        {t.excerpt && (
                          <span className="block truncate text-sm text-muted">
                            <span className="text-faint">{t.lastFrom === 'us' ? tx('Tu agencia') : t.lastFrom === 'family' ? tx('Familia') : t.athleteName.split(' ')[0]}: </span>{t.excerpt}
                          </span>
                        )}
                        <span className="text-xs text-faint">{THREAD_STATUS_LABEL[t.status] ?? t.status}</span>
                      </span>
                      <span className="shrink-0 text-xs text-faint">{when(t.lastMessageAt ?? t.createdAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export interface ThreadContextData {
  athleteId: string;
  athleteName: string;
  /** null = tu permiso en la representación no incluye ver procesos. */
  cases: { id: string; institution: string; stage: string; action: NextAction }[] | null;
  /** null = sin permiso de documentos. */
  docs: { title: string; status: string }[] | null;
  canMessage: boolean;
  canMessageReason: string | null;
}

/** Panel de contexto de una conversación del agente: fase, siguiente acción, oportunidades, proceso y documentos. */
export function ThreadContext({ d, today = new Date().toISOString().slice(0, 10) }: { d: ThreadContextData; today?: string }) {
  return (
    <aside aria-label="Contexto de la conversación" data-testid="thread-context" className="space-y-5 rounded-[var(--radius-card)] border border-line bg-surface p-5">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-brass">Contexto</p>
        <p className="mt-1 text-xl text-paper">{d.athleteName}</p>
      </div>
      {!d.canMessage && d.canMessageReason && <p role="status" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{d.canMessageReason}</p>}
      <section aria-labelledby="ctx-proc">
        <h3 id="ctx-proc" className="text-sm font-semibold text-paper">Procesos y siguiente acción</h3>
        {d.cases === null ? <p className="mt-1 text-sm text-muted">Tu permiso no incluye ver sus procesos.</p>
          : !d.cases.length ? <p className="mt-1 text-sm text-muted">Sin procesos abiertos.</p>
            : (
              <ul className="mt-2 space-y-3">
                {d.cases.map((c) => (
                  <li key={c.id} className="rounded-xl border border-line p-3">
                    <p className="text-sm font-semibold text-paper">{c.institution}</p>
                    <p className="text-xs text-faint">{phaseOf(c.stage)?.label ?? 'Cerrado'} · {STATE_LABEL[c.action.state]}</p>
                    <p className="mt-1 text-sm text-muted">{c.action.action}</p>
                    {c.action.blocker && <p className="mt-1 text-xs text-danger">{c.action.blocker}</p>}
                    {c.action.due && <p className="text-xs text-faint">{dueText(c.action.due, today)}</p>}
                    <Link href={c.action.cta.href} className="mt-2 inline-flex text-sm font-semibold text-brass hover:underline">{c.action.cta.label}</Link>
                  </li>
                ))}
              </ul>
            )}
      </section>
      <section aria-labelledby="ctx-docs">
        <h3 id="ctx-docs" className="text-sm font-semibold text-paper">Documentos pedidos</h3>
        {d.docs === null ? <p className="mt-1 text-sm text-muted">Tu permiso no incluye documentos.</p>
          : !d.docs.length ? <p className="mt-1 text-sm text-muted">Ninguno pendiente.</p>
            : <ul className="mt-2 space-y-1 text-sm">{d.docs.map((x) => <li key={x.title} className="flex items-center gap-2 text-muted"><FileText className="h-4 w-4 text-brass" aria-hidden />{x.title} · <span className="text-faint">{x.status}</span></li>)}</ul>}
      </section>
      <nav aria-label="Ir a" className="flex flex-col gap-2 border-t border-line pt-4 text-sm">
        <Link href={`/app/portfolio/${d.athleteId}`} className="inline-flex items-center gap-2 text-paper hover:text-brass"><UserRound className="h-4 w-4" aria-hidden />Ficha 360</Link>
        <Link href={`/app/opportunities/discover?athlete=${d.athleteId}`} className="inline-flex items-center gap-2 text-paper hover:text-brass"><Search className="h-4 w-4" aria-hidden />Oportunidades que encajan</Link>
        <Link href={`/app/portfolio/${d.athleteId}?tab=documentos`} className="inline-flex items-center gap-2 text-paper hover:text-brass"><FileText className="h-4 w-4" aria-hidden />Documentos</Link>
      </nav>
    </aside>
  );
}
