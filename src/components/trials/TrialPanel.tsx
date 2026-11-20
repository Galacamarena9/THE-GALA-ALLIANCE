import { Badge, Card, CardTitle } from '@/components/ui';
import { TrialButton } from './TrialButtons';
import { AVAILABILITY_LABEL, OUTCOME_LABEL, TRIAL_STATUS_LABEL, eventWhen, feeLabel, type EventDetails, type TrialStatus } from '@/lib/domain/trials';

type Reg = { id: string; athlete_id: string; status: string; outcome: string | null; origin: string; needs_athlete_ok: boolean; guardian_status: string; name: string };
type Details = EventDetails & {
  venue?: string | null; region?: string | null; capacity?: number | null; fee_includes?: string[]; refundable?: string; refund_details?: string | null;
  education_support?: string; program_schedule?: string | null; video_requirements?: string | null; age_min?: number | null; age_max?: number | null; event_end_date?: string | null;
  extra_costs?: { label?: string; amount?: number; currency?: string; required?: boolean }[];
};

const REFUND: Record<string, string> = { yes: 'Reembolsable', no: 'No reembolsable', partial: 'Reembolso parcial', unknown: 'Reembolso sin indicar' };

/**
 * Trial o programa: transparencia antes del botón (quién, cuándo, cuánto, qué incluye, qué pasa después) y,
 * según quién mira, inscribirse / responder (atleta), aprobar (familia) o gestionar inscripciones (club).
 */
export function TrialPanel({ opportunityId, open, details, me, registrations, asClub, asFamily, preview }: {
  opportunityId: string; open: boolean; details: Details | null; me: string | null; registrations: Reg[]; asClub: boolean; asFamily: boolean; preview: boolean;
}) {
  const d = details;
  const mine = me ? registrations.find((r) => r.athlete_id === me) : undefined;
  const fee = feeLabel(d);
  const active = (s: string) => ['invited', 'interested', 'registered', 'confirmed', 'waitlisted'].includes(s);
  const guardianPending = asFamily ? registrations.filter((r) => r.guardian_status === 'pending') : [];
  const costPending = asFamily ? registrations.filter((r) => r.needs_athlete_ok) : [];

  return (
    <>
      <Card>
        <CardTitle kicker="Trial / programa">Lo que tienes que saber</CardTitle>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-faint">Cuándo</dt><dd className="text-paper">{eventWhen(d)}{d?.event_end_date && d.event_end_date !== d.event_start_date ? ` → ${d.event_end_date}` : ''}</dd></div>
          <div><dt className="text-faint">Dónde</dt><dd className="text-paper">{[d?.venue, d?.city, d?.region, d?.country].filter(Boolean).join(', ') || 'Sin indicar'}</dd></div>
          <div><dt className="text-faint">Coste</dt><dd className={`font-semibold ${d?.fee_type === 'free' ? 'text-ok' : 'text-warn'}`}>{fee}{d?.fee_type === 'paid' && d.refundable ? <span className="block text-xs font-normal text-muted">{REFUND[d.refundable]}{d.refund_details ? ` · ${d.refund_details}` : ''}</span> : null}</dd></div>
          <div><dt className="text-faint">Categoría</dt><dd className="text-paper">{d?.age_category ?? 'Sin indicar'}{d?.age_min || d?.age_max ? ` (${d?.age_min ?? '?'}–${d?.age_max ?? '?'} años)` : ''}</dd></div>
          <div><dt className="text-faint">Alojamiento · Comidas · Viaje</dt><dd className="text-paper">{AVAILABILITY_LABEL[d?.accommodation ?? 'unknown']} · {AVAILABILITY_LABEL[d?.meals ?? 'unknown']} · {AVAILABILITY_LABEL[d?.travel ?? 'unknown']}</dd></div>
          <div><dt className="text-faint">Menores</dt><dd className="text-paper">{d?.minor_policy === 'adults_only' ? 'Solo mayores de edad' : 'Con aprobación de la familia'}</dd></div>
        </dl>
        {!!d?.fee_includes?.length && <p className="mt-3 text-xs text-muted">Incluye: {d.fee_includes.join(', ')}</p>}
        {!!d?.extra_costs?.length && (
          <ul className="mt-2 text-xs text-muted">{d.extra_costs.map((c, i) => <li key={i}>{c.required ? 'Obligatorio' : 'Opcional'}: {c.label} {c.amount != null ? `· ${c.amount} ${c.currency ?? ''}` : ''}</li>)}</ul>
        )}
        {d?.video_requirements && <p className="mt-2 text-xs text-muted">Vídeo: {d.video_requirements}</p>}
        {d?.program_schedule && <p className="mt-2 text-xs text-muted">Horario: {d.program_schedule}</p>}
        <p className="mt-3 text-[11px] text-faint">Después de inscribirte, el club revisa y confirma la plaza, te pone en lista de espera o no continúa. Inscribirse no garantiza plaza ni contrato, y no comparte tus documentos privados.</p>
        {!d && <p className="mt-2 text-xs text-warn">La organización aún no ha completado los detalles (fecha, coste, lugar). Pregunta antes de comprometerte.</p>}
      </Card>

      {/* Atleta */}
      {me && (
        <Card>
          <CardTitle kicker="Tu participación">{mine ? TRIAL_STATUS_LABEL[mine.status as TrialStatus] : 'Inscripción'}</CardTitle>
          {mine?.outcome && <p className="mb-2 text-sm text-paper">{OUTCOME_LABEL[mine.outcome]}</p>}
          {mine?.guardian_status === 'pending' && <p className="mb-2 text-sm text-warn">Esperando la aprobación de tu familia.</p>}
          <div className="flex flex-wrap gap-2">
            {!mine && open && <TrialButton call={{ kind: 'register', opportunity: opportunityId, athlete: me }} label="Inscribirme" variant="primary" confirm={`Coste: ${fee}. ¿Enviar tu inscripción?`} />}
            {mine?.status === 'invited' && <TrialButton call={{ kind: 'respond', registration: mine.id, action: 'interested', opportunity: opportunityId }} label="Me interesa" variant="primary" />}
            {mine?.status === 'interested' && !mine.needs_athlete_ok && mine.guardian_status !== 'pending' && open && <TrialButton call={{ kind: 'register', opportunity: opportunityId, athlete: me }} label="Inscribirme" variant="primary" confirm={`Coste: ${fee}. ¿Enviar tu inscripción?`} />}
            {mine?.needs_athlete_ok && <TrialButton call={{ kind: 'respond', registration: mine.id, action: 'confirm_cost', opportunity: opportunityId }} label="Aceptar coste e inscribirme" variant="primary" confirm={`Tu agente te propone este trial. Coste: ${fee}. ¿Lo aceptas?`} />}
            {mine && active(mine.status) && <TrialButton call={{ kind: 'respond', registration: mine.id, action: 'withdraw', opportunity: opportunityId }} label={mine.status === 'invited' ? 'No me interesa' : 'Retirarme'} variant="danger" confirm="¿Seguro? Se avisará al club." />}
            {!mine && !open && <p className="text-sm text-muted">La inscripción está cerrada.</p>}
          </div>
        </Card>
      )}

      {/* Familia: aprobaciones pendientes de sus hijos */}
      {(guardianPending.length > 0 || costPending.length > 0) && (
        <Card>
          <CardTitle kicker="Familia">Necesita tu decisión</CardTitle>
          <ul className="space-y-3">
            {guardianPending.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-paper">{r.name} quiere inscribirse · {fee}</span>
                <span className="flex gap-2">
                  <TrialButton call={{ kind: 'respond', registration: r.id, action: 'guardian_approve', opportunity: opportunityId }} label="Aprobar" variant="primary" confirm={`¿Apruebas la inscripción? Coste: ${fee}.`} />
                  <TrialButton call={{ kind: 'respond', registration: r.id, action: 'guardian_decline', opportunity: opportunityId }} label="No aprobar" variant="danger" />
                </span>
              </li>
            ))}
            {costPending.filter((r) => !guardianPending.includes(r)).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-paper">Propuesta del agente para {r.name} · {fee}</span>
                <TrialButton call={{ kind: 'respond', registration: r.id, action: 'confirm_cost', opportunity: opportunityId }} label="Aceptar coste" variant="primary" confirm={`¿Aceptas el coste (${fee})?`} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Club: gestión de inscripciones */}
      {asClub && !preview && (
        <Card>
          <CardTitle kicker="Club">Inscripciones ({registrations.length})</CardTitle>
          {registrations.length ? (
            <ul className="divide-y divide-line">
              {registrations.map((r) => (
                <li key={r.id} className="py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm text-paper">{r.name}<span className="ml-2 text-[11px] text-faint">{r.origin === 'agent' ? 'vía agente' : r.origin === 'club_invite' ? 'invitado' : ''}</span></span>
                    <Badge tone={r.status === 'confirmed' ? 'ok' : r.status === 'declined' || r.status === 'withdrawn' ? 'neutral' : 'brass'}>{TRIAL_STATUS_LABEL[r.status as TrialStatus]}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {['registered', 'waitlisted'].includes(r.status) && <TrialButton call={{ kind: 'club', registration: r.id, action: 'confirm', opportunity: opportunityId }} label="Confirmar plaza" variant="primary" />}
                    {r.status === 'registered' && <TrialButton call={{ kind: 'club', registration: r.id, action: 'waitlist', opportunity: opportunityId }} label="Lista de espera" />}
                    {['registered', 'waitlisted', 'interested', 'confirmed'].includes(r.status) && <TrialButton call={{ kind: 'club', registration: r.id, action: 'decline', opportunity: opportunityId }} label="No continuar" variant="danger" confirm="Se avisará al atleta (y a su agente si lo tiene)." />}
                    {r.status === 'confirmed' && <>
                      <TrialButton call={{ kind: 'club', registration: r.id, action: 'attended', opportunity: opportunityId }} label="Asistió" />
                      <TrialButton call={{ kind: 'club', registration: r.id, action: 'no_show', opportunity: opportunityId }} label="No asistió" variant="danger" />
                    </>}
                    {r.status === 'attended' && !r.outcome && <>
                      <TrialButton call={{ kind: 'club', registration: r.id, action: 'outcome', outcome: 'continue_recruiting', opportunity: opportunityId }} label="Continuar recruiting" variant="primary" confirm="Pasa a tu pipeline de candidatos. No crea ninguna oferta." />
                      <TrialButton call={{ kind: 'club', registration: r.id, action: 'outcome', outcome: 'follow_up', opportunity: opportunityId }} label="Seguimiento" />
                      <TrialButton call={{ kind: 'club', registration: r.id, action: 'outcome', outcome: 'not_selected', opportunity: opportunityId }} label="No seleccionado" variant="danger" />
                    </>}
                    {r.outcome && <span className="text-xs text-muted">{OUTCOME_LABEL[r.outcome]}</span>}
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">Aún no hay inscripciones.</p>}
        </Card>
      )}
    </>
  );
}
