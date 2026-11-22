import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { myOrganizations } from '@/lib/data/orgs';
import { ATHLETE_STATUS_LABEL, PIPELINE_STATUSES, PIPELINE_STATUS_LABEL } from '@/lib/domain/labels';
import type { ApplicationStatus } from '@/lib/types';
import { Badge, ButtonLink, Card, EmptyState, PageHeader, inputClass } from '@/components/ui';
import { boardColumns, nextStatus } from '@/lib/domain/pipeline-board';
import { initials } from '@/lib/domain/portfolio';
import { addApplicationNote, moveApplication, withdrawApplication } from '@/app/actions/opportunities';

export const metadata: Metadata = { title: 'Candidaturas' };

export default async function ApplicationsPage() {
  const session = await requireSession(['athlete', 'university', 'coach']);
  const supabase = await createClient();
  const isRecruiter = session.roles.includes('university') || session.roles.includes('coach');

  if (isRecruiter) {
    const orgs = await myOrganizations(session.userId);
    const orgIds = orgs.map((o) => o.id);
    const { data: opps } = orgIds.length ? await supabase.from('opportunities').select('id, title').in('organization_id', orgIds) : { data: [] };
    const oppIds = (opps ?? []).map((o) => o.id);
    const { data: apps } = oppIds.length
      ? await supabase
          .from('applications')
          .select('id, status, athlete_message, created_at, athlete_id, opportunity_id, application_notes(id, body, created_at)')
          .in('opportunity_id', oppIds)
          .order('updated_at', { ascending: false })
      : { data: [] };
    const athleteIds = [...new Set((apps ?? []).map((a) => a.athlete_id))];
    const { data: names } = athleteIds.length ? await supabase.from('athlete_directory').select('user_id, display_name, graduation_year, current_team').in('user_id', athleteIds) : { data: [] };
    const nameById = new Map((names ?? []).map((n) => [n.user_id, n]));
    const oppById = new Map((opps ?? []).map((o) => [o.id, o.title]));
    const columns = boardColumns(apps ?? []);
    const total = apps?.length ?? 0;

    return (
      <>
        <PageHeader
          kicker="Recruiting"
          title="Candidatos"
          description="Cada candidatura avanza por cinco fases. Las notas son privadas de tu organización: el atleta solo ve en qué punto está."
          action={total ? <Badge tone="brass">{total} candidatura{total > 1 ? 's' : ''}</Badge> : undefined}
        />
        {total ? (
          <div className="-mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-4">
            {columns.map((col) => (
              <section key={col.key} aria-labelledby={`col-${col.key}`} className="flex w-[300px] shrink-0 snap-start flex-col rounded-[var(--radius-card)] border border-line bg-surface-2/60 p-3">
                <header className="mb-3 flex items-start justify-between gap-2 px-1">
                  <div>
                    <h2 id={`col-${col.key}`} className="font-display text-xl font-bold uppercase leading-none text-paper">{col.label}</h2>
                    <p className="mt-1 text-xs text-faint">{col.hint}</p>
                  </div>
                  <Badge tone={col.tone}>{col.items.length}</Badge>
                </header>
                {col.items.length ? (
                  <ul className="space-y-3">
                    {col.items.map((a) => {
                      const athlete = nameById.get(a.athlete_id);
                      const notes = (a.application_notes as unknown as { id: string; body: string }[]) ?? [];
                      const next = nextStatus(a.status as ApplicationStatus);
                      return (
                        <li key={a.id} className="hover-lift rounded-2xl border border-line bg-surface p-4 shadow-sm">
                          <div className="flex items-start gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-night font-display text-sm font-bold text-lime">{initials(athlete?.display_name ?? 'A')}</span>
                            <div className="min-w-0">
                              <Link href={`/athletes/${a.athlete_id}`} className="block truncate font-semibold text-paper hover:text-brass">{athlete?.display_name ?? 'Atleta'}</Link>
                              <p className="truncate text-xs text-faint">Promoción {athlete?.graduation_year ?? '—'}{athlete?.current_team ? ` · ${athlete.current_team}` : ''}</p>
                            </div>
                          </div>
                          <p className="mt-3 text-xs text-muted">{oppById.get(a.opportunity_id)}</p>
                          <div className="mt-2"><Badge tone={col.tone}>{PIPELINE_STATUS_LABEL[a.status as ApplicationStatus]}</Badge></div>
                          {a.athlete_message && <p className="mt-3 line-clamp-3 text-sm text-muted">“{a.athlete_message}”</p>}
                          {next && (
                            <form action={moveApplication} className="mt-3">
                              <input type="hidden" name="id" value={a.id} />
                              <input type="hidden" name="status" value={next} />
                              <button className="w-full rounded-xl bg-brass px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-brass-soft">Pasar a «{PIPELINE_STATUS_LABEL[next]}»</button>
                            </form>
                          )}
                          <details className="group mt-2">
                            <summary className="cursor-pointer list-none text-xs font-medium text-brass hover:underline">Más opciones{notes.length ? ` · ${notes.length} nota${notes.length > 1 ? 's' : ''}` : ''}</summary>
                            <form action={moveApplication} className="mt-2 flex gap-2">
                              <input type="hidden" name="id" value={a.id} />
                              <select name="status" defaultValue={a.status} aria-label="Mover a" className={`${inputClass} py-1.5`}>
                                {PIPELINE_STATUSES.map((st) => <option key={st} value={st}>{PIPELINE_STATUS_LABEL[st]}</option>)}
                              </select>
                              <button className="rounded-lg border border-line-strong px-3 text-xs text-paper hover:border-brass">Mover</button>
                            </form>
                            {notes.length > 0 && <ul className="mt-3 space-y-1 border-t border-line pt-2 text-xs text-muted">{notes.map((n) => <li key={n.id}>• {n.body}</li>)}</ul>}
                            <form action={addApplicationNote} className="mt-2 flex gap-2">
                              <input type="hidden" name="application_id" value={a.id} />
                              <input name="body" placeholder="Nota privada" aria-label="Nota privada" className={`${inputClass} py-1.5`} />
                              <button className="text-xs font-semibold text-brass">Añadir</button>
                            </form>
                          </details>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="rounded-xl border border-dashed border-line-strong px-3 py-6 text-center text-xs text-faint">Ninguna candidatura en esta fase</p>
                )}
              </section>
            ))}
          </div>
        ) : (
          <EmptyState title="Aún no hay candidaturas" action={<ButtonLink href="/app/opportunities/new">Publicar una beca</ButtonLink>}>Cuando un atleta se apunte a una de vuestras becas aparecerá aquí, en la fase «Nuevas».</EmptyState>
        )}
      </>
    );
  }

  const { data: apps } = await supabase
    .from('applications')
    .select('id, status, created_at, opportunities(id, title, organizations(name)), application_status_history(new_status, created_at)')
    .eq('athlete_id', session.userId)
    .order('created_at', { ascending: false });

  return (
    <>
      <PageHeader kicker="Mis candidaturas" title="Seguimiento" description="Cada paso, con fecha. Si una universidad te pide información, lo verás aquí." />
      {apps?.length ? (
        <ul className="space-y-4">
          {apps.map((a) => {
            const o = a.opportunities as unknown as { id: string; title: string; organizations: { name: string } | null } | null;
            const history = ((a.application_status_history as unknown as { new_status: ApplicationStatus; created_at: string }[]) ?? []).sort((x, y) => x.created_at.localeCompare(y.created_at));
            return (
              <li key={a.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link href={`/app/opportunities/${o?.id}`} className="font-display text-lg text-paper hover:text-brass">{o?.title}</Link>
                      <p className="text-sm text-muted">{o?.organizations?.name}</p>
                    </div>
                    <Badge tone={a.status === 'offer' || a.status === 'accepted' ? 'ok' : a.status === 'declined' ? 'danger' : 'brass'}>{ATHLETE_STATUS_LABEL[a.status as ApplicationStatus]}</Badge>
                  </div>
                  <ol className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
                    {history.map((h, i) => (
                      <li key={i} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-brass" aria-hidden />{ATHLETE_STATUS_LABEL[h.new_status]} · {new Date(h.created_at).toLocaleDateString('es-ES')}</li>
                    ))}
                  </ol>
                  {a.status !== 'withdrawn' && a.status !== 'accepted' && (
                    <form action={withdrawApplication} className="mt-4"><input type="hidden" name="id" value={a.id} /><button className="text-xs text-faint hover:text-danger">Retirar candidatura</button></form>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title="Aún no has aplicado a nada">Explora las <Link href="/app/opportunities" className="text-brass hover:underline">oportunidades</Link> y aplica con tu Passport.</EmptyState>
      )}
    </>
  );
}
