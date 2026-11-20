/**
 * Coste real para la familia sin inventar nada.
 * Cada componente es un número conocido o `null` (desconocido). Nunca se rellena un hueco con 0.
 */
export type CostKey = 'tuition' | 'fees' | 'housing' | 'meals' | 'insurance' | 'travel' | 'other_costs';
export type AidKey = 'athletic_aid' | 'academic_aid' | 'other_aid';

export interface CostScenario {
  currency: 'USD' | 'EUR' | 'GBP';
  tuition: number | null; fees: number | null; housing: number | null; meals: number | null;
  insurance: number | null; travel: number | null; other_costs: number | null;
  athletic_aid: number | null; academic_aid: number | null; other_aid: number | null;
  /** true = el alojamiento está incluido en la matrícula/oferta; null = no se sabe. */
  housing_included: boolean | null;
}

export const COST_LABEL: Record<CostKey, string> = {
  tuition: 'Matrícula', fees: 'Tasas', housing: 'Alojamiento', meals: 'Comidas', insurance: 'Seguro', travel: 'Viajes', other_costs: 'Otros costes',
};
export const AID_LABEL: Record<AidKey, string> = { athletic_aid: 'Beca deportiva', academic_aid: 'Ayuda académica', other_aid: 'Otra ayuda confirmada' };

/** Componentes sin los que no se puede hablar de «coste estimado». */
const ESSENTIAL: CostKey[] = ['tuition', 'housing', 'meals'];

export type CostStatus = 'complete' | 'partial' | 'insufficient';
export interface CostSummary {
  currency: CostScenario['currency'];
  knownCost: number;
  knownAid: number;
  /** Coste conocido − ayuda confirmada. Solo es «coste estimado» si status = complete. */
  knownNet: number;
  missing: CostKey[];
  status: CostStatus;
  /** Frase honesta lista para mostrar. */
  headline: string;
}

const fmt = (n: number, c: CostScenario['currency']) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n);

export function familyCost(s: CostScenario): CostSummary {
  const costKeys = Object.keys(COST_LABEL) as CostKey[];
  // Si el alojamiento está incluido, no falta aunque no tenga importe propio.
  const missing = costKeys.filter((k) => s[k] == null && !(k === 'housing' && s.housing_included === true));
  const knownCost = costKeys.reduce((t, k) => t + (s[k] ?? 0), 0);
  const knownAid = (['athletic_aid', 'academic_aid', 'other_aid'] as AidKey[]).reduce((t, k) => t + (s[k] ?? 0), 0);
  const knownNet = Math.max(0, knownCost - knownAid);
  const essentialMissing = ESSENTIAL.filter((k) => missing.includes(k));
  const status: CostStatus = knownCost === 0 || s.tuition == null ? 'insufficient' : essentialMissing.length ? 'partial' : 'complete';
  const list = (ks: CostKey[]) => ks.map((k) => COST_LABEL[k].toLowerCase()).join(', ');
  const headline =
    status === 'insufficient'
      ? `Información insuficiente: falta ${s.tuition == null ? 'la matrícula' : list(essentialMissing)}.`
      : status === 'partial'
        ? `Coste conocido hasta ahora: ${fmt(knownNet, s.currency)} + ${list(essentialMissing)} sin conocer.`
        : `Coste estimado para la familia: ${fmt(knownNet, s.currency)} al año${missing.length ? ` (sin ${list(missing)})` : ''}.`;
  return { currency: s.currency, knownCost, knownAid, knownNet, missing, status, headline };
}

export type BudgetFit = 'within' | 'over' | 'unknown';
/**
 * ¿Cabe en el presupuesto? Solo se afirma con datos completos en la misma moneda.
 * Con información incompleta, «unknown»: nunca se descarta una opción por falta de datos.
 */
export function budgetFit(summary: CostSummary, budget: { amount: number | null; currency: CostScenario['currency'] } | null): BudgetFit {
  if (!budget?.amount || budget.currency !== summary.currency) return 'unknown';
  if (summary.status !== 'complete') return summary.knownNet > budget.amount ? 'over' : 'unknown';
  return summary.knownNet <= budget.amount ? 'within' : 'over';
}
