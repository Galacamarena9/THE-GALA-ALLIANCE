import { Badge, Card, CardTitle } from '@/components/ui';
import { TrialButton } from './TrialButtons';
import {
  AVAILABILITY_LABEL, COST_TYPE_LABEL, ENROLLMENT_STATUS_LABEL, costLine, eventWhen, knownRequiredCost, money, priceLabel,
  type CostComponent, type PriceStatus,
} from '@/lib/domain/trials';
import { REQUIRED_MATERIAL_LABEL } from '@/lib/domain/recruit';
import type { PanelCore, PanelMaterial, PanelRequirement, PanelApplication } from './TrialPanel';

export type ProgramDetails = {
  program_kind: string; calendar_type: string; competition_level: string | null; training_sessions_per_week: number | null;
  residential: string; accommodation: string; meals: string; education_support: string; language_support: string[] | null;
  capacity: number | null; price_status: PriceStatus; financial_aid: string; minor_policy: string; requirements_note: string | null;
};
export type PanelEnrollment = {
  id: string; athlete_id: string; status: keyof typeof ENROLLMENT_STATUS_LABEL; guardian_status: string; name: string;
  aid_amount: number | null; aid_currency: string | null; starts_on: string | null; ends_on: string | null;
};

const CALENDAR: Record<string, string> = { fixed_term: 'Curso con fechas fijas', rolling: 'Entrada continua', seasonal: 'Por temporada', one_off: 'Edición única' };
const RESIDENTIAL: Record<string, string> = { residential: 'Residencial', non_residential: 'Sin residencia', both: 'Con o sin residencia', unknown: 'Sin indicar' };
const YESNO: Record<string, string> = { yes: 'Sí', no: 'No', unknown: 'Sin indicar' };
// «Hay ayudas» ≠ «tienes ayuda». Solo una ayuda registrada en tu plaza es una ayuda confirmada.
const AID: Record<string, string> = { available: 'La academia ofrece ayudas (no significa que tengas una)', not_available: 'Sin ayudas económicas', unknown: 'Ayudas: sin información' };
const STRENGTH: Record<string, string> = { required: 'Obligatorio', preferred: 'Preferible', informational: 'Información' };
const fmtDay = (d: string | null) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }) : null);

/**
 * Programa de academia: qué es, cuánto cuesta de verdad (obligatorio vs opcional, sin inventar el viaje) y, según quién
 * mira, aceptar la plaza (atleta), aprobarla (familia) o gestionar candidaturas y matrículas (academia).
 * Aceptado ≠ matriculado: la matrícula la formaliza la academia y exige la aprobación familiar si es menor.
 */
export function ProgramPanel({ opportunityId, details, core, costs, requirements, materials, me, enrollments, applications, asClub, asFamily }: {
  opportunityId: string; details: ProgramDetails | null; core: PanelCore; costs: CostComponent[]; requirements: PanelRequirement[]; materials: PanelMaterial[];
  me: string | null; enrollments: PanelEnrollment[]; applications: PanelApplication[]; asClub: boolean; asFamily: boolean;
}) {
  const d = details;
  const price = d?.price_status ?? 'price_not_provided';
  const known = knownRequiredCost(price, costs);
  const required = costs.filter((c) => c.required);
  const optional = costs.filter((c) => !c.required);
  const travelMissing = !costs.some((c) => c.component_type === 'transport');
  const mine = me ? enrollments.find((e) => e.athlete_id === me) : undefined;
  const guardianPending = asFamily ? enrollments.filter((e) => e.status === 'offered' && e.guardian_status === 'pending') : [];
  const period = [fmtDay(core.start_at ? core.start_at.slice(0, 10) : null), fmtDay(core.end_at ? core.end_at.slice(0, 10) : null)].filter(Boolean).join(' → ');
  const knownText = known.total != null && known.currency ? `${money(known.total, known.currency)}${known.basis ? ` (${known.basis})` : ''}` : known.total === 0 ? 'Gratis' : null;

  return (
    <>
      <Card>
        <CardTitle kicker="Programa de academia">Lo esencial</CardTitle>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-faint">Cuándo</dt><dd className="text-paper">{period || eventWhen(core.start_at, core.timezone)}{d ? ` · ${CALENDAR[d.calendar_type] ?? d.calendar_type}` : ''}</dd></div>
          <div><dt className="text-faint">Dónde</dt><dd className="text-paper">{[core.venue_name, core.city, core.country].filter(Boolean).join(', ') || 'Sin indicar'}</dd></div>
          <div><dt className="text-faint">Edad / categoría</dt><dd className="text-paper">{core.age_category ?? 'Sin indicar'}</dd></div>
          <div><dt className="text-faint">Entrenamiento</dt><dd className="text-paper">{d?.training_sessions_per_week ? `${d.training_sessions_per_week} sesiones/semana` : 'Sin indicar'}{d?.competition_level ? ` · ${d.competition_level}` : ''}</dd></div>
          <div><dt className="text-faint">Residencia</dt><dd className="text-paper">{RESIDENTIAL[d?.residential ?? 'unknown']}</dd></div>
          <div><dt className="text-faint">Apoyo académico</dt><dd className="text-paper">{YESNO[d?.education_support ?? 'unknown']}{d?.language_support?.length ? ` · Idiomas: ${d.language_support.join(', ')}` : ''}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-muted">{AID[d?.financial_aid ?? 'unknown']}</p>
      </Card>

      <Card>
        <CardTitle kicker="Coste">{priceLabel(price, costs)}</CardTitle>
        {required.length + optional.length > 0 && (
          <ul className="space-y-1 text-sm">
            {required.map((c, i) => <li key={`r${i}`} className="flex justify-between gap-2"><span className="text-paper">{c.label || COST_TYPE_LABEL[c.component_type]}</span><span className="text-paper">{costLine(c)}</span></li>)}
            {optional.map((c, i) => <li key={`o${i}`} className="flex justify-between gap-2"><span className="text-muted">{c.label || COST_TYPE_LABEL[c.component_type]} <span className="text-[11px]">(opcional)</span></span><span className="text-muted">{costLine(c)}</span></li>)}
          </ul>
        )}
        <p className="mt-2 border-t border-line pt-2 text-sm font-semibold text-paper">
          Coste obligatorio conocido: {knownText ?? <span className="font-normal text-warn">{known.reason}</span>}
        </p>
        <p className="mt-1 text-xs text-muted">
          Alojamiento: {AVAILABILITY_LABEL[d?.accommodation ?? 'unknown']} · Comidas: {AVAILABILITY_LABEL[d?.meals ?? 'unknown']}
          {travelMissing ? ' · Viaje no incluido: coste desconocido (no está en el total).' : ''}
        </p>
      </Card>

      {(requirements.length > 0 || materials.length > 0 || d?.requirements_note) && (
        <Card>
          <CardTitle kicker="Requisitos">Qué te piden</CardTitle>
          <ul className="space-y-1 text-sm">
            {requirements.map((r, i) => <li key={i} className="text-paper">{r.label ?? r.kind} <span className="text-[11px] text-muted">· {STRENGTH[r.strength]}</span></li>)}
            {materials.map((m, i) => <li key={`m${i}`} className="text-paper">{m.label ?? REQUIRED_MATERIAL_LABEL[m.material] ?? m.material} <span className="text-[11px] text-muted">· {m.required ? 'Obligatorio' : 'Opcional'}</span></li>)}
          </ul>
          {d?.requirements_note && <p className="mt-2 text-xs text-muted">{d.requirements_note}</p>}
        </Card>
      )}

      {/* Atleta */}
      {mine && (
        <Card>
          <CardTitle kicker="Tu plaza">{ENROLLMENT_STATUS_LABEL[mine.status]}</CardTitle>
          {mine.status === 'offered' && <p className="mb-2 text-sm text-paper">La academia te ofrece una plaza. Aceptarla no te matricula todavía: la academia formaliza la matrícula después{mine.guardian_status === 'pending' ? ' y tu familia debe aprobarla' : ''}.</p>}
          {mine.aid_amount != null && mine.aid_currency && <p className="mb-2 text-sm text-ok">Ayuda confirmada en tu plaza: {money(mine.aid_amount, mine.aid_currency)}</p>}
          {mine.status === 'offered' && mine.guardian_status === 'pending' && <p className="mb-2 text-sm text-warn">Esperando la aprobación de tu familia.</p>}
          <div className="flex flex-wrap gap-2">
            {mine.status === 'offered' && <TrialButton call={{ kind: 'enrollment', enrollment: mine.id, action: 'accept', opportunity: opportunityId }} label="Aceptar plaza" variant="primary" confirm={`Coste obligatorio conocido: ${knownText ?? 'sin precio completo'}. ¿Aceptar la plaza?`} />}
            {mine.status === 'offered' && <TrialButton call={{ kind: 'enrollment', enrollment: mine.id, action: 'decline', opportunity: opportunityId }} label="Rechazar" variant="danger" confirm="¿Rechazar la plaza? La academia solo verá «rechazada»." />}
            {['accepted', 'enrolled', 'active'].includes(mine.status) && <TrialButton call={{ kind: 'enrollment', enrollment: mine.id, action: 'withdraw', opportunity: opportunityId }} label="Retirarme" variant="danger" confirm="¿Seguro? Se avisará a la academia." />}
          </div>
        </Card>
      )}

      {/* Familia */}
      {guardianPending.length > 0 && (
        <Card>
          <CardTitle kicker="Familia">Necesita tu decisión</CardTitle>
          <p className="mb-3 text-xs text-muted">
            Aprobar permite aceptar esta plaza concreta. Coste obligatorio conocido: {knownText ?? 'sin precio completo'}{travelMissing ? '; el viaje no está incluido' : ''}.
            La academia ve el Opportunity Passport y el vídeo, no tus datos ni sus documentos privados.
          </p>
          <ul className="space-y-3">
            {guardianPending.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-paper">{e.name}</span>
                <span className="flex flex-wrap gap-2">
                  <TrialButton call={{ kind: 'enrollment', enrollment: e.id, action: 'guardian_approve', opportunity: opportunityId }} label="Aprobar" variant="primary" confirm={`¿Aprobar la plaza de ${e.name}? Coste obligatorio conocido: ${knownText ?? 'sin precio completo'}.`} />
                  <TrialButton call={{ kind: 'enrollment', enrollment: e.id, action: 'guardian_decline', opportunity: opportunityId }} label="No aprobar" variant="danger" confirm="La academia verá la plaza como rechazada." />
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Academia */}
      {asClub && (
        <>
          <Card id="candidaturas">
            <CardTitle kicker="Academia">Candidaturas ({applications.length})</CardTitle>
            {applications.length ? (
              <ul className="divide-y divide-line">
                {applications.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <span className="min-w-0"><span className="block text-paper">{a.name}</span><span className="block text-[11px] text-muted">{a.guardian_consent_status === 'pending' ? 'Familia: pendiente' : a.guardian_consent_status === 'approved' ? 'Familia ✓' : 'Sin tutor requerido'}</span></span>
                    {['applied', 'reviewed', 'information_requested', 'waitlisted'].includes(a.status) ? (
                      <span className="flex flex-wrap gap-2">
                        <TrialButton call={{ kind: 'decide', application: a.id, decision: 'accepted', opportunity: opportunityId }} label="Ofrecer plaza" variant="primary" confirm={`¿Ofrecer plaza a ${a.name}? Aceptar la candidatura no matricula: el atleta (y su familia si es menor) debe aceptar.`} />
                        {a.status !== 'waitlisted' && <TrialButton call={{ kind: 'decide', application: a.id, decision: 'waitlisted', opportunity: opportunityId }} label="Lista de espera" />}
                        <TrialButton call={{ kind: 'decide', application: a.id, decision: 'declined', opportunity: opportunityId }} label="No continuar" variant="danger" confirm="Se avisará al atleta." />
                      </span>
                    ) : <Badge tone="neutral">{a.status === 'accepted' ? 'Plaza ofrecida' : a.status === 'declined' ? 'No continúa' : a.status}</Badge>}
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">Aún no hay candidaturas.</p>}
          </Card>
          <Card id="participantes">
            <CardTitle kicker="Academia">Plazas y matrículas ({enrollments.length})</CardTitle>
            {enrollments.length ? (
              <ul className="divide-y divide-line">
                {enrollments.map((e) => (
                  <li key={e.id} className="py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm text-paper">{e.name}</span>
                      <Badge tone={['enrolled', 'active', 'completed'].includes(e.status) ? 'ok' : ['declined', 'withdrawn', 'cancelled'].includes(e.status) ? 'neutral' : 'brass'}>{ENROLLMENT_STATUS_LABEL[e.status]}</Badge>
                    </div>
                    <p className="mt-1 text-[11px] text-muted">{e.guardian_status === 'pending' ? 'Aprobación familiar pendiente' : e.guardian_status === 'approved' ? 'Familia ✓' : ''}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {e.status === 'accepted' && <TrialButton call={{ kind: 'enrollment', enrollment: e.id, action: 'enroll', opportunity: opportunityId }} label="Formalizar matrícula" variant="primary" confirm="Confirma que la matrícula está formalizada con el atleta (y su familia si es menor)." />}
                      {e.status === 'enrolled' && <TrialButton call={{ kind: 'enrollment', enrollment: e.id, action: 'activate', opportunity: opportunityId }} label="Iniciar programa" variant="primary" />}
                      {e.status === 'active' && <TrialButton call={{ kind: 'enrollment', enrollment: e.id, action: 'complete', opportunity: opportunityId }} label="Marcar completado" />}
                      {['offered', 'accepted', 'enrolled', 'active'].includes(e.status) && <TrialButton call={{ kind: 'enrollment', enrollment: e.id, action: 'cancel', opportunity: opportunityId }} label="Cancelar plaza" variant="danger" confirm="Se avisará al atleta y a su familia." />}
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">Aún no hay plazas ofrecidas.</p>}
          </Card>
        </>
      )}
    </>
  );
}
