import 'server-only';
import { NO_REPLY_DAYS } from '@/lib/domain/coach-outreach';
import { createClient } from '@/lib/supabase/server';
import { loadPortfolio } from '@/lib/data/portfolio';
import { loadAgencyCases } from '@/lib/data/agency-cases';
import { representationAlerts, type PortfolioEntry } from '@/lib/domain/portfolio';
import {
  athletesPreview, buildAttention, pipelineCounts, summarize,
  type AgentHomeInput, type AgentHomeSummary, type AthletePreviewRow, type AttentionItem, type HomeAthlete,
} from '@/lib/domain/agent-home';
import type { AgencyPlanStatus } from '@/lib/domain/plan-limits';

/**
 * Contrato del Inicio del agente: SOLO estos campos llegan a la página (y al HTML). Se construye con la sesión
 * del agente, así que la RLS limita cada fuente a su agencia y a sus permisos de representación
 * (ofertas: offers.view). Nunca incluye cuerpos de notas internas, datos de cumplimiento ni documentos.
 */
export interface AgentHomeData {
  state: 'ok' | 'no_agency' | 'error';
  agency: { name: string; verified: boolean } | null;
  summary: AgentHomeSummary;
  attention: AttentionItem[];
  athletes: AthletePreviewRow[];
  pipeline: { id: string; label: string; count: number }[];
  /** Fuentes que no se han podido cargar: la página se muestra igualmente con un aviso. */
  partial: ('ofertas' | 'tareas' | 'oportunidades' | 'procesos')[];
  /** Atletas con propuesta pendiente (esperando su respuesta). */
  pendingProposals: number;
  /** Prueba / plan de la agencia y cupo de atletas (null si no se ha podido leer: entonces no se avisa). */
  plan?: AgencyPlanStatus | null;
}

/** Estado del plan de una agencia (cualquier miembro puede leerlo). Si falla, null: el aviso simplemente no sale. */
export async function loadAgencyPlanStatus(orgId: string | undefined | null): Promise<AgencyPlanStatus | null> {
  if (!orgId) return null;
  try {
    const { data, error } = await (await createClient()).rpc('agency_plan_status', { p_org: orgId });
    if (error) return null;
    return ((data as AgencyPlanStatus[] | null) ?? [])[0] ?? null;
  } catch {
    return null;
  }
}

const EMPTY_SUMMARY: AgentHomeSummary = { athletes: 0, needAttention: 0, activeOpportunities: 0, offers: 0, deadlinesToday: 0 };

export interface AgentSources {
  agency: { id?: string; name: string; verified: boolean };
  input: AgentHomeInput;
  partial: AgentHomeData['partial'];
  entries: PortfolioEntry[];
}

/**
 * Fuentes compartidas del Inicio y de «Mis atletas» (misma proyección, misma RLS): null si no hay agencia.
 * Lanza si la cartera no se puede cargar; las demás fuentes degradan a «parcial».
 */
export async function loadAgentSources(userId: string, now: Date = new Date()): Promise<AgentSources | null> {

    const portfolio = await loadPortfolio(userId);
    const ag = portfolio.agencies[0];
    if (!ag) return null;
    const agency = { id: ag.id, name: ag.name, verified: ag.verification_status === 'verified' };
    const partial: AgentHomeData['partial'] = [];
    const supabase = await createClient();

    // Un atleta aparece una vez aunque tenga historial de varias representaciones: manda la activa.
    const byAthlete = new Map<string, HomeAthlete>();
    for (const e of portfolio.entries) {
      const status: HomeAthlete['status'] = e.status === 'active' ? 'active' : e.status === 'requested' ? 'requested' : 'other';
      const prev = byAthlete.get(e.athleteId);
      if (prev && prev.status === 'active') continue;
      byAthlete.set(e.athleteId, {
        id: e.athleteId, name: e.name, sportId: e.sportId, sportName: e.sportName, positionName: e.positionName,
        graduationYear: e.graduationYear, status, lastActivityAt: [e.lastNoteAt, e.respondedAt, e.createdAt].filter(Boolean).sort().at(-1) ?? null,
      });
    }
    const athletes = [...byAthlete.values()];
    const activeIds = athletes.filter((a) => a.status === 'active').map((a) => a.id);
    const sports = [...new Set(athletes.filter((a) => a.status === 'active' && a.sportId).map((a) => a.sportId!))];

    let cases: AgentHomeInput['cases'] = [];
    try {
      cases = (await loadAgencyCases(userId)).cases.map((c) => ({
        id: c.id, athleteId: c.athleteId, institution: c.institutionName, stage: c.stage, nextAction: c.nextAction, nextActionDue: c.nextActionDue, updatedAt: c.updatedAt,
      }));
    } catch { partial.push('procesos'); }
    const openCaseIds = cases.filter((c) => c.stage !== 'committed' && c.stage !== 'closed').map((c) => c.id);
    const today = now.toISOString().slice(0, 10);

    const silentBefore = new Date(now.getTime() - NO_REPLY_DAYS * 864e5).toISOString();
    const [offersRes, tasksRes, oppsRes, outreachRes] = await Promise.all([
      activeIds.length
        ? supabase.from('athlete_offers').select('id, athlete_id, university_name, aid_amount_usd, deadline').in('athlete_id', activeIds).limit(500)
        : Promise.resolve({ data: [], error: null }),
      openCaseIds.length
        ? supabase.from('recruiting_case_tasks').select('id, case_id, title, due_date').in('case_id', openCaseIds.slice(0, 500)).eq('done', false).not('due_date', 'is', null).lt('due_date', today).limit(500)
        : Promise.resolve({ data: [], error: null }),
      sports.length
        ? supabase.from('opportunities').select('id, title, sport_id, graduation_years, deadline, created_at, organizations!inner(name, verification_status)')
            .eq('status', 'published').eq('organizations.verification_status', 'verified').in('sport_id', sports)
            .or(`deadline.is.null,deadline.gte.${today}`).order('created_at', { ascending: false }).limit(200)
        : Promise.resolve({ data: [], error: null }),
      openCaseIds.length
        ? supabase.from('case_outreach').select('id, case_id, sent_at').in('case_id', openCaseIds.slice(0, 500)).eq('status', 'sent').lte('sent_at', silentBefore).limit(500)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (offersRes.error) partial.push('ofertas');
    if (tasksRes.error) partial.push('tareas');
    if (oppsRes.error) partial.push('oportunidades');

    const input: AgentHomeInput = {
      athletes,
      offers: ((offersRes.data ?? []) as { id: string; athlete_id: string; university_name: string; aid_amount_usd: number | null; deadline: string | null }[])
        .map((o) => ({ id: o.id, athleteId: o.athlete_id, university: o.university_name, aidUsd: o.aid_amount_usd, deadline: o.deadline })),
      cases,
      tasks: ((tasksRes.data ?? []) as { id: string; case_id: string; title: string; due_date: string | null }[]).map((t) => ({ id: t.id, caseId: t.case_id, title: t.title, dueDate: t.due_date })),
      followUps: portfolio.notes.filter((n) => n.kind === 'follow_up' && !n.done && activeIds.includes(n.athlete_id)).map((n) => ({ id: n.id, athleteId: n.athlete_id, dueDate: n.due_date })),
      repAlerts: representationAlerts(portfolio.entries, now).map((r) => ({ athleteId: r.athleteId, text: r.text, daysLeft: r.daysLeft, severe: r.tone === 'danger' })),
      opportunities: ((oppsRes.data ?? []) as unknown as { id: string; title: string; sport_id: string | null; graduation_years: number[] | null; deadline: string | null; created_at: string; organizations: { name: string } | null }[])
        .map((o) => ({ id: o.id, title: o.title, organization: o.organizations?.name ?? 'Organización verificada', sportId: o.sport_id, graduationYears: o.graduation_years ?? [], deadline: o.deadline, createdAt: o.created_at })),
      coachOutreach: ((outreachRes.data ?? []) as { id: string; case_id: string; sent_at: string | null }[])
        .filter((o) => o.sent_at).map((o) => ({ id: o.id, caseId: o.case_id, sentAt: o.sent_at as string })),
    };
    return { agency, input, partial, entries: portfolio.entries };
}

export async function loadAgentHome(userId: string, now: Date = new Date()): Promise<AgentHomeData> {
  const empty = (state: AgentHomeData['state'], agency: AgentHomeData['agency'] = null): AgentHomeData =>
    ({ state, agency, summary: EMPTY_SUMMARY, attention: [], athletes: [], pipeline: pipelineCounts([]), partial: [], pendingProposals: 0 });
  try {
    const src = await loadAgentSources(userId, now);
    if (!src) return empty('no_agency');
    const { agency, input, partial } = src;
    const athletes = input.athletes;
    const cases = input.cases;
    const attention = buildAttention(input, now);
    const plan = await loadAgencyPlanStatus(agency.id);
    return {
      state: 'ok', agency, attention,
      summary: summarize(input, attention, now),
      athletes: athletesPreview(input, attention),
      pipeline: pipelineCounts(cases),
      partial,
      pendingProposals: athletes.filter((a) => a.status === 'requested').length,
      plan,
    };
  } catch {
    return empty('error');
  }
}
