/**
 * Fase 9 · Bandeja única del agente: conversaciones agrupadas por atleta (y dentro, por organización),
 * cada grupo con su contexto de recruiting (fase y siguiente acción). Lógica pura y determinista.
 */
import { compareActions, type NextAction } from './next-action.ts';

export interface InboxThread {
  id: string; athleteId: string; athleteName: string; organization: string; status: string;
  isMinor: boolean; lastMessageAt: string | null; createdAt: string;
}
export interface InboxGroup {
  athleteId: string; athleteName: string; isMinor: boolean;
  threads: InboxThread[];
  /** Lo más urgente de sus procesos (null si no hay procesos visibles). */
  top: NextAction | null;
  openCases: number;
  lastAt: string;
}

export const THREAD_STATUS_LABEL: Record<string, string> = {
  pending_guardian: 'Esperando a la familia', pending: 'Esperando al atleta', accepted: 'Conversación abierta', declined: 'Rechazada', blocked: 'Bloqueada',
};

export function groupInbox(threads: InboxThread[], actionsByAthlete: Map<string, NextAction[]>): InboxGroup[] {
  const by = new Map<string, InboxThread[]>();
  for (const t of threads) by.set(t.athleteId, [...(by.get(t.athleteId) ?? []), t]);
  const groups: InboxGroup[] = [...by.entries()].map(([athleteId, ts]) => {
    const sorted = [...ts].sort((a, b) => (b.lastMessageAt ?? b.createdAt).localeCompare(a.lastMessageAt ?? a.createdAt) || a.id.localeCompare(b.id));
    const acts = [...(actionsByAthlete.get(athleteId) ?? [])].sort(compareActions);
    return {
      athleteId, athleteName: sorted[0].athleteName, isMinor: sorted.some((t) => t.isMinor), threads: sorted,
      top: acts[0] ?? null, openCases: acts.filter((a) => a.state !== 'done').length,
      lastAt: sorted[0].lastMessageAt ?? sorted[0].createdAt,
    };
  });
  // Primero lo que pide acción (bloqueado, vencido…), luego lo más reciente.
  return groups.sort((a, b) => {
    if (a.top && b.top) { const c = compareActions(a.top, b.top); if (c) return c; }
    else if (a.top || b.top) return a.top ? -1 : 1;
    return b.lastAt.localeCompare(a.lastAt) || a.athleteName.localeCompare(b.athleteName, 'es');
  });
}
