/**
 * COACH & UNIVERSITY PORTAL · reglas puras.
 * - Roles y capacidades (espejo de public.org_role_caps; la base de datos es quien decide).
 * - Encaje inverso: atleta ↔ necesidad de recruiting. Mide compatibilidad con criterios registrados,
 *   NO talento: nunca se usa para ordenar personas como "mejores" o "peores".
 * - Siguiente mejor acción del staff.
 */
export const ORG_ROLES = ['owner', 'admin', 'head_coach', 'assistant_coach', 'recruiting_coordinator', 'admissions', 'compliance', 'staff', 'coach', 'recruiter'] as const;
export type OrgRole = (typeof ORG_ROLES)[number];
export const ROLE_LABEL: Record<OrgRole, string> = {
  owner: 'Propietario', admin: 'Administrador', head_coach: 'Head coach', assistant_coach: 'Assistant coach',
  recruiting_coordinator: 'Recruiting coordinator', admissions: 'Admisiones', compliance: 'Compliance', staff: 'Staff',
  coach: 'Coach', recruiter: 'Reclutador',
};
/** Roles que un admin puede asignar desde la interfaz (coach/recruiter quedan como heredados). */
export const ASSIGNABLE_ROLES: OrgRole[] = ['admin', 'head_coach', 'assistant_coach', 'recruiting_coordinator', 'admissions', 'compliance', 'staff'];

export type Cap = 'manage_org' | 'manage_members' | 'manage_programs' | 'opportunities' | 'needs' | 'discover' | 'shortlist' | 'notes'
  | 'pipeline' | 'tasks' | 'candidates' | 'academic' | 'request_info' | 'contact' | 'offers' | 'export' | 'audit';
const ALL: Cap[] = ['manage_org', 'manage_members', 'manage_programs', 'opportunities', 'needs', 'discover', 'shortlist', 'notes', 'pipeline', 'tasks', 'candidates', 'academic', 'request_info', 'contact', 'offers', 'export', 'audit'];
const COACHING: Cap[] = ['discover', 'shortlist', 'notes', 'pipeline', 'tasks', 'candidates', 'academic', 'request_info', 'contact'];
export const ROLE_CAPS: Record<OrgRole, Cap[]> = {
  owner: ALL, admin: ALL,
  head_coach: ['manage_programs', 'opportunities', 'needs', ...COACHING, 'offers', 'export'],
  coach: ['opportunities', 'needs', ...COACHING],
  recruiter: ['opportunities', 'needs', ...COACHING],
  recruiting_coordinator: ['needs', ...COACHING, 'export'],
  assistant_coach: COACHING,
  admissions: ['candidates', 'academic', 'notes', 'tasks'],
  compliance: ['candidates', 'audit'],
  staff: ['candidates', 'tasks'],
};
/** Lo que se puede hacer antes de que la organización esté verificada. */
export const UNVERIFIED_CAPS: Cap[] = ['manage_org', 'manage_members', 'manage_programs', 'needs', 'opportunities', 'tasks'];
export function can(role: string, cap: Cap, verified: boolean) {
  const caps = ROLE_CAPS[role as OrgRole] ?? [];
  return caps.includes(cap) && (verified || UNVERIFIED_CAPS.includes(cap));
}

export const INTERNAL_STAGES = ['new', 'review', 'priority_review', 'shortlisted', 'contact', 'call', 'active', 'offer', 'committed', 'closed'] as const;
export type InternalStage = (typeof INTERNAL_STAGES)[number];
export const INTERNAL_STAGE_LABEL: Record<InternalStage, string> = {
  new: 'Nuevo', review: 'En revisión', priority_review: 'Revisión prioritaria', shortlisted: 'En shortlist', contact: 'Contacto',
  call: 'Llamada / visita', active: 'Recruiting activo', offer: 'Oferta', committed: 'Comprometido', closed: 'Cerrado',
};
export const BOARD_INTERNAL: InternalStage[] = ['new', 'review', 'priority_review', 'contact', 'call', 'active', 'offer', 'committed'];

export const INFO_KIND_LABEL: Record<string, string> = {
  full_game_video: 'Partido completo', transcript: 'Expediente académico', english_certificate: 'Certificado de inglés',
  statistic: 'Estadística adicional', document: 'Documento de candidatura', other: 'Otra información',
};
export const SCHOLARSHIP_LABEL: Record<string, string> = {
  not_provided: 'Sin información de beca',
  potentially_available: 'Beca deportiva posible (sin importe)',
  amount_stated: 'Importe o rango indicado por la organización',
  confirmed_in_offer: 'Confirmada en una oferta',
};

/* ------------------------------------------------------------------ Encaje con una necesidad */
export interface NeedCriteria {
  sport_id: string; position_ids: number[]; class_years: number[]; min_height_cm: number | null;
  requires_video: boolean; requires_documented_academics: boolean; countries: string[];
}
/** Datos del atleta TAL COMO LOS VE el coach (null = no visible o no indicado). */
export interface AthleteFacts {
  sport_id: string | null; primary_position_id: number | null; secondary_position_id: number | null; graduation_year: number | null;
  height_cm: number | null; country: string | null; has_video: boolean; academics_documented: boolean | null; verified_stats: number | null;
}
export type FitStatus = 'met' | 'unmet' | 'unknown';
export interface FitFactor { key: string; label: string; status: FitStatus; hard: boolean; weight: number }
export interface NeedFit { score: number | null; confidence: 'high' | 'medium' | 'low'; blocked: boolean; factors: FitFactor[]; met: FitFactor[]; missing: FitFactor[]; unmet: FitFactor[] }

export function needFit(n: NeedCriteria, a: AthleteFacts): NeedFit {
  const f: FitFactor[] = [];
  f.push({ key: 'sport', label: 'Deporte', hard: true, weight: 0, status: a.sport_id == null ? 'unknown' : a.sport_id === n.sport_id ? 'met' : 'unmet' });
  if (n.position_ids.length) {
    const pos = [a.primary_position_id, a.secondary_position_id].filter((x): x is number => x != null);
    f.push({ key: 'position', label: 'Posición', hard: true, weight: 30, status: !pos.length ? 'unknown' : pos.some((p) => n.position_ids.includes(p)) ? 'met' : 'unmet' });
  }
  if (n.class_years.length) f.push({ key: 'class', label: 'Año de graduación', hard: true, weight: 25, status: a.graduation_year == null ? 'unknown' : n.class_years.includes(a.graduation_year) ? 'met' : 'unmet' });
  if (n.min_height_cm) f.push({ key: 'height', label: `Altura ≥ ${(n.min_height_cm / 100).toFixed(2)} m`, hard: false, weight: 15, status: a.height_cm == null ? 'unknown' : a.height_cm >= n.min_height_cm ? 'met' : 'unmet' });
  f.push({ key: 'video', label: 'Highlight reel', hard: n.requires_video, weight: n.requires_video ? 15 : 8, status: a.has_video ? 'met' : n.requires_video ? 'unmet' : 'unknown' });
  if (n.requires_documented_academics) f.push({ key: 'academics', label: 'Académico documentado', hard: false, weight: 15, status: a.academics_documented == null ? 'unknown' : a.academics_documented ? 'met' : 'unmet' });
  if (n.countries.length) f.push({ key: 'country', label: 'País', hard: false, weight: 8, status: a.country == null ? 'unknown' : n.countries.includes(a.country) ? 'met' : 'unmet' });
  f.push({ key: 'verified_stats', label: 'Estadísticas verificadas', hard: false, weight: 7, status: a.verified_stats == null ? 'unknown' : a.verified_stats > 0 ? 'met' : 'unknown' });

  const blocked = f.some((x) => x.hard && x.status === 'unmet');
  const scored = f.filter((x) => x.weight > 0);
  const total = scored.reduce((s, x) => s + x.weight, 0);
  const known = scored.filter((x) => x.status !== 'unknown');
  const knownW = known.reduce((s, x) => s + x.weight, 0);
  const coverage = total ? knownW / total : 0;
  const score = coverage < 0.4 ? null : Math.round((known.filter((x) => x.status === 'met').reduce((s, x) => s + x.weight, 0) / knownW) * 100);
  return {
    score: blocked ? 0 : score, blocked,
    confidence: coverage >= 0.8 ? 'high' : coverage >= 0.55 ? 'medium' : 'low',
    factors: f, met: f.filter((x) => x.status === 'met'), missing: f.filter((x) => x.status === 'unknown'), unmet: f.filter((x) => x.status === 'unmet'),
  };
}

/* ------------------------------------------------------------------ Siguiente mejor acción del staff */
export interface CoachInput {
  verified: boolean; hasPrograms: boolean; activeNeeds: number; newApplications: number; toReview: number;
  overdueTasks: number; dueTodayTasks: number; expiringOpportunities: { id: string; title: string; days: number }[];
  sharedInfo: number; members: number;
}
export interface CoachAction { key: string; title: string; reason: string; href: string; priority: 'urgent' | 'important' | 'recommended' }

export function coachActions(i: CoachInput): CoachAction[] {
  const out: CoachAction[] = [];
  if (!i.verified) out.push({ key: 'verify', title: 'Completa la verificación de tu organización', reason: 'Hasta entonces puedes configurar programas y necesidades, pero no descubrir ni contactar atletas.', href: '/app/organization', priority: 'urgent' });
  for (const o of i.expiringOpportunities) out.push({ key: `exp:${o.id}`, title: `${o.title} caduca en ${o.days} día${o.days === 1 ? '' : 's'}`, reason: 'Revísala, amplía la fecha o ciérrala. Nunca se renueva sola.', href: `/app/opportunities/${o.id}`, priority: o.days <= 3 ? 'urgent' : 'important' });
  if (i.overdueTasks) out.push({ key: 'tasks:overdue', title: `${i.overdueTasks} tarea${i.overdueTasks > 1 ? 's' : ''} vencida${i.overdueTasks > 1 ? 's' : ''}`, reason: 'Tareas del equipo con fecha pasada.', href: '/app/recruit/tasks', priority: 'urgent' });
  if (i.newApplications) out.push({ key: 'apps:new', title: `Revisa ${i.newApplications} candidatura${i.newApplications > 1 ? 's' : ''} nueva${i.newApplications > 1 ? 's' : ''}`, reason: 'Atletas que se han presentado a vuestras oportunidades.', href: '/app/recruit/candidates?stage=new', priority: 'important' });
  if (i.sharedInfo) out.push({ key: 'info:shared', title: `${i.sharedInfo} atleta${i.sharedInfo > 1 ? 's han' : ' ha'} compartido información`, reason: 'Respuestas a vuestras solicitudes.', href: '/app/recruit/candidates', priority: 'important' });
  if (i.toReview) out.push({ key: 'review', title: `${i.toReview} atleta${i.toReview > 1 ? 's' : ''} en shortlist sin revisar`, reason: 'Marcados como "por revisar".', href: '/app/recruit/shortlists', priority: 'recommended' });
  if (i.dueTodayTasks) out.push({ key: 'tasks:today', title: `${i.dueTodayTasks} tarea${i.dueTodayTasks > 1 ? 's' : ''} para hoy`, reason: 'Del equipo de recruiting.', href: '/app/recruit/tasks', priority: 'important' });
  if (i.verified && !i.hasPrograms) out.push({ key: 'programs', title: 'Crea tu primer programa deportivo', reason: 'Organiza necesidades, shortlists y permisos por programa.', href: '/app/organization#programas', priority: 'recommended' });
  if (i.verified && !i.activeNeeds) out.push({ key: 'needs', title: 'Define una necesidad de recruiting', reason: 'Gala te mostrará atletas compatibles sin publicarla.', href: '/app/recruit/needs', priority: 'recommended' });
  if (i.members <= 1) out.push({ key: 'invite', title: 'Invita a tu staff', reason: 'Colaborad sin duplicar trabajo: asignaciones, notas y tareas compartidas.', href: '/app/organization#equipo', priority: 'recommended' });
  const rank = { urgent: 0, important: 1, recommended: 2 };
  return out.sort((a, b) => rank[a.priority] - rank[b.priority]);
}

/** Embudo de recruiting de la organización a partir de las etapas internas reales. */
export function funnel(stages: string[]) {
  const at = (set: string[]) => stages.filter((s) => set.includes(s)).length;
  return [
    { key: 'discovered', label: 'Candidatos', value: stages.length },
    { key: 'shortlisted', label: 'En revisión o shortlist', value: at(['review', 'priority_review', 'shortlisted', 'contact', 'call', 'active', 'offer', 'committed']) },
    { key: 'contact', label: 'Contacto', value: at(['contact', 'call', 'active', 'offer', 'committed']) },
    { key: 'offer', label: 'Oferta', value: at(['offer', 'committed']) },
    { key: 'committed', label: 'Comprometidos', value: at(['committed']) },
  ];
}

/* ------------------------------------------------------------------ Publicar oportunidad (Fase 07 · 14-17) */
/** Materiales que una oportunidad puede pedir. Se muestran al atleta antes de aplicar y en la vista previa. */
export const REQUIRED_MATERIAL_LABEL: Record<string, string> = {
  passport: 'Opportunity Passport', highlight_video: 'Highlight reel', full_game_video: 'Partido completo',
  transcript: 'Expediente académico', english_certificate: 'Certificado de inglés', test_scores: 'SAT / ACT', application_form: 'Formulario de candidatura',
};
export const INTERNATIONAL_LABEL: Record<string, string> = { yes: 'Aceptan atletas internacionales', no: 'No aceptan atletas internacionales', unknown: 'No indicado si aceptan internacionales' };
export const CONTACT_METHOD_LABEL: Record<string, string> = { gala: 'Contacto y preguntas a través de Gala', application_only: 'Solo mediante candidatura' };

export interface PublishFields {
  scholarship_status: 'not_provided' | 'potentially_available' | 'amount_stated';
  aid_amount_usd: number | null;
  aid_kind: 'full' | 'partial' | 'unknown';
  deadline: string | null;
  expires_at: string | null;
}
/**
 * Reglas de honestidad antes de guardar (la base de datos también las aplica):
 * - Sin información de beca no se puede anunciar ayuda ni «beca completa».
 * - «Importe indicado» exige un importe.
 * - La oportunidad no puede caducar antes de su plazo ni en el pasado.
 */
export function validatePublish(f: PublishFields, today = new Date().toISOString().slice(0, 10)): Record<string, string> {
  const e: Record<string, string> = {};
  if (f.scholarship_status === 'not_provided' && (f.aid_amount_usd != null || f.aid_kind !== 'unknown')) {
    e.scholarship_status = 'Has indicado ayuda: elige el estado de la beca.';
  }
  if (f.scholarship_status === 'amount_stated' && f.aid_amount_usd == null) e.aid_amount_usd = 'Indica el importe o elige otro estado de beca.';
  if (f.expires_at && f.expires_at < today) e.expires_at = 'La caducidad no puede estar en el pasado.';
  if (f.expires_at && f.deadline && f.expires_at < f.deadline) e.expires_at = 'La caducidad no puede ser anterior al plazo de candidatura.';
  return e;
}
