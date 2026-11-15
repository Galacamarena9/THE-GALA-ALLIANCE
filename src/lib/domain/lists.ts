/** Lógica pura de las listas de seguimiento (saved_athletes). Sin dependencias de servidor: se prueba con node --test. */

export interface SavedRow {
  athlete_id: string;
  list_name: string;
  created_at: string;
  name: string | null;
  grad: number | null;
  sport: string | null;
}

export type ListSort = 'recent' | 'name' | 'grad';
export interface ListView { list: string | null; sport: string | null; sort: ListSort }

const DEFAULT_LIST = 'Shortlist';
const SORTS: ListSort[] = ['recent', 'name', 'grad'];

/** Listas del usuario con su número de atletas: la Shortlist primero y el resto por orden alfabético. */
export function listSummary(rows: Pick<SavedRow, 'list_name'>[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.list_name, (counts.get(r.list_name) ?? 0) + 1);
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => (a.name === DEFAULT_LIST ? -1 : b.name === DEFAULT_LIST ? 1 : a.name.localeCompare(b.name, 'es')));
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Lee la vista desde la URL aceptando solo listas que existen y valores conocidos. */
export function parseListView(sp: Record<string, string | string[] | undefined>, listNames: string[]): ListView {
  const list = first(sp.list);
  const sport = first(sp.sport);
  const sort = first(sp.sort) as ListSort | undefined;
  return {
    list: list && listNames.includes(list) ? list : (listNames[0] ?? null),
    sport: sport && /^[a-z_]{2,40}$/.test(sport) ? sport : null,
    sort: sort && SORTS.includes(sort) ? sort : 'recent',
  };
}

export function sortSaved<T extends SavedRow>(rows: T[], sort: ListSort): T[] {
  const copy = [...rows];
  if (sort === 'name') return copy.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'es'));
  if (sort === 'grad') return copy.sort((a, b) => (a.grad ?? Number.MAX_SAFE_INTEGER) - (b.grad ?? Number.MAX_SAFE_INTEGER));
  return copy.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Parte una lista de ids en lotes (las consultas `in (...)` van en la URL y tienen límite de longitud). */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size < 1) throw new Error('chunk size must be >= 1');
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
