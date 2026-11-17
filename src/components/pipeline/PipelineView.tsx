import Link from 'next/link';
import { AlertTriangle, CalendarClock, ListChecks } from 'lucide-react';
import { Badge, Card } from '@/components/ui';
import { quickMove, setArchived } from '@/app/actions/pipeline';
import { BOARD_STAGES, STAGE_INFO, URGENCY_INFO, URGENCY_RANK, summarize, type Stage } from '@/lib/domain/pipeline';
import type { ProcessRow } from '@/lib/data/pipeline';

const fmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
const d = (s: string) => fmt.format(new Date(`${s.slice(0, 10)}T12:00:00`));

export interface PipelineFilters { view: 'board' | 'list'; stage?: string; kind?: string; urgent?: boolean; archived?: boolean; sort: 'urgency' | 'updated' | 'deadline' | 'name' }

export function applyFilters(rows: ProcessRow[], f: PipelineFilters) {
  let out = rows.filter((r) => (f.archived ? r.archived_at : !r.archived_at));
  if (f.stage) out = out.filter((r) => r.status === f.stage);
  if (f.kind) out = out.filter((r) => r.target_kind === f.kind);
  if (f.urgent) out = out.filter((r) => r.urgency === 'overdue' || r.urgency === 'due_soon');
  const by: Record<PipelineFilters['sort'], (a: ProcessRow, b: ProcessRow) => number> = {
    urgency: (a, b) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] || b.updated_at.localeCompare(a.updated_at),
    updated: (a, b) => b.updated_at.localeCompare(a.updated_at),
    deadline: (a, b) => (a.official_deadline ?? a.next_action_due ?? '9999').localeCompare(b.official_deadline ?? b.next_action_due ?? '9999'),
    name: (a, b) => a.name.localeCompare(b.name, 'es'),
  };
  return [...out].sort(by[f.sort]);
}

function href(base: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...patch })) if (v) q.set(k, v);
  const s = q.toString();
  return `/app/process${s ? `?${s}` : ''}`;
}

function ProcessCard({ r, athlete, compact, editable }: { r: ProcessRow; athlete: string; compact?: boolean; editable: boolean }) {
  const u = URGENCY_INFO[r.urgency];
  return (
    <article className="rounded-xl border border-line bg-surface p-3 transition-colors hover:border-brass/40">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/app/process/${r.id}${athlete ? `?a=${athlete}` : ''}`} className="block truncate text-sm font-semibold text-paper hover:text-brass">{r.name}</Link>
          <p className="truncate text-xs text-muted">{r.target_kind === 'institution' ? 'Universidad' : 'Oportunidad'}{r.sub ? ` · ${r.sub}` : ''}</p>
        </div>
        {r.urgency !== 'ok' && r.urgency !== 'done' && <Badge tone={u.tone}>{u.label}</Badge>}
      </div>
      {r.next_action && (
        <p className="mt-2 text-xs text-paper"><span className="text-faint">Siguiente:</span> {r.next_action}{r.next_action_due ? ` · ${d(r.next_action_due)}` : ''}</p>
      )}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
        {r.official_deadline && <span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" aria-hidden />Plazo oficial {d(r.official_deadline)}</span>}
        {r.open_tasks > 0 && <span className="inline-flex items-center gap-1"><ListChecks className="h-3 w-3" aria-hidden />{r.open_tasks} tarea{r.open_tasks > 1 ? 's' : ''}</span>}
        {r.offers > 0 && <span>{r.offers} oferta{r.offers > 1 ? 's' : ''}</span>}
        {r.application && <span>Candidatura enviada</span>}
      </div>
      {r.urgencyReason && <p className="mt-1 text-[11px] text-faint">{r.urgencyReason}</p>}
      {!compact && editable && (
        <form action={quickMove} className="mt-2 flex items-center gap-2">
          <input type="hidden" name="id" value={r.id} /><input type="hidden" name="athlete" value={athlete} />
          <label className="sr-only" htmlFor={`mv-${r.id}`}>Mover {r.name} a</label>
          <select id={`mv-${r.id}`} name="status" defaultValue={['committed', 'closed'].includes(r.status) ? 'decision' : r.status} className="min-h-9 flex-1 rounded-lg border border-line bg-ink/40 px-2 text-xs text-paper">
            {(['discovered', 'saved', 'applied', 'contacted', 'call', 'offer', 'decision'] as Stage[]).map((s) => <option key={s} value={s}>{STAGE_INFO[s].label}</option>)}
          </select>
          <button className="min-h-9 rounded-lg border border-line px-2 text-xs font-semibold text-paper hover:border-brass hover:text-brass">Mover</button>
        </form>
      )}
    </article>
  );
}

export function PipelineView({ rows, f, athlete, params, editable }: { rows: ProcessRow[]; f: PipelineFilters; athlete: string; params: Record<string, string | undefined>; editable: boolean }) {
  const sum = summarize(rows);
  const list = applyFilters(rows, f);
  const archivedCount = rows.filter((r) => r.archived_at).length;
  const closed = rows.filter((r) => !r.archived_at && r.status === 'closed');

  return (
    <div className="space-y-5">
      {/* Resumen: solo cifras reales de tus procesos. */}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { k: 'En seguimiento', v: sum.total },
          { k: 'Activos', v: sum.active },
          { k: 'Vencidos', v: sum.overdue, warn: sum.overdue > 0 },
          { k: 'Esta semana', v: sum.dueSoon },
        ].map((s) => (
          <div key={s.k} className="rounded-2xl border border-line bg-surface p-3">
            <dt className="text-xs text-muted">{s.k}</dt>
            <dd className={`font-display text-2xl font-bold ${s.warn ? 'text-danger' : 'text-paper'}`}>{s.v}</dd>
          </div>
        ))}
      </dl>

      {/* Filtros y orden */}
      <nav aria-label="Vista y filtros" className="flex flex-wrap items-center gap-2 text-xs">
        <Link href={href(params, { view: undefined })} aria-current={f.view === 'board' ? 'page' : undefined} className={`rounded-full border px-3 py-1.5 font-semibold ${f.view === 'board' ? 'border-brass bg-brass/10 text-brass' : 'border-line text-muted'}`}>Tablero</Link>
        <Link href={href(params, { view: 'list' })} aria-current={f.view === 'list' ? 'page' : undefined} className={`rounded-full border px-3 py-1.5 font-semibold ${f.view === 'list' ? 'border-brass bg-brass/10 text-brass' : 'border-line text-muted'}`}>Lista</Link>
        <span className="mx-1 h-4 w-px bg-line" aria-hidden />
        <Link href={href(params, { urgent: f.urgent ? undefined : '1' })} className={`rounded-full border px-3 py-1.5 ${f.urgent ? 'border-brass text-brass' : 'border-line text-muted'}`}>Requiere atención</Link>
        <Link href={href(params, { kind: f.kind === 'institution' ? undefined : 'institution' })} className={`rounded-full border px-3 py-1.5 ${f.kind === 'institution' ? 'border-brass text-brass' : 'border-line text-muted'}`}>Universidades</Link>
        <Link href={href(params, { kind: f.kind === 'opportunity' ? undefined : 'opportunity' })} className={`rounded-full border px-3 py-1.5 ${f.kind === 'opportunity' ? 'border-brass text-brass' : 'border-line text-muted'}`}>Oportunidades</Link>
        <Link href={href(params, { archived: f.archived ? undefined : '1' })} className={`rounded-full border px-3 py-1.5 ${f.archived ? 'border-brass text-brass' : 'border-line text-muted'}`}>Archivados ({archivedCount})</Link>
        {f.view === 'list' && (
          <span className="ml-auto flex items-center gap-1 text-muted">Ordenar:
            {(['urgency', 'deadline', 'updated', 'name'] as const).map((s) => (
              <Link key={s} href={href(params, { sort: s === 'urgency' ? undefined : s })} className={f.sort === s ? 'font-semibold text-brass' : 'hover:text-paper'}>{{ urgency: 'urgencia', deadline: 'fecha', updated: 'recientes', name: 'nombre' }[s]}</Link>
            ))}
          </span>
        )}
      </nav>

      {sum.overdue > 0 && !f.urgent && (
        <p className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-paper" role="status">
          <AlertTriangle className="h-4 w-4 text-danger" aria-hidden />{sum.overdue} proceso{sum.overdue > 1 ? 's tienen' : ' tiene'} un paso vencido. <Link href={href(params, { urgent: '1', view: 'list' })} className="font-semibold text-brass underline underline-offset-2">Ver</Link>
        </p>
      )}

      {f.view === 'board' && !f.archived ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-2">
          <ol className="grid auto-cols-[minmax(240px,1fr)] grid-flow-col gap-3" aria-label="Tablero por etapas">
            {BOARD_STAGES.map((s) => {
              const items = list.filter((r) => r.status === s);
              return (
                <li key={s} className="rounded-2xl border border-line bg-ink/30 p-2.5">
                  <h3 className="mb-2 flex items-center justify-between px-1 text-xs font-bold uppercase tracking-wide text-faint">{STAGE_INFO[s].label}<span className="rounded-full bg-surface px-2 py-0.5 text-paper">{items.length}</span></h3>
                  <div className="space-y-2">
                    {items.map((r) => <ProcessCard key={r.id} r={r} athlete={athlete} editable={editable} />)}
                    {!items.length && <p className="px-1 py-3 text-xs text-faint">Vacío</p>}
                  </div>
                </li>
              );
            })}
          </ol>
          {closed.length > 0 && <p className="mt-2 text-xs text-muted">{closed.length} proceso{closed.length > 1 ? 's' : ''} cerrado{closed.length > 1 ? 's' : ''}. <Link href={href(params, { view: 'list', stage: 'closed' })} className="text-brass underline underline-offset-2">Ver</Link></p>}
        </div>
      ) : (
        <Card className="p-0">
          {list.length ? (
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Procesos de recruiting</caption>
              <thead className="border-b border-line text-xs text-faint">
                <tr><th scope="col" className="p-3">Proceso</th><th scope="col" className="hidden p-3 sm:table-cell">Etapa</th><th scope="col" className="hidden p-3 md:table-cell">Siguiente paso</th><th scope="col" className="p-3">Estado</th><th scope="col" className="p-3"><span className="sr-only">Acciones</span></th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((r) => (
                  <tr key={r.id}>
                    <td className="p-3"><Link href={`/app/process/${r.id}${athlete ? `?a=${athlete}` : ''}`} className="font-semibold text-paper hover:text-brass">{r.name}</Link><p className="text-xs text-muted">{r.sub}</p></td>
                    <td className="hidden p-3 sm:table-cell">{STAGE_INFO[r.status as Stage]?.label ?? r.status}</td>
                    <td className="hidden p-3 text-xs text-muted md:table-cell">{r.next_action ?? '—'}{r.next_action_due ? ` · ${d(r.next_action_due)}` : ''}{r.official_deadline ? <span className="block">Plazo oficial {d(r.official_deadline)}</span> : null}</td>
                    <td className="p-3"><Badge tone={URGENCY_INFO[r.urgency].tone}>{URGENCY_INFO[r.urgency].label}</Badge></td>
                    <td className="p-3 text-right">
                      {editable && (
                        <form action={setArchived}>
                          <input type="hidden" name="id" value={r.id} /><input type="hidden" name="athlete" value={athlete} /><input type="hidden" name="archive" value={r.archived_at ? '0' : '1'} />
                          <button className="text-xs text-muted hover:text-paper">{r.archived_at ? 'Recuperar' : 'Archivar'}</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="p-5 text-sm text-muted">No hay procesos con estos filtros.</p>}
        </Card>
      )}
    </div>
  );
}
