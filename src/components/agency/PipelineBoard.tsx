import Link from 'next/link';
import { groupByStage, nextStage, stageLabel, isCaseStale } from '@/lib/domain/agency-cases';
import { initials, dueText, isOverdue } from '@/lib/domain/portfolio';
import { moveCase } from '@/app/actions/agency-cases';
import { Badge, Card } from '@/components/ui';
import type { CaseRow } from '@/lib/data/agency-cases';

/** Tablero Kanban (13 fases) o tabla de procesos. Server component sin datos propios: lo usa la página y el probador. */
export function PipelineBoard({ cases, view, sportName, writableAgencies }: {
  cases: CaseRow[]; view: 'board' | 'table'; sportName: Map<string, string>; writableAgencies: Set<string>;
}) {
  const columns = groupByStage(cases);
  return view === 'board' ? (
        <div className="-mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-4">
          {columns.map((col) => (
            <section key={col.stage.id} aria-labelledby={`st-${col.stage.id}`} className={`relative flex shrink-0 snap-start flex-col rounded-[var(--radius-card)] border border-line p-3 ${col.items.length ? 'w-[280px] bg-surface-2/60' : 'w-[150px] bg-surface-2/30'}`}>
              <header className="mb-3 flex items-start justify-between gap-2 px-1">
                <div>
                  <h2 id={`st-${col.stage.id}`} className={`font-display font-bold uppercase leading-none ${col.items.length ? 'text-lg text-paper' : 'text-sm text-faint'}`}>{col.stage.label}</h2>
                  {col.items.length > 0 && <p className="mt-1 text-xs text-faint">{col.stage.hint}</p>}
                </div>
                <span className="rounded-full bg-night px-2 py-0.5 text-xs font-bold text-lime">{col.items.length}</span>
              </header>
              {col.items.length ? (
                <ul className="space-y-3">
                  {col.items.map((c) => {
                    const next = nextStage(c.stage as never);
                    const canMove = writableAgencies.has(c.agencyId);
                    return (
                      <li key={c.id} className="hover-lift rounded-2xl border border-line bg-surface p-4 shadow-sm">
                        <div className="flex items-start gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-night font-display text-sm font-bold text-lime">{initials(c.athleteName)}</span>
                          <div className="min-w-0">
                            <Link href={`/app/pipeline/${c.id}`} className="block truncate font-semibold text-paper hover:text-brass">{c.athleteName}</Link>
                            <p className="truncate text-xs text-muted">{c.institutionName}</p>
                            <p className="text-xs text-faint">{c.cycle}{c.sportId ? ` · ${sportName.get(c.sportId) ?? ''}` : ''}</p>
                          </div>
                        </div>
                        {c.nextAction && (
                          <p className={`mt-3 text-xs ${isOverdue(c.nextActionDue) ? 'text-danger' : 'text-muted'}`}>
                            {c.nextAction}{c.nextActionDue ? ` · ${dueText(c.nextActionDue)}` : ''}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {c.ownerName && <Badge>{c.ownerName}</Badge>}
                          {isCaseStale(c) && <Badge tone="danger">Parado</Badge>}
                          {c.sharedWithAthlete && <Badge tone="ok">Visible al atleta</Badge>}
                        </div>
                        {next && canMove && (
                          <form action={moveCase} className="mt-3">
                            <input type="hidden" name="id" value={c.id} />
                            <input type="hidden" name="stage" value={next} />
                            <button className="w-full rounded-xl bg-brass px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brass-soft">Pasar a «{stageLabel(next)}»</button>
                          </form>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="sr-only">Nada en esta fase</p>
              )}
            </section>
          ))}
        </div>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-line text-xs text-faint">
              <tr>{['Atleta', 'Universidad', 'Temporada', 'Fase', 'Responsable', 'Próxima acción', 'Actualizado'].map((h) => <th key={h} scope="col" className="px-4 py-3 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0 hover:bg-surface-2/60">
                  <td className="px-4 py-3"><Link href={`/app/pipeline/${c.id}`} className="font-semibold text-paper hover:text-brass">{c.athleteName}</Link></td>
                  <td className="px-4 py-3 text-muted">{c.institutionName}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{c.cycle}</td>
                  <td className="px-4 py-3"><Badge>{stageLabel(c.stage)}</Badge>{isCaseStale(c) && <Badge tone="danger" className="ml-1">Parado</Badge>}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{c.ownerName ?? '—'}</td>
                  <td className={`px-4 py-3 ${isOverdue(c.nextActionDue) ? 'text-danger' : 'text-muted'}`}>{c.nextAction ?? '—'}{c.nextActionDue ? ` · ${dueText(c.nextActionDue)}` : ''}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-faint">{c.updatedAt.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      );
}
