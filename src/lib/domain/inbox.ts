/**
 * Fase 9 · Bandeja única del agente: conversaciones agrupadas por atleta (y dentro, por organización),
 * cada grupo con su contexto de recruiting (fase y siguiente acción). Lógica pura y determinista.
 */
import { compareActions, type NextAction } from './next-action.ts';

export interface InboxThread {
  id: string; athleteId: string; athleteName: string; organization: string; status: string;
  isMinor: boolean; lastMessageAt: string | null; createdAt: string;
  /** Extracto del último mensaje (o del mensaje inicial si aún no hay respuestas). */
  excerpt?: string | null;
  /** Quién escribió lo último: tu agencia, el atleta o su familia. */
  lastFrom?: 'us' | 'athlete' | 'family' | null;
  /** Lo último lo escribió la otra parte y la conversación está abierta: te toca responder. */
  awaitingReply?: boolean;
  /** Hay algo de la otra parte que aún no has abierto. */
  unread?: boolean;
}

/**
 * Estado de una conversación para la bandeja del agente (QA agente, hallazgo 5). `ours` = miembros de la agencia
 * (cualquiera de ellos que conteste cuenta como respuesta de la agencia). `readAt` = la última vez que TÚ la abriste.
 */
export function threadFlags(p: { status: string; athleteId: string; lastSenderId: string | null; lastAt: string | null; ours: Set<string>; readAt: string | null }) {
  const lastFrom: InboxThread['lastFrom'] = !p.lastSenderId ? null : p.ours.has(p.lastSenderId) ? 'us' : p.lastSenderId === p.athleteId ? 'athlete' : 'family';
  const fromThem = lastFrom === 'athlete' || lastFrom === 'family';
  return {
    lastFrom,
    awaitingReply: fromThem && p.status === 'accepted',
    unread: fromThem && (!p.readAt || (p.lastAt != null && p.lastAt > p.readAt)),
  };
}

/** Recorta un mensaje a una línea para la bandeja. */
export function excerptOf(body: string | null | undefined, max = 110): string | null {
  const one = (body ?? '').replace(/\s+/g, ' ').trim();
  if (!one) return null;
  return one.length > max ? `${one.slice(0, max - 1).trimEnd()}…` : one;
}
export interface InboxGroup {
  athleteId: string; athleteName: string; isMinor: boolean;
  threads: InboxThread[];
  /** Lo más urgente de sus procesos (null si no hay procesos visibles). */
  top: NextAction | null;
  openCases: number;
  lastAt: string;
  /** Conversaciones en las que te toca responder / con algo sin leer. */
  awaiting: number;
  unread: number;
}

export const THREAD_STATUS_LABEL: Record<string, string> = {
  pending_guardian: 'Esperando a la familia', pending: 'Esperando al atleta', accepted: 'Conversación abierta', declined: 'Rechazada', blocked: 'Bloqueada',
};

export function groupInbox(threads: InboxThread[], actionsByAthlete: Map<string, NextAction[]>): InboxGroup[] {
  const by = new Map<string, InboxThread[]>();
  for (const t of threads) by.set(t.athleteId, [...(by.get(t.athleteId) ?? []), t]);
  const groups: InboxGroup[] = [...by.entries()].map(([athleteId, ts]) => {
    const sorted = [...ts].sort((a, b) => Number(!!b.awaitingReply) - Number(!!a.awaitingReply) || (b.lastMessageAt ?? b.createdAt).localeCompare(a.lastMessageAt ?? a.createdAt) || a.id.localeCompare(b.id));
    const recent = [...ts].sort((a, b) => (b.lastMessageAt ?? b.createdAt).localeCompare(a.lastMessageAt ?? a.createdAt))[0];
    const acts = [...(actionsByAthlete.get(athleteId) ?? [])].sort(compareActions);
    return {
      athleteId, athleteName: sorted[0].athleteName, isMinor: sorted.some((t) => t.isMinor), threads: sorted,
      top: acts[0] ?? null, openCases: acts.filter((a) => a.state !== 'done').length,
      lastAt: recent.lastMessageAt ?? recent.createdAt,
      awaiting: ts.filter((x) => x.awaitingReply).length,
      unread: ts.filter((x) => x.unread).length,
    };
  });
  // Primero las conversaciones que esperan tu respuesta; luego lo que pide acción (bloqueado, vencido…) y lo más reciente.
  return groups.sort((a, b) => {
    if (Boolean(a.awaiting) !== Boolean(b.awaiting)) return a.awaiting ? -1 : 1;
    if (a.top && b.top) { const c = compareActions(a.top, b.top); if (c) return c; }
    else if (a.top || b.top) return a.top ? -1 : 1;
    return b.lastAt.localeCompare(a.lastAt) || a.athleteName.localeCompare(b.athleteName, 'es');
  });
}
