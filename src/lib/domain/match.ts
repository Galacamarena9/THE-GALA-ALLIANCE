import type { AthleteAcademics, AthleteProfile, Opportunity } from '@/lib/types';

/**
 * Motor de compatibilidad explicable (v1, determinista).
 * Devuelve COMPATIBILIDAD, nunca probabilidad de admisión ni de beca.
 * Separa requisitos obligatorios de preferencias y declara los datos que faltan.
 */
export const MATCH_ENGINE_VERSION = 'rules-1.1';

export type MatchTier = 'strong' | 'potential' | 'reach' | 'not_eligible';

/** Áreas del encaje. Ningún criterio usa atributos sensibles (sexo, origen, salud…). */
export type MatchArea = 'athletic' | 'academic' | 'financial' | 'timing';
export const MATCH_AREA_LABEL: Record<MatchArea, string> = {
  athletic: 'Deportivo',
  academic: 'Académico',
  financial: 'Económico',
  timing: 'Plazos y elegibilidad',
};

export interface AreaScore {
  area: MatchArea;
  /** 0-100 sobre los criterios con dato; null si el área no tiene ningún dato para evaluarse. */
  score: number | null;
  /** Criterios del área que se pudieron evaluar / total del área. */
  evaluated: number;
  total: number;
}

/**
 * Confianza del cálculo según el peso de los criterios con dato:
 * alta ≥ 85 %, media ≥ 60 %, baja por debajo. Una puntuación con confianza baja no debe presentarse como firme.
 */
export type MatchConfidence = 'high' | 'medium' | 'low';
export const CONFIDENCE_LABEL: Record<MatchConfidence, string> = { high: 'Confianza alta', medium: 'Confianza media', low: 'Confianza baja' };

export interface MatchResult {
  score: number;
  tier: MatchTier;
  met: string[];
  unmet: string[];
  missing: string[];
  areas: AreaScore[];
  confidence: MatchConfidence;
  /** Porcentaje del peso total que se pudo evaluar con datos reales. */
  coverage: number;
  version: string;
}

interface Criterion {
  area: MatchArea;
  label: string;
  weight: number;
  mandatory: boolean;
  /** true = cumple · false = no cumple · null = falta el dato para saberlo */
  evaluate: () => boolean | null;
  missingLabel?: string;
}

/** Convierte la nota a escala 4.0 de forma lineal. Es una aproximación: la conversión oficial la hace la NCAA. */
export function toGpa4(gpa: number | null | undefined, scale: number | null | undefined) {
  if (gpa == null || !scale) return null;
  return Math.round(((gpa / scale) * 4) * 100) / 100;
}

export function matchAthleteToOpportunity(
  athlete: Pick<AthleteProfile, 'sport_id' | 'primary_position_id' | 'secondary_position_id' | 'graduation_year' | 'target_divisions'> & {
    annual_budget_usd?: number | null;
  },
  academics: Pick<AthleteAcademics, 'gpa' | 'gpa_scale' | 'english_test' | 'english_score'> | null,
  opp: Pick<Opportunity, 'sport_id' | 'position_ids' | 'graduation_years' | 'division' | 'min_gpa_4' | 'english_required' | 'annual_cost_usd' | 'aid_amount_usd'>,
): MatchResult {
  const gpa4 = toGpa4(academics?.gpa ?? null, academics?.gpa_scale ?? null);
  const netCost =
    opp.annual_cost_usd != null && opp.aid_amount_usd != null ? opp.annual_cost_usd - opp.aid_amount_usd : null;

  const criteria: Criterion[] = [
    {
      area: 'athletic',
      label: 'Deporte',
      weight: 30,
      mandatory: true,
      evaluate: () => (athlete.sport_id ? athlete.sport_id === opp.sport_id : null),
      missingLabel: 'Deporte sin indicar en tu Passport',
    },
    {
      area: 'athletic',
      label: 'Posición buscada',
      weight: 20,
      mandatory: true,
      evaluate: () => {
        if (!opp.position_ids.length) return true;
        if (!athlete.primary_position_id) return null;
        return opp.position_ids.includes(athlete.primary_position_id) ||
          (athlete.secondary_position_id != null && opp.position_ids.includes(athlete.secondary_position_id));
      },
      missingLabel: 'Posición sin indicar',
    },
    {
      area: 'timing',
      label: 'Año de graduación aceptado',
      weight: 15,
      mandatory: true,
      evaluate: () => {
        if (!opp.graduation_years.length) return true;
        if (!athlete.graduation_year) return null;
        return opp.graduation_years.includes(athlete.graduation_year);
      },
      missingLabel: 'Año de graduación sin indicar',
    },
    {
      area: 'academic',
      label: 'Nota mínima',
      weight: 15,
      mandatory: true,
      evaluate: () => {
        if (opp.min_gpa_4 == null) return true;
        if (gpa4 == null) return null;
        return gpa4 >= opp.min_gpa_4;
      },
      missingLabel: 'Nota media sin indicar',
    },
    {
      area: 'athletic',
      label: 'División en tus objetivos',
      weight: 10,
      mandatory: false,
      evaluate: () => {
        if (!opp.division) return true;
        if (!athlete.target_divisions?.length) return null;
        return athlete.target_divisions.includes(opp.division);
      },
      missingLabel: 'Divisiones objetivo sin indicar',
    },
    {
      area: 'financial',
      label: 'Coste neto dentro de tu presupuesto',
      weight: 10,
      mandatory: false,
      evaluate: () => {
        if (netCost == null) return null;
        if (athlete.annual_budget_usd == null) return null;
        return netCost <= athlete.annual_budget_usd;
      },
      missingLabel:
        netCost == null ? 'La oportunidad no publica coste y ayuda completos' : 'Presupuesto anual familiar sin indicar',
    },
  ];

  if (opp.english_required) {
    criteria.push({
      area: 'academic',
      label: `Inglés requerido (${opp.english_required})`,
      weight: 5,
      mandatory: false,
      evaluate: () => (academics?.english_test && academics.english_test !== 'none' && academics.english_score ? true : null),
      missingLabel: 'Certificado de inglés sin indicar',
    });
  }

  const met: string[] = [];
  const unmet: string[] = [];
  const missing: string[] = [];
  let earned = 0;
  let total = 0;
  let mandatoryFailed = false;
  let mandatoryMissing = false;
  let withData = 0;
  const byArea = new Map<MatchArea, { earned: number; weight: number; evaluated: number; total: number }>();

  for (const c of criteria) {
    total += c.weight;
    const r = c.evaluate();
    const a = byArea.get(c.area) ?? { earned: 0, weight: 0, evaluated: 0, total: 0 };
    a.total += 1;
    if (r !== null) {
      withData += c.weight;
      a.weight += c.weight;
      a.evaluated += 1;
      if (r) a.earned += c.weight;
    }
    byArea.set(c.area, a);
    if (r === true) {
      earned += c.weight;
      met.push(c.label);
    } else if (r === false) {
      unmet.push(c.label);
      if (c.mandatory) mandatoryFailed = true;
    } else {
      missing.push(c.missingLabel ?? c.label);
      if (c.mandatory) mandatoryMissing = true;
    }
  }

  const score = Math.round((earned / total) * 100);
  const tier: MatchTier = mandatoryFailed
    ? 'not_eligible'
    : mandatoryMissing
      ? 'potential'
      : score >= 80
        ? 'strong'
        : score >= 55
          ? 'potential'
          : 'reach';

  const coverage = Math.round((withData / total) * 100);
  const confidence: MatchConfidence = coverage >= 85 ? 'high' : coverage >= 60 ? 'medium' : 'low';
  const areas: AreaScore[] = (Object.keys(MATCH_AREA_LABEL) as MatchArea[])
    .filter((k) => byArea.has(k))
    .map((k) => {
      const a = byArea.get(k)!;
      return { area: k, score: a.weight ? Math.round((a.earned / a.weight) * 100) : null, evaluated: a.evaluated, total: a.total };
    });

  return { score, tier, met, unmet, missing, areas, confidence, coverage, version: MATCH_ENGINE_VERSION };
}

export const TIER_LABEL: Record<MatchTier, string> = {
  strong: 'Encaje fuerte',
  potential: 'Encaje posible',
  reach: 'Exigente',
  not_eligible: 'No encaja ahora',
};
