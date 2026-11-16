/** Agency Core: procesos de recruiting (atleta + universidad + temporada). Lógica pura. */

export type CaseStageId =
  | 'research' | 'fit_review' | 'shortlisted' | 'approved_to_contact' | 'contacted'
  | 'response_received' | 'active_conversation' | 'evaluation_visit' | 'academic_review'
  | 'offer_discussion' | 'decision_pending' | 'committed' | 'closed';

export interface CaseStage { id: CaseStageId; label: string; hint: string }

/** Las 13 fases de la especificación, en orden. */
export const CASE_STAGES: CaseStage[] = [
  { id: 'research', label: 'Investigación', hint: 'Buscando información del programa.' },
  { id: 'fit_review', label: 'Revisión de encaje', hint: 'Comprobando nivel, académico y coste.' },
  { id: 'shortlisted', label: 'Preseleccionado', hint: 'Entra en la lista corta.' },
  { id: 'approved_to_contact', label: 'Aprobado para contactar', hint: 'El atleta ha dado el visto bueno.' },
  { id: 'contacted', label: 'Contactado', hint: 'Primer contacto enviado.' },
  { id: 'response_received', label: 'Respuesta recibida', hint: 'El programa ha contestado.' },
  { id: 'active_conversation', label: 'Conversación activa', hint: 'Hay diálogo en marcha.' },
  { id: 'evaluation_visit', label: 'Evaluación o visita', hint: 'Vídeo revisado, llamada o visita.' },
  { id: 'academic_review', label: 'Revisión académica', hint: 'Admisión y elegibilidad.' },
  { id: 'offer_discussion', label: 'Oferta o ayuda', hint: 'Se habla de beca o ayuda.' },
  { id: 'decision_pending', label: 'Decisión pendiente', hint: 'Falta la decisión del atleta o del programa.' },
  { id: 'committed', label: 'Comprometido', hint: 'Compromiso o matrícula confirmados.' },
  { id: 'closed', label: 'Cerrado o en pausa', hint: 'Perdido, descartado o en espera.' },
];

const BY_ID = new Map(CASE_STAGES.map((s) => [s.id, s]));
export const FINAL_STAGES: CaseStageId[] = ['committed', 'closed'];

export function isCaseStage(v: unknown): v is CaseStageId {
  return typeof v === 'string' && BY_ID.has(v as CaseStageId);
}
export function stageLabel(id: string): string {
  return BY_ID.get(id as CaseStageId)?.label ?? id;
}

/** Siguiente fase natural; null en las finales. */
export function nextStage(id: CaseStageId): CaseStageId | null {
  if (FINAL_STAGES.includes(id) || id === 'decision_pending') return id === 'decision_pending' ? 'committed' : null;
  const i = CASE_STAGES.findIndex((s) => s.id === id);
  return CASE_STAGES[i + 1]?.id ?? null;
}

export function groupByStage<T extends { stage: string }>(items: T[]): { stage: CaseStage; items: T[] }[] {
  return CASE_STAGES.map((stage) => ({ stage, items: items.filter((i) => i.stage === stage.id) }));
}

/** Sin movimiento en 14 días y abierto: conviene revisarlo. */
export const STALE_DAYS = 14;
export function isCaseStale(c: { stage: string; updatedAt: string }, now: Date = new Date()): boolean {
  if (FINAL_STAGES.includes(c.stage as CaseStageId)) return false;
  return now.getTime() - new Date(c.updatedAt).getTime() > STALE_DAYS * 86_400_000;
}

/** Celda CSV segura: escapa comillas/comas/saltos y neutraliza fórmulas de Excel. */
export function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export interface CaseCsvRow {
  athlete: string; institution: string; sport: string | null; cycle: string; stage: string;
  owner: string | null; nextAction: string | null; nextActionDue: string | null; updatedAt: string;
}
export function casesToCsv(rows: CaseCsvRow[]): string {
  const head = ['Atleta', 'Universidad', 'Deporte', 'Temporada', 'Fase', 'Responsable', 'Próxima acción', 'Fecha', 'Actualizado'];
  const body = rows.map((r) => [r.athlete, r.institution, r.sport, r.cycle, stageLabel(r.stage), r.owner, r.nextAction, r.nextActionDue, r.updatedAt.slice(0, 10)]);
  return [head, ...body].map((cells) => cells.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export type AgencyRole = 'owner' | 'admin' | 'manager' | 'recruiter' | 'scout' | 'compliance' | 'viewer';
export const AGENCY_ROLES: { id: AgencyRole; label: string; desc: string }[] = [
  { id: 'owner', label: 'Propietario', desc: 'Responsable de la agencia y de su facturación.' },
  { id: 'admin', label: 'Administrador', desc: 'Gestiona miembros y permisos.' },
  { id: 'manager', label: 'Responsable de recruiting', desc: 'Reparte procesos y revisa el equipo.' },
  { id: 'recruiter', label: 'Recruiter o agente', desc: 'Lleva sus atletas y procesos.' },
  { id: 'scout', label: 'Scout o analista', desc: 'Investiga programas y prepara información.' },
  { id: 'compliance', label: 'Operaciones o cumplimiento', desc: 'Revisa documentos y permisos.' },
  { id: 'viewer', label: 'Solo lectura', desc: 'Ve los procesos, no cambia nada.' },
];
export function canWrite(role: AgencyRole | null | undefined): boolean {
  return role !== 'viewer';
}

/** Temporada actual (empieza en agosto) y las tres siguientes, formato 2026-27. */
export function cycleOptions(now: Date = new Date()): string[] {
  const start = now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return [0, 1, 2, 3].map((i) => `${start + i}-${String((start + i + 1) % 100).padStart(2, '0')}`);
}

export type AgendaReason = 'overdue' | 'due' | 'stale';
/**
 * Qué toca hacer: procesos abiertos con acción vencida, luego con fecha (de más cercana a más lejana),
 * luego los parados sin próxima acción. Los cerrados y comprometidos no aparecen.
 */
export function caseAgenda<T extends { id: string; stage: string; nextAction: string | null; nextActionDue: string | null; updatedAt: string }>(
  cases: T[], now: Date = new Date(),
): (T & { reason: AgendaReason })[] {
  const today = now.toISOString().slice(0, 10);
  const open = cases.filter((c) => !FINAL_STAGES.includes(c.stage as CaseStageId));
  const dated = open.filter((c) => c.nextActionDue).sort((a, b) => a.nextActionDue!.localeCompare(b.nextActionDue!))
    .map((c) => ({ ...c, reason: (c.nextActionDue! < today ? 'overdue' : 'due') as AgendaReason }));
  const stale = open.filter((c) => !c.nextActionDue && isCaseStale(c, now)).map((c) => ({ ...c, reason: 'stale' as AgendaReason }));
  return [...dated.filter((c) => c.reason === 'overdue'), ...dated.filter((c) => c.reason === 'due'), ...stale];
}
