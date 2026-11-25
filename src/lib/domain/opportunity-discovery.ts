/**
 * Fase 8 · Buscador de oportunidades del agente («¿Para quién buscas?»).
 *
 * Capa de PROYECCIÓN sobre el motor canónico Gala Match (gala-match/engine.ts): aquí no hay reglas de encaje nuevas.
 * Convierte el resultado del motor en lo que ve el agente:
 *  - un nivel de encaje que NUNCA tapa un requisito obligatorio incumplido (NO CUMPLE ⇒ «No elegible», sea cual sea el %),
 *  - requisitos obligatorios como CUMPLE / NO CUMPLE / DESCONOCIDO (lo desconocido se queda desconocido),
 *  - hasta cuatro motivos y el dato desconocido que más pesa,
 *  - explicaciones en voz de agente que no contienen datos protegidos (ni presupuesto, ni nota exacta, ni notas internas).
 * La proyección es lo único que sale del servidor hacia el navegador.
 */
import type { Division } from '@/lib/types';
import { formatUsd } from '../i18n/format.ts';
import { DIVISION_LABEL } from './labels.ts';
import {
  CONFIDENCE_LABEL, DIMENSION_LABEL, compareMatches, galaMatch,
  type AthleteContext, type Dimension, type Factor, type FactorStatus, type GalaMatch, type InstitutionTarget, type MatchConfidence, type OpportunityTarget,
} from './gala-match/engine.ts';

/* ----------------------------------------------------------------------------- Filtros */

/** Los cinco filtros por defecto (criterio de aceptación: nunca más de cinco a la vista). */
export const DEFAULT_FILTERS = ['sport', 'destination', 'level', 'aid', 'intake'] as const;
/** Filtros avanzados, plegados en «Más filtros». */
export const ADVANCED_FILTERS = ['type', 'closing', 'verified', 'eligible'] as const;
export const DISCOVERY_FILTER_KEYS = [...DEFAULT_FILTERS, ...ADVANCED_FILTERS] as const;
export type DiscoveryFilterKey = (typeof DISCOVERY_FILTER_KEYS)[number];

export const FILTER_LABEL: Record<DiscoveryFilterKey, string> = {
  sport: 'Deporte', destination: 'País o destino', level: 'División o nivel', aid: 'Beca o ayuda', intake: 'Año de ingreso',
  type: 'Tipo de oportunidad', closing: 'Plazo', verified: 'Organización', eligible: 'Elegibilidad',
};

export type AidFilter = 'full' | 'partial' | 'any_aid';
export const AID_LABEL: Record<AidFilter, string> = { full: 'Beca completa', partial: 'Beca parcial', any_aid: 'Cualquier ayuda' };
export const DISCOVERY_TYPES = ['athletic_scholarship', 'university_recruitment', 'club_recruitment', 'academy', 'tryout', 'camp_showcase', 'development_program'] as const;
export const DISCOVERY_TYPE_LABEL: Record<(typeof DISCOVERY_TYPES)[number], string> = {
  athletic_scholarship: 'Beca deportiva', university_recruitment: 'Recruiting universitario', club_recruitment: 'Fichaje de club',
  academy: 'Academia', tryout: 'Prueba', camp_showcase: 'Campus o showcase', development_program: 'Programa de desarrollo',
};
export const DESTINATION_LABEL: Record<string, string> = {
  US: 'Estados Unidos', ES: 'España', GB: 'Reino Unido', FR: 'Francia', IT: 'Italia', DE: 'Alemania', PT: 'Portugal', CA: 'Canadá',
};

export interface DiscoveryFilters {
  sport?: string;
  destination?: string;
  level?: Division;
  aid?: AidFilter;
  intake?: number;
  type?: (typeof DISCOVERY_TYPES)[number];
  /** Cierra en ≤ N días. */
  closing?: 30 | 90;
  verified?: true;
  /** Ocultar las que tienen un requisito obligatorio incumplido. */
  eligible?: true;
}

const DIVISIONS = Object.keys(DIVISION_LABEL) as Division[];

/** Lista blanca estricta: cualquier clave o valor desconocido se descarta (lo mismo se aplica al guardar búsquedas). */
export function parseDiscoveryFilters(raw: Record<string, string | string[] | undefined>, nowYear = new Date().getFullYear()): DiscoveryFilters {
  const v = (k: string) => { const x = raw[k]; return (Array.isArray(x) ? x[0] : x)?.trim() ?? ''; };
  const f: DiscoveryFilters = {};
  const sport = v('sport');
  if (/^[a-z_]{2,40}$/.test(sport)) f.sport = sport;
  const dest = v('destination').toUpperCase();
  if (/^[A-Z]{2}$/.test(dest)) f.destination = dest;
  const level = v('level') as Division;
  if (DIVISIONS.includes(level)) f.level = level;
  const aid = v('aid') as AidFilter;
  if (aid in AID_LABEL) f.aid = aid;
  const intake = Number.parseInt(v('intake'), 10);
  if (Number.isInteger(intake) && intake >= nowYear - 1 && intake <= nowYear + 8) f.intake = intake;
  const type = v('type') as (typeof DISCOVERY_TYPES)[number];
  if ((DISCOVERY_TYPES as readonly string[]).includes(type)) f.type = type;
  const closing = Number(v('closing'));
  if (closing === 30 || closing === 90) f.closing = closing;
  if (v('verified') === '1') f.verified = true;
  if (v('eligible') === '1') f.eligible = true;
  return f;
}

/** Filtros → objeto plano de texto (para la URL y para guardar la búsqueda). */
export function filtersToRecord(f: DiscoveryFilters): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of DISCOVERY_FILTER_KEYS) {
    const x = f[k];
    if (x === undefined) continue;
    out[k] = x === true ? '1' : String(x);
  }
  return out;
}

export const advancedCount = (f: DiscoveryFilters) => ADVANCED_FILTERS.filter((k) => f[k] !== undefined).length;

/* ----------------------------------------------------------------------------- Fila de oportunidad */

/** Lo único que se lee de una oportunidad para el buscador (columnas no sensibles). */
export interface DiscoveryOpportunity {
  id: string;
  title: string;
  type: string;
  sport_id: string;
  position_ids: number[];
  graduation_years: number[];
  division: Division | null;
  min_gpa_4: number | null;
  english_required: string | null;
  deadline: string | null;
  annual_cost_usd: number | null;
  aid_amount_usd: number | null;
  aid_kind: 'full' | 'partial' | 'unknown' | null;
  financial_source: 'organization_provided' | 'platform_verified' | 'unverified' | null;
  international_eligible: 'yes' | 'no' | 'conditional' | 'unknown' | null;
  country: string | null;
  location: string | null;
  published_at: string | null;
  organization: { name: string; verified: boolean; institutionId: string | null };
}

/** País de destino: el publicado; si la oportunidad es de una universidad del directorio, EE. UU. */
export const destinationOf = (o: Pick<DiscoveryOpportunity, 'country' | 'organization'>) => o.country ?? (o.organization.institutionId ? 'US' : null);

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/** Filtros que no dependen del encaje (se aplican igual en SQL; esta versión es la referencia y la que usa el probador). */
export function passesFilters(o: DiscoveryOpportunity, f: DiscoveryFilters, today: string): boolean {
  if (o.deadline && o.deadline < today) return false;
  if (f.sport && o.sport_id !== f.sport) return false;
  if (f.destination && destinationOf(o) !== f.destination) return false;
  if (f.level && o.division !== f.level) return false;
  if (f.aid === 'full' && o.aid_kind !== 'full') return false;
  if (f.aid === 'partial' && o.aid_kind !== 'partial') return false;
  if (f.aid === 'any_aid' && o.aid_kind !== 'full' && o.aid_kind !== 'partial') return false;
  if (f.intake && o.graduation_years.length && !o.graduation_years.includes(f.intake)) return false;
  if (f.type && o.type !== f.type) return false;
  if (f.closing && (!o.deadline || o.deadline > addDays(today, f.closing))) return false;
  if (f.verified && !o.organization.verified) return false;
  return true;
}

/* ----------------------------------------------------------------------------- Proyección */

export type RequirementResult = 'PASS' | 'FAIL' | 'UNKNOWN';
export const REQUIREMENT_LABEL: Record<RequirementResult, string> = { PASS: 'Cumple', FAIL: 'No cumple', UNKNOWN: 'Desconocido' };
export type FitLevel = 'strong' | 'good' | 'partial' | 'insufficient' | 'not_eligible';
export const FIT_LABEL: Record<FitLevel, string> = {
  strong: 'Encaje fuerte', good: 'Buen encaje', partial: 'Encaje parcial', insufficient: 'Faltan datos', not_eligible: 'No elegible',
};
const SOURCE_LABEL: Record<Factor['source'], string> = {
  official: 'Dato oficial', organization: 'Publicado por la organización', passport: 'Perfil del atleta', inferred: 'Deducido por Gala',
};

export interface Requirement { id: string; label: string; result: RequirementResult; explanation: string; source: string }
export interface CompatibilityItem { id: string; label: string; status: FactorStatus; explanation: string; source: string }

export interface DiscoveryCard {
  id: string;
  title: string;
  typeLabel: string;
  organization: string;
  organizationVerified: boolean;
  destination: string | null;
  division: string | null;
  aid: string;
  intakeYears: number[];
  deadline: string | null;
  deadlineSoon: boolean;
  fit: FitLevel;
  fitLabel: string;
  /** null cuando no hay datos suficientes para dar un porcentaje honesto. */
  score: number | null;
  confidence: MatchConfidence;
  confidenceLabel: string;
  /** Como mucho cuatro motivos, de más a menos peso. */
  reasons: string[];
  /** El dato desconocido que más pesa (los obligatorios primero). */
  keyUnknown: { label: string; explanation: string } | null;
  eligible: boolean;
  isNew: boolean;
  shortlisted: boolean;
  why: {
    requirements: Requirement[];
    compatibility: { dimension: string; score: number | null; items: CompatibilityItem[] }[];
    evidence: { coverage: number; confidenceLabel: string; gaps: string[] };
  };
}

const dateEs = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const usd = (n: number) => formatUsd(n, 'es')!;

/**
 * Explicación en voz de agente. Solo usa datos publicados por la organización o hechos sí/no del perfil:
 * nunca la nota exacta, el presupuesto ni datos privados de la familia.
 */
export function agentExplanation(f: Factor, o: DiscoveryOpportunity): string {
  const s = f.status;
  switch (f.id) {
    case 'sport': return s === 'met' ? 'Es de su deporte.' : s === 'unmet' ? 'Es de otro deporte.' : 'No consta su deporte en el perfil.';
    case 'position': return s === 'met' ? 'Buscan su posición.' : s === 'unmet' ? 'Buscan otras posiciones.' : 'No consta su posición en el perfil.';
    case 'grad_year':
      return s === 'met' ? 'Buscan su promoción.' : s === 'unmet' ? `Buscan las promociones ${o.graduation_years.join(', ')}.` : 'No consta su año de graduación.';
    case 'deadline': return s === 'met' ? (o.deadline ? `Plazo abierto hasta el ${dateEs(o.deadline)}.` : 'Sin plazo publicado.') : 'El plazo ha terminado.';
    case 'min_gpa':
      return s === 'met' ? `Su nota cumple el mínimo publicado (${o.min_gpa_4} / 4.0).`
        : s === 'unmet' ? `Su nota está por debajo del mínimo publicado (${o.min_gpa_4} / 4.0).`
          : f.missingSide === 'target' ? 'Su nota está en otro sistema: la evaluará la universidad (no la convertimos).' : 'No consta su nota media.';
    case 'international': return f.detail;
    case 'division_goal': return s === 'met' ? 'Es una división que busca.' : s === 'unmet' ? 'No es una división que haya marcado.' : f.missingSide === 'target' ? 'División sin confirmar.' : 'No ha indicado qué divisiones busca.';
    case 'level_fit': return s === 'met' ? 'El nivel encaja con su objetivo deportivo.' : s === 'unmet' ? 'El nivel no corresponde a su objetivo deportivo.' : 'No ha indicado su objetivo deportivo.';
    case 'program': return s === 'met' ? 'Ofrecen lo que quiere estudiar.' : s === 'partial' ? 'Ofrecen estudios relacionados, no el programa exacto.' : s === 'unmet' ? 'No ofrecen lo que quiere estudiar.' : f.missingSide === 'target' ? 'Sin listado oficial de estudios.' : 'No ha indicado qué quiere estudiar.';
    case 'english': return s === 'met' ? `Piden ${o.english_required}: tiene certificado (confirma el nivel).` : `Piden ${o.english_required}: no consta certificado.`;
    case 'scholarship': return s === 'met' ? `Ofrecen beca ${o.aid_kind === 'full' ? 'completa' : 'parcial'}, como necesita.` : s === 'unmet' ? 'Necesita beca completa y ofrecen parcial.' : 'No detallan la beca.';
    case 'country': return s === 'met' ? 'El destino está entre sus países.' : s === 'unmet' ? 'El destino no está entre sus países.' : 'No ha indicado países de destino.';
    case 'region': return s === 'met' ? 'El estado está entre sus preferidos.' : s === 'unmet' ? 'El estado no está entre sus preferidos.' : 'No ha indicado estados preferidos.';
    case 'campus': return s === 'met' ? 'El entorno del campus encaja con lo que prefiere.' : s === 'unmet' ? 'El entorno del campus no es el que prefiere.' : 'Sin dato oficial del entorno.';
    case 'size': return s === 'met' ? 'El tamaño de la universidad encaja.' : s === 'unmet' ? 'El tamaño de la universidad no es el que prefiere.' : 'Sin dato del tamaño o de su preferencia.';
    default: return `${f.label}: ${s === 'met' ? 'encaja' : s === 'partial' ? 'encaja en parte' : s === 'unmet' ? 'no encaja' : 'desconocido'}.`;
  }
}

/** Etiquetas del motor escritas para el atleta («Tu…») → neutras para el agente. */
const AGENT_LABEL: Record<string, string> = { sport: 'Deporte', position: 'Posición buscada', grad_year: 'Promoción', deadline: 'Plazo' };
const labelOf = (f: Factor) => AGENT_LABEL[f.id] ?? f.label;

const resultOf = (s: FactorStatus): RequirementResult => (s === 'met' ? 'PASS' : s === 'unmet' ? 'FAIL' : 'UNKNOWN');

export function fitLevel(m: GalaMatch): FitLevel {
  if (m.blocked) return 'not_eligible'; // Un NO CUMPLE manda siempre, aunque el porcentaje sea alto.
  if (m.score == null) return 'insufficient';
  // «Encaje fuerte» exige que ningún requisito obligatorio esté por confirmar.
  const hardUnknown = m.dimensions.some((d) => d.factors.some((f) => f.kind === 'hard' && f.status === 'unknown'));
  if (m.score >= 80 && m.confidence !== 'low' && !hardUnknown) return 'strong';
  if (m.score >= 60) return 'good';
  return 'partial';
}

const aidText = (o: DiscoveryOpportunity) =>
  o.aid_kind === 'full' ? 'Beca completa'
    : o.aid_kind === 'partial' ? (o.aid_amount_usd != null && o.financial_source !== 'unverified' ? `Beca parcial · ${usd(o.aid_amount_usd)}/año` : 'Beca parcial')
      : 'Ayuda sin detallar';

export interface ProjectOptions { today: string; lastSeenAt?: string | null; shortlisted?: ReadonlySet<string> }

export function projectCard(o: DiscoveryOpportunity, m: GalaMatch, opt: ProjectOptions): DiscoveryCard {
  const all = m.dimensions.flatMap((d) => d.factors);
  const hard = all.filter((x) => x.kind === 'hard');
  const soft = all.filter((x) => x.kind === 'soft');
  const fit = fitLevel(m);
  const unknowns = all.filter((x) => x.status === 'unknown').sort((a, b) => (a.kind === b.kind ? b.weight - a.weight : a.kind === 'hard' ? -1 : 1));
  // El plazo ya va en el pie de la tarjeta: no ocupa un motivo.
  const reasons = all.filter((x) => (x.status === 'met' || x.status === 'partial') && x.id !== 'deadline').sort((a, b) => b.weight - a.weight).slice(0, 4).map((x) => agentExplanation(x, o));
  const dest = destinationOf(o);
  return {
    id: o.id,
    title: o.title,
    typeLabel: DISCOVERY_TYPE_LABEL[o.type as keyof typeof DISCOVERY_TYPE_LABEL] ?? 'Oportunidad',
    organization: o.organization.name,
    organizationVerified: o.organization.verified,
    destination: dest ? DESTINATION_LABEL[dest] ?? dest : null,
    division: o.division ? DIVISION_LABEL[o.division] : null,
    aid: aidText(o),
    intakeYears: o.graduation_years,
    deadline: o.deadline,
    deadlineSoon: Boolean(o.deadline && o.deadline <= addDays(opt.today, 14)),
    fit,
    fitLabel: FIT_LABEL[fit],
    score: m.score,
    confidence: m.confidence,
    confidenceLabel: CONFIDENCE_LABEL[m.confidence],
    reasons,
    keyUnknown: unknowns[0] ? { label: labelOf(unknowns[0]), explanation: agentExplanation(unknowns[0], o) } : null,
    eligible: !m.blocked,
    isNew: Boolean(opt.lastSeenAt && o.published_at && o.published_at > opt.lastSeenAt),
    shortlisted: opt.shortlisted?.has(o.id) ?? false,
    why: {
      requirements: hard.map((x) => ({ id: x.id, label: labelOf(x), result: resultOf(x.status), explanation: agentExplanation(x, o), source: SOURCE_LABEL[x.source] })),
      compatibility: (Object.keys(DIMENSION_LABEL) as Dimension[])
        .map((d) => ({ d, items: soft.filter((x) => x.dimension === d) }))
        .filter((g) => g.items.length)
        .map((g) => ({
          dimension: DIMENSION_LABEL[g.d],
          score: m.dimensions.find((x) => x.dimension === g.d)?.score ?? null,
          items: g.items.map((x) => ({ id: x.id, label: labelOf(x), status: x.status, explanation: agentExplanation(x, o), source: SOURCE_LABEL[x.source] })),
        })),
      evidence: { coverage: m.coverage, confidenceLabel: CONFIDENCE_LABEL[m.confidence], gaps: m.evidenceGaps.map((g) => g.label) },
    },
  };
}

/** Orden: elegibles primero (motor canónico), luego plazo más cercano. */
export function sortCards(rows: { card: DiscoveryCard; m: GalaMatch }[]) {
  return [...rows].sort((a, b) => compareMatches(a.m, b.m) || (a.card.deadline ?? '9999').localeCompare(b.card.deadline ?? '9999') || a.card.id.localeCompare(b.card.id));
}

/** ¿Puede añadirse a la shortlist? Un requisito obligatorio incumplido no se puede saltar (la acción del servidor lo vuelve a comprobar). */
export const canShortlist = (m: GalaMatch) => !m.blocked;

/** Temporada del proceso (formato AAAA-AA) a partir del año de ingreso. */
export const cycleFor = (intakeYear: number) => `${intakeYear}-${String((intakeYear + 1) % 100).padStart(2, '0')}`;

/* ----------------------------------------------------------------------------- Puntuación (motor canónico) */

/** Contexto del atleta tal como lo ve el agente: sin presupuesto (privado de la familia) y con su país. */
export type AthleteBase = { ctx: AthleteContext; country: string | null };
export type InstitutionFacts = Omit<InstitutionTarget, 'kind' | 'name'>;

/** Si el atleta compite como internacional depende del destino de cada oportunidad. */
export function contextFor(base: AthleteBase, o: DiscoveryOpportunity): AthleteContext {
  const dest = destinationOf(o);
  return { ...base.ctx, annual_budget_usd: null, budget_private: true, is_international: !base.country ? null : dest ? base.country.toUpperCase() !== dest : null };
}

export function scoreOpportunity(base: AthleteBase, o: DiscoveryOpportunity, inst: InstitutionFacts | null, now = new Date()): GalaMatch {
  const target: OpportunityTarget = {
    kind: 'opportunity', id: o.id, name: o.title, sport_id: o.sport_id, position_ids: o.position_ids ?? [], graduation_years: o.graduation_years ?? [],
    division: o.division, min_gpa_4: o.min_gpa_4, english_required: o.english_required, deadline: o.deadline, annual_cost_usd: o.annual_cost_usd,
    aid_amount_usd: o.aid_amount_usd, aid_kind: o.aid_kind, financial_source: o.financial_source, international_eligible: o.international_eligible,
    institution: inst ? { ...inst, program_cips: inst.program_cips ?? [], sports_offered: inst.sports_offered ?? [] } : null,
  };
  return galaMatch(contextFor(base, o), target, now);
}
