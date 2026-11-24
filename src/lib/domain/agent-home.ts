import { NO_REPLY_DAYS } from './coach-outreach.ts';
/**
 * Prompt 5 · Inicio del agente (Command Center). Lógica pura y determinista: prioridades, resumen, pipeline
 * y vista previa de la cartera. Recibe solo la proyección segura (ver AgentHomeInput) y nunca notas
 * internas de scouting ni datos de cumplimiento: solo hechos operativos (fechas, fases, títulos de tareas).
 */

export type AttentionKind = 'offer_expiring' | 'overdue' | 'university_reply' | 'visit' | 'new_opportunity';
export type DueState = 'overdue' | 'today' | 'soon' | 'upcoming' | 'new';

/** Orden de la especificación: una oferta que caduca gana a todo; una oportunidad nueva va la última. */
export const ATTENTION_RANK: Record<AttentionKind, number> = {
  offer_expiring: 1, overdue: 2, university_reply: 3, visit: 4, new_opportunity: 5,
};
export const ATTENTION_LABEL: Record<AttentionKind, string> = {
  offer_expiring: 'Oferta que caduca', overdue: 'Vencido', university_reply: 'Respuesta de universidad',
  visit: 'Visita o entrevista', new_opportunity: 'Oportunidad nueva',
};

export interface AttentionItem {
  key: string;
  kind: AttentionKind;
  rank: number;
  athleteId: string;
  athleteName: string;
  title: string;
  context: string;
  due: string | null;
  dueState: DueState;
  /** Exactamente una acción principal por elemento. */
  cta: { label: string; href: string };
}

export interface HomeAthlete { id: string; name: string; sportId: string | null; sportName: string | null; positionName: string | null; graduationYear: number | null; status: 'active' | 'requested' | 'other'; lastActivityAt: string | null }
export interface HomeOffer { id: string; athleteId: string; university: string; aidUsd: number | null; deadline: string | null }
export interface HomeCase { id: string; athleteId: string; institution: string; stage: string; nextAction: string | null; nextActionDue: string | null; updatedAt: string }
export interface HomeTask { id: string; caseId: string; title: string; dueDate: string | null }
export interface HomeFollowUp { id: string; athleteId: string; dueDate: string | null }
export interface HomeRepAlert { athleteId: string; text: string; daysLeft: number | null; severe: boolean }
export interface HomeOpportunity { id: string; title: string; organization: string; sportId: string | null; graduationYears: number[]; deadline: string | null; createdAt: string }

export interface AgentHomeInput {
  athletes: HomeAthlete[];
  offers: HomeOffer[];
  cases: HomeCase[];
  tasks: HomeTask[];
  followUps: HomeFollowUp[];
  repAlerts: HomeRepAlert[];
  opportunities: HomeOpportunity[];
  /** Ciclo 2 · emails a coaches enviados que siguen sin respuesta. */
  coachOutreach?: { id: string; caseId: string; sentAt: string }[];
}

export const OFFER_WINDOW_DAYS = 7;
export const REPLY_WINDOW_DAYS = 7;
export const VISIT_WINDOW_DAYS = 14;
export const NEW_OPP_DAYS = 7;
const FINAL = new Set(['committed', 'closed']);

const day = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => day(new Date(Date.parse(`${iso}T00:00:00Z`) + n * 864e5));
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 864e5);

export function dueStateOf(due: string | null, today: string): DueState {
  if (!due) return 'upcoming';
  if (due < today) return 'overdue';
  if (due === today) return 'today';
  return daysBetween(today, due) <= 3 ? 'soon' : 'upcoming';
}

export function dueText(due: string | null, today: string): string {
  if (!due) return 'Sin fecha';
  const n = daysBetween(today, due);
  if (n < 0) return n === -1 ? 'Venció ayer' : `Venció hace ${-n} días`;
  if (n === 0) return 'Hoy';
  if (n === 1) return 'Mañana';
  return `En ${n} días`;
}

/** Oportunidades que encajan con algún atleta activo: mismo deporte y (si la oportunidad lo fija) su promoción. */
export function matchingOpportunities(opps: HomeOpportunity[], athletes: HomeAthlete[], today: string) {
  const active = athletes.filter((a) => a.status === 'active');
  return opps
    .filter((o) => !o.deadline || o.deadline >= today)
    .map((o) => ({ o, who: active.filter((a) => a.sportId && a.sportId === o.sportId && (!o.graduationYears.length || (a.graduationYear != null && o.graduationYears.includes(a.graduationYear)))) }))
    .filter((x) => x.who.length > 0);
}

/**
 * «Necesita atención» en orden determinista:
 * 1. ofertas que caducan en ≤ 7 días · 2. vencidos (próxima acción, tarea, seguimiento o representación que vence en ≤ 7 días)
 * · 3. respuestas de universidad (≤ 7 días) · 4. visitas o entrevistas (≤ 14 días) · 5. oportunidades nuevas que encajan (≤ 7 días).
 * Dentro de cada grupo: fecha más próxima primero, luego nombre del atleta, luego clave (orden total y estable).
 */
export function buildAttention(input: AgentHomeInput, now: Date = new Date()): AttentionItem[] {
  const today = day(now);
  const name = new Map(input.athletes.map((a) => [a.id, a.name]));
  const caseById = new Map(input.cases.map((c) => [c.id, c]));
  const items: AttentionItem[] = [];
  const push = (i: Omit<AttentionItem, 'rank' | 'athleteName'> & { athleteName?: string }) =>
    items.push({ ...i, rank: ATTENTION_RANK[i.kind], athleteName: i.athleteName ?? name.get(i.athleteId) ?? 'Atleta' });

  for (const o of input.offers) {
    if (!o.deadline || o.deadline < today || o.deadline > addDays(today, OFFER_WINDOW_DAYS)) continue;
    push({ key: `offer:${o.id}`, kind: 'offer_expiring', athleteId: o.athleteId, title: `Oferta de ${o.university} caduca`,
      context: o.aidUsd ? `${o.aidUsd.toLocaleString('es-ES')} $/año` : 'Ayuda sin indicar', due: o.deadline, dueState: dueStateOf(o.deadline, today),
      cta: { label: 'Revisar oferta', href: `/app/portfolio/${o.athleteId}` } });
  }

  const open = input.cases.filter((c) => !FINAL.has(c.stage));
  for (const c of open) {
    if (c.nextActionDue && c.nextActionDue < today) {
      push({ key: `case:${c.id}`, kind: 'overdue', athleteId: c.athleteId, title: c.nextAction ?? 'Próxima acción vencida', context: c.institution,
        due: c.nextActionDue, dueState: 'overdue', cta: { label: 'Abrir proceso', href: `/app/pipeline/${c.id}` } });
    }
  }
  for (const t of input.tasks) {
    const c = caseById.get(t.caseId);
    if (!c || FINAL.has(c.stage) || !t.dueDate || t.dueDate >= today) continue;
    push({ key: `task:${t.id}`, kind: 'overdue', athleteId: c.athleteId, title: t.title, context: `Tarea · ${c.institution}`,
      due: t.dueDate, dueState: 'overdue', cta: { label: 'Hacer tarea', href: `/app/pipeline/${c.id}` } });
  }
  input.followUps.forEach((f) => {
    if (!f.dueDate || f.dueDate >= today) return;
    // El texto del seguimiento es interno de la agencia: aquí solo el hecho y la fecha.
    push({ key: `follow:${f.id}`, kind: 'overdue', athleteId: f.athleteId, title: 'Seguimiento pendiente', context: 'Tu agenda',
      due: f.dueDate, dueState: 'overdue', cta: { label: 'Ver seguimiento', href: `/app/portfolio/${f.athleteId}?tab=actividad` } });
  });
  for (const r of input.repAlerts) {
    if (!r.severe) continue;
    push({ key: `rep:${r.athleteId}`, kind: 'overdue', athleteId: r.athleteId, title: r.text, context: 'Representación',
      due: r.daysLeft != null ? addDays(today, r.daysLeft) : null, dueState: r.daysLeft == null ? 'overdue' : dueStateOf(addDays(today, r.daysLeft), today),
      cta: { label: 'Revisar representación', href: `/app/portfolio/${r.athleteId}` } });
  }

  for (const o of input.coachOutreach ?? []) {
    const c = caseById.get(o.caseId);
    const sent = o.sentAt.slice(0, 10);
    if (!c || FINAL.has(c.stage) || daysBetween(sent, today) < NO_REPLY_DAYS) continue;
    push({ key: `coach:${o.id}`, kind: 'overdue', athleteId: c.athleteId, title: `${c.institution} no ha contestado`,
      context: `Email al coach · hace ${daysBetween(sent, today)} días`, due: addDays(sent, NO_REPLY_DAYS), dueState: 'overdue',
      cta: { label: 'Hacer seguimiento', href: `/app/pipeline/${c.id}` } });
  }

  for (const c of open) {
    if (c.stage !== 'response_received') continue;
    const updated = c.updatedAt.slice(0, 10);
    if (daysBetween(updated, today) > REPLY_WINDOW_DAYS) continue;
    push({ key: `reply:${c.id}`, kind: 'university_reply', athleteId: c.athleteId, title: `${c.institution} ha respondido`, context: 'Respuesta recibida',
      due: updated, dueState: 'new', cta: { label: 'Responder', href: `/app/pipeline/${c.id}` } });
  }
  for (const c of open) {
    if (c.stage !== 'evaluation_visit' || !c.nextActionDue || c.nextActionDue < today || c.nextActionDue > addDays(today, VISIT_WINDOW_DAYS)) continue;
    push({ key: `visit:${c.id}`, kind: 'visit', athleteId: c.athleteId, title: c.nextAction ?? `Visita a ${c.institution}`, context: c.institution,
      due: c.nextActionDue, dueState: dueStateOf(c.nextActionDue, today), cta: { label: 'Preparar visita', href: `/app/pipeline/${c.id}` } });
  }

  const fresh = input.opportunities.filter((o) => daysBetween(o.createdAt.slice(0, 10), today) <= NEW_OPP_DAYS);
  for (const { o, who } of matchingOpportunities(fresh, input.athletes, today)) {
    const first = [...who].sort((a, b) => a.name.localeCompare(b.name, 'es'))[0];
    push({ key: `opp:${o.id}`, kind: 'new_opportunity', athleteId: first.id, athleteName: who.length > 1 ? `${first.name} y ${who.length - 1} más` : first.name,
      title: o.title, context: o.organization, due: o.deadline, dueState: 'new', cta: { label: 'Ver oportunidad', href: `/app/opportunities/${o.id}` } });
  }

  return items.sort((a, b) => a.rank - b.rank || (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.athleteName.localeCompare(b.athleteName, 'es') || a.key.localeCompare(b.key));
}

/**
 * Pipeline del agente en 5 fases visibles (fase 9): Introducción · Evaluación · Visita o prueba · Oferta · Decisión o colocado.
 * Las 13 fases internas se agrupan; «cerrado» no cuenta. Lo aún sin contactar (investigación, shortlist) vive en Introducción.
 */
export const PIPELINE_BUCKETS = [
  { id: 'introduction', label: 'Introducción', stages: ['research', 'fit_review', 'shortlisted', 'approved_to_contact', 'contacted', 'response_received'] },
  { id: 'evaluation', label: 'Evaluación', stages: ['active_conversation', 'academic_review'] },
  { id: 'visit', label: 'Visita o prueba', stages: ['evaluation_visit'] },
  { id: 'offer', label: 'Oferta', stages: ['offer_discussion'] },
  { id: 'placed', label: 'Decisión o colocado', stages: ['decision_pending', 'committed'] },
] as const;

export function pipelineCounts(cases: HomeCase[]) {
  return PIPELINE_BUCKETS.map((b) => ({ id: b.id, label: b.label, count: cases.filter((c) => (b.stages as readonly string[]).includes(c.stage)).length }));
}

export interface AgentHomeSummary { athletes: number; needAttention: number; activeOpportunities: number; offers: number; deadlinesToday: number }

/** Resumen que cuadra con las fuentes (las pruebas lo recalculan a mano). */
export function summarize(input: AgentHomeInput, attention: AttentionItem[], now: Date = new Date()): AgentHomeSummary {
  const today = day(now);
  const activeIds = new Set(input.athletes.filter((a) => a.status === 'active').map((a) => a.id));
  return {
    athletes: activeIds.size,
    needAttention: attention.filter((i) => i.rank <= 4).length,
    activeOpportunities: matchingOpportunities(input.opportunities, input.athletes, today).length,
    offers: input.offers.filter((o) => activeIds.has(o.athleteId) && (!o.deadline || o.deadline >= today)).length,
    deadlinesToday: attention.filter((i) => i.due === today && i.kind !== 'university_reply' && i.kind !== 'new_opportunity').length,
  };
}

export interface AthletePreviewRow { id: string; name: string; meta: string; status: string; nextAction: string | null; nextDue: string | null; processes: number; lastActivityAt: string | null; needsAttention: boolean }

/** Vista previa de la cartera: primero los que necesitan atención, luego por siguiente fecha y actividad. */
export function athletesPreview(input: AgentHomeInput, attention: AttentionItem[], limit = 5): AthletePreviewRow[] {
  const flagged = new Set(attention.filter((i) => i.rank <= 4).map((i) => i.athleteId));
  const rows = input.athletes.filter((a) => a.status === 'active').map((a) => {
    const open = input.cases.filter((c) => c.athleteId === a.id && !FINAL.has(c.stage));
    const next = open.filter((c) => c.nextActionDue).sort((x, y) => x.nextActionDue!.localeCompare(y.nextActionDue!))[0];
    const last = [a.lastActivityAt, ...open.map((c) => c.updatedAt)].filter(Boolean).sort().at(-1) ?? null;
    const placed = input.cases.some((c) => c.athleteId === a.id && c.stage === 'committed');
    const offer = open.some((c) => c.stage === 'offer_discussion' || c.stage === 'decision_pending');
    return {
      id: a.id, name: a.name, meta: [a.sportName, a.positionName, a.graduationYear].filter(Boolean).join(' · '),
      status: placed ? 'Colocado' : offer ? 'Con oferta' : open.length ? 'En proceso' : 'Sin procesos',
      nextAction: next?.nextAction ?? (next ? `Siguiente paso con ${next.institution}` : null), nextDue: next?.nextActionDue ?? null,
      processes: open.length, lastActivityAt: last, needsAttention: flagged.has(a.id),
    };
  });
  return rows.sort((x, y) => Number(y.needsAttention) - Number(x.needsAttention) || (x.nextDue ?? '9999').localeCompare(y.nextDue ?? '9999') || (y.lastActivityAt ?? '').localeCompare(x.lastActivityAt ?? '') || x.name.localeCompare(y.name, 'es')).slice(0, limit);
}

/** Destino seguro para /app/go: solo rutas de /app con caracteres de ruta y query simples; si no, /app. */
export function safeInternalPath(to: string | null | undefined): string {
  if (!to || to.includes('//') || to.includes('\\')) return '/app';
  return /^\/app(\/[A-Za-z0-9_\-/]*)?(\?[A-Za-z0-9_\-=&%.]*)?$/.test(to) ? to : '/app';
}
