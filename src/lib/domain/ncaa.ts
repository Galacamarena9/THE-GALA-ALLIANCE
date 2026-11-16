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

export function ncaaWindow(gradYear: number | null, division: Division | null, sport: string | null, today = new Date()) {
  const opensOn = ncaaContactOpensOn(gradYear, division, sport);
  return { open: !opensOn || today.toISOString().slice(0, 10) >= opensOn, opensOn };
}

/** College Sports Commission: los acuerdos NIL de terceros de 600 $ o más se declaran en NIL Go en 5 días hábiles. */
export const NIL_GO_THRESHOLD_USD = 600;
export const nilGoApplies = (usd: number | null | undefined) => (usd ?? 0) >= NIL_GO_THRESHOLD_USD;

export const formatEsDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
