/**
 * Buscador del coach/club (QA coach-club #9): filtros, orden y búsquedas guardadas. Reglas puras.
 * La base de datos (discover_athlete_ids) vuelve a validar cada filtro y solo lo aplica sobre atletas que permiten
 * filtrar ese bloque: aquí solo se normaliza lo que llega por la URL. Nunca hay filtro de presupuesto familiar.
 */
import type { Division } from '../types.ts';

export const ENGLISH_LEVELS = ['b1', 'b2', 'c1', 'c2'] as const;
export type EnglishLevel = (typeof ENGLISH_LEVELS)[number];
export const DIVISIONS: Division[] = ['ncaa_d1', 'ncaa_d2', 'ncaa_d3', 'naia', 'njcaa'];
export const DISCOVER_SORTS = ['recent', 'grad', 'fit'] as const;
export type DiscoverSort = (typeof DISCOVER_SORTS)[number];
export const SORT_LABEL: Record<DiscoverSort, string> = { recent: 'Actividad reciente', grad: 'Promoción', fit: 'Encaje con la necesidad' };
export const ENGLISH_LABEL: Record<EnglishLevel, string> = { b1: 'B1 o más', b2: 'B2 o más', c1: 'C1 o más', c2: 'C2 / nativo' };

/** Filtros que entiende la RPC (mismos nombres que en p_filters y en org_saved_searches.filters). */
export interface SearchFilters {
  sport?: string; position?: number; grad?: number; country?: string; min_height?: number;
  video?: boolean; academics?: boolean; verified_stats?: boolean; q?: string;
  min_gpa?: number; english?: EnglishLevel; english_test?: boolean; division?: Division; start?: string;
  open?: boolean; contactable?: boolean; sort?: DiscoverSort;
}
export const FILTER_KEYS = ['sport', 'position', 'grad', 'country', 'min_height', 'video', 'academics', 'verified_stats', 'q',
  'min_gpa', 'english', 'english_test', 'division', 'start', 'open', 'contactable', 'sort'] as const;

/** Parámetros de la URL de /app/recruit/discover → nombre del filtro. */
export const URL_KEY: Record<(typeof FILTER_KEYS)[number], string> = {
  sport: 'sport', position: 'position', grad: 'grad', country: 'country', min_height: 'h', video: 'video', academics: 'acad',
  verified_stats: 'vstats', q: 'q', min_gpa: 'gpa', english: 'eng', english_test: 'etest', division: 'div', start: 'start',
  open: 'open', contactable: 'ncaa', sort: 'sort',
};

/** Promociones que se pueden buscar: también graduados de los 3 últimos años (europeos de 19-20, año sabático). */
export function classYears(now = new Date()) {
  const y = now.getUTCFullYear();
  return Array.from({ length: 9 }, (_, i) => y - 3 + i);
}

/** Periodos de incorporación: Fall (ago-sep) y Spring (ene) de este año y los 3 siguientes. */
export function startTerms(now = new Date()) {
  const y = now.getUTCFullYear();
  const ym = `${y}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  // Solo periodos que aún no han terminado (su último mes es este o posterior).
  return Array.from({ length: 4 }, (_, i) => y + i).flatMap((yr) => [`${yr}-spring`, `${yr}-fall`])
    .filter((t) => termBounds(t)!.to >= ym);
}
/** Meses (AAAA-MM) que cuentan como cada periodo. Espejo de la RPC. */
export function termBounds(term: string): { from: string; to: string } | null {
  const m = /^(20[2-4]\d)-(fall|spring)$/.exec(term);
  if (!m) return null;
  const y = Number(m[1]);
  return m[2] === 'fall' ? { from: `${y}-06`, to: `${y}-10` } : { from: `${y - 1}-11`, to: `${y}-05` };
}
export const termLabel = (term: string) => {
  const m = /^(\d{4})-(fall|spring)$/.exec(term);
  return m ? `${m[2] === 'fall' ? 'Fall' : 'Spring'} ${m[1]}` : term;
};

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

/** URL → filtros válidos (lo que no cuadra se ignora, nunca se pasa tal cual a la base de datos). */
export function parseSearch(sp: Raw, now = new Date()): SearchFilters {
  const f: SearchFilters = {};
  const sport = one(sp.sport);
  if (/^[a-z_]{2,40}$/.test(sport)) f.sport = sport;
  const pos = one(sp.position);
  if (/^\d{1,6}$/.test(pos)) f.position = Number(pos);
  const grad = Number(one(sp.grad));
  if (classYears(now).includes(grad)) f.grad = grad;
  const country = one(sp.country);
  if (/^[A-Z]{2}$/.test(country)) f.country = country;
  const h = Number(one(sp.h));
  if (Number.isInteger(h) && h >= 140 && h <= 230) f.min_height = h;
  if (one(sp.video) === '1') f.video = true;
  if (one(sp.acad) === '1') f.academics = true;
  if (one(sp.vstats) === '1') f.verified_stats = true;
  const q = one(sp.q).trim();
  if (q) f.q = q.slice(0, 60);
  const gpa = Number(one(sp.gpa));
  if (one(sp.gpa) && Number.isFinite(gpa) && gpa > 0 && gpa <= 4) f.min_gpa = Math.round(gpa * 10) / 10;
  const eng = one(sp.eng);
  if ((ENGLISH_LEVELS as readonly string[]).includes(eng)) f.english = eng as EnglishLevel;
  if (one(sp.etest) === '1') f.english_test = true;
  const div = one(sp.div);
  if ((DIVISIONS as string[]).includes(div)) f.division = div as Division;
  const start = one(sp.start);
  if (termBounds(start)) f.start = start;
  if (one(sp.open) === '1') f.open = true;
  if (one(sp.ncaa) === '1') f.contactable = true;
  const sort = one(sp.sort);
  if ((DISCOVER_SORTS as readonly string[]).includes(sort)) f.sort = sort as DiscoverSort;
  return f;
}

/** Filtros → p_filters de la RPC. Sin necesidad no se puede ordenar por encaje (se ordena por actividad). */
export function rpcFilters(f: SearchFilters, sport: string, needId?: string | null): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = { sport };
  for (const k of FILTER_KEYS) {
    if (k === 'sport') continue;
    const v = f[k];
    if (v === undefined || v === false || v === '') continue;
    if (k === 'sort' && v === 'fit' && !needId) continue;
    out[k] = v as string | number | boolean;
  }
  if (needId) out.need = needId;
  return out;
}

/** Filtros guardados (org_saved_searches.filters) → URL del buscador. */
export function savedSearchHref(filters: Record<string, unknown>, needId?: string | null, org?: string | null) {
  const p = new URLSearchParams();
  if (org) p.set('org', org);
  if (needId) p.set('need', needId);
  for (const k of FILTER_KEYS) {
    const v = filters[k];
    if (v === undefined || v === null || v === false || v === '') continue;
    if (k === 'sport' && needId) continue;
    p.set(URL_KEY[k], v === true ? '1' : String(v));
  }
  return `/app/recruit/discover?${p.toString()}`;
}

/** Cuántos filtros hay activos (sin contar deporte, orden ni texto libre), para resumir una búsqueda guardada. */
export const activeFilterCount = (f: SearchFilters | Record<string, unknown>) =>
  Object.entries(f).filter(([k, v]) => !['sport', 'sort', 'q', 'need'].includes(k) && v !== undefined && v !== false && v !== '').length;

/* ------------------------------------------------------------------ Comparar (valores reales, no sí/no) */
export interface CompareInput {
  user_id: string; display_name: string; position: string | null; graduation_year: number | null; height: string | null;
  country: string | null; competitive_level: string | null; has_video: boolean; video_url: string | null;
  /** null = no compartido contigo. */
  academics: { gpa: number | null; gpa_scale: number | null; grade_display: string | null; gpa_source: string | null; english_test: string | null; english_score: string | null } | null;
  english_level: string | null;
  stats: { label: string; value: number | string; unit: string | null; source: string }[] | null;
  verified: boolean;
}
export type CompareCell = { text: string; href?: string; tone?: 'ok' | 'muted' };
export interface CompareRow { key: string; label: string; cells: CompareCell[] }

const TEST_NAME: Record<string, string> = { toefl: 'TOEFL', ielts: 'IELTS', duolingo: 'Duolingo', cambridge: 'Cambridge', none: '' };

/** Filas de la comparación. Cada celda dice el valor real o por qué no se ve; ninguna fila elige «ganador». */
export function compareRows(people: CompareInput[], t: (s: string) => string = (s) => s): CompareRow[] {
  const locked = { text: t('🔒 No compartido'), tone: 'muted' as const };
  const dash = { text: '—', tone: 'muted' as const };
  const row = (key: string, label: string, fn: (p: CompareInput) => CompareCell): CompareRow => ({ key, label: t(label), cells: people.map(fn) });
  return [
    row('position', 'Posición', (p) => (p.position ? { text: p.position } : dash)),
    row('class', 'Promoción', (p) => (p.graduation_year ? { text: String(p.graduation_year) } : dash)),
    row('height', 'Altura', (p) => (p.height ? { text: p.height } : locked)),
    row('country', 'País', (p) => (p.country ? { text: p.country } : dash)),
    row('level', 'Nivel competitivo', (p) => (p.competitive_level ? { text: p.competitive_level } : dash)),
    row('gpa', 'Nota media', (p) => {
      const a = p.academics;
      if (!a) return locked;
      if (a.gpa == null && !a.grade_display) return dash;
      const raw = a.grade_display ?? (a.gpa != null && a.gpa_scale ? `${a.gpa}/${a.gpa_scale}` : '');
      const est = a.gpa != null && a.gpa_scale && a.gpa_scale !== 4 ? ` · ≈ ${(Math.round((a.gpa / a.gpa_scale) * 4 * 100) / 100).toFixed(2)} ${t('GPA est. (no oficial)')}` : '';
      return { text: `${raw}${est} · ${t(a.gpa_source && a.gpa_source !== 'self_reported' ? 'documentada' : 'declarada')}` };
    }),
    row('english', 'Inglés', (p) => {
      const a = p.academics;
      const test = a?.english_test && a.english_test !== 'none' ? `${TEST_NAME[a.english_test] ?? a.english_test}${a.english_score ? ` ${a.english_score}` : ''}` : null;
      const level = p.english_level ? (p.english_level === 'native' ? t('Nativo') : p.english_level.toUpperCase()) : null;
      const parts = [test, level].filter(Boolean);
      if (parts.length) return { text: parts.join(' · ') };
      return a ? { text: t('Sin certificado'), tone: 'muted' } : locked;
    }),
    row('video', 'Vídeo', (p) => (p.video_url ? { text: t('▶ Ver highlight'), href: p.video_url } : p.has_video ? { text: t('Con vídeo (en la ficha)') } : { text: t('Sin vídeo visible'), tone: 'muted' })),
    row('stats', 'Estadísticas', (p) => {
      if (!p.stats) return locked;
      if (!p.stats.length) return dash;
      return { text: p.stats.slice(0, 3).map((s) => `${t(s.label)} ${s.value}${s.unit ? ` ${s.unit}` : ''}${s.source !== 'self_reported' ? ' ✓' : ''}`).join(' · ') };
    }),
    row('verification', 'Verificación', (p) => (p.verified ? { text: t('✓ Datos verificados por club o documento'), tone: 'ok' } : { text: t('Solo datos declarados'), tone: 'muted' })),
  ];
}

/* ------------------------------------------------------------------ Actividad del equipo: qué atleta y quién */
export const ACTIVITY_LABEL: Record<string, string> = {
  candidate_created: 'añadió a', stage_changed: 'cambió de etapa a', assigned: 'asignó a', shortlisted: 'añadió a la shortlist a',
  unshortlisted: 'quitó de la shortlist a', reviewed: 'revisó a', note_added: 'añadió una nota sobre', task_created: 'creó una tarea sobre',
  task_done: 'completó una tarea sobre', info_requested: 'pidió información a',
  document_accessed: 'consultó un documento de', offer_recorded: 'registró una oferta para',
};
/** «Marta añadió una nota sobre Lucía». Sin autor (sistema o miembro eliminado) se dice «Alguien del equipo». */
export function activityLine(kind: string, actor: string | null, athlete: string | null, t: (s: string) => string = (s) => s) {
  // Estas las hace el propio atleta (o su familia): el sujeto es el atleta, nunca «alguien del equipo».
  if (athlete && kind === 'info_shared') return `${athlete} ${t('compartió la información solicitada')}`;
  if (athlete && kind === 'info_declined') return `${athlete} ${t('rechazó una solicitud de información')}`;
  const who = actor ?? t('Alguien del equipo');
  const verb = ACTIVITY_LABEL[kind];
  if (verb && athlete) return `${who} ${t(verb)} ${athlete}`;
  return null;
}
