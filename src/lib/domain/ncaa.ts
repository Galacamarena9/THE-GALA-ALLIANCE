import type { Division } from '../types.ts';

/**
 * Reglas NCAA que la plataforma aplica por diseño (espejo de public.ncaa_contact_opens_on).
 * D-I: primer contacto de reclutamiento el 15 de junio al acabar el 2.º curso de secundaria
 * (béisbol 1 de agosto, lacrosse 1 de septiembre). D-II: 15 de junio. D-III, NAIA y NJCAA: sin límite electrónico.
 */
export function ncaaContactOpensOn(gradYear: number | null, division: Division | null, sport: string | null): string | null {
  if (!gradYear || !division) return null;
  const y = gradYear - 2;
  if (division === 'ncaa_d1' && sport === 'baseball') return `${y}-08-01`;
  if (division === 'ncaa_d1' && sport === 'lacrosse') return `${y}-09-01`;
  if (division === 'ncaa_d1' || division === 'ncaa_d2') return `${y}-06-15`;
  return null;
}

/** Universidades y colleges: la división es obligatoria (de ella depende la ventana de contacto NCAA). */
export const needsDivision = (orgType: string | null | undefined) => orgType === 'university' || orgType === 'college';

/**
 * División efectiva para la ventana de contacto (espejo de public.ncaa_contact_closed): una universidad/college sin
 * división declarada se trata como D-I (la regla más restrictiva). Otros tipos de organización no tienen ventana.
 */
export function effectiveNcaaDivision(orgType: string | null | undefined, division: Division | null): Division | null {
  if (!needsDivision(orgType)) return null;
  return division ?? 'ncaa_d1';
}

/**
 * Tipos de oportunidad que puede publicar cada organización. Universidades y colleges no publican «tryout» (prueba):
 * NO COMPROBADO normativamente (según el QA, la NCAA D-I prohíbe tryouts a prospects, Bylaw 13.11, y D-II los limita);
 * pendiente de revisión con el abogado NCAA. Ofrecen «Campus / Showcase» en su lugar.
 */
export const COLLEGE_BLOCKED_OPPORTUNITY_TYPES = ['tryout'] as const;
export function opportunityTypeAllowed(orgType: string | null | undefined, oppType: string): boolean {
  return !(needsDivision(orgType) && (COLLEGE_BLOCKED_OPPORTUNITY_TYPES as readonly string[]).includes(oppType));
}

export function ncaaWindow(gradYear: number | null, division: Division | null, sport: string | null, today = new Date()) {
  const opensOn = ncaaContactOpensOn(gradYear, division, sport);
  return { open: !opensOn || today.toISOString().slice(0, 10) >= opensOn, opensOn };
}

/** College Sports Commission: los acuerdos NIL de terceros de 600 $ o más se declaran en NIL Go en 5 días hábiles. */
export const NIL_GO_THRESHOLD_USD = 600;
export const nilGoApplies = (usd: number | null | undefined) => (usd ?? 0) >= NIL_GO_THRESHOLD_USD;

export const formatEsDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
