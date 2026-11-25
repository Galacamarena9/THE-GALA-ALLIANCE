/**
 * GALA MATCH v2 · motor de compatibilidad determinista y explicable.
 *
 * Qué es: compatibilidad entre la información disponible del Passport y la de una universidad u oportunidad.
 * Qué NO es: probabilidad de admisión, de beca, de ser reclutado ni de recibir una oferta.
 *
 * Principios (no negociables):
 *  - Los criterios y pesos viven en MATCH_CONFIG; el resto de la app no conoce reglas.
 *  - Un dato que falta es "desconocido", nunca un cero ni un supuesto.
 *  - Requisitos obligatorios (hard) separados de preferencias (soft). Un bloqueo no se esconde tras un porcentaje.
 *  - Nunca se inventan necesidades del equipo, becas ni costes. Las notas internacionales no se convierten a GPA.
 *  - Cada factor indica de dónde sale el dato: oficial, organización, Passport o inferencia declarada.
 */
import type { MajorDef } from './majors.ts';
import { formatUsd } from '../../i18n/format.ts';
import { programMatch, resolveMajor } from './majors.ts';

export const GALA_MATCH_VERSION = 'gm-2.0';

export type Dimension = 'athletic' | 'academic' | 'location' | 'financial' | 'preferences' | 'timing';
export const DIMENSION_LABEL: Record<Dimension, string> = {
  athletic: 'Deportivo', academic: 'Académico', location: 'Ubicación', financial: 'Económico', preferences: 'Preferencias', timing: 'Plazos',
};

export type FactorStatus = 'met' | 'partial' | 'unmet' | 'unknown';
/** Origen del dato que decide el factor. */
export type FactSource = 'official' | 'organization' | 'passport' | 'inferred';
/** Quién debe aportar el dato que falta. */
export type MissingSide = 'athlete' | 'target';

export interface Factor {
  id: string;
  dimension: Dimension;
  kind: 'hard' | 'soft';
  weight: number;
  status: FactorStatus;
  label: string;
  detail: string;
  source: FactSource;
  missingSide?: MissingSide;
  fix?: { action: string; href: string };
}

/* --------------------------------------------------------------------- Entradas */
export interface AthleteContext {
  sport_id: string | null;
  primary_position_id: number | null;
  secondary_position_id: number | null;
  graduation_year: number | null;
  /** Caminos buscados (NCAA D-I, NAIA…). */
  pathways: string[];
  countries: string[];
  regions: string[];
  intended_majors: string[];
  school_size: 'small' | 'medium' | 'large' | 'any' | null;
  sport_level: 'top' | 'competitive' | 'development' | 'any' | null;
  campus_setting: 'urban' | 'suburban' | 'rural' | 'any' | null;
  scholarship_need: 'full' | 'partial' | 'none' | 'unsure' | null;
  annual_budget_usd: number | null;
  /** Nota solo comparable si está en escala 4.0 (sistema estadounidense). */
  gpa: number | null;
  gpa_scale: number | null;
  education_system: string | null;
  has_english_certificate: boolean;
  /** Evidencia del Passport (no puntúa el encaje; afecta a la confianza y a "lo que falta"). */
  has_highlight: boolean;
  has_full_game: boolean;
  verified_stats: number;
  /**
   * Si el atleta compite como internacional para esa oportunidad (otro país). `undefined` = no se evalúa
   * (vista del propio atleta, que lo ve en la ficha); `null` = no sabemos su país → requisito DESCONOCIDO.
   */
  is_international?: boolean | null;
  /**
   * Vista de agente: el presupuesto familiar es privado y nunca llega al agente, así que el factor «Presupuesto»
   * no se evalúa (ni como desconocido: no es un dato que falte, es un dato que no le corresponde).
   */
  budget_private?: boolean;
}

export interface InstitutionTarget {
  kind: 'institution';
  id: string;
  name: string;
  state: string | null;
  sports_offered: string[];
  division: string | null;
  association: string | null;
  athletic_source: 'manual_admin' | 'organization' | 'official_external' | null;
  ownership: 'public' | 'private_nonprofit' | 'private_forprofit' | null;
  locale: 'city' | 'suburb' | 'town' | 'rural' | null;
  enrollment: number | null;
  cost_attendance_usd: number | null;
  tuition_in_state_usd: number | null;
  tuition_out_of_state_usd: number | null;
  program_cips: string[];
}

export interface OpportunityTarget {
  kind: 'opportunity';
  id: string;
  name: string;
  sport_id: string;
  position_ids: number[];
  graduation_years: number[];
  division: string | null;
  min_gpa_4: number | null;
  english_required: string | null;
  deadline: string | null;
  annual_cost_usd: number | null;
  aid_amount_usd: number | null;
  aid_kind: 'full' | 'partial' | 'unknown' | null;
  financial_source: 'organization_provided' | 'platform_verified' | 'unverified' | null;
  /** Si admiten atletas internacionales (publicado por la organización). */
  international_eligible?: 'yes' | 'no' | 'conditional' | 'unknown' | null;
  /** Si la oportunidad pertenece a una universidad del directorio, su perfil completa ubicación y estudios. */
  institution?: Omit<InstitutionTarget, 'kind' | 'id' | 'name'> | null;
}

export type MatchTarget = InstitutionTarget | OpportunityTarget;

/* --------------------------------------------------------------------- Configuración */
/** Pesos por factor (editables sin tocar la lógica). */
export const MATCH_CONFIG = {
  weights: {
    sport: 30, position: 12, division_goal: 10, level_fit: 6,
    program: 12, min_gpa: 10, english: 5,
    country: 4, region: 5, campus: 4,
    budget: 12, scholarship: 6,
    size: 5,
    grad_year: 10, deadline: 8, international: 10,
  },
  /** Cobertura mínima para mostrar un porcentaje; por debajo se muestra "datos insuficientes". */
  minCoverageForScore: 40,
  confidence: { high: 75, medium: 50 },
  sizeBuckets: { small: [0, 5000], medium: [5000, 15000], large: [15000, Infinity] } as Record<'small' | 'medium' | 'large', [number, number]>,
  /** Qué divisiones encajan con cada nivel deportivo buscado (orientación declarada, no juicio de talento). */
  levelDivisions: {
    top: ['ncaa_d1'],
    competitive: ['ncaa_d1', 'ncaa_d2', 'naia'],
    development: ['ncaa_d2', 'ncaa_d3', 'naia', 'njcaa'],
  } as Record<'top' | 'competitive' | 'development', string[]>,
};

const P = '/app/athlete/passport';
const US_STATES: Record<string, string> = {
  AL: 'alabama', AK: 'alaska', AZ: 'arizona', AR: 'arkansas', CA: 'california', CO: 'colorado', CT: 'connecticut', DE: 'delaware', FL: 'florida', GA: 'georgia',
  HI: 'hawaii', ID: 'idaho', IL: 'illinois', IN: 'indiana', IA: 'iowa', KS: 'kansas', KY: 'kentucky', LA: 'louisiana', ME: 'maine', MD: 'maryland',
  MA: 'massachusetts', MI: 'michigan', MN: 'minnesota', MS: 'mississippi', MO: 'missouri', MT: 'montana', NE: 'nebraska', NV: 'nevada', NH: 'new hampshire', NJ: 'new jersey',
  NM: 'new mexico', NY: 'new york', NC: 'north carolina', ND: 'north dakota', OH: 'ohio', OK: 'oklahoma', OR: 'oregon', PA: 'pennsylvania', RI: 'rhode island', SC: 'south carolina',
  SD: 'south dakota', TN: 'tennessee', TX: 'texas', UT: 'utah', VT: 'vermont', VA: 'virginia', WA: 'washington', WV: 'west virginia', WI: 'wisconsin', WY: 'wyoming', DC: 'district of columbia',
};
export const STATE_NAME = (code: string | null) => (code && US_STATES[code] ? US_STATES[code].replace(/\b\w/g, (c) => c.toUpperCase()) : code ?? '');
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export const usdFmt = (n: number) => formatUsd(n, 'es')!;

/**
 * Coste anual PUBLICADO estimado para un estudiante internacional.
 * Scorecard publica el coste de asistencia con matrícula de residente en las públicas: sustituimos esa matrícula
 * por la de no residente (la que paga un internacional). No restamos becas ni ayudas no confirmadas.
 */
export function estimatedIntlCost(t: Pick<InstitutionTarget, 'cost_attendance_usd' | 'tuition_in_state_usd' | 'tuition_out_of_state_usd' | 'ownership'>) {
  if (t.cost_attendance_usd == null) return null;
  if (t.ownership === 'public' && t.tuition_in_state_usd != null && t.tuition_out_of_state_usd != null) {
    return t.cost_attendance_usd - t.tuition_in_state_usd + t.tuition_out_of_state_usd;
  }
  return t.cost_attendance_usd;
}

/* --------------------------------------------------------------------- Factores */
function institutionPart(t: MatchTarget): Omit<InstitutionTarget, 'kind' | 'id' | 'name'> | null {
  return t.kind === 'institution' ? t : t.institution ?? null;
}

function buildFactors(a: AthleteContext, t: MatchTarget, now: Date): Factor[] {
  const W = MATCH_CONFIG.weights;
  const f: Factor[] = [];
  const inst = institutionPart(t);

  // ---------- DEPORTIVO
  const sports = t.kind === 'opportunity' ? [t.sport_id] : t.sports_offered;
  if (!a.sport_id) {
    f.push({ id: 'sport', dimension: 'athletic', kind: 'hard', weight: W.sport, status: 'unknown', label: 'Deporte', detail: 'No has indicado tu deporte.', source: 'passport', missingSide: 'athlete', fix: { action: 'Indica tu deporte', href: `${P}?s=identidad` } });
  } else if (!sports.length) {
    f.push({ id: 'sport', dimension: 'athletic', kind: 'hard', weight: W.sport, status: 'unknown', label: 'Deporte', detail: 'Aún no tenemos confirmados los deportes de esta universidad.', source: 'official', missingSide: 'target' });
  } else {
    const ok = sports.includes(a.sport_id);
    f.push({
      id: 'sport', dimension: 'athletic', kind: 'hard', weight: W.sport, status: ok ? 'met' : 'unmet', label: 'Tu deporte está disponible',
      detail: ok ? (t.kind === 'opportunity' ? 'La oportunidad es de tu deporte.' : 'La universidad tiene programa de tu deporte.') : 'Tu deporte no figura en esta universidad u oportunidad.',
      source: t.kind === 'opportunity' ? 'organization' : inst && 'athletic_source' in inst && inst.athletic_source === 'organization' ? 'organization' : 'official',
    });
  }

  if (t.kind === 'opportunity' && t.position_ids.length) {
    if (!a.primary_position_id) {
      f.push({ id: 'position', dimension: 'athletic', kind: 'hard', weight: W.position, status: 'unknown', label: 'Posición buscada', detail: 'No has indicado tu posición.', source: 'passport', missingSide: 'athlete', fix: { action: 'Indica tu posición', href: `${P}?s=identidad` } });
    } else {
      const ok = t.position_ids.includes(a.primary_position_id) || (a.secondary_position_id != null && t.position_ids.includes(a.secondary_position_id));
      f.push({ id: 'position', dimension: 'athletic', kind: 'hard', weight: W.position, status: ok ? 'met' : 'unmet', label: 'Posición buscada', detail: ok ? 'Buscan tu posición (publicado por la organización).' : 'La oportunidad busca otras posiciones.', source: 'organization' });
    }
  }
  // Para universidades sin oportunidad publicada NO evaluamos posición: no sabemos qué necesita el equipo.

  const division = t.kind === 'opportunity' ? t.division ?? inst?.division ?? null : t.division;
  const divGoals = a.pathways.filter((p) => ['ncaa_d1', 'ncaa_d2', 'ncaa_d3', 'naia', 'njcaa'].includes(p));
  if (!division) {
    f.push({ id: 'division_goal', dimension: 'athletic', kind: 'soft', weight: W.division_goal, status: 'unknown', label: 'División', detail: 'No tenemos confirmada la división.', source: 'official', missingSide: 'target' });
  } else if (!divGoals.length) {
    f.push({ id: 'division_goal', dimension: 'athletic', kind: 'soft', weight: W.division_goal, status: 'unknown', label: 'División en tus objetivos', detail: 'No has indicado qué divisiones buscas.', source: 'passport', missingSide: 'athlete', fix: { action: 'Indica qué buscas', href: `${P}?s=objetivos` } });
  } else {
    const ok = divGoals.includes(division);
    f.push({ id: 'division_goal', dimension: 'athletic', kind: 'soft', weight: W.division_goal, status: ok ? 'met' : 'unmet', label: 'División en tus objetivos', detail: ok ? 'Compite en una división que buscas.' : 'Compite en una división que no has marcado.', source: 'passport' });
  }

  if (division && a.sport_level && a.sport_level !== 'any') {
    const ok = MATCH_CONFIG.levelDivisions[a.sport_level].includes(division);
    f.push({ id: 'level_fit', dimension: 'athletic', kind: 'soft', weight: W.level_fit, status: ok ? 'met' : 'unmet', label: 'Nivel deportivo que buscas', detail: ok ? 'La división encaja con el nivel que has indicado.' : 'La división no corresponde al nivel que has indicado.', source: 'inferred' });
  } else if (division && !a.sport_level) {
    f.push({ id: 'level_fit', dimension: 'athletic', kind: 'soft', weight: W.level_fit, status: 'unknown', label: 'Nivel deportivo que buscas', detail: 'No has indicado el nivel deportivo que buscas.', source: 'passport', missingSide: 'athlete', fix: { action: 'Indica tu nivel deportivo objetivo', href: `${P}?s=objetivos` } });
  }

  // ---------- ACADÉMICO
  const majors = a.intended_majors.map(resolveMajor).filter((m): m is MajorDef => m != null);
  if (!a.intended_majors.length) {
    f.push({ id: 'program', dimension: 'academic', kind: 'soft', weight: W.program, status: 'unknown', label: 'Estudios que buscas', detail: 'No has indicado qué quieres estudiar.', source: 'passport', missingSide: 'athlete', fix: { action: 'Añade qué quieres estudiar', href: `${P}?s=objetivos` } });
  } else if (!inst || !inst.program_cips.length) {
    f.push({ id: 'program', dimension: 'academic', kind: 'soft', weight: W.program, status: 'unknown', label: 'Estudios que buscas', detail: 'No tenemos el listado oficial de programas de esta universidad.', source: 'official', missingSide: 'target' });
  } else if (!majors.length) {
    f.push({ id: 'program', dimension: 'academic', kind: 'soft', weight: W.program, status: 'unknown', label: 'Estudios que buscas', detail: `No reconocemos «${a.intended_majors[0]}». Prueba con un nombre más común (p. ej. Business, Psicología).`, source: 'passport', missingSide: 'athlete', fix: { action: 'Revisa cómo escribes tus estudios', href: `${P}?s=objetivos` } });
  } else {
    const results = majors.map((m) => ({ m, r: programMatch(m, inst.program_cips) }));
    const exact = results.find((x) => x.r === 'exact');
    const related = results.find((x) => x.r === 'related');
    f.push(exact
      ? { id: 'program', dimension: 'academic', kind: 'soft', weight: W.program, status: 'met', label: 'Estudios que buscas', detail: `Ofrece ${exact.m.label} (coincidencia exacta).`, source: 'official' }
      : related
        ? { id: 'program', dimension: 'academic', kind: 'soft', weight: W.program, status: 'partial', label: 'Estudios que buscas', detail: `Ofrece programas relacionados con ${related.m.label}, no el programa exacto.`, source: 'official' }
        : { id: 'program', dimension: 'academic', kind: 'soft', weight: W.program, status: 'unmet', label: 'Estudios que buscas', detail: 'No figura ningún programa de grado de lo que buscas.', source: 'official' });
  }

  if (t.kind === 'opportunity' && t.min_gpa_4 != null) {
    if (a.gpa == null) {
      f.push({ id: 'min_gpa', dimension: 'academic', kind: 'hard', weight: W.min_gpa, status: 'unknown', label: `Nota mínima (${t.min_gpa_4} / 4.0)`, detail: 'No has indicado tu nota media.', source: 'passport', missingSide: 'athlete', fix: { action: 'Añade tu nota media', href: `${P}?s=academico` } });
    } else if (a.gpa_scale !== 4) {
      // No convertimos notas internacionales a GPA: no existe un método fiable único.
      f.push({ id: 'min_gpa', dimension: 'academic', kind: 'hard', weight: W.min_gpa, status: 'unknown', label: `Nota mínima (${t.min_gpa_4} / 4.0)`, detail: 'Tu nota está en otro sistema. La universidad la evaluará con su propio método; no la convertimos.', source: 'passport', missingSide: 'target' });
    } else {
      const ok = a.gpa >= t.min_gpa_4;
      f.push({ id: 'min_gpa', dimension: 'academic', kind: 'hard', weight: W.min_gpa, status: ok ? 'met' : 'unmet', label: `Nota mínima (${t.min_gpa_4} / 4.0)`, detail: ok ? 'Tu GPA cumple el mínimo publicado.' : 'Tu GPA está por debajo del mínimo publicado.', source: 'organization' });
    }
  }

  if (t.kind === 'opportunity' && t.english_required) {
    f.push(a.has_english_certificate
      ? { id: 'english', dimension: 'academic', kind: 'soft', weight: W.english, status: 'met', label: 'Inglés', detail: `Piden: ${t.english_required}. Tienes certificado (comprueba el nivel exacto).`, source: 'passport' }
      : { id: 'english', dimension: 'academic', kind: 'soft', weight: W.english, status: 'unknown', label: 'Inglés', detail: `Piden: ${t.english_required}. No has añadido certificado.`, source: 'passport', missingSide: 'athlete', fix: { action: 'Añade tu certificado de inglés', href: `${P}?s=academico` } });
  }

  // ---------- UBICACIÓN (todas las universidades del directorio están en EE. UU.)
  if (inst) {
    f.push(!a.countries.length
      ? { id: 'country', dimension: 'location', kind: 'soft', weight: W.country, status: 'unknown', label: 'País', detail: 'No has indicado países preferidos.', source: 'passport', missingSide: 'athlete', fix: { action: 'Elige tus países', href: `${P}?s=objetivos` } }
      : { id: 'country', dimension: 'location', kind: 'soft', weight: W.country, status: a.countries.includes('US') ? 'met' : 'unmet', label: 'País', detail: a.countries.includes('US') ? 'Has indicado Estados Unidos como destino.' : 'Estados Unidos no está entre tus países.', source: 'passport' });

    if (a.regions.length && inst.state) {
      const name = US_STATES[inst.state] ?? '';
      const ok = a.regions.some((r) => { const n = norm(r); return n === inst.state!.toLowerCase() || n === name; });
      f.push({ id: 'region', dimension: 'location', kind: 'soft', weight: W.region, status: ok ? 'met' : 'unmet', label: 'Estado', detail: ok ? `${STATE_NAME(inst.state)} está entre tus estados preferidos.` : `${STATE_NAME(inst.state)} no está entre tus estados preferidos.`, source: 'official' });
    } else if (!a.regions.length) {
      f.push({ id: 'region', dimension: 'location', kind: 'soft', weight: W.region, status: 'unknown', label: 'Estado', detail: 'No has indicado estados preferidos.', source: 'passport', missingSide: 'athlete', fix: { action: 'Indica tus estados preferidos', href: `${P}?s=objetivos` } });
    }

    if (a.campus_setting && a.campus_setting !== 'any') {
      if (!inst.locale) {
        f.push({ id: 'campus', dimension: 'location', kind: 'soft', weight: W.campus, status: 'unknown', label: 'Entorno del campus', detail: 'No tenemos dato oficial del entorno.', source: 'official', missingSide: 'target' });
      } else {
        const map = { urban: ['city'], suburban: ['suburb', 'town'], rural: ['rural', 'town'] } as const;
        const ok = (map[a.campus_setting] as readonly string[]).includes(inst.locale);
        const loc = { city: 'urbano', suburb: 'de periferia', town: 'de ciudad pequeña', rural: 'rural' }[inst.locale];
        f.push({ id: 'campus', dimension: 'location', kind: 'soft', weight: W.campus, status: ok ? 'met' : 'unmet', label: 'Entorno del campus', detail: `Campus ${loc} (dato oficial).`, source: 'official' });
      }
    }
  }

  // ---------- ECONÓMICO (nunca restamos una beca no confirmada)
  const confirmedAid = t.kind === 'opportunity' && t.aid_amount_usd != null && (t.financial_source === 'organization_provided' || t.financial_source === 'platform_verified');
  const published = t.kind === 'opportunity' ? (t.annual_cost_usd ?? (inst ? estimatedIntlCost(inst) : null)) : estimatedIntlCost(t);
  const yourCost = published == null ? null : confirmedAid ? Math.max(0, published - (t as OpportunityTarget).aid_amount_usd!) : published;
  if (a.budget_private) {
    // Sin factor de presupuesto: ver AthleteContext.budget_private.
  } else if (a.annual_budget_usd == null) {
    f.push({ id: 'budget', dimension: 'financial', kind: 'soft', weight: W.budget, status: 'unknown', label: 'Presupuesto', detail: 'No has indicado tu presupuesto anual (es privado).', source: 'passport', missingSide: 'athlete', fix: { action: 'Indica tu presupuesto anual', href: `${P}?s=objetivos` } });
  } else if (yourCost == null) {
    f.push({ id: 'budget', dimension: 'financial', kind: 'soft', weight: W.budget, status: 'unknown', label: 'Coste frente a tu presupuesto', detail: 'No hay coste publicado.', source: 'official', missingSide: 'target' });
  } else {
    const ok = yourCost <= a.annual_budget_usd;
    const near = !ok && yourCost <= a.annual_budget_usd * 1.25;
    f.push({
      id: 'budget', dimension: 'financial', kind: 'soft', weight: W.budget, status: ok ? 'met' : near ? 'partial' : 'unmet', label: 'Coste frente a tu presupuesto',
      detail: `${confirmedAid ? 'Coste con la ayuda confirmada' : 'Coste publicado estimado, sin becas'}: ${usdFmt(yourCost)}/año · tu presupuesto: ${usdFmt(a.annual_budget_usd)}.${!ok && !confirmedAid ? ' Una beca podría cambiarlo, pero no la damos por hecha.' : ''}`,
      source: confirmedAid ? 'organization' : 'official',
    });
  }
  if (t.kind === 'opportunity' && a.scholarship_need && a.scholarship_need !== 'unsure' && a.scholarship_need !== 'none') {
    if (!t.aid_kind || t.aid_kind === 'unknown') {
      f.push({ id: 'scholarship', dimension: 'financial', kind: 'soft', weight: W.scholarship, status: 'unknown', label: 'Beca', detail: 'La oportunidad no detalla la beca.', source: 'organization', missingSide: 'target' });
    } else {
      const ok = a.scholarship_need === 'partial' || t.aid_kind === 'full';
      f.push({ id: 'scholarship', dimension: 'financial', kind: 'soft', weight: W.scholarship, status: ok ? 'met' : 'unmet', label: 'Beca', detail: `Ofrecen beca ${t.aid_kind === 'full' ? 'completa' : 'parcial'} (publicado por la organización).`, source: 'organization' });
    }
  }

  // ---------- PREFERENCIAS
  if (inst && a.school_size && a.school_size !== 'any') {
    if (inst.enrollment == null) {
      f.push({ id: 'size', dimension: 'preferences', kind: 'soft', weight: W.size, status: 'unknown', label: 'Tamaño de la universidad', detail: 'No tenemos el número oficial de estudiantes.', source: 'official', missingSide: 'target' });
    } else {
      const [lo, hi] = MATCH_CONFIG.sizeBuckets[a.school_size];
      const ok = inst.enrollment >= lo && inst.enrollment < hi;
      f.push({ id: 'size', dimension: 'preferences', kind: 'soft', weight: W.size, status: ok ? 'met' : 'unmet', label: 'Tamaño de la universidad', detail: `${inst.enrollment.toLocaleString('es-ES')} estudiantes de grado (dato oficial).`, source: 'official' });
    }
  } else if (inst && !a.school_size) {
    f.push({ id: 'size', dimension: 'preferences', kind: 'soft', weight: W.size, status: 'unknown', label: 'Tamaño de la universidad', detail: 'No has indicado qué tamaño prefieres.', source: 'passport', missingSide: 'athlete', fix: { action: 'Indica tu tamaño de universidad preferido', href: `${P}?s=objetivos` } });
  }

  // ---------- PLAZOS (solo oportunidades: una universidad sin oportunidad no tiene ventana publicada)
  if (t.kind === 'opportunity') {
    if (t.graduation_years.length) {
      if (!a.graduation_year) f.push({ id: 'grad_year', dimension: 'timing', kind: 'hard', weight: W.grad_year, status: 'unknown', label: 'Promoción', detail: 'No has indicado tu año de graduación.', source: 'passport', missingSide: 'athlete', fix: { action: 'Añade tu año de graduación', href: `${P}?s=identidad` } });
      else {
        const ok = t.graduation_years.includes(a.graduation_year);
        f.push({ id: 'grad_year', dimension: 'timing', kind: 'hard', weight: W.grad_year, status: ok ? 'met' : 'unmet', label: 'Promoción', detail: ok ? `Buscan la promoción ${a.graduation_year}.` : `Buscan las promociones ${t.graduation_years.join(', ')}.`, source: 'organization' });
      }
    }
    if (a.is_international !== undefined && (a.is_international === null || a.is_international)) {
      const e = t.international_eligible ?? 'unknown';
      if (a.is_international === null) {
        f.push({ id: 'international', dimension: 'timing', kind: 'hard', weight: W.international, status: 'unknown', label: 'Plaza para internacionales', detail: 'No consta el país del atleta, así que no sabemos si cuenta como internacional.', source: 'passport', missingSide: 'athlete' });
      } else if (e === 'yes' || e === 'no') {
        f.push({ id: 'international', dimension: 'timing', kind: 'hard', weight: W.international, status: e === 'yes' ? 'met' : 'unmet', label: 'Plaza para internacionales', detail: e === 'yes' ? 'Admiten atletas internacionales.' : 'Esta oportunidad no admite atletas internacionales.', source: 'organization' });
      } else {
        f.push({ id: 'international', dimension: 'timing', kind: 'hard', weight: W.international, status: 'unknown', label: 'Plaza para internacionales', detail: e === 'conditional' ? 'Admiten internacionales con condiciones: hay que confirmarlas.' : 'La organización no ha dicho si admite internacionales.', source: 'organization', missingSide: 'target' });
      }
    }
    if (t.deadline) {
      const open = new Date(`${t.deadline}T23:59:59`) >= now;
      f.push({ id: 'deadline', dimension: 'timing', kind: 'hard', weight: W.deadline, status: open ? 'met' : 'unmet', label: 'Plazo', detail: open ? `Abierta hasta el ${t.deadline}.` : 'El plazo ha terminado.', source: 'organization' });
    }
  }
  return f;
}

/* --------------------------------------------------------------------- Resultado */
export type MatchConfidence = 'high' | 'medium' | 'low';
export const CONFIDENCE_LABEL: Record<MatchConfidence, string> = { high: 'Alta', medium: 'Media', low: 'Baja' };

export interface GalaMatch {
  /** null = datos insuficientes para dar un porcentaje honesto. */
  score: number | null;
  blocked: boolean;
  confidence: MatchConfidence;
  coverage: number;
  dimensions: { dimension: Dimension; score: number | null; factors: Factor[] }[];
  why: Factor[];
  missing: Factor[];
  blockers: Factor[];
  /** Lo que el atleta puede hacer (ordenado por impacto). */
  nextStep: Factor['fix'] & { reason: string } | null;
  /** Evidencia del Passport que no puntúa pero que el coach mirará. */
  evidenceGaps: { label: string; href: string }[];
  version: string;
}

const value = (s: FactorStatus) => (s === 'met' ? 1 : s === 'partial' ? 0.5 : 0);

export function galaMatch(a: AthleteContext, t: MatchTarget, now = new Date()): GalaMatch {
  const factors = buildFactors(a, t, now);
  const known = factors.filter((x) => x.status !== 'unknown');
  const totalW = factors.reduce((s, x) => s + x.weight, 0);
  const knownW = known.reduce((s, x) => s + x.weight, 0);
  const coverage = totalW ? Math.round((knownW / totalW) * 100) : 0;
  const blockers = factors.filter((x) => x.kind === 'hard' && x.status === 'unmet');
  const raw = knownW ? Math.round((known.reduce((s, x) => s + x.weight * value(x.status), 0) / knownW) * 100) : 0;
  const score = coverage >= MATCH_CONFIG.minCoverageForScore ? raw : null;
  const confidence: MatchConfidence = coverage >= MATCH_CONFIG.confidence.high ? 'high' : coverage >= MATCH_CONFIG.confidence.medium ? 'medium' : 'low';

  const dims = (Object.keys(DIMENSION_LABEL) as Dimension[]).map((d) => {
    const fs = factors.filter((x) => x.dimension === d);
    const k = fs.filter((x) => x.status !== 'unknown');
    const w = k.reduce((s, x) => s + x.weight, 0);
    return { dimension: d, factors: fs, score: w ? Math.round((k.reduce((s, x) => s + x.weight * value(x.status), 0) / w) * 100) : null };
  }).filter((d) => d.factors.length);

  const missing = factors.filter((x) => x.status === 'unknown').sort((x, y) => y.weight - x.weight);
  const fixable = missing.filter((x) => x.fix);
  const evidenceGaps: GalaMatch['evidenceGaps'] = [];
  if (!a.has_highlight) evidenceGaps.push({ label: 'Highlight Reel', href: `${P}?s=video` });
  if (!a.has_full_game) evidenceGaps.push({ label: 'Partido completo', href: `${P}?s=video` });
  if (a.verified_stats === 0) evidenceGaps.push({ label: 'Estadísticas verificadas', href: `${P}?s=verificacion` });
  if (!a.has_english_certificate) evidenceGaps.push({ label: 'Certificado de inglés', href: `${P}?s=academico` });

  const nextStep = fixable[0]
    ? { ...fixable[0].fix!, reason: 'Completa este dato para que el encaje sea más preciso.' }
    : evidenceGaps[0]
      ? { action: `Añade: ${evidenceGaps[0].label}`, href: evidenceGaps[0].href, reason: 'No cambia el porcentaje, pero es lo primero que mira un coach.' }
      : null;

  return {
    score,
    blocked: blockers.length > 0,
    confidence,
    coverage,
    dimensions: dims,
    why: factors.filter((x) => x.status === 'met' || x.status === 'partial'),
    missing,
    blockers,
    nextStep,
    evidenceGaps,
    version: GALA_MATCH_VERSION,
  };
}

/** Orden de resultados: bloqueadas al final; luego porcentaje y confianza. */
export function compareMatches(x: GalaMatch, y: GalaMatch) {
  if (x.blocked !== y.blocked) return x.blocked ? 1 : -1;
  const sx = x.score ?? -1, sy = y.score ?? -1;
  if (sx !== sy) return sy - sx;
  return y.coverage - x.coverage;
}
