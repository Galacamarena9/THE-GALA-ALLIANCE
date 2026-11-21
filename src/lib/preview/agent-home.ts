/**
 * Inicio del agente con datos FICTICIOS (solo /preview, nunca en producción): misma lógica real
 * (buildAttention, summarize…) sobre la cartera y los procesos de ejemplo.
 */
import type { AgentHomeData } from '@/lib/data/agent-home';
import { representationAlerts } from '@/lib/domain/portfolio';
import { athletesPreview, buildAttention, pipelineCounts, summarize, type AgentHomeInput } from '@/lib/domain/agent-home';
import { crmRows, type CrmEntry } from '@/lib/domain/athletes-crm';
import { previewCases, previewPortfolio } from './fixtures';

const now = Date.now();
const inDays = (d: number) => new Date(now + d * 864e5).toISOString().slice(0, 10);
const ago = (d: number) => new Date(now - d * 864e5).toISOString();

/** Entrada de ejemplo completa (cartera, procesos, ofertas, tareas, seguimientos y oportunidades). */
export function previewAgentHomeInput(): AgentHomeInput {
  return buildInput(previewPortfolio.entries, false);
}

export function previewAgentHome(variant: 'full' | 'empty' | 'partial' | 'no_agency' | 'error' = 'full'): AgentHomeData {
  const entries = variant === 'empty' ? [] : previewPortfolio.entries;
  const input = buildInput(entries, variant === 'empty');
  const athletes = input.athletes;
  const attention = buildAttention(input);
  return {
    state: variant === 'no_agency' ? 'no_agency' : variant === 'error' ? 'error' : 'ok',
    agency: { name: 'Norte Sports Management', verified: true },
    summary: summarize(input, attention), attention, athletes: athletesPreview(input, attention), pipeline: pipelineCounts(input.cases),
    partial: variant === 'partial' ? ['ofertas'] : [], pendingProposals: athletes.filter((a) => a.status === 'requested').length,
  };
}

function buildInput(entries: typeof previewPortfolio.entries, empty: boolean): AgentHomeInput {
  const athletes = entries.map((e) => ({
    id: e.athleteId, name: e.name, sportId: e.sportId, sportName: e.sportName, positionName: e.positionName, graduationYear: e.graduationYear,
    status: (e.status === 'active' ? 'active' : e.status === 'requested' ? 'requested' : 'other') as 'active' | 'requested' | 'other', lastActivityAt: e.lastNoteAt ?? e.respondedAt,
  }));
  const cases = (empty ? [] : previewCases).map((c) => ({ id: c.id, athleteId: c.athleteId, institution: c.institutionName, stage: c.stage, nextAction: c.nextAction, nextActionDue: c.nextActionDue, updatedAt: c.updatedAt }));
  // Ajustes de ejemplo: una respuesta reciente, una visita con fecha y una oferta que caduca.
  const tuned = cases.map((c) => c.id === 'c1' ? { ...c, stage: 'response_received', updatedAt: ago(1) } : c.id === 'c3' ? { ...c, nextAction: 'Visita oficial al campus', nextActionDue: inDays(9) } : c);
  return empty ? { athletes, offers: [], cases: [], tasks: [], followUps: [], repAlerts: [], opportunities: [] } : {
    athletes, cases: tuned,
    offers: [{ id: 'o1', athleteId: 'a1', university: 'Lakeshore College', aidUsd: 18000, deadline: inDays(2) }, { id: 'o2', athleteId: 'a1', university: 'Northfield University', aidUsd: 24000, deadline: inDays(25) }],
    tasks: [{ id: 't1', caseId: 'c5', title: 'Pedir expediente traducido a la familia', dueDate: inDays(-2) }],
    followUps: [{ id: 'f1', athleteId: 'a3', dueDate: inDays(-1) }],
    repAlerts: representationAlerts(entries).map((r) => ({ athleteId: r.athleteId, text: r.text, daysLeft: r.daysLeft, severe: r.tone === 'danger' })),
    opportunities: [{ id: 'op1', title: 'Beca parcial de baloncesto masculino (ejemplo)', organization: 'Universidad de ejemplo', sportId: 'basketball', graduationYears: [2027], deadline: inDays(40), createdAt: ago(2) }],
  };
}

/** «Mis atletas» con datos FICTICIOS: la cartera de ejemplo o `n` atletas generados (prueba de 50/100). */
export function previewCrmRows(n?: number) {
  const sports = [['basketball', 'Baloncesto', 'Base'], ['football', 'Fútbol', 'Delantero'], ['volleyball', 'Voleibol', 'Receptora'], ['tennis', 'Tenis', null], ['athletics', 'Atletismo', '400 m']] as const;
  const countries = ['ES', 'AR', 'MX', 'PT', 'FR', 'IT'];
  const firsts = ['Lucía', 'Marcos', 'Sofía', 'Daniel', 'Nora', 'Álex', 'Irene', 'Pablo', 'Carla', 'Hugo'];
  const lasts = ['Martín', 'Kim', 'Vidal', 'Romero', 'Costa', 'Ferrer', 'Jiménez', 'Navarro', 'Ortega', 'Serra'];
  const entries: CrmEntry[] = n
    ? Array.from({ length: n }, (_, i) => {
        const s = sports[i % sports.length];
        return {
          athleteId: `00000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`, name: `${firsts[i % 10]} ${lasts[Math.floor(i / 10) % 10]} (ejemplo ${i + 1})`, avatarUrl: null,
          sportId: s[0], sportName: s[1], positionName: s[2], country: countries[i % countries.length], graduationYear: 2026 + (i % 3),
          status: i % 9 === 8 ? 'requested' : 'active', createdAt: ago(60 + i), respondedAt: ago(50 + (i % 30)), endedAt: null, lastNoteAt: i % 4 ? ago(i % 20) : null,
        } satisfies CrmEntry;
      })
    : previewPortfolio.entries.map((e) => ({ athleteId: e.athleteId, name: e.name, avatarUrl: e.avatarUrl, sportId: e.sportId, sportName: e.sportName, positionName: e.positionName, country: e.country, graduationYear: e.graduationYear, status: e.status, createdAt: e.createdAt, respondedAt: e.respondedAt, endedAt: e.endedAt, lastNoteAt: e.lastNoteAt }));
  const ids = entries.map((e) => e.athleteId);
  const stages = ['research', 'contacted', 'response_received', 'active_conversation', 'evaluation_visit', 'offer_discussion', 'committed'];
  const cases = n
    ? ids.flatMap((id, i) => (i % 5 === 4 ? [] : [{ id: `c-${i}`, athleteId: id, institution: `Universidad de ejemplo ${i % 12}`, stage: stages[i % stages.length], nextAction: i % 3 ? `Enviar vídeo a la universidad ${i % 12}` : null, nextActionDue: i % 3 ? inDays((i % 11) - 4) : null, updatedAt: ago(i % 15) }]))
    : previewAgentHomeInput().cases;
  const input: AgentHomeInput = n
    ? { athletes: entries.map((e) => ({ id: e.athleteId, name: e.name, sportId: e.sportId, sportName: e.sportName, positionName: e.positionName, graduationYear: e.graduationYear, status: e.status === 'active' ? 'active' : 'requested', lastActivityAt: e.lastNoteAt })),
        cases, offers: ids.filter((_, i) => i % 7 === 0).map((id, i) => ({ id: `o-${i}`, athleteId: id, university: 'Universidad de ejemplo', aidUsd: 15000, deadline: inDays(i % 9) })),
        tasks: [], followUps: [], repAlerts: [], opportunities: [] }
    : previewAgentHomeInput();
  const verification = ids.map((id, i) => ({ athleteId: id, verifiedStats: i % 2 === 0, video: i % 3 !== 1 }));
  return crmRows(entries, input, buildAttention(input), verification);
}
