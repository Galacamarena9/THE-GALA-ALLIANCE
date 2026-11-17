/**
 * OPPORTUNITY PIPELINE · reglas puras (sin red).
 * Etapas, urgencia y comparación de ofertas. Nunca resta becas no confirmadas por escrito.
 */
export const STAGES = ['discovered', 'saved', 'applied', 'contacted', 'call', 'offer', 'decision', 'committed', 'closed'] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_INFO: Record<Stage, { label: string; hint: string }> = {
  discovered: { label: 'Descubierta', hint: 'La has visto, aún sin decidir.' },
  saved: { label: 'Interesada', hint: 'Quieres seguirla.' },
  applied: { label: 'Candidatura', hint: 'Has enviado tu candidatura o tu información.' },
  contacted: { label: 'En contacto', hint: 'Hay conversación con el staff.' },
  call: { label: 'Llamada / visita', hint: 'Entrevista, llamada, prueba o visita.' },
  offer: { label: 'Oferta', hint: 'Tienes una propuesta (pídela siempre por escrito).' },
  decision: { label: 'Decidiendo', hint: 'Comparas y decides.' },
  committed: { label: 'Comprometida', hint: 'Tu decisión final.' },
  closed: { label: 'Cerrada', hint: 'El proceso no continúa.' },
};
/** Columnas del tablero (cerradas y archivadas van aparte). */
export const BOARD_STAGES: Stage[] = ['saved', 'applied', 'contacted', 'call', 'offer', 'decision', 'committed'];
export const ACTIVE_STAGES: Stage[] = ['applied', 'contacted', 'call', 'offer', 'decision'];

export const CLOSE_REASON: Record<string, string> = {
  not_interested: 'Ya no me interesa', rejected: 'La organización no continúa', declined_offer: 'Rechacé la oferta',
  opportunity_closed: 'La oportunidad se cerró', other: 'Otro motivo',
};
export const CHANNEL_LABEL: Record<string, string> = {
  email: 'Email', call: 'Llamada', video: 'Videollamada', meeting: 'Reunión', visit: 'Visita', message: 'Mensaje', other: 'Otro',
};
export const SOURCE_LABEL: Record<string, string> = { user: 'Tú', platform: 'Gala', organization: 'Organización' };

export function isStage(v: string): v is Stage { return (STAGES as readonly string[]).includes(v); }

const DAY = 86400000;
function daysTo(date: string, now: Date) {
  return Math.ceil((new Date(`${date}T23:59:59`).getTime() - now.getTime()) / DAY);
}

export type Urgency = 'overdue' | 'due_soon' | 'stale' | 'ok' | 'done';
export const URGENCY_INFO: Record<Urgency, { label: string; tone: 'danger' | 'warn' | 'neutral' | 'ok' }> = {
  overdue: { label: 'Vencido', tone: 'danger' },
  due_soon: { label: 'Esta semana', tone: 'warn' },
  stale: { label: 'Sin movimiento', tone: 'neutral' },
  ok: { label: 'Al día', tone: 'ok' },
  done: { label: 'Cerrado', tone: 'neutral' },
};

export interface ProcessLike {
  status: string;
  next_action_due: string | null;
  official_deadline?: string | null;
  stage_changed_at: string;
  archived_at?: string | null;
  open_task_due?: string | null;
}

/**
 * Urgencia real: solo fechas que existen (plazo oficial, siguiente paso, tarea) o un proceso activo
 * sin cambios en 21 días. Nada de urgencia inventada.
 */
export function urgencyOf(p: ProcessLike, now = new Date()): { urgency: Urgency; days: number | null; reason: string } {
  if (p.archived_at || p.status === 'committed' || p.status === 'closed') return { urgency: 'done', days: null, reason: '' };
  const dates: { d: string; why: string }[] = [];
  if (p.official_deadline) dates.push({ d: p.official_deadline, why: 'Plazo oficial' });
  if (p.next_action_due) dates.push({ d: p.next_action_due, why: 'Tu siguiente paso' });
  if (p.open_task_due) dates.push({ d: p.open_task_due, why: 'Tarea pendiente' });
  const soonest = dates.map((x) => ({ ...x, n: daysTo(x.d, now) })).sort((a, b) => a.n - b.n)[0];
  if (soonest && soonest.n < 0 && soonest.why !== 'Plazo oficial') return { urgency: 'overdue', days: soonest.n, reason: `${soonest.why} vencido` };
  if (soonest && soonest.n >= 0 && soonest.n <= 7) return { urgency: 'due_soon', days: soonest.n, reason: `${soonest.why} en ${soonest.n} día${soonest.n === 1 ? '' : 's'}` };
  const idle = Math.floor((now.getTime() - new Date(p.stage_changed_at).getTime()) / DAY);
  if ((ACTIVE_STAGES as string[]).includes(p.status) && idle >= 21) return { urgency: 'stale', days: idle, reason: `${idle} días sin cambios` };
  return { urgency: 'ok', days: soonest?.n ?? null, reason: '' };
}

export const URGENCY_RANK: Record<Urgency, number> = { overdue: 0, due_soon: 1, stale: 2, ok: 3, done: 4 };

export interface OfferLike {
  annual_cost_usd: number | null;
  aid_amount_usd: number | null;
  in_writing: boolean;
  renewable: string;
}
/**
 * Coste neto anual: solo descuenta la ayuda confirmada por escrito.
 * Si no hay coste conocido, devuelve null (no se inventa).
 */
export function netCost(o: OfferLike): { net: number | null; aidCounted: number; aidPending: number } {
  if (o.annual_cost_usd == null) return { net: null, aidCounted: 0, aidPending: o.aid_amount_usd ?? 0 };
  const aid = o.aid_amount_usd ?? 0;
  const counted = o.in_writing ? aid : 0;
  return { net: Math.max(0, o.annual_cost_usd - counted), aidCounted: counted, aidPending: o.in_writing ? 0 : aid };
}

/** Resumen del pipeline para el dashboard y la cabecera. */
export function summarize(rows: (ProcessLike & { status: string })[], now = new Date()) {
  const open = rows.filter((r) => !r.archived_at);
  const byStage = Object.fromEntries(STAGES.map((s) => [s, open.filter((r) => r.status === s).length])) as Record<Stage, number>;
  const urg = open.map((r) => urgencyOf(r, now).urgency);
  return {
    total: open.length,
    active: open.filter((r) => (ACTIVE_STAGES as string[]).includes(r.status)).length,
    byStage,
    overdue: urg.filter((u) => u === 'overdue').length,
    dueSoon: urg.filter((u) => u === 'due_soon').length,
    stale: urg.filter((u) => u === 'stale').length,
  };
}
