/**
 * Coste real para la familia sin inventar nada.
 * Cada componente es un número conocido o `null` (sin dato). Nunca se rellena un hueco con 0.
 * Seguro médico y viajes cuentan como esenciales: sin ellos no se habla de «coste estimado», solo de «coste mínimo conocido».
 */
export type CostKey = 'tuition' | 'fees' | 'housing' | 'meals' | 'insurance' | 'travel' | 'other_costs';
export type AidKey = 'athletic_aid' | 'academic_aid' | 'other_aid';
export type Currency = 'USD' | 'EUR' | 'GBP';
export type CostLang = 'es' | 'en';

export interface CostScenario {
  currency: Currency;
  tuition: number | null; fees: number | null; housing: number | null; meals: number | null;
  insurance: number | null; travel: number | null; other_costs: number | null;
  athletic_aid: number | null; academic_aid: number | null; other_aid: number | null;
  /** true = el alojamiento está incluido en la matrícula/oferta; null = no se sabe. */
  housing_included: boolean | null;
}

export const COST_LABEL: Record<CostKey, string> = {
  tuition: 'Matrícula', fees: 'Tasas', housing: 'Alojamiento', meals: 'Comidas', insurance: 'Seguro médico', travel: 'Viajes (estimado)', other_costs: 'Otros costes',
};
const COST_LABEL_EN: Record<CostKey, string> = {
  tuition: 'Tuition', fees: 'Fees', housing: 'Housing', meals: 'Meals', insurance: 'Health insurance', travel: 'Travel (estimate)', other_costs: 'Other costs',
};
export const AID_LABEL: Record<AidKey, string> = { athletic_aid: 'Beca deportiva', academic_aid: 'Ayuda académica', other_aid: 'Otra ayuda confirmada' };

/** Componentes sin los que no se puede hablar de «coste estimado». */
export const ESSENTIAL: CostKey[] = ['tuition', 'housing', 'meals', 'insurance', 'travel'];
/** Horizonte de una carrera universitaria en EE. UU. */
export const YEARS = 4;

export type CostStatus = 'complete' | 'partial' | 'insufficient';
export interface CostSummary {
  currency: Currency;
  knownCost: number;
  knownAid: number;
  /** Coste conocido − ayuda confirmada. Solo es «coste estimado» si status = complete. */
  knownNet: number;
  /** knownNet × 4 años (mismo coste cada año: no suponemos subidas ni ayudas que no estén por escrito). */
  fourYearNet: number;
  missing: CostKey[];
  status: CostStatus;
  /** Frase honesta lista para mostrar. */
  headline: string;
}

/** Dinero sin céntimos y con separador de miles también en cifras de 4 dígitos («1.200 US$», no «1200 US$»). */
export function money(n: number, c: Currency, lang: CostLang = 'es'): string {
  const s = new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'es-ES', {
    style: 'currency', currency: c, maximumFractionDigits: 0, useGrouping: 'always' as unknown as boolean,
    currencyDisplay: lang === 'en' ? 'symbol' : c === 'USD' ? 'code' : 'symbol',
  }).format(Math.round(n));
  return lang === 'en' ? s : s.replace('USD', 'US$');
}

const label = (k: CostKey, lang: CostLang) => (lang === 'en' ? COST_LABEL_EN[k] : COST_LABEL[k]);
const list = (ks: CostKey[], lang: CostLang) => ks.map((k) => label(k, lang).toLowerCase()).join(', ');

export function familyCost(s: CostScenario, lang: CostLang = 'es'): CostSummary {
  const costKeys = Object.keys(COST_LABEL) as CostKey[];
  // Si el alojamiento está incluido, no falta aunque no tenga importe propio.
  const missing = costKeys.filter((k) => s[k] == null && !(k === 'housing' && s.housing_included === true));
  const knownCost = costKeys.reduce((t, k) => t + (s[k] ?? 0), 0);
  const knownAid = (['athletic_aid', 'academic_aid', 'other_aid'] as AidKey[]).reduce((t, k) => t + (s[k] ?? 0), 0);
  const knownNet = Math.max(0, knownCost - knownAid);
  const essentialMissing = ESSENTIAL.filter((k) => missing.includes(k));
  const status: CostStatus = knownCost === 0 || s.tuition == null ? 'insufficient' : essentialMissing.length ? 'partial' : 'complete';
  const m = money(knownNet, s.currency, lang);
  const headline = lang === 'en'
    ? status === 'insufficient'
      ? `Not enough information: ${s.tuition == null ? 'tuition is' : `${list(essentialMissing, lang)} are`} missing.`
      : status === 'partial'
        ? `Minimum known cost: ${m} a year (no data yet: ${list(missing, lang)}).`
        : `Estimated cost for the family: ${m} a year${missing.length ? ` (no data: ${list(missing, lang)})` : ''}.`
    : status === 'insufficient'
      ? `Información insuficiente: falta ${s.tuition == null ? 'la matrícula' : list(essentialMissing, lang)}.`
      : status === 'partial'
        // Se listan TODOS los huecos (también tasas y otros costes), no solo los esenciales.
        ? `Coste mínimo conocido: ${m} al año (sin dato: ${list(missing, lang)}).`
        : `Coste estimado para la familia: ${m} al año${missing.length ? ` (sin dato: ${list(missing, lang)})` : ''}.`;
  return { currency: s.currency, knownCost, knownAid, knownNet, fourYearNet: knownNet * YEARS, missing, status, headline };
}

/**
 * Tipo de cambio que la familia indica, con su fecha y su fuente. Sin él no se convierte nada:
 * nunca hay un tipo «por defecto» inventado.
 */
export interface FxRate { eurPerUsd: number; date: string; source: string }

export function validFx(fx: Partial<FxRate> | null | undefined): fx is FxRate {
  return !!fx && typeof fx.eurPerUsd === 'number' && Number.isFinite(fx.eurPerUsd) && fx.eurPerUsd > 0 && fx.eurPerUsd < 10
    && typeof fx.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fx.date) && typeof fx.source === 'string' && fx.source.trim().length >= 3;
}

/** Convierte entre USD y EUR con el tipo indicado. Otra moneda, o sin tipo válido: null (no se inventa). */
export function convert(amount: number, from: Currency, to: Currency, fx: FxRate | null | undefined): number | null {
  if (from === to) return amount;
  if (!validFx(fx)) return null;
  if (from === 'USD' && to === 'EUR') return Math.round(amount * fx.eurPerUsd);
  if (from === 'EUR' && to === 'USD') return Math.round(amount / fx.eurPerUsd);
  return null;
}

/** Importe en la moneda de la fuente y, si hay tipo de cambio, también en la otra (USD ↔ EUR). */
export function dual(amount: number, c: Currency, fx: FxRate | null | undefined, lang: CostLang = 'es'): { primary: string; secondary: string | null } {
  const other: Currency | null = c === 'USD' ? 'EUR' : c === 'EUR' ? 'USD' : null;
  const conv = other ? convert(amount, c, other, fx) : null;
  return { primary: money(amount, c, lang), secondary: conv == null || !other ? null : money(conv, other, lang) };
}

/** «A 4 años: …»; si faltan datos, «al menos …». */
export function fourYearLine(r: CostSummary, fx: FxRate | null | undefined, lang: CostLang = 'es'): string | null {
  if (r.status === 'insufficient') return null;
  const d = dual(r.fourYearNet, r.currency, fx, lang);
  const amount = d.secondary ? `${d.primary} (≈ ${d.secondary})` : d.primary;
  if (lang === 'en') return r.status === 'complete' ? `Over ${YEARS} years: ${amount}` : `Over ${YEARS} years: at least ${amount}`;
  return r.status === 'complete' ? `A ${YEARS} años: ${amount}` : `A ${YEARS} años: al menos ${amount}`;
}

export type BudgetFit = 'within' | 'over' | 'unknown';
/**
 * ¿Cabe en el presupuesto? Solo se afirma con datos completos. Si las monedas difieren, solo con un tipo de cambio
 * indicado (USD ↔ EUR). Con información incompleta, «unknown»: nunca se descarta una opción por falta de datos.
 */
export function budgetFit(summary: CostSummary, budget: { amount: number | null; currency: Currency } | null, fx?: FxRate | null): BudgetFit {
  if (!budget?.amount) return 'unknown';
  const net = convert(summary.knownNet, summary.currency, budget.currency, fx);
  if (net == null) return 'unknown';
  if (summary.status !== 'complete') return net > budget.amount ? 'over' : 'unknown';
  return net <= budget.amount ? 'within' : 'over';
}
