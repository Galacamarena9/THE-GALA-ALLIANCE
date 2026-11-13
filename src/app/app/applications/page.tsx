import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { myOrganizations } from '@/lib/data/orgs';
import { ATHLETE_STATUS_LABEL, PIPELINE_STATUSES, PIPELINE_STATUS_LABEL } from '@/lib/domain/labels';
import type { ApplicationStatus } from '@/lib/types';
import { Badge, Card, EmptyState, PageHeader, inputClass } from '@/components/ui';
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
    const columns = PIPELINE_STATUSES.map((s) => ({ s, items: (apps ?? []).filter((a) => a.status === s) })).filter((c) => c.items.length);

    return (
      <>
        <PageHeader kicker="Recruiting" title="Pipeline" description="Las notas internas son privadas de tu organización: el atleta solo ve una línea temporal amable. Cada cambio de estado queda registrado." />
        {apps?.length ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {columns.map(({ s, items }) => (
              <section key={s} className="w-80 shrink-0">
                <h2 className="mb-3 flex items-center justify-between font-sans text-sm font-medium text-paper">{PIPELINE_STATUS_LABEL[s]}<span className="text-faint">{items.length}</span></h2>
                <ul className="space-y-3">
                  {items.map((a) => {
                    const athlete = nameById.get(a.athlete_id);
                    const notes = (a.application_notes as unknown as { id: string; body: string }[]) ?? [];
                    return (
                      <li key={a.id}>
                        <Card className="p-4 sm:p-4">
                          <Link href={`/athletes/${a.athlete_id}`} className="font-medium text-paper hover:text-brass">{athlete?.display_name ?? 'Atleta'}</Link>
                          <p className="text-xs text-faint">Clase {athlete?.graduation_year ?? '—'} · {oppById.get(a.opportunity_id)}</p>
                          {a.athlete_message && <p className="mt-2 line-clamp-3 text-sm text-muted">“{a.athlete_message}”</p>}
                          <form action={moveApplication} className="mt-3 flex gap-2">
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
                            <button className="text-xs text-brass">Añadir</button>
                          </form>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <EmptyState title="Aún no hay candidaturas">Publica una beca y revisa el talento compatible desde su ficha.</EmptyState>
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
