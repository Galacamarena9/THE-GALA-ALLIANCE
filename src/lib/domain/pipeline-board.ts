import type { ApplicationStatus } from '../types.ts';

/** Tablero de candidatos: los 10 estados del pipeline agrupados en 5 fases legibles. */
export type PhaseKey = 'new' | 'contact' | 'evaluation' | 'offer' | 'closed';
export interface BoardPhase { key: PhaseKey; label: string; hint: string; tone: 'brass' | 'neutral' | 'warn' | 'ok' | 'danger'; statuses: ApplicationStatus[] }

export const BOARD_PHASES: BoardPhase[] = [
  { key: 'new', label: 'Nuevas', hint: 'Por revisar', tone: 'brass', statuses: ['applied', 'reviewed'] },
  { key: 'contact', label: 'En contacto', hint: 'Conversación abierta', tone: 'neutral', statuses: ['contacted', 'information_requested'] },
  { key: 'evaluation', label: 'Evaluación', hint: 'Entrevista, prueba o preselección', tone: 'warn', statuses: ['interview', 'tryout', 'shortlist'] },
  { key: 'offer', label: 'Oferta', hint: 'Propuesta enviada o aceptada', tone: 'ok', statuses: ['offer', 'accepted'] },
  { key: 'closed', label: 'Descartadas', hint: 'Fuera del proceso', tone: 'danger', statuses: ['declined'] },
];

/** Orden lineal del proceso (sin "descartada", que es una salida). */
const FLOW: ApplicationStatus[] = ['applied', 'reviewed', 'contacted', 'information_requested', 'interview', 'tryout', 'shortlist', 'offer', 'accepted'];

export function phaseOf(status: ApplicationStatus): PhaseKey {
  return (BOARD_PHASES.find((p) => p.statuses.includes(status)) ?? BOARD_PHASES[0]).key;
}

export function nextStatus(status: ApplicationStatus): ApplicationStatus | null {
  const i = FLOW.indexOf(status);
  return i < 0 || i === FLOW.length - 1 ? null : FLOW[i + 1];
}

export function boardColumns<T extends { status: ApplicationStatus }>(items: T[]): (BoardPhase & { items: T[] })[] {
  return BOARD_PHASES.map((p) => ({
    ...p,
    items: items.filter((i) => p.statuses.includes(i.status)).sort((a, b) => p.statuses.indexOf(a.status) - p.statuses.indexOf(b.status)),
  }));
}
