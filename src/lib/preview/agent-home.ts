/**
 * Inicio del agente con datos FICTICIOS (solo /preview, nunca en producción): misma lógica real
 * (buildAttention, summarize…) sobre la cartera y los procesos de ejemplo.
 */
import type { AgentHomeData } from '@/lib/data/agent-home';
import { representationAlerts } from '@/lib/domain/portfolio';
import { athletesPreview, buildAttention, pipelineCounts, summarize, type AgentHomeInput } from '@/lib/domain/agent-home';
import { previewCases, previewPortfolio } from './fixtures';

const now = Date.now();
const inDays = (d: number) => new Date(now + d * 864e5).toISOString().slice(0, 10);
const ago = (d: number) => new Date(now - d * 864e5).toISOString();

export function previewAgentHome(variant: 'full' | 'empty' | 'partial' | 'no_agency' | 'error' = 'full'): AgentHomeData {
  const entries = variant === 'empty' ? [] : previewPortfolio.entries;
  const athletes = entries.map((e) => ({
    id: e.athleteId, name: e.name, sportId: e.sportId, sportName: e.sportName, positionName: e.positionName, graduationYear: e.graduationYear,
    status: (e.status === 'active' ? 'active' : e.status === 'requested' ? 'requested' : 'other') as 'active' | 'requested' | 'other', lastActivityAt: e.lastNoteAt ?? e.respondedAt,
  }));
  const cases = (variant === 'empty' ? [] : previewCases).map((c) => ({ id: c.id, athleteId: c.athleteId, institution: c.institutionName, stage: c.stage, nextAction: c.nextAction, nextActionDue: c.nextActionDue, updatedAt: c.updatedAt }));
  // Ajustes de ejemplo: una respuesta reciente, una visita con fecha y una oferta que caduca.
  const tuned = cases.map((c) => c.id === 'c1' ? { ...c, stage: 'response_received', updatedAt: ago(1) } : c.id === 'c3' ? { ...c, nextAction: 'Visita oficial al campus', nextActionDue: inDays(9) } : c);
  const input: AgentHomeInput = variant === 'empty' ? { athletes, offers: [], cases: [], tasks: [], followUps: [], repAlerts: [], opportunities: [] } : {
    athletes, cases: tuned,
    offers: [{ id: 'o1', athleteId: 'a1', university: 'Lakeshore College', aidUsd: 18000, deadline: inDays(2) }, { id: 'o2', athleteId: 'a1', university: 'Northfield University', aidUsd: 24000, deadline: inDays(25) }],
    tasks: [{ id: 't1', caseId: 'c5', title: 'Pedir expediente traducido a la familia', dueDate: inDays(-2) }],
    followUps: [{ id: 'f1', athleteId: 'a3', dueDate: inDays(-1) }],
    repAlerts: representationAlerts(entries).map((r) => ({ athleteId: r.athleteId, text: r.text, daysLeft: r.daysLeft, severe: r.tone === 'danger' })),
    opportunities: [{ id: 'op1', title: 'Beca parcial de baloncesto masculino (ejemplo)', organization: 'Universidad de ejemplo', sportId: 'basketball', graduationYears: [2027], deadline: inDays(40), createdAt: ago(2) }],
  };
  const attention = buildAttention(input);
  return {
    state: variant === 'no_agency' ? 'no_agency' : variant === 'error' ? 'error' : 'ok',
    agency: { name: 'Norte Sports Management', verified: true },
    summary: summarize(input, attention), attention, athletes: athletesPreview(input, attention), pipeline: pipelineCounts(input.cases),
    partial: variant === 'partial' ? ['ofertas'] : [], pendingProposals: athletes.filter((a) => a.status === 'requested').length,
  };
}
