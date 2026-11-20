/**
 * Agent Workspace — lógica pura de la cartera (sin dependencias de Next ni de Supabase).
 * Todo sale de agent_representations, athlete_directory y agency_athlete_notes:
 * aquí no se inventa ningún dato.
 */

export type RepStatus = 'requested' | 'active' | 'declined' | 'ended';
export const REP_STATUSES: RepStatus[] = ['active', 'requested', 'declined', 'ended'];

export interface RepMeta {
  label: string;
  /** Quién tiene que actuar o qué significa, para el tooltip. */
  hint: string;
  tone: 'ok' | 'warn' | 'danger' | 'neutral';
}

export const REP_META: Record<RepStatus, RepMeta> = {
  active: { label: 'Representado', hint: 'El atleta aceptó la representación.', tone: 'ok' },
  requested: { label: 'Pendiente', hint: 'Esperando respuesta del atleta: solo él o ella puede aceptar o rechazar.', tone: 'warn' },
  declined: { label: 'Rechazada', hint: 'El atleta rechazó la propuesta.', tone: 'danger' },
  ended: { label: 'Finalizada', hint: 'La representación o la propuesta se cerró.', tone: 'neutral' },
};

export function isRepStatus(v: unknown): v is RepStatus {
  return v === 'requested' || v === 'active' || v === 'declined' || v === 'ended';
}

/**
 * 12A: la base de datos distingue diez estados (pending_guardian, pending_review, suspended, expired, revoked…).
 * La cartera los agrupa en cuatro para no sobrecargar: qué está en marcha, qué espera, qué se cerró.
 */
export const DB_REP_STATUSES = ['requested', 'pending_guardian', 'pending_review', 'active', 'suspended', 'disputed',
  'expired', 'revoked', 'terminated', 'declined'] as const;
export type DbRepStatus = (typeof DB_REP_STATUSES)[number];

export function toRepStatus(v: unknown): RepStatus | null {
  switch (v) {
    case 'requested': case 'pending_guardian': case 'pending_review': return 'requested';
    case 'active': case 'suspended': case 'disputed': return 'active';
    case 'declined': return 'declined';
    case 'expired': case 'revoked': case 'terminated': case 'ended': return 'ended';
    default: return null;
  }
}

/** Matiz para el detalle: por qué está pendiente o cómo terminó. null si el grupo ya lo dice todo. */
export function repStatusDetail(v: unknown): string | null {
  switch (v) {
    case 'pending_guardian': return 'Esperando la aprobación de la familia';
    case 'pending_review': return 'Gala revisa un solape con otra representación exclusiva';
    case 'suspended': return 'Suspendida temporalmente por Gala';
    case 'disputed': return 'En disputa';
    case 'expired': return 'Caducó en su fecha de fin';
    case 'revoked': return 'El atleta la revocó';
    case 'terminated': return 'La agencia la terminó';
    default: return null;
  }
}

export interface PortfolioEntry {
  repId: string;
  agencyId: string;
  agencyName: string;
  agentId: string;
  athleteId: string;
  status: RepStatus;
  message: string | null;
  createdAt: string;
  respondedAt: string | null;
  endedAt: string | null;
  name: string;
  avatarUrl: string | null;
  country: string | null;
  sportId: string | null;
  sportName: string | null;
  positionName: string | null;
  graduationYear: number | null;
  currentTeam: string | null;
  hasVideo: boolean;
  /** Fecha de la última nota interna de la agencia, si la hay. */
  lastNoteAt: string | null;
}

export interface AgencyNote {
  id: string;
  agency_id: string;
  athlete_id: string;
  author_id: string;
  kind: 'note' | 'follow_up';
  body: string;
  due_date: string | null;
  done: boolean;
  done_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Fechas ─────────────────────────────────────────────────────────────────

/** Fecha que importa para la relación: aceptación si está activa; si no, la solicitud. */
export function sinceDate(e: Pick<PortfolioEntry, 'status' | 'respondedAt' | 'createdAt'>): string {
  return e.status === 'active' && e.respondedAt ? e.respondedAt : e.createdAt;
}

export function lastActivityAt(e: Pick<PortfolioEntry, 'createdAt' | 'respondedAt' | 'endedAt' | 'lastNoteAt'>): string {
  return [e.createdAt, e.respondedAt, e.endedAt, e.lastNoteAt]
    .filter((d): d is string => Boolean(d))
    .reduce((max, d) => (d > max ? d : max), e.createdAt);
}

export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function isOverdue(dueDate: string | null, now: Date = new Date()): boolean {
  return Boolean(dueDate) && (dueDate as string).slice(0, 10) < isoDay(now);
}

// ─── Filtros ────────────────────────────────────────────────────────────────

export type StatusFilter = 'all' | RepStatus;
export type PortfolioSort = 'recent' | 'name' | 'grad' | 'activity';

export interface PortfolioFilters {
  q: string;
  status: StatusFilter;
  sport: string | null;
  grad: number | null;
  sort: PortfolioSort;
}

export const DEFAULT_FILTERS: PortfolioFilters = { q: '', status: 'all', sport: null, grad: null, sort: 'recent' };

export const SORT_LABEL: Record<PortfolioSort, string> = {
  recent: 'Más recientes',
  name: 'Nombre A–Z',
  grad: 'Promoción',
  activity: 'Última actividad',
};

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export function parseFilters(sp: Params): PortfolioFilters {
  const status = one(sp.status);
  const sort = one(sp.sort);
  const grad = one(sp.grad);
  const sport = one(sp.sport);
  return {
    q: one(sp.q).trim().slice(0, 80),
    status: isRepStatus(status) ? status : 'all',
    sport: /^[a-z_]{2,40}$/.test(sport) ? sport : null,
    grad: /^\d{4}$/.test(grad) ? Number(grad) : null,
    sort: sort === 'name' || sort === 'grad' || sort === 'activity' ? sort : 'recent',
  };
}

/** Querystring con solo lo que no es por defecto (enlaces limpios y compartibles). */
export function filtersToQuery(f: PortfolioFilters, patch: Partial<PortfolioFilters> = {}): string {
  const n = { ...f, ...patch };
  const p = new URLSearchParams();
  if (n.q) p.set('q', n.q);
  if (n.status !== 'all') p.set('status', n.status);
  if (n.sport) p.set('sport', n.sport);
  if (n.grad) p.set('grad', String(n.grad));
  if (n.sort !== 'recent') p.set('sort', n.sort);
  const s = p.toString();
  return s ? `?${s}` : '';
}

const fold = (s: string | null | undefined) =>
  (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function filterPortfolio(entries: PortfolioEntry[], f: PortfolioFilters): PortfolioEntry[] {
  const q = fold(f.q);
  return sortPortfolio(
    entries.filter((e) => {
      if (f.status !== 'all' && e.status !== f.status) return false;
      if (f.sport && e.sportId !== f.sport) return false;
      if (f.grad && e.graduationYear !== f.grad) return false;
      if (q && !fold([e.name, e.sportName, e.positionName, e.currentTeam, e.country].join(' ')).includes(q)) return false;
      return true;
    }),
    f.sort,
  );
}

export function sortPortfolio(entries: PortfolioEntry[], sort: PortfolioSort): PortfolioEntry[] {
  const c = [...entries];
  if (sort === 'name') return c.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  if (sort === 'grad') {
    return c.sort((a, b) => {
      if (a.graduationYear === b.graduationYear) return 0;
      if (a.graduationYear == null) return 1;
      if (b.graduationYear == null) return -1;
      return a.graduationYear - b.graduationYear;
    });
  }
  if (sort === 'activity') return c.sort((a, b) => lastActivityAt(b).localeCompare(lastActivityAt(a)));
  return c.sort((a, b) => sinceDate(b).localeCompare(sinceDate(a)));
}

export function statusCounts(entries: PortfolioEntry[]): Record<StatusFilter, number> {
  const c: Record<StatusFilter, number> = { all: entries.length, active: 0, requested: 0, declined: 0, ended: 0 };
  for (const e of entries) c[e.status] += 1;
  return c;
}

/** Opciones de filtro construidas solo con valores reales de la cartera. */
export function sportOptions(entries: PortfolioEntry[]): { id: string; name: string }[] {
  const m = new Map<string, string>();
  for (const e of entries) if (e.sportId) m.set(e.sportId, e.sportName ?? e.sportId);
  return [...m].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export function gradOptions(entries: PortfolioEntry[]): number[] {
  return [...new Set(entries.map((e) => e.graduationYear).filter((y): y is number => y != null))].sort((a, b) => a - b);
}

// ─── KPIs ───────────────────────────────────────────────────────────────────

export interface PortfolioStats {
  total: number;
  active: number;
  pending: number;
  declined: number;
  ended: number;
  newLast30Days: number;
  openFollowUps: number;
  overdueFollowUps: number;
}

export function portfolioStats(entries: PortfolioEntry[], notes: Pick<AgencyNote, 'kind' | 'done' | 'due_date'>[], now: Date = new Date()): PortfolioStats {
  const cutoff = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const open = notes.filter((n) => n.kind === 'follow_up' && !n.done);
  return {
    total: entries.length,
    active: entries.filter((e) => e.status === 'active').length,
    pending: entries.filter((e) => e.status === 'requested').length,
    declined: entries.filter((e) => e.status === 'declined').length,
    ended: entries.filter((e) => e.status === 'ended').length,
    newLast30Days: entries.filter((e) => e.createdAt >= cutoff).length,
    openFollowUps: open.length,
    overdueFollowUps: open.filter((n) => isOverdue(n.due_date, now)).length,
  };
}

// ─── Actividad ──────────────────────────────────────────────────────────────

export type EventKind = 'requested' | 'accepted' | 'declined' | 'withdrawn' | 'ended' | 'note' | 'follow_up' | 'follow_up_done';

export interface TimelineEvent {
  id: string;
  kind: EventKind;
  at: string;
  title: string;
  detail?: string;
  athleteId: string;
  athleteName: string;
}

const EVENT_TITLE: Record<EventKind, string> = {
  requested: 'Propuesta de representación enviada',
  accepted: 'El atleta aceptó la representación',
  declined: 'El atleta rechazó la propuesta',
  withdrawn: 'Propuesta retirada',
  ended: 'Representación finalizada',
  note: 'Nota interna añadida',
  follow_up: 'Seguimiento programado',
  follow_up_done: 'Seguimiento completado',
};

const clip = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n)}…` : s);

export function buildTimeline(entries: PortfolioEntry[], notes: AgencyNote[] = [], limit?: number): TimelineEvent[] {
  const nameOf = new Map(entries.map((e) => [e.athleteId, e.name]));
  const out: TimelineEvent[] = [];
  const push = (ev: Omit<TimelineEvent, 'title'>) => out.push({ ...ev, title: EVENT_TITLE[ev.kind] });

  for (const e of entries) {
    const base = { athleteId: e.athleteId, athleteName: e.name };
    push({ id: `${e.repId}:req`, kind: 'requested', at: e.createdAt, detail: e.message ? clip(e.message) : undefined, ...base });
    if (e.respondedAt) push({ id: `${e.repId}:resp`, kind: e.status === 'declined' ? 'declined' : 'accepted', at: e.respondedAt, ...base });
    // Terminada sin respuesta = propuesta retirada por la agencia.
    if (e.endedAt) push({ id: `${e.repId}:end`, kind: e.respondedAt ? 'ended' : 'withdrawn', at: e.endedAt, ...base });
  }
  for (const n of notes) {
    const base = { athleteId: n.athlete_id, athleteName: nameOf.get(n.athlete_id) ?? 'Atleta' };
    push({ id: `${n.id}:c`, kind: n.kind === 'follow_up' ? 'follow_up' : 'note', at: n.created_at, detail: clip(n.body), ...base });
    if (n.kind === 'follow_up' && n.done && n.done_at) push({ id: `${n.id}:d`, kind: 'follow_up_done', at: n.done_at, detail: clip(n.body), ...base });
  }
  out.sort((a, b) => b.at.localeCompare(a.at));
  return limit == null ? out : out.slice(0, limit);
}

// ─── Próximos pasos ─────────────────────────────────────────────────────────

export interface NextStep {
  id: string;
  noteId: string;
  title: string;
  dueDate: string | null;
  overdue: boolean;
  dueToday: boolean;
  athleteId: string;
  athleteName: string;
  authorId: string;
}

export function nextSteps(notes: AgencyNote[], nameOf: Map<string, string> = new Map(), now: Date = new Date()): NextStep[] {
  const today = isoDay(now);
  return notes
    .filter((n) => n.kind === 'follow_up' && !n.done)
    .map((n) => ({
      id: `step:${n.id}`,
      noteId: n.id,
      title: n.body,
      dueDate: n.due_date,
      overdue: isOverdue(n.due_date, now),
      dueToday: n.due_date === today,
      athleteId: n.athlete_id,
      athleteName: nameOf.get(n.athlete_id) ?? 'Atleta',
      authorId: n.author_id,
    }))
    .sort((a, b) => {
      if (a.dueDate === b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
}

// ─── Utilidades de presentación ─────────────────────────────────────────────

export function initials(name: string | null | undefined): string {
  const p = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  return (p.length === 1 ? p[0][0] : p[0][0] + p[p.length - 1][0]).toUpperCase();
}

/** "hace 3 días", "en 2 días", "hoy" — sin dependencias. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const diff = new Date(iso).getTime() - now.getTime();
  const abs = Math.abs(diff);
  const min = 60_000, hour = 60 * min, day = 24 * hour;
  const fmt = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
  if (abs < hour) return fmt.format(Math.round(diff / min), 'minute');
  if (abs < day) return fmt.format(Math.round(diff / hour), 'hour');
  if (abs < 30 * day) return fmt.format(Math.round(diff / day), 'day');
  if (abs < 365 * day) return fmt.format(Math.round(diff / (30 * day)), 'month');
  return fmt.format(Math.round(diff / (365 * day)), 'year');
}

export function dueText(dueDate: string | null, now: Date = new Date()): string {
  if (!dueDate) return 'Sin fecha';
  const today = isoDay(now);
  if (dueDate === today) return 'Hoy';
  const d = new Date(`${dueDate}T12:00:00`);
  const label = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  return dueDate < today ? `Vencido · ${label}` : label;
}

/** Mensajes legibles para los errores de los triggers y la RLS. */
export function friendlyDbError(message: string | undefined): string {
  const m = message ?? '';
  if (m.includes('representation_transition_not_allowed')) return 'Ese cambio de estado no está permitido. Solo el atleta puede aceptar o rechazar.';
  if (m.includes('representation_adults_only')) return 'La representación solo está disponible con atletas mayores de edad.';
  if (m.includes('note_due_only_follow_up')) return 'Solo los seguimientos llevan fecha.';
  if (m.includes('note_immutable')) return 'No se puede cambiar a quién pertenece una nota.';
  if (m.includes('row-level security') || m.includes('agency_required')) return 'No tienes permiso para hacer esto.';
  return 'No se ha podido guardar. Inténtalo de nuevo.';
}

/** 12A: permisos que el atleta concede a su agencia, en lenguaje del atleta. */
export const REP_PERMISSIONS: { id: string; label: string }[] = [
  { id: 'passport.view', label: 'Ver tu Passport completo' },
  { id: 'passport.suggest_edit', label: 'Sugerirte cambios en el Passport' },
  { id: 'opportunities.manage', label: 'Buscar y preparar oportunidades para ti' },
  { id: 'pipeline.view', label: 'Ver tus procesos con universidades y clubes' },
  { id: 'pipeline.manage', label: 'Gestionar esos procesos' },
  { id: 'tasks.manage', label: 'Crear tareas para ti' },
  { id: 'deadlines.manage', label: 'Gestionar tus plazos' },
  { id: 'documents.view', label: 'Ver tus documentos' },
  { id: 'documents.request_share', label: 'Pedirte compartir documentos' },
  { id: 'messages.participate', label: 'Participar en tus conversaciones' },
  { id: 'organization.contact', label: 'Contactar con organizaciones en tu nombre' },
  { id: 'offers.view', label: 'Ver tus ofertas' },
  { id: 'offers.negotiate', label: 'Negociar ofertas' },
  { id: 'financial_context.view', label: 'Ver tu contexto económico' },
];

export const REP_TYPE_LABEL: Record<string, string> = {
  exclusive: 'Exclusiva', non_exclusive: 'No exclusiva', opportunity_specific: 'Solo una oportunidad',
};
