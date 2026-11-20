/**
 * TRIALS Y PROGRAMAS · reglas puras (Prompt 11A, enfocado al agente).
 * - Estados separados: invitado ≠ interesado ≠ inscrito ≠ confirmado ≠ asistió. La base de datos decide las transiciones.
 * - Coste siempre visible antes de cualquier botón. Nunca «quedan X plazas» ni «selección garantizada».
 * - Encaje para el agente: deporte obligatorio; posición y promoción si la oportunidad las indica. No es una valoración del talento.
 */
export const TRIAL_TYPES = ['tryout', 'camp_showcase', 'academy', 'club_recruitment'] as const;
export type TrialType = (typeof TRIAL_TYPES)[number];
export const isTrialType = (t: string): t is TrialType => (TRIAL_TYPES as readonly string[]).includes(t);

export type TrialStatus = 'invited' | 'interested' | 'registered' | 'confirmed' | 'waitlisted' | 'declined' | 'withdrawn' | 'attended' | 'no_show';
export const TRIAL_STATUS_LABEL: Record<TrialStatus, string> = {
  invited: 'Invitado por el club', interested: 'Interesado', registered: 'Inscrito (pendiente del club)', confirmed: 'Plaza confirmada',
  waitlisted: 'Lista de espera', declined: 'El club no continúa', withdrawn: 'Retirado', attended: 'Asistió', no_show: 'No asistió',
};
export const OUTCOME_LABEL: Record<string, string> = {
  follow_up: 'El club hará seguimiento', continue_recruiting: 'El club continúa el proceso', not_selected: 'No seleccionado esta vez',
};
export const AVAILABILITY_LABEL: Record<string, string> = { included: 'Incluido', available_paid: 'Disponible (de pago)', not_included: 'No incluido', unknown: 'Sin información' };

export interface EventDetails {
  fee_type: 'free' | 'paid' | 'unknown';
  fee_amount: number | null;
  currency: string | null;
  event_start_date: string | null;
  event_end_date?: string | null;
  start_time_local: string | null;
  timezone: string | null;
  city?: string | null;
  country?: string | null;
  age_category?: string | null;
  accommodation?: string;
  meals?: string;
  travel?: string;
  minor_policy?: string;
}

/** «Gratis», «50 € · inscripción» o «Coste sin indicar». Nunca «Desde X» escondiendo costes. */
export function feeLabel(d: Pick<EventDetails, 'fee_type' | 'fee_amount' | 'currency'> | null | undefined) {
  if (!d || d.fee_type === 'unknown') return 'Coste sin indicar';
  if (d.fee_type === 'free') return 'Gratis';
  try {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: d.currency ?? 'EUR', maximumFractionDigits: 2 }).format(Number(d.fee_amount));
  } catch {
    return `${d.fee_amount} ${d.currency ?? ''}`.trim();
  }
}

/**
 * Fecha y hora en la zona del evento, sin convertir: «12 jun 2027 · 10:00 (Europe/Madrid)».
 * Un atleta en EE. UU. ve la hora de Madrid etiquetada como tal.
 */
export function eventWhen(d: Pick<EventDetails, 'event_start_date' | 'start_time_local' | 'timezone'> | null | undefined) {
  if (!d?.event_start_date) return 'Fecha sin indicar';
  const [y, m, day] = d.event_start_date.split('-').map(Number);
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const date = `${day} ${months[(m ?? 1) - 1]} ${y}`;
  const time = d.start_time_local ? ` · ${d.start_time_local.slice(0, 5)}` : '';
  const tz = d.timezone ? ` (${d.timezone})` : '';
  return `${date}${time}${tz}`;
}

export interface FitAthlete { id: string; sport_id: string | null; primary_position_id: number | null; secondary_position_id?: number | null; graduation_year: number | null }
export interface FitOpportunity { sport_id: string; position_ids: number[]; graduation_years: number[] }
export interface TrialFit { ok: boolean; reasons: string[]; missing: string[] }

/** Encaje mínimo y explicable de un atleta con un trial, para sugerirlo a su agente. */
export function trialFit(a: FitAthlete, o: FitOpportunity): TrialFit {
  const reasons: string[] = [];
  const missing: string[] = [];
  if (!a.sport_id || a.sport_id !== o.sport_id) return { ok: false, reasons: [], missing: [] };
  reasons.push('Deporte');
  if (o.position_ids.length) {
    if (a.primary_position_id == null && a.secondary_position_id == null) missing.push('Posición sin indicar');
    else if (o.position_ids.includes(a.primary_position_id ?? -1) || o.position_ids.includes(a.secondary_position_id ?? -1)) reasons.push('Posición');
    else return { ok: false, reasons: [], missing: [] };
  }
  if (o.graduation_years.length) {
    if (a.graduation_year == null) missing.push('Promoción sin indicar');
    else if (o.graduation_years.includes(a.graduation_year)) reasons.push('Promoción');
    else return { ok: false, reasons: [], missing: [] };
  }
  return { ok: true, reasons, missing };
}

/** Columnas del tablero del agente: lo que necesita una acción primero. */
export type BoardGroup = 'needs_athlete' | 'waiting_club' | 'confirmed' | 'after_event' | 'closed';
export const BOARD_GROUP_LABEL: Record<BoardGroup, string> = {
  needs_athlete: 'Pendiente del atleta o su familia', waiting_club: 'Esperando al club', confirmed: 'Confirmados', after_event: 'Después del trial', closed: 'Cerrados',
};
export function boardGroup(r: { status: TrialStatus; needs_athlete_ok: boolean; guardian_status: string }): BoardGroup {
  if (r.status === 'invited' || r.needs_athlete_ok || r.guardian_status === 'pending') return 'needs_athlete';
  if (r.status === 'interested' || r.status === 'registered' || r.status === 'waitlisted') return 'waiting_club';
  if (r.status === 'confirmed') return 'confirmed';
  if (r.status === 'attended') return 'after_event';
  return 'closed';
}

/** Mensajes de error de la base de datos → texto para personas. */
export const TRIAL_ERROR: Record<string, string> = {
  not_allowed: 'No puedes hacer esto para este atleta (comprueba que la representación está activa).',
  opportunity_not_open: 'La oportunidad ya no está abierta.',
  registration_closed: 'El plazo de inscripción ha terminado.',
  organization_not_verified: 'Solo se puede inscribir en trials de organizaciones verificadas.',
  adults_only: 'Este trial solo admite mayores de edad.',
  invalid_transition: 'Esta acción no está disponible en el estado actual.',
  event_not_started: 'La asistencia se registra cuando el evento ya ha empezado.',
  athlete_not_visible: 'No puedes invitar a un atleta que no es visible para tu organización.',
};
export function trialErrorMessage(message: string | undefined) {
  const key = Object.keys(TRIAL_ERROR).find((k) => message?.includes(k));
  return key ? TRIAL_ERROR[key] : 'No se ha podido completar la acción.';
}
