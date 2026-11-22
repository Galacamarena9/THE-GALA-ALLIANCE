/**
 * Fase 9 · Motor de «siguiente acción» de un proceso (atleta × organización × temporada).
 *
 * Determinista y puro: mismas entradas + misma fecha ⇒ misma salida. Devuelve UNA acción, quién debe hacerla,
 * para cuándo, UN bloqueo como mucho y UN botón. Las reglas van en orden de prioridad y la primera que aplica gana.
 * No lee datos: recibe lo que la página ya cargó con la sesión del agente (RLS).
 */
import { PIPELINE_BUCKETS } from './agent-home.ts';

export type Actor = 'agent' | 'athlete' | 'family' | 'organization';
export const ACTOR_LABEL: Record<Actor, string> = { agent: 'Tú', athlete: 'El atleta', family: 'La familia', organization: 'La organización' };
/** «Le toca …»: con la preposición correcta. */
export const TURN_LABEL: Record<Actor, string> = { agent: 'Te toca', athlete: 'Le toca al atleta', family: 'Le toca a la familia', organization: 'Le toca a la organización' };

/** blocked: no se puede avanzar · overdue: vencido · today/soon: toca ya · waiting: espera a otra parte · ready: listo para hacer · done: colocado. */
export type ActionState = 'blocked' | 'overdue' | 'today' | 'soon' | 'waiting' | 'ready' | 'done';
export const STATE_LABEL: Record<ActionState, string> = {
  blocked: 'Bloqueado', overdue: 'Vencido', today: 'Hoy', soon: 'Esta semana', waiting: 'En espera', ready: 'Por hacer', done: 'Colocado',
};

export interface NextAction {
  key: string;
  action: string;
  actor: Actor;
  due: string | null;
  state: ActionState;
  /** Como mucho un bloqueo: lo que impide avanzar. */
  blocker: string | null;
  cta: { label: string; href: string };
}

export interface NACase {
  id: string; athleteId: string; institution: string; stage: string;
  nextAction: string | null; nextActionDue: string | null; updatedAt: string;
}
export interface NAContext {
  /** Representación efectiva para esta agencia (activa, en fechas). */
  repActive: boolean;
  /** Menor sin la aprobación del tutor que hace falta. */
  guardianPending?: boolean;
  /** El rol del agente en la agencia permite escribir. */
  canWrite?: boolean;
  /** Tareas abiertas de este proceso. */
  tasks?: { title: string; dueDate: string | null }[];
  /** Oferta de esta organización para el atleta, si la hay. */
  offer?: { deadline: string | null } | null;
  /** Documento pedido por la agencia y aún sin respuesta. */
  docRequest?: { title: string; requestedAt: string; fromFamily: boolean } | null;
}

export const FOLLOW_UP_DAYS = 7;
export const STALE_DAYS = 14;
const SOON_DAYS = 7;

const day = (d: Date) => d.toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const dueState = (due: string, today: string): ActionState => (due < today ? 'overdue' : due === today ? 'today' : daysBetween(today, due) <= SOON_DAYS ? 'soon' : 'ready');

export const phaseOf = (stage: string) => PIPELINE_BUCKETS.find((b) => (b.stages as readonly string[]).includes(stage)) ?? null;

export function nextAction(c: NACase, ctx: NAContext, now: Date = new Date()): NextAction {
  const today = day(now);
  const caseHref = `/app/pipeline/${c.id}`;
  const a360 = (tab: string) => `/app/portfolio/${c.athleteId}?tab=${tab}`;
  const mk = (key: string, n: Omit<NextAction, 'key'>): NextAction => ({ key, ...n });

  if (c.stage === 'closed') return mk('closed', { action: 'Proceso cerrado', actor: 'agent', due: null, state: 'done', blocker: null, cta: { label: 'Ver proceso', href: caseHref } });

  // 1 · Sin autoridad no hay acción: la representación manda sobre todo lo demás.
  if (!ctx.repActive) {
    return mk('rep', { action: 'Renovar o revisar la representación', actor: 'agent', due: null, state: 'blocked', blocker: 'La representación no está activa: no puedes actuar en este proceso.', cta: { label: 'Ver representación', href: a360('resumen') } });
  }
  if (ctx.guardianPending) {
    return mk('guardian', { action: 'Esperar la aprobación de la familia', actor: 'family', due: null, state: 'blocked', blocker: 'Es menor: hace falta la aprobación del tutor.', cta: { label: 'Ver ficha', href: a360('resumen') } });
  }

  if (c.stage === 'committed') {
    return mk('placed', { action: 'Preparar la llegada: documentos de visado y viaje', actor: 'athlete', due: null, state: 'done', blocker: null, cta: { label: 'Ver documentos', href: a360('documentos') } });
  }

  // 2 · Una oferta con plazo manda: si caduca, se pierde.
  const od = ctx.offer?.deadline ?? null;
  if (od && od < today) {
    return mk('offer-expired', { action: `Confirmar con ${c.institution} si la oferta sigue en pie`, actor: 'agent', due: od, state: 'overdue', blocker: 'La oferta ha caducado.', cta: { label: 'Revisar oferta', href: a360('oportunidades') } });
  }
  if (od && daysBetween(today, od) <= SOON_DAYS) {
    return mk('offer', { action: `Decidir la oferta de ${c.institution}`, actor: 'athlete', due: od, state: dueState(od, today), blocker: null, cta: { label: 'Revisar oferta', href: a360('oportunidades') } });
  }

  // 3 · Lo vencido del propio agente.
  const overdueTask = (ctx.tasks ?? []).filter((t) => t.dueDate && t.dueDate < today).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!) || a.title.localeCompare(b.title))[0];
  if (overdueTask) return mk('task', { action: overdueTask.title, actor: 'agent', due: overdueTask.dueDate, state: 'overdue', blocker: null, cta: { label: 'Hacer tarea', href: caseHref } });
  if (c.nextActionDue && c.nextActionDue < today) {
    return mk('manual-overdue', { action: c.nextAction ?? 'Próxima acción vencida', actor: 'agent', due: c.nextActionDue, state: 'overdue', blocker: null, cta: { label: 'Abrir proceso', href: caseHref } });
  }

  // 4 · Documento pedido: espera a la otra parte; a la semana, recordatorio.
  if (ctx.docRequest) {
    const who: Actor = ctx.docRequest.fromFamily ? 'family' : 'athlete';
    const age = daysBetween(ctx.docRequest.requestedAt.slice(0, 10), today);
    if (age >= FOLLOW_UP_DAYS) {
      return mk('doc-remind', { action: `Recordar «${ctx.docRequest.title}»`, actor: 'agent', due: today, state: 'today', blocker: `Falta ${ctx.docRequest.title.toLowerCase()}.`, cta: { label: 'Ver documentos', href: a360('documentos') } });
    }
    return mk('doc-wait', { action: `Esperando «${ctx.docRequest.title}»`, actor: who, due: addDays(ctx.docRequest.requestedAt.slice(0, 10), FOLLOW_UP_DAYS), state: 'waiting', blocker: `Falta ${ctx.docRequest.title.toLowerCase()}.`, cta: { label: 'Ver documentos', href: a360('documentos') } });
  }

  // 5 · La próxima acción que el agente apuntó, con fecha.
  if (c.nextAction && c.nextActionDue) {
    return mk('manual', { action: c.nextAction, actor: 'agent', due: c.nextActionDue, state: dueState(c.nextActionDue, today), blocker: null, cta: { label: 'Abrir proceso', href: caseHref } });
  }
  const nextTask = (ctx.tasks ?? []).filter((t) => t.dueDate).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!) || a.title.localeCompare(b.title))[0];
  if (nextTask) return mk('task-next', { action: nextTask.title, actor: 'agent', due: nextTask.dueDate, state: dueState(nextTask.dueDate!, today), blocker: null, cta: { label: 'Hacer tarea', href: caseHref } });

  // 6 · Lo que toca según la fase.
  const quiet = daysBetween(c.updatedAt.slice(0, 10), today);
  if (c.stage === 'contacted') {
    return quiet >= FOLLOW_UP_DAYS
      ? mk('follow-up', { action: `Hacer seguimiento con ${c.institution}`, actor: 'agent', due: today, state: 'today', blocker: null, cta: { label: 'Abrir proceso', href: caseHref } })
      : mk('await-org', { action: `Esperando respuesta de ${c.institution}`, actor: 'organization', due: addDays(c.updatedAt.slice(0, 10), FOLLOW_UP_DAYS), state: 'waiting', blocker: null, cta: { label: 'Abrir proceso', href: caseHref } });
  }
  if (c.stage === 'decision_pending') {
    return mk('await-athlete', { action: 'Esperando la decisión del atleta', actor: 'athlete', due: null, state: 'waiting', blocker: null, cta: { label: 'Ver ficha', href: a360('resumen') } });
  }
  if (quiet >= STALE_DAYS) {
    return mk('stale', { action: `Reactivar: ${quiet} días sin movimiento con ${c.institution}`, actor: 'agent', due: today, state: 'today', blocker: null, cta: { label: 'Abrir proceso', href: caseHref } });
  }
  const STAGE_ACTION: Record<string, string> = {
    research: `Revisar si ${c.institution} encaja`,
    fit_review: `Revisar si ${c.institution} encaja`,
    shortlisted: `Preparar la presentación para ${c.institution}`,
    approved_to_contact: `Enviar la presentación a ${c.institution}`,
    response_received: `Responder a ${c.institution}`,
    active_conversation: `Pedir a ${c.institution} el siguiente paso`,
    academic_review: 'Completar la revisión académica',
    evaluation_visit: 'Confirmar la visita o la prueba',
    offer_discussion: `Negociar la oferta de ${c.institution}`,
  };
  return mk(`stage-${c.stage}`, { action: STAGE_ACTION[c.stage] ?? 'Revisar el proceso', actor: 'agent', due: null, state: 'ready', blocker: null, cta: { label: 'Abrir proceso', href: caseHref } });
}

/** Orden de trabajo: bloqueado y vencido primero, luego por fecha; colocado al final. */
const STATE_RANK: Record<ActionState, number> = { blocked: 0, overdue: 1, today: 2, soon: 3, ready: 4, waiting: 5, done: 6 };
export function compareActions(a: NextAction, b: NextAction) {
  return STATE_RANK[a.state] - STATE_RANK[b.state] || (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.key.localeCompare(b.key);
}
