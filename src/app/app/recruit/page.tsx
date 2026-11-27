import { getT } from '@/lib/i18n/server-t';
import { dateLocale } from '@/lib/i18n/t';
import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { currentRecruitOrg, loadCoachHome } from '@/lib/data/recruit';
import { coachActions, funnel } from '@/lib/domain/recruit';
import { activeFilterCount, activityLine } from '@/lib/domain/recruit-search';
import { deleteOrgSearch, runOrgSearch } from '@/app/actions/saved-searches';
import { logEvent } from '@/lib/events';
import { Badge, ButtonLink, Card, CardTitle, PageHeader } from '@/components/ui';
import { RecruitShell } from '@/components/recruit/RecruitShell';
import { AskGala } from '@/components/AskGala';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('Recruiting') };
}

const ACTIVITY: Record<string, string> = {
  candidate_created: 'Nuevo candidato', stage_changed: 'Cambio de etapa', assigned: 'Asignación', shortlisted: 'Añadido a shortlist', unshortlisted: 'Quitado de shortlist',
  reviewed: 'Revisado', note_added: 'Nota interna', task_created: 'Tarea creada', task_done: 'Tarea hecha', info_requested: 'Información solicitada',
  info_shared: 'Información compartida', info_declined: 'Solicitud rechazada', document_accessed: 'Documento consultado', offer_recorded: 'Oferta registrada',
  member_added: 'Nuevo miembro', member_role_changed: 'Cambio de rol', member_removed: 'Miembro dado de baja', need_created: 'Necesidad creada',
  opportunity_status: 'Estado de oportunidad', ownership_transferred: 'Propiedad transferida', export: 'Exportación',
};
const PRIO = { urgent: 'danger', important: 'brass', recommended: 'neutral' } as const;

export default async function RecruitHome({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const tx = await getT();
  const session = await requireSession();
  const { org: wanted } = await searchParams;
  const { orgs, org } = await currentRecruitOrg(session.userId, wanted);
  const home = org ? await loadCoachHome(org) : null;
  if (org) void logEvent('coach_dashboard_viewed');
  const actions = org && home ? coachActions({
    verified: org.verified, hasPrograms: home.programs > 0, activeNeeds: home.needs.length,
    newApplications: home.candidates.filter((c) => c.source === 'application' && c.internal_stage === 'new').length,
    toReview: home.toReview, overdueTasks: home.overdueTasks, dueTodayTasks: home.dueTodayTasks, expiringOpportunities: home.expiring,
    sharedInfo: home.sharedInfo, members: home.members, trialApplications: home.trialApplications, upcomingTrial: home.upcomingTrial,
  }) : [];
  const f = home ? funnel(home.candidates.map((c) => c.internal_stage as string)) : [];

  return (
    <>
      <PageHeader kicker={tx('Club o universidad · Hoy')} title={`${tx('Hola')}, ${session.displayName.split(' ')[0]}`} description={tx('Qué perfiles necesitas, quién encaja y en qué punto va cada candidato. Con datos reales de tu organización.')} />
      <RecruitShell org={org} orgs={orgs} active="/app/recruit">
        {org && home && (
          <div className="space-y-6">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                [tx('Oportunidades activas'), home.activeOpportunities, '/app/opportunities?view=mine'],
                [tx('Necesidades activas'), home.needs.length, '/app/recruit/needs'],
                [tx('Candidaturas nuevas'), home.candidates.filter((c) => c.source === 'application' && c.internal_stage === 'new').length, '/app/recruit/candidates?stage=new'],
                [tx('Por revisar'), home.toReview, '/app/recruit/shortlists'],
                [tx('En shortlists'), home.shortlisted, '/app/recruit/shortlists'],
              ].map(([k, v, href]) => (
                <Link key={k as string} href={href as string} className="rounded-2xl border border-line bg-surface p-3 hover:border-brass/40">
                  <dt className="text-xs text-muted">{k}</dt><dd className="font-display text-2xl font-bold text-paper">{v}</dd>
                </Link>
              ))}
            </dl>

            <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
              <div className="min-w-0 space-y-6">
                <Card>
                  <CardTitle kicker={tx('Ahora')}>{tx('Siguiente mejor acción')}</CardTitle>
                  {actions.length ? (
                    <ul className="space-y-2">
                      {actions.slice(0, 6).map((a, i) => (
                        <li key={a.key} className={`rounded-xl border p-3 ${i === 0 ? 'border-brass/40 bg-brass/5' : 'border-line'}`}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <Link href={a.href} className="text-sm font-semibold text-paper hover:text-brass">{tx(a.title)}</Link>
                            <Badge tone={PRIO[a.priority]}>{tx(a.priority === 'urgent' ? 'Urgente' : a.priority === 'important' ? 'Importante' : 'Recomendado')}</Badge>
                          </div>
                          <p className="mt-0.5 text-xs text-muted">{tx(a.reason)}</p>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-muted">{tx('Estás al día: no hay nada urgente ahora mismo.')}</p>}
                </Card>

                <Card>
                  <CardTitle kicker={tx('Equipo')} action={<Link href="/app/recruit/tasks" className="text-sm font-semibold text-brass">{tx('Todas')}</Link>}>{tx('Tareas abiertas')}</CardTitle>
                  {home.tasks.length ? (
                    <ul className="divide-y divide-line text-sm">
                      {home.tasks.slice(0, 6).map((t) => (
                        <li key={t.id} className="flex justify-between gap-2 py-2"><span className="text-paper">{t.title}</span><span className={`text-xs ${t.due_date && t.due_date < new Date().toISOString().slice(0, 10) ? 'font-semibold text-danger' : 'text-muted'}`}>{t.due_date ?? tx('Sin fecha')}</span></li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-muted">{tx('Sin tareas abiertas.')}</p>}
                </Card>

                <Card>
                  <CardTitle kicker={tx('Operativa')}>{tx('Embudo de recruiting')}</CardTitle>
                  {home.candidates.length ? (
                    <ol className="space-y-2" aria-label={tx('Embudo')}>
                      {f.map((s) => (
                        <li key={s.key} className="flex items-center gap-3 text-sm">
                          <span className="w-44 shrink-0 text-muted">{tx(s.label)}</span>
                          <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-line"><span className="block h-full bg-brass" style={{ width: `${f[0].value ? (s.value / f[0].value) * 100 : 0}%` }} /></span>
                          <span className="w-10 text-right font-semibold text-paper">{s.value}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <ButtonLink href="/app/recruit/needs" variant="secondary">{tx('Crear necesidad')}</ButtonLink>
                      <ButtonLink href="/app/recruit/discover" variant="secondary">{tx('Descubrir atletas')}</ButtonLink>
                      <ButtonLink href="/app/opportunities/new" variant="secondary">{tx('Publicar oportunidad')}</ButtonLink>
                      <ButtonLink href="/app/organization#equipo" variant="secondary">{tx('Invitar al staff')}</ButtonLink>
                    </div>
                  )}
                  <p className="mt-3 text-[11px] text-faint">{tx('Métricas de proceso, no de personas: no se usan para puntuar al staff ni para clasificar atletas.')}</p>
                </Card>
              </div>

              <aside className="space-y-6" aria-label={tx('Actividad')}>
                {org.caps.has('discover') && (
                  <Card>
                    <CardTitle kicker={tx('Buscar')} action={<Link href="/app/recruit/discover" className="text-sm font-semibold text-brass">{tx('Nueva')}</Link>}>{tx('Búsquedas guardadas')}</CardTitle>
                    {home.savedSearches.length ? (
                      <ul className="divide-y divide-line text-sm" data-testid="saved-searches">
                        {home.savedSearches.map((s) => (
                          <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                            <form action={runOrgSearch} className="min-w-0 flex-1">
                              <input type="hidden" name="id" value={s.id} />
                              <button className="block w-full truncate text-left font-semibold text-paper hover:text-brass">{s.name}</button>
                              <span className="block text-xs text-faint">{activeFilterCount(s.filters) + (s.need_id ? 1 : 0)} {tx('filtros')} · {tx(s.visibility === 'team' ? 'Staff' : 'Privada')}</span>
                            </form>
                            {s.created_by === session.userId && (
                              <form action={deleteOrgSearch}><input type="hidden" name="id" value={s.id} /><button aria-label={`${tx('Archivar búsqueda')} ${s.name}`} className="min-h-11 px-2 text-xs text-muted hover:text-danger">×</button></form>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : <p className="text-sm text-muted">{tx('Guarda una búsqueda desde «Descubrir atletas» y lánzala desde aquí con un clic.')}</p>}
                  </Card>
                )}
                {home.expiring.length > 0 && (
                  <Card>
                    <CardTitle kicker={tx('Plazos')}>{tx('Oportunidades que caducan')}</CardTitle>
                    <ul className="space-y-2 text-sm">{home.expiring.map((o) => <li key={o.id}><Link href={`/app/opportunities/${o.id}`} className="text-paper hover:text-brass">{o.title}</Link> <span className="text-xs text-danger">· {o.days} d</span></li>)}</ul>
                  </Card>
                )}
                <Card>
                  <CardTitle kicker={tx('Historial')}>{tx('Actividad reciente del equipo')}</CardTitle>
                  {home.activityNamed.length ? (
                    <ul className="space-y-2 text-sm">
                      {home.activityNamed.map((a) => {
                        // Qué atleta y quién: «Marta añadió una nota sobre Lucía». Si el atleta ya no es visible, solo el tipo.
                        const line = activityLine(a.kind, a.actor, a.athlete, tx) ?? `${tx(ACTIVITY[a.kind] ?? a.kind)}${a.actor ? ` · ${a.actor}` : ''}`;
                        return (
                        <li key={a.id}>
                          {a.athlete_id ? <Link href={`/app/recruit/candidates/${a.athlete_id}`} className="text-paper hover:text-brass">{line}</Link> : <span className="text-paper">{line}</span>}
                          <span className="block text-xs text-faint">{new Date(a.created_at).toLocaleString(dateLocale(tx.locale), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        </li>
                        );
                      })}
                    </ul>
                  ) : <p className="text-sm text-muted">{tx('Aquí verás lo que hace tu equipo: revisiones, notas, asignaciones y cambios de etapa.')}</p>}
                </Card>
                <details className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
                  <summary className="cursor-pointer font-semibold text-brass">{tx('Pregunta a Gala')}</summary>
                  <div className="mt-4"><AskGala compact context="recruit" /></div>
                </details>
              </aside>
            </div>
          </div>
        )}
      </RecruitShell>
    </>
  );
}
