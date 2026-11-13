/**
 * Calculadora de coste neto (pura y testeable).
 * - Nunca inventa importes: lo que no se introduce cuenta como "desconocido", no como 0.
 * - Separa ayuda confirmada (por escrito) de estimada.
 * - Escenarios: prudente (solo confirmada, costes +10 %), esperado, optimista (toda la estimada).
 */
export interface CostInputs {
  tuition: number | null;
  fees: number | null;
  housing: number | null;
  meals: number | null;
  insurance: number | null;
  books: number | null;
  travel: number | null;
  visa: number | null;
  other: number | null;
}
export interface AidInputs {
  athleticConfirmed: number | null;
  academicConfirmed: number | null;
  otherConfirmed: number | null;
  estimated: number | null;
}
export interface Offer {
  id: string;
  name: string;
  costs: CostInputs;
  aid: AidInputs;
  years: number;
  annualIncreasePct: number;
}

const sum = (xs: (number | null)[]) => xs.reduce<number>((s, x) => s + (x ?? 0), 0);

export function computeNetCost(o: Offer) {
  const costValues = Object.values(o.costs);
  const unknownCosts = (Object.keys(o.costs) as (keyof CostInputs)[]).filter((k) => o.costs[k] == null);
  const gross = sum(costValues);
  const confirmed = sum([o.aid.athleticConfirmed, o.aid.academicConfirmed, o.aid.otherConfirmed]);
  const estimated = o.aid.estimated ?? 0;
  const clamp = (n: number) => Math.max(0, Math.round(n));

  const scenario = (costFactor: number, aid: number) => {
    let total = 0;
    for (let y = 0; y < o.years; y++) {
      const factor = Math.pow(1 + o.annualIncreasePct / 100, y);
      total += clamp(gross * costFactor * factor - aid);
    }
    return { firstYear: clamp(gross * costFactor - aid), total };
  };

  return {
    gross,
    confirmed,
    estimated,
    unknownCosts,
    familyFirstYear: clamp(gross - confirmed - estimated / 2),
    monthly: Math.round(clamp(gross - confirmed - estimated / 2) / 12),
    conservative: scenario(1.1, confirmed),
    expected: scenario(1, confirmed + estimated / 2),
    optimistic: scenario(1, confirmed + estimated),
  };
}

export const COST_LABELS: Record<keyof CostInputs, string> = {
  tuition: 'Matrícula',
  fees: 'Tasas obligatorias',
  housing: 'Alojamiento',
  meals: 'Comidas',
  insurance: 'Seguro médico',
  books: 'Libros y material',
  travel: 'Viajes',
  visa: 'Visado, SEVIS y trámites',
  other: 'Otros',
};
