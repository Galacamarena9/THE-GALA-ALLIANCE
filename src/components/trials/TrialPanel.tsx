import { Badge, Card, CardTitle } from '@/components/ui';
import { TrialButton } from './TrialButtons';
import {
  ATTENDANCE_LABEL, AVAILABILITY_LABEL, COST_TYPE_LABEL, INVITATION_STATUS_LABEL, OUTCOME_LABEL, REGISTRATION_STATUS_LABEL,
  capacityLabel, costLine, eventWhen, knownRequiredCost, money, priceLabel,
  type AttendanceStatus, type CostComponent, type InvitationStatus, type Outcome, type PriceStatus, type RegistrationStatus,
} from '@/lib/domain/trials';
import { REQUIRED_MATERIAL_LABEL } from '@/lib/domain/recruit';

export type PanelRegistration = {
  id: string; athlete_id: string; status: RegistrationStatus; origin: string; needs_athlete_ok: boolean; guardian_status: string; name: string;
  athlete_update: string | null; attendance: AttendanceStatus | null; check_in_at: string | null; outcome: Outcome | null;
  materials_status?: 'not_required' | 'pending' | 'complete';
};
export type PanelInvitation = { id: string; athlete_id: string; status: InvitationStatus; name: string; guardian_required: boolean };
export type PanelApplication = { id: string; athlete_id: string; status: string; name: string; guardian_consent_status: string; materials_complete?: boolean };

/** Filtros de participantes (móvil): uno a la vez, por URL (?pf=), para volver al mismo sitio tras actuar. */
export const PARTICIPANT_FILTERS = { all: 'Todos', confirmed: 'Confirmados', pending: 'Pendientes', docs: 'Docs. pendientes', waitlisted: 'Espera', cancelled: 'Cancelados' } as const;
export type ParticipantFilter = keyof typeof PARTICIPANT_FILTERS;
/** ¿Es el día del trial? (±18 h del inicio): se muestra el resumen de la puerta. */
function isTrialDay(startAt: string | null) {
  return !!startAt && Math.abs(new Date(startAt).getTime() - Date.now()) < 18 * 3600_000;
}
function matchesFilter(r: PanelRegistration, f: ParticipantFilter) {
  if (f === 'confirmed') return r.status === 'confirmed';
  if (f === 'pending') return r.status === 'pending' || r.status === 'registered';
  if (f === 'docs') return r.materials_status === 'pending' && !['cancelled', 'withdrawn'].includes(r.status);
  if (f === 'waitlisted') return r.status === 'waitlisted';
  if (f === 'cancelled') return r.status === 'cancelled' || r.status === 'withdrawn';
  return true;
}
export type PanelDetails = {
  trial_type?: string; registration_mode: 'direct' | 'application_required' | 'invitation_only'; capacity: number | null; price_status: PriceStatus;
  refundable: string; refund_policy: string | null; accommodation: string; meals: string; travel: string; minor_policy: string;
  equipment_requirements: string | null; video_requirements: string | null; additional_conditions: string | null;
};
export type PanelCore = { start_at: string | null; end_at: string | null; timezone: string | null; city: string | null; region: string | null; country: string | null; venue_name: string | null; age_category: string | null };
export type PanelRequirement = { kind: string; strength: 'required' | 'preferred' | 'informational'; label: string | null; params: Record<string, unknown> };
export type PanelMaterial = { material: string; label: string | null; required: boolean; sensitivity: string };

const REFUND: Record<string, string> = { yes: 'Reembolsable', no: 'No reembolsable', partial: 'Reembolso parcial', unknown: 'Reembolso sin indicar' };
const STRENGTH: Record<string, string> = { required: 'Obligatorio', preferred: 'Preferible', informational: 'Información' };

function requirementText(r: PanelRequirement) {
  const p = r.params as { min?: number; max?: number; min_cm?: number };
  if (r.kind === 'age') return `Edad ${p.min ?? '?'}–${p.max ?? '?'} años`;
  if (r.kind === 'birth_year') return `Nacidos entre ${p.min ?? '?'} y ${p.max ?? '?'}`;
  if (r.kind === 'height') return `Altura desde ${p.min_cm} cm`;
  return r.label ?? r.kind;
}

/**
 * Trial: transparencia antes del botón (quién, cuándo, dónde, cuánto —obligatorio vs opcional—, requisitos, qué pasa después)
 * y, según quién mira, inscribirse / responder a la invitación (atleta), aprobar (familia) o gestionar (club).
 */
export function TrialPanel({ opportunityId, open, details, core, costs, requirements, materials, confirmed, me, registrations, invitations, applications, asClub, asFamily, preview, participantFilter = 'all', filterHref, participantQuery = '' }: {
  opportunityId: string; open: boolean; details: PanelDetails | null; core: PanelCore; costs: CostComponent[]; requirements: PanelRequirement[]; materials: PanelMaterial[];
  confirmed: number; me: string | null; registrations: PanelRegistration[]; invitations: PanelInvitation[]; applications: PanelApplication[];
  asClub: boolean; asFamily: boolean; preview: boolean; participantFilter?: ParticipantFilter; filterHref?: (f: ParticipantFilter) => string; participantQuery?: string;
}) {
  const d = details;
  const price = d?.price_status ?? 'price_not_provided';
  const fee = priceLabel(price, costs);
  const known = knownRequiredCost(price, costs);
  const required = costs.filter((c) => c.required);
  const optional = costs.filter((c) => !c.required);
  const mine = me ? registrations.find((r) => r.athlete_id === me) : undefined;
  const myInvite = me ? invitations.find((i) => i.athlete_id === me && ['sent', 'viewed', 'interested'].includes(i.status)) : undefined;
  const myApp = me ? applications.find((a) => a.athlete_id === me) : undefined;
  const activeReg = (s: string) => ['pending', 'registered', 'confirmed', 'waitlisted'].includes(s);
  const guardianPending = asFamily ? registrations.filter((r) => r.guardian_status === 'pending') : [];
  const costPending = asFamily ? registrations.filter((r) => r.needs_athlete_ok) : [];
  const invitePending = asFamily ? invitations.filter((i) => i.guardian_required && ['sent', 'viewed', 'interested'].includes(i.status) && !registrations.some((r) => r.athlete_id === i.athlete_id)) : [];
  const canRegister = open && (d?.registration_mode === 'direct' || (d?.registration_mode === 'invitation_only' && !!myInvite) || (d?.registration_mode === 'application_required' && myApp?.status === 'accepted'));
  const costConfirm = `Coste obligatorio: ${known.total != null && known.currency ? money(known.total, known.currency) : known.total === 0 ? 'Gratis' : fee}. ¿Enviar la inscripción?`;

  return (
    <>
      <Card>
        <CardTitle kicker="Trial">Lo que tienes que saber</CardTitle>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-faint">Cuándo</dt><dd className="text-paper">{eventWhen(core.start_at, core.timezone)}</dd></div>
          <div><dt className="text-faint">Dónde</dt><dd className="text-paper">{[core.venue_name, core.city, core.region, core.country].filter(Boolean).join(', ') || 'Sin indicar'}</dd></div>
          <div><dt className="text-faint">Categoría</dt><dd className="text-paper">{core.age_category ?? 'Sin indicar'}</dd></div>
          <div><dt className="text-faint">Plazas</dt><dd className="text-paper">{d?.capacity != null ? capacityLabel(d.capacity, confirmed) : 'Capacidad no indicada'}</dd></div>
          <div><dt className="text-faint">Inscripción</dt><dd className="text-paper">{d?.registration_mode === 'invitation_only' ? 'Solo por invitación del club' : d?.registration_mode === 'application_required' ? 'Primero candidatura; el club acepta' : 'Directa'}</dd></div>
          <div><dt className="text-faint">Menores</dt><dd className="text-paper">{d?.minor_policy === 'adults_only' ? 'Solo mayores de edad' : 'Con aprobación de la familia'}</dd></div>
        </dl>

        <section aria-labelledby="costs" className="mt-4 rounded-xl border border-line p-3">
          <h3 id="costs" className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">Coste</h3>
          {price === 'free' ? <p className="text-sm font-semibold text-ok">Gratis</p>
            : price === 'price_not_provided' ? <p className="text-sm text-warn">La organización no ha indicado el coste. Pregunta antes de comprometerte.</p>
            : (
              <>
                <ul className="space-y-1 text-sm">
                  {required.map((c, i) => <li key={`r${i}`} className="flex justify-between gap-2"><span className="text-paper">{c.label || COST_TYPE_LABEL[c.component_type]}</span><span className="text-paper">{costLine(c)}</span></li>)}
                  {optional.map((c, i) => <li key={`o${i}`} className="flex justify-between gap-2"><span className="text-muted">{c.label || COST_TYPE_LABEL[c.component_type]} <span className="text-[11px]">(opcional)</span></span><span className="text-muted">{costLine(c)}</span></li>)}
                </ul>
                <p className="mt-2 border-t border-line pt-2 text-sm font-semibold text-paper">
                  Coste obligatorio conocido: {known.total != null && known.currency ? `${money(known.total, known.currency)}${known.basis ? ` (${known.basis})` : ''}` : <span className="font-normal text-warn">{known.reason}</span>}
                </p>
                <p className="mt-1 text-xs text-muted">{REFUND[d?.refundable ?? 'unknown']}{d?.refund_policy ? ` · ${d.refund_policy}` : ''}</p>
              </>
            )}
          <p className="mt-2 text-xs text-muted">Alojamiento: {AVAILABILITY_LABEL[d?.accommodation ?? 'unknown']} · Comidas: {AVAILABILITY_LABEL[d?.meals ?? 'unknown']} · Viaje: {AVAILABILITY_LABEL[d?.travel ?? 'unknown']}{d?.travel === 'not_included' ? ' (coste no incluido en el total)' : ''}</p>
        </section>

        {(requirements.length > 0 || materials.length > 0) && (
          <section aria-labelledby="reqs" className="mt-3">
            <h3 id="reqs" className="mb-1 text-xs font-semibold uppercase tracking-wider text-faint">Requisitos</h3>
            <ul className="space-y-1 text-sm">
              {requirements.map((r, i) => <li key={i} className="text-paper">{requirementText(r)} <span className="text-[11px] text-muted">· {STRENGTH[r.strength]}</span></li>)}
              {materials.map((m, i) => <li key={`m${i}`} className="text-paper">{m.label ?? REQUIRED_MATERIAL_LABEL[m.material] ?? m.material} <span className="text-[11px] text-muted">· {m.required ? 'Obligatorio' : 'Opcional'}{m.sensitivity === 'highly_restricted' ? ' · solo con tu permiso expreso' : ''}</span></li>)}
            </ul>
          </section>
        )}
        {d?.video_requirements && <p className="mt-2 text-xs text-muted">Vídeo: {d.video_requirements}</p>}
        {d?.equipment_requirements && <p className="mt-1 text-xs text-muted">Material: {d.equipment_requirements}</p>}
        {d?.additional_conditions && <p className="mt-1 text-xs text-muted">{d.additional_conditions}</p>}
        <p className="mt-3 text-[11px] text-faint">Después de inscribirte, el club confirma la plaza, te pone en lista de espera o no continúa. Inscribirse no garantiza plaza ni contrato y no comparte tus documentos privados.</p>
        {!d && <p className="mt-2 text-xs text-warn">La organización aún no ha completado los detalles. Pregunta antes de comprometerte.</p>}
      </Card>

      {/* Atleta */}
      {me && (
        <Card>
          <CardTitle kicker="Tu participación">{mine ? REGISTRATION_STATUS_LABEL[mine.status] : myInvite ? INVITATION_STATUS_LABEL[myInvite.status] : 'Inscripción'}</CardTitle>
          {myInvite && !mine && <p className="mb-2 text-sm text-paper">El club te ha invitado a valorar este trial. No es una oferta: revisa fecha, lugar y coste antes de responder.</p>}
          {mine?.athlete_update && <p className="mb-2 rounded-lg bg-surface-2 p-2 text-sm text-paper">Mensaje del club: {mine.athlete_update}</p>}
          {mine?.status === 'completed' && !mine.athlete_update && <p className="mb-2 text-sm text-muted">Trial completado. No tienes que hacer nada: si el club comparte novedades, las verás aquí.</p>}
          {mine?.status === 'waitlisted' && <p className="mb-2 text-sm text-muted">El club ha puesto tu inscripción en su lista de espera.</p>}
          {mine && ['pending', 'registered'].includes(mine.status) && mine.origin === 'application' && <p className="mb-2 text-sm text-paper">✓ El club ha aceptado tu candidatura <strong>para este trial</strong>. No es un fichaje ni una oferta: es una plaza para probar.</p>}
          {mine?.status === 'registered' && <p className="mb-2 text-sm text-muted">Inscrito. Falta que el club confirme tu plaza; te avisaremos.</p>}
          {mine?.status === 'confirmed' && <p className="mb-2 text-sm text-paper">Plaza confirmada: {eventWhen(core.start_at, core.timezone)}{core.city ? ` · ${[core.venue_name, core.city].filter(Boolean).join(', ')}` : ''}.</p>}
          {mine?.guardian_status === 'pending' && <p className="mb-2 text-sm text-warn">Esperando la aprobación de tu familia.</p>}
          <div className="flex flex-wrap gap-2">
            {myInvite && !mine && myInvite.status !== 'interested' && <TrialButton call={{ kind: 'invite', invitation: myInvite.id, action: 'interested', opportunity: opportunityId }} label="Me interesa" variant="primary" />}
            {myInvite && !mine && <TrialButton call={{ kind: 'invite', invitation: myInvite.id, action: 'declined', opportunity: opportunityId }} label="No me interesa" variant="danger" confirm="¿Rechazar la invitación? El club solo verá «rechazada»." />}
            {(!mine || mine.status === 'withdrawn') && canRegister && (!myInvite || myInvite.status === 'interested') && <TrialButton call={{ kind: 'register', opportunity: opportunityId, athlete: me }} label="Inscribirme" variant="primary" confirm={costConfirm} />}
            {mine?.needs_athlete_ok && <TrialButton call={{ kind: 'respond', registration: mine.id, action: 'confirm_cost', opportunity: opportunityId }} label="Aceptar coste e inscribirme" variant="primary" confirm={`Tu agente te propone este trial. ${costConfirm}`} />}
            {mine && activeReg(mine.status) && <TrialButton call={{ kind: 'respond', registration: mine.id, action: 'withdraw', opportunity: opportunityId }} label="Retirarme" variant="danger" confirm="¿Seguro? Se avisará al club." />}
            {!mine && !myInvite && open && d?.registration_mode === 'invitation_only' && <p className="text-sm text-muted">Este trial es solo por invitación del club.</p>}
            {!mine && open && d?.registration_mode === 'application_required' && myApp?.status !== 'accepted' && <p className="text-sm text-muted">{myApp ? 'Tu candidatura está en revisión. Si el club la acepta, podrás inscribirte.' : 'Primero presenta tu candidatura; si el club la acepta, podrás inscribirte.'}</p>}
            {!mine && !open && <p className="text-sm text-muted">La inscripción está cerrada.</p>}
          </div>
        </Card>
      )}

      {/* Familia */}
      {(guardianPending.length > 0 || costPending.length > 0 || invitePending.length > 0) && (
        <Card>
          <CardTitle kicker="Familia">Necesita tu decisión</CardTitle>
          <p className="mb-3 text-xs text-muted">Aprobar permite la participación en este trial concreto: el club verá el Opportunity Passport y el vídeo de tu hijo/a, no tus datos ni sus documentos privados. Coste obligatorio: {fee}.</p>
          <ul className="space-y-3">
            {invitePending.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-paper">Invitación del club para {i.name}</span>
                <span className="flex gap-2">
                  <TrialButton call={{ kind: 'invite', invitation: i.id, action: 'guardian_approve', opportunity: opportunityId }} label="Aprobar e inscribir" variant="primary" confirm={`¿Apruebas la participación? ${costConfirm}`} />
                  <TrialButton call={{ kind: 'invite', invitation: i.id, action: 'declined', opportunity: opportunityId }} label="No aprobar" variant="danger" />
                </span>
              </li>
            ))}
            {guardianPending.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-paper">{r.name} quiere participar</span>
                <span className="flex gap-2">
                  <TrialButton call={{ kind: 'respond', registration: r.id, action: 'guardian_approve', opportunity: opportunityId }} label="Aprobar" variant="primary" confirm={`¿Apruebas la participación? ${costConfirm}`} />
                  <TrialButton call={{ kind: 'respond', registration: r.id, action: 'guardian_decline', opportunity: opportunityId }} label="No aprobar" variant="danger" />
                </span>
              </li>
            ))}
            {costPending.filter((r) => !guardianPending.includes(r)).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-paper">Propuesta del agente para {r.name}</span>
                <TrialButton call={{ kind: 'respond', registration: r.id, action: 'confirm_cost', opportunity: opportunityId }} label="Aceptar coste" variant="primary" confirm={costConfirm} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Club */}
      {asClub && !preview && (
        <>
          {applications.length > 0 && (
            <Card id="candidaturas">
              <CardTitle kicker="Club">Candidaturas ({applications.length})</CardTitle>
              <ul className="divide-y divide-line">
                {applications.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="block text-paper">{a.name}</span>
                      <span className="block text-[11px] text-muted">
                        {a.guardian_consent_status === 'pending' ? 'Familia: pendiente' : a.guardian_consent_status === 'approved' ? 'Familia ✓' : 'Sin tutor requerido'}
                        {a.materials_complete != null ? ` · Documentos ${a.materials_complete ? '✓' : 'pendientes'}` : ''}
                      </span>
                    </span>
                    {['applied', 'reviewed', 'information_requested', 'waitlisted'].includes(a.status) ? (
                      <span className="flex flex-wrap gap-2">
                        <TrialButton call={{ kind: 'decide', application: a.id, decision: 'accepted', opportunity: opportunityId }} label="Aceptar" variant="primary" confirm={`¿Aceptar a ${a.name}? Familia: ${a.guardian_consent_status === 'pending' ? 'pendiente (no se confirmará la plaza hasta que apruebe)' : a.guardian_consent_status === 'approved' ? 'aprobada' : 'no requerida'}${a.materials_complete === false ? ' · Documentos pendientes' : ''}.`} />
                        {a.status !== 'waitlisted' && <TrialButton call={{ kind: 'decide', application: a.id, decision: 'waitlisted', opportunity: opportunityId }} label="Lista de espera" />}
                        <TrialButton call={{ kind: 'decide', application: a.id, decision: 'declined', opportunity: opportunityId }} label="No continuar" variant="danger" confirm="Se avisará al atleta." />
                      </span>
                    ) : <Badge tone="neutral">{a.status === 'accepted' ? 'Aceptada' : a.status === 'declined' ? 'No continúa' : a.status}</Badge>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card id="participantes">
            <CardTitle kicker="Club">Participantes ({registrations.length}) · {capacityLabel(d?.capacity, confirmed)}</CardTitle>
            {/* Día del trial: la cuenta que importa en la puerta (confirmados, con check-in y los que faltan). */}
            {isTrialDay(core.start_at) && (
              <dl className="mb-3 grid grid-cols-3 gap-2 text-center" aria-label="Hoy">
                {[['Confirmados', registrations.filter((r) => r.status === 'confirmed' || r.status === 'completed').length],
                  ['Con check-in', registrations.filter((r) => r.check_in_at || r.attendance === 'attended').length],
                  ['Faltan', registrations.filter((r) => r.status === 'confirmed' && !r.check_in_at && !r.attendance).length]].map(([k, n]) => (
                  <div key={k as string} className="rounded-xl bg-ink/40 p-2"><dt className="text-[10px] text-faint">{k}</dt><dd className="font-display text-xl font-bold text-paper">{n}</dd></div>
                ))}
              </dl>
            )}
            {filterHref && registrations.length > 8 && (
              <form method="get" className="mb-2" role="search">
                <input type="hidden" name="pf" value={participantFilter} />
                <label htmlFor="pq" className="sr-only">Buscar participante</label>
                <input id="pq" name="pq" type="search" defaultValue={participantQuery} placeholder="Buscar por nombre…" className="min-h-11 w-full rounded-xl border border-line bg-ink/40 px-3 text-sm text-paper" />
              </form>
            )}
            {filterHref && registrations.length > 0 && (
              <nav aria-label="Filtrar participantes" className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
                {(Object.keys(PARTICIPANT_FILTERS) as ParticipantFilter[]).map((f) => {
                  const n = registrations.filter((r) => matchesFilter(r, f)).length;
                  return <a key={f} href={filterHref(f)} aria-current={participantFilter === f ? 'true' : undefined}
                    className={`inline-flex min-h-9 shrink-0 items-center rounded-full border px-3 text-xs ${participantFilter === f ? 'border-brass bg-brass/10 text-brass' : 'border-line text-muted'}`}>{PARTICIPANT_FILTERS[f]} · {n}</a>;
                })}
              </nav>
            )}
            {invitations.length > 0 && <p className="mb-2 text-xs text-muted">Invitaciones: {invitations.filter((i) => ['sent', 'viewed'].includes(i.status)).length} sin respuesta · {invitations.filter((i) => i.status === 'interested').length} interesados · {invitations.filter((i) => i.status === 'declined').length} rechazadas</p>}
            {registrations.length ? (
              <ul className="divide-y divide-line">
                {registrations.filter((r) => matchesFilter(r, participantFilter) && (!participantQuery || r.name.toLowerCase().includes(participantQuery.toLowerCase()))).map((r) => (
                  <li key={r.id} className="py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm text-paper">{r.name}<span className="ml-2 text-[11px] text-faint">{r.origin === 'agent' ? 'vía agente' : r.origin === 'club_invite' ? 'invitado' : r.origin === 'application' ? 'por candidatura' : ''}</span></span>
                      <Badge tone={r.status === 'confirmed' ? 'ok' : r.status === 'cancelled' || r.status === 'withdrawn' ? 'neutral' : 'brass'}>{REGISTRATION_STATUS_LABEL[r.status]}</Badge>
                    </div>
                    <p className="mt-1 text-[11px] text-muted">
                      {r.guardian_status === 'pending' ? 'Aprobación familiar pendiente · ' : r.guardian_status === 'approved' ? 'Familia ✓ · ' : ''}
                      {r.materials_status === 'pending' ? 'Documentos pendientes · ' : r.materials_status === 'complete' ? 'Documentos ✓ · ' : ''}
                      {r.attendance ? `${ATTENDANCE_LABEL[r.attendance]}${r.check_in_at ? ` · ${new Date(r.check_in_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : ''}` : ''}
                      {r.outcome ? ` · ${OUTCOME_LABEL[r.outcome]} (interno)` : ''}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {['registered', 'waitlisted'].includes(r.status) && <TrialButton call={{ kind: 'club', registration: r.id, action: 'confirm', opportunity: opportunityId }} label="Confirmar plaza" variant="primary" />}
                      {r.status === 'registered' && <TrialButton call={{ kind: 'club', registration: r.id, action: 'waitlist', opportunity: opportunityId }} label="Lista de espera" />}
                      {['pending', 'registered', 'waitlisted', 'confirmed'].includes(r.status) && <TrialButton call={{ kind: 'club', registration: r.id, action: 'decline', opportunity: opportunityId }} label="No continuar" variant="danger" confirm="Se avisará al atleta (y a su agente si lo tiene)." />}
                      {r.status === 'confirmed' && <>
                        <TrialButton call={{ kind: 'club', registration: r.id, action: 'check_in', opportunity: opportunityId }} label="Check-in" variant="primary" />
                        <TrialButton call={{ kind: 'club', registration: r.id, action: 'no_show', opportunity: opportunityId }} label="No se presentó" variant="danger" confirm="Solo si el trial ya empezó y comprobaste la lista." />
                      </>}
                      {r.status === 'completed' && !r.outcome && <>
                        <TrialButton call={{ kind: 'club', registration: r.id, action: 'outcome', outcome: 'start_recruiting_process', opportunity: opportunityId }} label="Iniciar recruiting" variant="primary" confirm="Crea o reutiliza el proceso en tu pipeline (origen: trial). No crea ninguna oferta." />
                        <TrialButton call={{ kind: 'club', registration: r.id, action: 'outcome', outcome: 'follow_up', opportunity: opportunityId }} label="Seguimiento" />
                        <TrialButton call={{ kind: 'club', registration: r.id, action: 'outcome', outcome: 'invite_again', opportunity: opportunityId }} label="Volver a invitar" />
                        <TrialButton call={{ kind: 'club', registration: r.id, action: 'outcome', outcome: 'closed', opportunity: opportunityId }} label="Cerrar" variant="danger" />
                      </>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">Aún no hay inscripciones.</p>}
          </Card>
        </>
      )}
    </>
  );
}
