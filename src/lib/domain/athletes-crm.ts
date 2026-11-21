/**
 * Prompt 6 · «Mis atletas»: el CRM del agente. Lógica pura: filas, vistas, búsqueda, orden y paginación.
 * Reutiliza la regla de «necesita atención» del Inicio (buildAttention, rangos 1–4) para que ambas pantallas
 * cuenten igual. Sin rankings universales: el orden es operativo (urgencia, plazo, actividad, nombre).
 */
import { PIPELINE_BUCKETS, type AgentHomeInput, type AttentionItem } from './agent-home.ts';
import type { RepStatus } from './portfolio.ts';

export type CrmView = 'all' | 'attention' | 'recruiting' | 'offers' | 'placed';
export const CRM_VIEWS: { id: CrmView; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'attention', label: 'Necesitan atención' },
  { id: 'recruiting', label: 'En recruiting' },
  { id: 'offers', label: 'Con ofertas' },
  { id: 'placed', label: 'Colocados' },
];
/** Estado de la representación (canónico, de REP_STATUSES). «closed» agrupa rechazadas y finalizadas. */
export type CrmRep = 'active' | 'requested' | 'closed' | 'any';
export const CRM_REP_LABEL: Record<CrmRep, string> = { active: 'Representados', requested: 'Propuestas pendientes', closed: 'Rechazadas o finalizadas', any: 'Cualquiera' };
export type CrmSort = 'attention' | 'next' | 'activity' | 'name' | 'grad';
export const CRM_SORT_LABEL: Record<CrmSort, string> = { attention: 'Urgencia', next: 'Siguiente plazo', activity: 'Última actividad', name: 'Nombre', grad: 'Promoción' };
export const PAGE_SIZE = 25;

export interface CrmFilters { view: CrmView; q: string; sport: string | null; grad: number | null; country: string | null; rep: CrmRep; sort: CrmSort; dir: 'asc' | 'desc'; page: number }
export const DEFAULT_CRM: CrmFilters = { view: 'all', q: '', sport: null, grad: null, country: null, rep: 'active', sort: 'attention', dir: 'asc', page: 1 };

export interface CrmRow {
  id: string;
  name: string;
  avatarUrl: string | null;
  sportId: string | null;
  sport: string | null;
  position: string | null;
  country: string | null;
  intake: number | null;
  rep: RepStatus;
  /** Resumen de verificación en texto corto (nunca una pila de etiquetas). */
  verification: string;
  journey: string;
  nextAction: string | null;
  nextDue: string | null;
  processes: number;
  offers: number;
  attention: number;
  lastActivityAt: string | null;
  lastActivity: string;
  segments: CrmView[];
}

export interface CrmEntry {
  athleteId: string; name: string; avatarUrl: string | null; sportId: string | null; sportName: string | null; positionName: string | null;
  country: string | null; graduationYear: number | null; status: RepStatus; createdAt: string; respondedAt: string | null; endedAt: string | null; lastNoteAt: string | null;
}
export interface CrmVerification { athleteId: string; verifiedStats: boolean; video: boolean }

const FINAL = new Set(['committed', 'closed']);
const REP_ORDER: RepStatus[] = ['active', 'requested', 'declined', 'ended'];
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Una fila por atleta (manda la representación más viva), con hechos operativos y recuentos que cuadran con las fuentes. */
export function crmRows(entries: CrmEntry[], input: AgentHomeInput, attention: AttentionItem[], verification: CrmVerification[] = [], now: Date = new Date()): CrmRow[] {
  const today = now.toISOString().slice(0, 10);
  const best = new Map<string, CrmEntry>();
  for (const e of entries) {
    const prev = best.get(e.athleteId);
    if (!prev || REP_ORDER.indexOf(e.status) < REP_ORDER.indexOf(prev.status)) best.set(e.athleteId, e);
  }
  const ver = new Map(verification.map((v) => [v.athleteId, v]));
  return [...best.values()].map((e) => {
    const cases = input.cases.filter((c) => c.athleteId === e.athleteId);
    const open = cases.filter((c) => !FINAL.has(c.stage));
    const placed = cases.some((c) => c.stage === 'committed');
    const liveOffers = input.offers.filter((o) => o.athleteId === e.athleteId && (!o.deadline || o.deadline >= today)).length;
    const items = attention.filter((i) => i.athleteId === e.athleteId && i.rank <= 4);
    const bucket = [...PIPELINE_BUCKETS].reverse().find((b) => (placed && b.id === 'placed') || open.some((c) => (b.stages as readonly string[]).includes(c.stage)));
    const nextCase = open.filter((c) => c.nextActionDue).sort((a, b) => a.nextActionDue!.localeCompare(b.nextActionDue!))[0];
    const top = items[0];
    const v = ver.get(e.athleteId);
    const lastCase = cases.map((c) => ({ at: c.updatedAt, what: `Proceso con ${c.institution}` })).sort((a, b) => b.at.localeCompare(a.at))[0];
    const events = [
      lastCase,
      e.lastNoteAt ? { at: e.lastNoteAt, what: 'Nota de la agencia' } : undefined,
      e.respondedAt ? { at: e.respondedAt, what: e.status === 'active' ? 'Aceptó la representación' : 'Respondió a la propuesta' } : undefined,
      e.endedAt ? { at: e.endedAt, what: 'Representación finalizada' } : undefined,
      { at: e.createdAt, what: 'Propuesta enviada' },
    ].filter(Boolean).sort((a, b) => b!.at.localeCompare(a!.at));
    const segments: CrmView[] = ['all'];
    if (items.length) segments.push('attention');
    // En recruiting: procesos abiertos antes de la fase de oferta (descubrimiento → visita).
    if (!placed && open.some((c) => c.stage !== 'offer_discussion' && c.stage !== 'decision_pending')) segments.push('recruiting');
    if (liveOffers || open.some((c) => c.stage === 'offer_discussion' || c.stage === 'decision_pending')) segments.push('offers');
    if (placed) segments.push('placed');
    return {
      id: e.athleteId, name: e.name, avatarUrl: e.avatarUrl, sportId: e.sportId, sport: e.sportName, position: e.positionName, country: e.country,
      intake: e.graduationYear, rep: e.status,
      verification: !v ? 'Sin datos compartidos' : v.verifiedStats ? (v.video ? 'Stats validadas · vídeo' : 'Stats validadas') : v.video ? 'Vídeo · stats declaradas' : 'Datos declarados',
      journey: e.status === 'requested' ? 'Propuesta pendiente' : e.status !== 'active' ? 'Sin representación activa' : bucket?.label ?? 'Sin procesos',
      nextAction: top?.title ?? nextCase?.nextAction ?? (nextCase ? `Siguiente paso con ${nextCase.institution}` : null),
      nextDue: top?.due ?? nextCase?.nextActionDue ?? null,
      processes: open.length, offers: liveOffers, attention: items.length,
      lastActivityAt: events[0]?.at ?? null, lastActivity: events[0]?.what ?? '—',
      segments,
    };
  });
}

/** Lee la URL: solo valores canónicos; lo demás vuelve al valor por defecto (URL estable y compartible). */
export function parseCrmFilters(sp: Record<string, string | string[] | undefined>): CrmFilters {
  const one = (k: string) => { const v = sp[k]; return typeof v === 'string' ? v : Array.isArray(v) ? v[0] ?? '' : ''; };
  const view = one('view');
  const rep = one('rep');
  const sort = one('sort');
  const grad = one('grad');
  const page = Number(one('page'));
  return {
    view: CRM_VIEWS.some((v) => v.id === view) ? (view as CrmView) : 'all',
    q: one('q').trim().slice(0, 80),
    sport: /^[a-z_]{2,40}$/.test(one('sport')) ? one('sport') : null,
    grad: /^\d{4}$/.test(grad) ? Number(grad) : null,
    country: /^[A-Z]{2}$/.test(one('country')) ? one('country') : null,
    rep: rep in CRM_REP_LABEL ? (rep as CrmRep) : 'active',
    sort: sort in CRM_SORT_LABEL ? (sort as CrmSort) : 'attention',
    dir: one('dir') === 'desc' ? 'desc' : 'asc',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** Escribe solo lo que no es por defecto, en orden fijo. */
export function crmQuery(f: CrmFilters, patch: Partial<CrmFilters> = {}): string {
  const n = { ...f, ...patch };
  if (!('page' in patch)) n.page = 1;
  const p = new URLSearchParams();
  if (n.view !== 'all') p.set('view', n.view);
  if (n.q) p.set('q', n.q);
  if (n.sport) p.set('sport', n.sport);
  if (n.grad) p.set('grad', String(n.grad));
  if (n.country) p.set('country', n.country);
  if (n.rep !== 'active') p.set('rep', n.rep);
  if (n.sort !== 'attention') p.set('sort', n.sort);
  if (n.dir !== 'asc') p.set('dir', n.dir);
  if (n.page > 1) p.set('page', String(n.page));
  const s = p.toString();
  return s ? `?${s}` : '';
}

const repMatch = (rep: CrmRep, r: RepStatus) => rep === 'any' || (rep === 'closed' ? r === 'declined' || r === 'ended' : r === rep);

/** Todo excepto la vista: base para los contadores de las pestañas. */
export function filterBase(rows: CrmRow[], f: CrmFilters): CrmRow[] {
  const q = norm(f.q);
  return rows.filter((r) =>
    repMatch(f.rep, r.rep)
    && (!f.sport || r.sportId === f.sport)
    && (!f.grad || r.intake === f.grad)
    && (!f.country || r.country === f.country)
    && (!q || norm([r.name, r.sport, r.position, r.country, r.nextAction, r.journey].filter(Boolean).join(' ')).includes(q)));
}

export function viewCounts(rows: CrmRow[], f: CrmFilters): Record<CrmView, number> {
  const base = filterBase(rows, f);
  return Object.fromEntries(CRM_VIEWS.map((v) => [v.id, base.filter((r) => r.segments.includes(v.id)).length])) as Record<CrmView, number>;
}

export function sortCrm(rows: CrmRow[], sort: CrmSort, dir: 'asc' | 'desc'): CrmRow[] {
  const byName = (a: CrmRow, b: CrmRow) => a.name.localeCompare(b.name, 'es') || a.id.localeCompare(b.id);
  const cmp: Record<CrmSort, (a: CrmRow, b: CrmRow) => number> = {
    attention: (a, b) => b.attention - a.attention || (a.nextDue ?? '9999').localeCompare(b.nextDue ?? '9999') || byName(a, b),
    next: (a, b) => (a.nextDue ?? '9999').localeCompare(b.nextDue ?? '9999') || byName(a, b),
    activity: (a, b) => (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? '') || byName(a, b),
    name: byName,
    grad: (a, b) => (a.intake ?? 9999) - (b.intake ?? 9999) || byName(a, b),
  };
  const sorted = [...rows].sort(cmp[sort]);
  return dir === 'desc' ? sorted.reverse() : sorted;
}

export function applyCrm(rows: CrmRow[], f: CrmFilters) {
  const filtered = sortCrm(filterBase(rows, f).filter((r) => r.segments.includes(f.view)), f.sort, f.dir);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(f.page, pages);
  return { total: filtered.length, pages, page, rows: filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) };
}

export function crmOptions(rows: CrmRow[]) {
  const uniq = <T,>(xs: (T | null)[]) => [...new Set(xs.filter((x): x is T => x != null))];
  return {
    sports: uniq(rows.map((r) => (r.sportId ? `${r.sportId}|${r.sport ?? r.sportId}` : null))).map((s) => ({ id: s.split('|')[0], name: s.split('|')[1] })).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    grads: uniq(rows.map((r) => r.intake)).sort(),
    countries: uniq(rows.map((r) => r.country)).sort(),
  };
}
