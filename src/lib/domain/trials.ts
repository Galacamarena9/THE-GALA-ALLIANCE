import { guardianErrorMessage } from './guardian-verification.ts';
/**
 * TRIALS Y PROGRAMAS · reglas puras (Prompts 11 y 11A).
 * - Entidades separadas: invitación (club) ≠ candidatura (atleta) ≠ inscripción ≠ asistencia ≠ resultado ≠ matrícula.
 * - Coste siempre visible antes de cualquier botón: «Gratis» solo si la organización lo declara; nunca «0 €» ambiguo.
 * - Plazas libres = capacidad confirmada − inscripciones confirmadas; capacidad desconocida ≠ ilimitada.
 * - Encaje para el agente: deporte obligatorio; posición y promoción si la oportunidad las indica. No valora el talento.
 */
export const TRIAL_TYPES = ['tryout', 'camp_showcase', 'club_recruitment'] as const;
export const PROGRAM_TYPES = ['academy', 'development_program'] as const;
export const CLUB_TYPES = [...TRIAL_TYPES, ...PROGRAM_TYPES] as const;
export type TrialType = (typeof TRIAL_TYPES)[number];
export const isTrialType = (t: string): t is TrialType => (TRIAL_TYPES as readonly string[]).includes(t);
export const isProgramType = (t: string) => (PROGRAM_TYPES as readonly string[]).includes(t);

/* ----------------------------------------------------------------------------------- Estados */
export type RegistrationStatus = 'pending' | 'registered' | 'confirmed' | 'waitlisted' | 'cancelled' | 'withdrawn' | 'completed';
export const REGISTRATION_STATUS_LABEL: Record<RegistrationStatus, string> = {
  pending: 'Pendiente (falta un paso)', registered: 'Inscrito · pendiente de confirmar por el club', confirmed: 'Plaza confirmada',
  waitlisted: 'En lista de espera', cancelled: 'El club no continúa', withdrawn: 'Retirado', completed: 'Trial completado',
};
export type InvitationStatus = 'sent' | 'viewed' | 'interested' | 'declined' | 'expired' | 'withdrawn' | 'converted_to_registration';
export const INVITATION_STATUS_LABEL: Record<InvitationStatus, string> = {
  sent: 'Invitación recibida', viewed: 'Invitación vista', interested: 'Interesado', declined: 'Rechazada', expired: 'Caducada',
  withdrawn: 'Retirada por el club', converted_to_registration: 'Inscrito',
};
export type AttendanceStatus = 'unknown' | 'attended' | 'no_show' | 'partial' | 'cancelled_before_event';
export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  unknown: 'Asistencia sin registrar', attended: 'Asistió', no_show: 'No se presentó', partial: 'Asistencia parcial', cancelled_before_event: 'Canceló antes del evento',
};
export type Outcome = 'no_further_action' | 'follow_up' | 'invite_again' | 'start_recruiting_process' | 'academy_offer' | 'club_offer' | 'closed';
/** Etiquetas INTERNAS del club (el atleta nunca las ve; solo el mensaje que el club decide compartir). */
export const OUTCOME_LABEL: Record<Outcome, string> = {
  no_further_action: 'Sin más acciones', follow_up: 'Seguimiento', invite_again: 'Volver a invitar', start_recruiting_process: 'Proceso de recruiting iniciado',
  academy_offer: 'Oferta de academia', club_offer: 'Oferta de club', closed: 'Cerrado',
};
export type EnrollmentStatus = 'offered' | 'accepted' | 'declined' | 'enrolled' | 'active' | 'completed' | 'withdrawn' | 'cancelled';
export const ENROLLMENT_STATUS_LABEL: Record<EnrollmentStatus, string> = {
  offered: 'Plaza ofrecida', accepted: 'Plaza aceptada · pendiente de matrícula', declined: 'Plaza rechazada', enrolled: 'Matriculado',
  active: 'Programa en curso', completed: 'Programa completado', withdrawn: 'Retirado', cancelled: 'Cancelada por la academia',
};
export const AVAILABILITY_LABEL: Record<string, string> = { included: 'Incluido', available_paid: 'Disponible (de pago)', not_included: 'No incluido', unknown: 'Sin información' };

/* ----------------------------------------------------------------------------------- Costes */
export type PriceStatus = 'free' | 'paid' | 'price_not_provided';
export interface CostComponent {
  component_type: string; label: string; amount: number | null; currency: string | null; required: boolean; included: boolean; period?: string;
}
export const COST_TYPE_LABEL: Record<string, string> = {
  registration: 'Inscripción', program_fee: 'Cuota del programa', accommodation: 'Alojamiento', meals: 'Comidas', equipment: 'Material',
  insurance: 'Seguro', transport: 'Transporte', other: 'Otro',
};
const PERIOD_LABEL: Record<string, string> = { one_off: '', per_month: ' / mes', per_term: ' / trimestre', per_season: ' / temporada', per_year: ' / año' };

export function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

/** Línea de un componente: «150,00 €», «Incluido» o «Importe sin indicar». */
export function costLine(c: CostComponent) {
  if (c.included) return 'Incluido';
  if (c.amount == null || !c.currency) return 'Importe sin indicar';
  return `${money(Number(c.amount), c.currency)}${PERIOD_LABEL[c.period ?? 'one_off'] ?? ''}`;
}

/**
 * Coste obligatorio CONOCIDO: solo se suma si el cálculo es correcto (todo obligatorio tiene importe, una sola moneda
 * y el mismo periodo). Si no, `total` es null y `reason` explica por qué. Lo opcional nunca se suma.
 */
export function knownRequiredCost(price: PriceStatus | null | undefined, components: CostComponent[]): { total: number | null; currency: string | null; reason: string | null; basis?: string } {
  if (price === 'free') return { total: 0, currency: null, reason: null };
  if (!price || price === 'price_not_provided') return { total: null, currency: null, reason: 'La organización no ha indicado el coste.' };
  const req = components.filter((c) => c.required && !c.included);
  if (!req.length) return { total: null, currency: null, reason: 'Falta el importe.' };
  if (req.some((c) => c.amount == null || !c.currency)) return { total: null, currency: null, reason: 'Hay costes obligatorios sin importe.' };
  const currencies = new Set(req.map((c) => c.currency));
  if (currencies.size > 1) return { total: null, currency: null, reason: 'Los costes están en monedas distintas.' };
  const periods = new Set(req.map((c) => c.period ?? 'one_off'));
  const recurring = [...periods].filter((p) => p !== 'one_off');
  // Pagos únicos + UN periodo recurrente (p. ej. cuota y alojamiento por temporada + matrícula única) = coste del
  // primer ciclo, y se dice así. Dos periodos recurrentes distintos (mes y año) no se suman.
  if (recurring.length > 1) return { total: null, currency: null, reason: 'Los costes tienen periodos distintos.' };
  const total = req.reduce((s, c) => s + Number(c.amount), 0);
  if (recurring.length === 1 && periods.has('one_off')) {
    return { total, currency: req[0].currency, reason: null, basis: `${FIRST_CYCLE[recurring[0]] ?? 'primer periodo'}, incluye pagos únicos` };
  }
  return recurring.length ? { total, currency: req[0].currency, reason: null, basis: PERIOD_LABEL[recurring[0]].replace(' / ', 'por ') } : { total, currency: req[0].currency, reason: null };
}
const FIRST_CYCLE: Record<string, string> = { per_month: 'primer mes', per_term: 'primer trimestre', per_season: 'primera temporada', per_year: 'primer año' };

/** Resumen para tarjetas: «Gratis», «150,00 €» o «Coste sin indicar». Nunca «0 €». */
export function priceLabel(price: PriceStatus | null | undefined, components: CostComponent[] = []) {
  if (price === 'free') return 'Gratis';
  if (!price || price === 'price_not_provided') return 'Coste sin indicar';
  const k = knownRequiredCost(price, components);
  return k.total != null && k.currency ? money(k.total, k.currency) : 'De pago · importe incompleto';
}

/** Plazas: «15 confirmadas · 5 libres» solo con capacidad confirmada; si no, solo las confirmadas. */
export function capacityLabel(capacity: number | null | undefined, confirmed: number) {
  if (capacity == null) return `${confirmed} confirmadas`;
  return `${confirmed} confirmadas · ${Math.max(capacity - confirmed, 0)} libres`;
}

/* ----------------------------------------------------------------------------------- Fechas */
/**
 * Fecha y hora EN LA ZONA DEL EVENTO, etiquetada: «12 jun 2027 · 10:00 (Europe/Madrid)».
 * Un atleta en EE. UU. ve la hora de Madrid con su zona, sin conversiones silenciosas.
 */
export function eventWhen(startAt: string | null | undefined, timezone: string | null | undefined) {
  if (!startAt) return 'Fecha sin indicar';
  const tz = timezone ?? 'UTC';
  try {
    const d = new Date(startAt);
    const date = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: tz }).format(d);
    const time = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(d);
    return `${date} · ${time} (${tz})`;
  } catch {
    return startAt;
  }
}

/** Convierte «2027-06-12» + «10:00» + zona IANA en un instante ISO (lo que guarda la base de datos). */
export function localToInstant(date: string, time: string | null, timezone: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time ?? '00:00').split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  // Desfase de la zona en ese instante (incluye horario de verano).
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asIfUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return new Date(guess - (asIfUtc - guess)).toISOString();
}

/* ----------------------------------------------------------------------------------- Publicación */
export const PUBLISH_GAP_LABEL: Record<string, string> = {
  location: 'Añade la ciudad y el país antes de publicar.',
  age_category: 'Indica la categoría o la edad.',
  requirements: 'Añade al menos un requisito o un material requerido.',
  details: 'Completa los detalles del trial o programa.',
  date: 'Añade la fecha y la zona horaria antes de publicar.',
  cost_status: 'Indica si es gratis o de pago.',
  price: 'Es de pago: indica el importe de la inscripción o de la cuota.',
  deadline: 'Con candidatura previa, indica el plazo para presentarla.',
};
export function publishGapMessages(message: string | undefined) {
  const m = message?.match(/not_publishable:([a-z_,]+)/);
  if (!m) return [];
  return m[1].split(',').map((g) => PUBLISH_GAP_LABEL[g] ?? g);
}

/* ----------------------------------------------------------------------------------- Encaje (agente) */
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
export function boardGroup(r: { status: RegistrationStatus | InvitationStatus; needs_athlete_ok?: boolean; guardian_status?: string }): BoardGroup {
  if (['sent', 'viewed', 'interested'].includes(r.status) || r.needs_athlete_ok || r.guardian_status === 'pending' || r.status === 'pending') return 'needs_athlete';
  if (r.status === 'registered' || r.status === 'waitlisted') return 'waiting_club';
  if (r.status === 'confirmed') return 'confirmed';
  if (r.status === 'completed') return 'after_event';
  return 'closed';
}

/* ----------------------------------------------------------------------------------- Errores */
export const TRIAL_ERROR: Record<string, string> = {
  ncaa_contact_window_closed: 'Normas NCAA: vuestra universidad aún no puede invitar a este atleta por su curso. Podrás hacerlo cuando se abra la ventana de contacto.',
  not_allowed: 'No tienes permiso para hacer esto (comprueba tu rol, el programa o la representación).',
  opportunity_not_open: 'La oportunidad ya no está abierta.',
  registration_closed: 'El plazo de inscripción ha terminado.',
  organization_not_verified: 'Solo se puede participar en oportunidades de organizaciones verificadas.',
  adults_only: 'Este trial solo admite mayores de edad.',
  invalid_transition: 'Esta acción no está disponible en el estado actual.',
  event_not_started: 'La asistencia se registra cuando el evento ya ha empezado.',
  event_date_missing: 'Falta la fecha del evento.',
  athlete_not_visible: 'No puedes invitar a un atleta que no es visible para tu organización.',
  athlete_not_accessible: 'Este atleta ya no es accesible para tu organización.',
  invitation_required: 'Este trial es solo por invitación.',
  application_required: 'Primero hay que presentar una candidatura y que el club la acepte.',
  invitation_expired: 'La invitación ha caducado.',
  already_registered: 'Este atleta ya está inscrito.',
  guardian_consent_missing: 'Falta la aprobación de la familia.',
  capacity_reached: 'No quedan plazas confirmables: usa la lista de espera.',
  blocked: 'No es posible: hay un bloqueo entre el atleta y la organización.',
  rate_limited: 'Has alcanzado el límite diario. Inténtalo mañana.',
  not_publishable: 'Faltan datos para publicar.',
  payment_status_server_only: 'El estado del pago solo lo actualiza el sistema de pagos.',
  use_application_org_decide: 'Las candidaturas a trials se deciden desde el propio trial (Aceptar, Lista de espera o No continuar).',
  'row-level security': 'No tienes permiso para hacer esto.',
  'permission denied': 'No tienes permiso para hacer esto.',
  team_not_in_org: 'Ese equipo no pertenece a tu organización.',
  duplicate: 'Ya existe: no se ha duplicado.',
};
export function trialErrorMessage(message: string | undefined) {
  const guardian = guardianErrorMessage(message);
  if (guardian) return guardian;
  const key = Object.keys(TRIAL_ERROR).find((k) => message?.includes(k));
  return key ? TRIAL_ERROR[key] : 'No se ha podido completar la acción. Inténtalo de nuevo.';
}
