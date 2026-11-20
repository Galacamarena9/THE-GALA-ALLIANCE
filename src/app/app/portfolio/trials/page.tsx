import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { loadAgentTrials, type AgentRegistration } from '@/lib/data/trials';
import { logEvent } from '@/lib/events';
import { AVAILABILITY_LABEL, BOARD_GROUP_LABEL, OUTCOME_LABEL, TRIAL_STATUS_LABEL, boardGroup, eventWhen, feeLabel, type BoardGroup } from '@/lib/domain/trials';
import { OPPORTUNITY_TYPE_LABEL } from '@/lib/domain/labels';
import { Badge, ButtonLink, Card, CardTitle, EmptyState, Notice, PageHeader } from '@/components/ui';
import { TrialButton } from '@/components/trials/TrialButtons';

export const metadata: Metadata = { title: 'Trials de tu cartera' };

const GROUPS: BoardGroup[] = ['needs_athlete', 'waiting_club', 'confirmed', 'after_event', 'closed'];
const GROUP_TONE = { needs_athlete: 'warn', waiting_club: 'neutral', confirmed: 'ok', after_event: 'brass', closed: 'neutral' } as const;

function RegCard({ r }: { r: AgentRegistration }) {
  const d = r.opp?.details;
  return (
    <li className="rounded-xl border border-line bg-surface p-3">
      <p className="text-sm font-semibold text-paper">{r.athlete?.name ?? 'Atleta'}</p>
      {r.opp && <Link href={`/app/opportunities/${r.opp.id}`} className="block text-xs text-brass hover:underline">{r.opp.title} · {r.opp.org_name}</Link>}
      <p className="mt-1 text-[11px] text-muted">{eventWhen(d)} · {feeLabel(d)}</p>
      <p className="mt-1 text-xs text-paper">{TRIAL_STATUS_LABEL[r.status]}{r.outcome ? ` · ${OUTCOME_LABEL[r.outcome]}` : ''}</p>
      {r.needs_athlete_ok && <p className="mt-1 text-[11px] text-warn">El atleta debe aceptar el coste para que se envíe la inscripción.</p>}
      {r.guardian_status === 'pending' && <p className="mt-1 text-[11px] text-warn">Pendiente de aprobación familiar.</p>}
      {r.status === 'invited' && <p className="mt-1 text-[11px] text-warn">Invitación del club: el atleta decide si le interesa.</p>}
      {['invited', 'interested', 'registered', 'confirmed', 'waitlisted'].includes(r.status) && (
        <div className="mt-2"><TrialButton call={{ kind: 'respond', registration: r.id, action: 'withdraw' }} label="Retirar" variant="danger" confirm={`¿Retirar a ${r.athlete?.name ?? 'el atleta'} de este trial? Se avisará al atleta.`} /></div>
      )}
    </li>
  );
}

export default async function AgentTrialsPage() {
  const session = await requireSession(['agent']);
  const data = await loadAgentTrials(session.userId);
  void logEvent('agent_trials_viewed');

  if (!data.agencies.length) {
    return (
      <>
        <PageHeader kicker="Clubs & Academies" title="Trials de tu cartera" />
        <EmptyState title="Primero necesitas una agencia" action={<ButtonLink href="/app/organization">Crear agencia</ButtonLink>}>
          Los trials se gestionan para los atletas que tu agencia representa.
        </EmptyState>
      </>
    );
  }

  const byGroup = new Map<BoardGroup, AgentRegistration[]>(GROUPS.map((g) => [g, []]));
  for (const r of data.registrations) byGroup.get(boardGroup(r))!.push(r);
  const pending = byGroup.get('needs_athlete')!.length;

  return (
    <>
      <PageHeader
        kicker="Clubs & Academies"
        title="Trials de tu cartera"
        description="Todos los trials, pruebas y programas de tus representados en un solo sitio: qué falta, qué espera al club y qué hay abierto que encaje con cada atleta."
        action={<ButtonLink href="/app/portfolio" variant="secondary">Cartera</ButtonLink>}
      />

      {!data.athletes.length ? (
        <Notice tone="neutral">Aún no tienes representaciones activas. Cuando un atleta acepte tu representación aparecerá aquí.</Notice>
      ) : (
        <div className="space-y-8">
          {/* 1. Lo que necesita una acción: arriba y visible en móvil. */}
          <section aria-labelledby="board">
            <h2 id="board" className="mb-3 font-display text-xl text-paper">Seguimiento{pending ? <span className="ml-2 align-middle"><Badge tone="warn">{pending} esperan al atleta</Badge></span> : null}</h2>
            {data.registrations.length ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {GROUPS.map((g) => (
                  <section key={g} aria-label={BOARD_GROUP_LABEL[g]} className={`rounded-2xl border border-line bg-ink/30 p-2.5 ${byGroup.get(g)!.length ? '' : 'hidden xl:block'}`}>
                    <h3 className="mb-2 flex items-center justify-between px-1 text-xs font-bold uppercase tracking-wide text-faint">
                      {BOARD_GROUP_LABEL[g]}<Badge tone={GROUP_TONE[g]}>{byGroup.get(g)!.length}</Badge>
                    </h3>
                    <ul className="space-y-2">{byGroup.get(g)!.map((r) => <RegCard key={r.id} r={r} />)}</ul>
                    {!byGroup.get(g)!.length && <p className="px-1 py-2 text-xs text-faint">Vacío</p>}
                  </section>
                ))}
              </div>
            ) : <p className="text-sm text-muted">Ninguno de tus atletas está todavía en un trial. Abajo tienes los abiertos que encajan con ellos.</p>}
          </section>

          {/* 2. Trials abiertos que encajan con tus atletas. */}
          <section aria-labelledby="open">
            <h2 id="open" className="mb-1 font-display text-xl text-paper">Abiertos para tus atletas</h2>
            <p className="mb-3 text-sm text-muted">Solo de organizaciones verificadas. El encaje es por deporte, posición y promoción cuando el club los indica: no es una valoración del talento ni una probabilidad de selección.</p>
            {data.suggestions.length ? (
              <ul className="grid gap-4 lg:grid-cols-2">
                {data.suggestions.map(({ opp, fits }) => {
                  const d = opp.details;
                  const paid = d?.fee_type !== 'free';
                  return (
                    <li key={opp.id}>
                      <Card>
                        <CardTitle kicker={`${OPPORTUNITY_TYPE_LABEL[opp.type as keyof typeof OPPORTUNITY_TYPE_LABEL] ?? opp.type} · ${opp.org_name} ✓`}>
                          <Link href={`/app/opportunities/${opp.id}`} className="hover:text-brass">{opp.title}</Link>
                        </CardTitle>
                        {/* Transparencia antes de cualquier botón: cuándo, dónde, cuánto y qué incluye. */}
                        <dl className="grid grid-cols-2 gap-2 text-xs">
                          <div><dt className="text-faint">Cuándo</dt><dd className="text-paper">{eventWhen(d)}</dd></div>
                          <div><dt className="text-faint">Dónde</dt><dd className="text-paper">{[d?.city, d?.country].filter(Boolean).join(', ') || 'Sin indicar'}</dd></div>
                          <div><dt className="text-faint">Coste</dt><dd className={`font-semibold ${paid ? 'text-warn' : 'text-ok'}`}>{feeLabel(d)}</dd></div>
                          <div><dt className="text-faint">Plazo</dt><dd className="text-paper">{opp.deadline ?? 'Abierto'}</dd></div>
                          <div><dt className="text-faint">Alojamiento</dt><dd className="text-paper">{AVAILABILITY_LABEL[d?.accommodation ?? 'unknown']}</dd></div>
                          <div><dt className="text-faint">Viaje</dt><dd className="text-paper">{AVAILABILITY_LABEL[d?.travel ?? 'unknown']}</dd></div>
                        </dl>
                        <ul className="mt-4 divide-y divide-line border-t border-line">
                          {fits.map(({ athlete, fit, registered }) => (
                            <li key={athlete.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                              <span className="text-sm text-paper">{athlete.name}
                                <span className="block text-[11px] text-muted">✓ {fit.reasons.join(' · ')}{fit.missing.length ? ` · ⚠ ${fit.missing.join(', ')}` : ''}</span>
                              </span>
                              {registered ? <Badge tone="ok">Ya en seguimiento</Badge> : (
                                <TrialButton
                                  call={{ kind: 'register', opportunity: opp.id, athlete: athlete.id, agency: athlete.agencyId }}
                                  label={paid ? 'Proponer al atleta' : 'Inscribir'}
                                  variant="primary"
                                  confirm={paid
                                    ? `Tiene coste (${feeLabel(d)}). Se enviará como propuesta: ${athlete.name} debe aceptar el coste antes de que se inscriba.`
                                    : `¿Inscribir a ${athlete.name}? Se le avisará y podrá retirarse cuando quiera.`}
                                />
                              )}
                            </li>
                          ))}
                        </ul>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="text-sm text-muted">Ahora mismo no hay trials abiertos de organizaciones verificadas que encajen con tus atletas. No inventamos oportunidades: aparecerán aquí en cuanto se publiquen.</p>}
          </section>
        </div>
      )}
    </>
  );
}
