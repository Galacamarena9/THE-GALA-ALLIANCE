/**
 * «Listo para EE. UU.»: los 6 hitos que un atleta europeo necesita para llegar a la NCAA/NAIA, calculados
 * a partir de la lista de documentos que la agencia ve (nunca afirma que algo falta si no lo ha podido ver).
 * Puro y determinista: mismo resultado para la misma entrada.
 */
import type { ChecklistRow } from './athlete-360.ts';

export type MilestoneState = 'done' | 'requested' | 'overdue' | 'pending' | 'later' | 'locked' | 'unknown';

export interface Milestone {
  key: 'video' | 'academic' | 'english' | 'eligibility' | 'passport' | 'visa';
  title: string;
  why: string;
  state: MilestoneState;
  /** Fecha recomendada más temprana entre sus documentos (YYYY-MM-DD) o null. */
  due: string | null;
}

const DEFS: { key: Milestone['key']; title: string; why: string; kinds: string[] }[] = [
  { key: 'video', title: 'Vídeo de highlights', why: 'Lo primero que mira un entrenador.', kinds: ['highlight_video'] },
  { key: 'academic', title: 'Notas y traducción', why: 'Las piden la admisión y la elegibilidad académica.', kinds: ['transcript', 'translation'] },
  { key: 'english', title: 'Examen de inglés', why: 'Cada universidad exige una nota mínima.', kinds: ['english_test'] },
  { key: 'eligibility', title: 'Elegibilidad (NCAA Eligibility Center o PlayNAIA)', why: 'Sin registro no puede competir; lo confirma el atleta.', kinds: [] },
  { key: 'passport', title: 'Pasaporte en vigor', why: 'Para los exámenes y el visado.', kinds: ['passport'] },
  { key: 'visa', title: 'Visado F-1 (I-20, SEVIS, DS-160)', why: 'Tras aceptar una oferta; sin I-20 no hay visado.', kinds: ['financial', 'i20', 'sevis_receipt', 'ds160'] },
];

export const MILESTONE_STATE_LABEL: Record<MilestoneState, string> = {
  done: 'Listo', requested: 'Pedido', overdue: 'Vencido', pending: 'Pendiente', later: 'Tras la oferta', locked: 'Sin permiso', unknown: 'Por confirmar',
};

export function usReadiness(rows: ChecklistRow[], today: string, opts: { committed?: boolean } = {}): { milestones: Milestone[]; done: number; total: number } {
  const milestones = DEFS.map((d): Milestone => {
    const mine = rows.filter((r) => d.kinds.includes(r.kind));
    const dues = mine.map((r) => r.due).filter((x): x is string => !!x).sort();
    const due = dues[0] ?? null;
    let state: MilestoneState;
    if (d.key === 'eligibility') state = 'unknown';
    else if (!mine.length) state = 'pending';
    else if (mine.every((r) => r.state === 'locked')) state = 'locked';
    else if (mine.every((r) => r.state === 'shared')) state = 'done';
    else if (d.key === 'visa' && !opts.committed) state = 'later';
    else if (mine.some((r) => r.state === 'requested')) state = 'requested';
    else if (due && due < today) state = 'overdue';
    else state = 'pending';
    return { key: d.key, title: d.title, why: d.why, state, due };
  });
  const relevant = milestones.filter((m) => m.state !== 'later' && m.state !== 'locked');
  return { milestones, done: relevant.filter((m) => m.state === 'done').length, total: relevant.length };
}
