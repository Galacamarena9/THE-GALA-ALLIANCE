import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { currentRecruitOrg, loadCoachHome } from '@/lib/data/recruit';
import { coachActions, funnel } from '@/lib/domain/recruit';
import { logEvent } from '@/lib/events';
import { Badge, ButtonLink, Card, CardTitle, PageHeader } from '@/components/ui';
import { RecruitShell } from '@/components/recruit/RecruitShell';
import { AskGala } from '@/components/AskGala';

export const metadata: Metadata = { title: 'Recruiting' };

const ACTIVITY: Record<string, string> = {
  candidate_created: 'Nuevo candidato', stage_changed: 'Cambio de etapa', assigned: 'Asignación', shortlisted: 'Añadido a shortlist', unshortlisted: 'Quitado de shortlist',
  reviewed: 'Revisado', note_added: 'Nota interna', task_created: 'Tarea creada', task_done: 'Tarea hecha', info_requested: 'Información solicitada',
  info_shared: 'Información compartida', info_declined: 'Solicitud rechazada', document_accessed: 'Documento consultado', offer_recorded: 'Oferta registrada',
  member_added: 'Nuevo miembro', member_role_changed: 'Cambio de rol', member_removed: 'Miembro dado de baja', need_created: 'Necesidad creada',
  opportunity_status: 'Estado de oportunidad', ownership_transferred: 'Propiedad transferida', export: 'Exportación',
};
const PRIO = { urgent: 'danger', important: 'brass', recommended: 'neutral' } as const;

export default async function RecruitHome({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const session = await requireSession();
  const { org: wanted } = await searchParams;
  const { orgs, org } = await currentRecruitOrg(session.userId, wanted);
  const home = org ? await loadCoachHome(org) : null;
  if (org) void logEvent('coach_dashboard_viewed');
  const actions = org && home ? coachActions({
    verified: org.verified, hasPrograms: home.programs > 0, activeNeeds: home.needs.length,
    newApplications: home.candidates.filter((c) => c.source === 'application' && c.internal_stage === 'new').length,
    toReview: home.toReview, overdueTasks: home.overdueTasks, dueTodayTasks: home.dueTodayTasks, expiringOpportunities: home.expiring,
    sharedInfo: home.sharedInfo, members: home.members,
  }) : [];
  const f = home ? funnel(home.candidates.map((c) => c.internal_stage as string)) : [];

  return (
    <>
      <PageHeader kicker="Coach & University Portal" title={`Hola, ${session.displayName.split(' ')[0]}`} description="Qué necesita tu atención hoy, con datos reales de tu organización." />
      <RecruitShell org={org} orgs={orgs} active="/app/recruit">
        {org && home && (
          <div className="space-y-6">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                ['Oportunidades activas', home.activeOpportunities, '/app/opportunities?view=mine'],
                ['Necesidades activas', home.needs.length, '/app/recruit/needs'],
                ['Candidaturas nuevas', home.candidates.filter((c) => c.source === 'application' && c.internal_stage === 'new').length, '/app/recruit/candidates?stage=new'],
                ['Por revisar', home.toReview, '/app/recruit/shortlists'],
                ['En shortlists', home.shortlisted, '/app/recruit/shortlists'],
              ].map(([k, v, href]) => (
                <Link key={k as string} href={href as string} className="rounded-2xl border border-line bg-surface p-3 hover:border-brass/40">
                  <dt className="text-xs text-muted">{k}</dt><dd className="font-display text-2xl font-bold text-paper">{v}</dd>
                </Link>
              ))}
            </dl>

            <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
              <div className="min-w-0 space-y-6">
                <Card>
                  <CardTitle kicker="Ahora">Siguiente mejor acción</CardTitle>
                  {actions.length ? (
                    <ul className="space-y-2">
                      {actions.slice(0, 6).map((a, i) => (
                        <li key={a.key} className={`rounded-xl border p-3 ${i === 0 ? 'border-brass/40 bg-brass/5' : 'border-line'}`}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <Link href={a.href} className="text-sm font-semibold text-paper hover:text-brass">{a.title}</Link>
                            <Badge tone={PRIO[a.priority]}>{a.priority === 'urgent' ? 'Urgente' : a.priority === 'important' ? 'Importante' : 'Recomendado'}</Badge>
                          </div>
                          <p className="mt-0.5 text-xs text-muted">{a.reason}</p>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-muted">Todo al día.</p>}
                </Card>

                <Card>
                  <CardTitle kicker="Equipo" action={<Link href="/app/recruit/tasks" className="text-sm font-semibold text-brass">Todas</Link>}>Tareas abiertas</CardTitle>
                  {home.tasks.length ? (
                    <ul className="divide-y divide-line text-sm">
                      {home.tasks.slice(0, 6).map((t) => (
                        <li key={t.id} className="flex justify-between gap-2 py-2"><span className="text-paper">{t.title}</span><span className={`text-xs ${t.due_date && t.due_date < new Date().toISOString().slice(0, 10) ? 'font-semibold text-danger' : 'text-muted'}`}>{t.due_date ?? 'Sin fecha'}</span></li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-muted">Sin tareas abiertas.</p>}
                </Card>

                <Card>
                  <CardTitle kicker="Operativa">Embudo de recruiting</CardTitle>
                  {home.candidates.length ? (
                    <ol className="space-y-2" aria-label="Embudo">
                      {f.map((s) => (
                        <li key={s.key} className="flex items-center gap-3 text-sm">
                          <span className="w-44 shrink-0 text-muted">{s.label}</span>
                          <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-line"><span className="block h-full bg-brass" style={{ width: `${f[0].value ? (s.value / f[0].value) * 100 : 0}%` }} /></span>
                          <span className="w-10 text-right font-semibold text-paper">{s.value}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <ButtonLink href="/app/recruit/needs" variant="secondary">Crear necesidad</ButtonLink>
                      <ButtonLink href="/app/recruit/discover" variant="secondary">Descubrir atletas</ButtonLink>
                      <ButtonLink href="/app/opportunities/new" variant="secondary">Publicar oportunidad</ButtonLink>
                      <ButtonLink href="/app/organization#equipo" variant="secondary">Invitar al staff</ButtonLink>
                    </div>
                  )}
                  <p className="mt-3 text-[11px] text-faint">Métricas de proceso, no de personas: no se usan para puntuar al staff ni para clasificar atletas.</p>
                </Card>
              </div>

              <aside className="space-y-6" aria-label="Actividad">
                {home.expiring.length > 0 && (
                  <Card>
                    <CardTitle kicker="Plazos">Oportunidades que caducan</CardTitle>
                    <ul className="space-y-2 text-sm">{home.expiring.map((o) => <li key={o.id}><Link href={`/app/opportunities/${o.id}`} className="text-paper hover:text-brass">{o.title}</Link> <span className="text-xs text-danger">· {o.days} d</span></li>)}</ul>
                  </Card>
                )}
                <Card>
                  <CardTitle kicker="Historial">Actividad reciente del equipo</CardTitle>
                  {home.activity.length ? (
                    <ul className="space-y-2 text-sm">
                      {home.activity.map((a) => (
                        <li key={a.id}>
                          {a.athlete_id ? <Link href={`/app/recruit/candidates/${a.athlete_id}`} className="text-paper hover:text-brass">{ACTIVITY[a.kind] ?? a.kind}</Link> : <span className="text-paper">{ACTIVITY[a.kind] ?? a.kind}</span>}
                          <span className="block text-xs text-faint">{new Date(a.created_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-muted">Aquí verás lo que hace tu equipo: revisiones, notas, asignaciones y cambios de etapa.</p>}
                </Card>
                <details className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
                  <summary className="cursor-pointer font-semibold text-brass">Pregunta a Gala</summary>
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
