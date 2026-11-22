/**
 * Informe mensual del agente para la familia (puro y determinista).
 * Solo usa procesos COMPARTIDOS con el atleta: las notas internas de la agencia nunca entran en el informe.
 */
import { FINAL_STAGES, stageLabel } from './agency-cases.ts';

export interface ReportCase {
  institutionName: string; stage: string; nextAction: string | null; nextActionDue: string | null;
  sharedWithAthlete: boolean; updatedAt: string; createdAt: string; outcomeReason: string | null;
}
export interface ReportOffer { title: string; orgName: string; netUsd: number | null; deadline: string | null }

export interface MonthlyReport {
  month: string; // YYYY-MM
  monthLabel: string;
  active: number;
  started: { name: string; stage: string }[];
  moved: { name: string; stage: string }[];
  committed: { name: string }[];
  nextSteps: { name: string; action: string; due: string | null }[];
  offers: ReportOffer[];
  hiddenInternal: number;
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function isMonth(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}
export function monthLabel(month: string): string {
  return `${MONTHS.at(Number(month.slice(5, 7)) - 1)} de ${month.slice(0, 4)}`;
}

export function buildMonthlyReport(p: { month: string; cases: ReportCase[]; offers: ReportOffer[] | null }): MonthlyReport {
  const inMonth = (iso: string) => iso.slice(0, 7) === p.month;
  const shared = p.cases.filter((c) => c.sharedWithAthlete);
  const open = shared.filter((c) => !FINAL_STAGES.includes(c.stage as never));
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'es');
  return {
    month: p.month,
    monthLabel: monthLabel(p.month),
    active: open.length,
    started: shared.filter((c) => inMonth(c.createdAt)).map((c) => ({ name: c.institutionName, stage: stageLabel(c.stage) })).sort(byName),
    moved: shared.filter((c) => !inMonth(c.createdAt) && inMonth(c.updatedAt) && c.stage !== 'committed').map((c) => ({ name: c.institutionName, stage: stageLabel(c.stage) })).sort(byName),
    committed: shared.filter((c) => c.stage === 'committed').map((c) => ({ name: c.institutionName })),
    nextSteps: open.filter((c) => c.nextAction).map((c) => ({ name: c.institutionName, action: c.nextAction as string, due: c.nextActionDue }))
      .sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999')).slice(0, 8),
    offers: (p.offers ?? []).slice(0, 6),
    hiddenInternal: p.cases.length - shared.length,
  };
}
