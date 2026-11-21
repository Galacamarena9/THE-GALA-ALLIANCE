/**
 * Búsqueda de talento: los filtros que usan agentes, clubes y coaches para encontrar atletas en segundos.
 * Todo entra por la URL (compartible y guardable) y se valida aquí: lo que no pasa, se ignora.
 * Los filtros se aplican en el servidor sobre `athlete_directory`, donde un dato oculto sale NULL:
 * filtrar por él nunca revela nada.
 */

export const TALENT_FILTER_KEYS = [
  'q', 'sport', 'position', 'grad', 'grad_min', 'grad_max', 'division', 'gpa', 'video',
  'country', 'nationality', 'min_height', 'max_height', 'min_weight', 'max_weight',
  'side', 'english', 'verified', 'exp_min', 'league',
] as const;
export type TalentFilterKey = (typeof TALENT_FILTER_KEYS)[number];
export type TalentFilters = Partial<Record<TalentFilterKey, string>>;

export const SORTS = { recent: 'Actualizados recientemente', height: 'Más altos', grad: 'Promoción más próxima', experience: 'Más experiencia' } as const;
export type TalentSort = keyof typeof SORTS;

export const SIDE_LABEL: Record<string, string> = { left: 'Izquierda', right: 'Derecha', both: 'Ambas' };
export const ENGLISH_LEVELS = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'native'] as const;
export const ENGLISH_LABEL: Record<string, string> = { a1: 'A1', a2: 'A2', b1: 'B1', b2: 'B2', c1: 'C1', c2: 'C2', native: 'Nativo' };

const int = (v: string | undefined, min: number, max: number) => {
  if (!v || !/^\d{1,4}$/.test(v)) return undefined;
  const n = Number(v);
  return n >= min && n <= max ? String(n) : undefined;
};
const iso = (v: string | undefined) => (v && /^[A-Za-z]{2}$/.test(v) ? v.toUpperCase() : undefined);
const text = (v: string | undefined) => {
  const t = v?.replace(/[%_,()*\\]/g, '').trim().slice(0, 60);
  return t || undefined;
};

/** Valida y normaliza los filtros que llegan por URL o desde una búsqueda guardada. */
export function parseTalentFilters(raw: Record<string, string | string[] | undefined>, divisions: readonly string[] = []): TalentFilters {
  const g = (k: string) => {
    const v = raw[k];
    return typeof v === 'string' ? v : Array.isArray(v) ? v[0] : undefined;
  };
  const f: TalentFilters = {
    q: text(g('q')),
    sport: g('sport') && /^[a-z0-9_-]{1,40}$/.test(g('sport')!) ? g('sport') : undefined,
    position: int(g('position'), 1, 100000),
    grad: int(g('grad'), 2020, 2040),
    grad_min: int(g('grad_min'), 2020, 2040),
    grad_max: int(g('grad_max'), 2020, 2040),
    division: g('division') && divisions.includes(g('division')!) ? g('division') : undefined,
    gpa: g('gpa') && /^\d(\.\d{1,2})?$/.test(g('gpa')!) && Number(g('gpa')) <= 4 ? g('gpa') : undefined,
    video: g('video') === '1' ? '1' : undefined,
    country: iso(g('country')),
    nationality: iso(g('nationality')),
    min_height: int(g('min_height'), 100, 250),
    max_height: int(g('max_height'), 100, 250),
    min_weight: int(g('min_weight'), 30, 200),
    max_weight: int(g('max_weight'), 30, 200),
    side: g('side') && g('side')! in SIDE_LABEL ? g('side') : undefined,
    english: g('english') && (ENGLISH_LEVELS as readonly string[]).includes(g('english')!) ? g('english') : undefined,
    verified: g('verified') === '1' ? '1' : undefined,
    exp_min: int(g('exp_min'), 0, 40),
    league: text(g('league')),
  };
  // Rangos al revés: se corrigen en lugar de devolver cero resultados sin explicación.
  for (const [a, b] of [['min_height', 'max_height'], ['min_weight', 'max_weight'], ['grad_min', 'grad_max']] as const) {
    if (f[a] && f[b] && Number(f[a]) > Number(f[b])) [f[a], f[b]] = [f[b], f[a]];
  }
  return Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined)) as TalentFilters;
}

export function parseSort(v: unknown): TalentSort {
  return typeof v === 'string' && v in SORTS ? (v as TalentSort) : 'recent';
}

/** Niveles de inglés iguales o superiores al pedido (para filtrar «B2 o más»). */
export function englishAtLeast(level: string): string[] {
  const i = (ENGLISH_LEVELS as readonly string[]).indexOf(level);
  return i < 0 ? [] : ENGLISH_LEVELS.slice(i) as unknown as string[];
}

export interface ChipContext {
  sportName?: (id: string) => string | undefined;
  positionName?: (id: string) => string | undefined;
  countryName?: (cc: string) => string | undefined;
  divisionName?: (d: string) => string | undefined;
}

/** Filtros activos en lenguaje claro, para verlos de un vistazo y quitarlos de uno en uno. */
export function activeChips(f: TalentFilters, c: ChipContext = {}): { key: TalentFilterKey | 'height' | 'weight' | 'grad_range'; label: string; remove: TalentFilterKey[] }[] {
  const chips: { key: TalentFilterKey | 'height' | 'weight' | 'grad_range'; label: string; remove: TalentFilterKey[] }[] = [];
  const range = (min?: string, max?: string, unit = '') =>
    min && max ? `${min}–${max}${unit}` : min ? `≥ ${min}${unit}` : max ? `≤ ${max}${unit}` : '';
  if (f.q) chips.push({ key: 'q', label: `«${f.q}»`, remove: ['q'] });
  if (f.sport) chips.push({ key: 'sport', label: c.sportName?.(f.sport) ?? f.sport, remove: ['sport', 'position'] });
  if (f.position) chips.push({ key: 'position', label: c.positionName?.(f.position) ?? 'Posición', remove: ['position'] });
  if (f.grad) chips.push({ key: 'grad', label: `Promoción ${f.grad}`, remove: ['grad'] });
  if (f.grad_min || f.grad_max) chips.push({ key: 'grad_range', label: `Promoción ${range(f.grad_min, f.grad_max)}`, remove: ['grad_min', 'grad_max'] });
  if (f.min_height || f.max_height) chips.push({ key: 'height', label: `Altura ${range(f.min_height, f.max_height, ' cm')}`, remove: ['min_height', 'max_height'] });
  if (f.min_weight || f.max_weight) chips.push({ key: 'weight', label: `Peso ${range(f.min_weight, f.max_weight, ' kg')}`, remove: ['min_weight', 'max_weight'] });
  if (f.nationality) chips.push({ key: 'nationality', label: `Nacionalidad: ${c.countryName?.(f.nationality) ?? f.nationality}`, remove: ['nationality'] });
  if (f.country) chips.push({ key: 'country', label: `Reside en ${c.countryName?.(f.country) ?? f.country}`, remove: ['country'] });
  if (f.side) chips.push({ key: 'side', label: `Lateralidad: ${SIDE_LABEL[f.side]}`, remove: ['side'] });
  if (f.division) chips.push({ key: 'division', label: c.divisionName?.(f.division) ?? f.division, remove: ['division'] });
  if (f.english) chips.push({ key: 'english', label: `Inglés ${ENGLISH_LABEL[f.english]}+`, remove: ['english'] });
  if (f.gpa) chips.push({ key: 'gpa', label: `GPA ≥ ${f.gpa}`, remove: ['gpa'] });
  if (f.exp_min) chips.push({ key: 'exp_min', label: `${f.exp_min}+ años compitiendo`, remove: ['exp_min'] });
  if (f.league) chips.push({ key: 'league', label: `Liga: ${f.league}`, remove: ['league'] });
  if (f.video) chips.push({ key: 'video', label: 'Con vídeo', remove: ['video'] });
  if (f.verified) chips.push({ key: 'verified', label: 'Estadísticas validadas por club', remove: ['verified'] });
  return chips;
}

/** URL con los filtros cambiados (vacío = se quita). Mantiene orden y vista; vuelve a la página 1. */
export function talentHref(base: string, current: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const next = { ...current, ...patch };
  if (!('page' in patch)) delete next.page;
  const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]).toString();
  return qs ? `${base}?${qs}` : base;
}
