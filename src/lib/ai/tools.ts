import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { SessionContext } from '@/lib/session';
import { loadAthleteDashboard } from '@/lib/data/dashboard';
import { loadAthleteContext, loadInstitutionMatches } from '@/lib/data/gala-match';
import { loadPipeline } from '@/lib/data/pipeline';
import { STAGE_INFO, summarize, type Stage } from '@/lib/domain/pipeline';
import { searchKnowledge } from './knowledge';
import type { GalaMatch } from '@/lib/domain/gala-match/engine';

/**
 * Herramientas internas de Gala AI.
 * - Solo LECTURA y siempre con el cliente del usuario (RLS): nunca ven más de lo que el usuario puede ver.
 * - Devuelven datos estructurados mínimos; el modelo nunca recibe tablas completas.
 * - Las acciones con consecuencias no se ejecutan aquí: se PROPONEN y el usuario las confirma en la interfaz.
 */
export interface ToolCtx { session: SessionContext }
export interface Source { label: string; url: string; reviewed?: string; stale?: boolean; internal?: boolean }
export interface Proposal { kind: 'add_to_pipeline' | 'create_task' | 'open_page'; label: string; href?: string; target_kind?: 'institution' | 'opportunity'; target_id?: string; title?: string; due_date?: string }
export interface Draft { tone: string; subject?: string; body: string }
export interface ToolResult { data: unknown; sources?: Source[]; proposals?: Proposal[]; drafts?: Draft[] }

const isAthlete = (s: SessionContext) => s.roles.includes('athlete');

function matchBrief(m: GalaMatch) {
  return {
    score: m.score, confidence: m.confidence, coverage_pct: m.coverage, blocked: m.blocked,
    why: m.why.slice(0, 5).map((f) => ({ factor: f.label, detail: f.detail, source: f.source })),
    missing: m.missing.slice(0, 4).map((f) => ({ factor: f.label, detail: f.detail, who_must_provide: f.missingSide ?? 'unknown' })),
    blockers: m.blockers.map((f) => ({ factor: f.label, detail: f.detail })),
    next_step: m.nextStep ? { action: m.nextStep.action, href: m.nextStep.href } : null,
    engine_version: m.version,
  };
}

async function athleteCtx(ctx: ToolCtx) {
  if (!isAthlete(ctx.session)) return null;
  return loadAthleteContext(ctx.session.userId);
}

/** Busca una universidad por nombre entre las que el usuario puede ver. */
async function findInstitution(name: string) {
  const supabase = await createClient();
  const clean = name.replace(/[%_,()]/g, '').trim().slice(0, 80);
  if (clean.length < 3) return null;
  const { data } = await supabase.from('institutions').select('id, name, state').ilike('name', `%${clean}%`).limit(1).maybeSingle();
  return data;
}

export const TOOL_DEFS = [
  { name: 'get_next_best_action', description: 'Siguiente mejor acción del atleta y sus tareas priorizadas (reglas deterministas del panel).', input_schema: { type: 'object', properties: {} } },
  { name: 'get_pipeline_summary', description: 'Resumen del pipeline del atleta: procesos por etapa, vencidos, próximos pasos.', input_schema: { type: 'object', properties: {} } },
  { name: 'get_deadlines', description: 'Próximos plazos: oficiales (de organizaciones), recomendados por Gala y personales, separados.', input_schema: { type: 'object', properties: {} } },
  { name: 'get_passport_gaps', description: '«Passport listo» (% de perfil completo) y qué falta, por impacto.', input_schema: { type: 'object', properties: {} } },
  { name: 'explain_match', description: 'Explica el encaje de Gala Match con una universidad concreta usando el motor real.', input_schema: { type: 'object', properties: { university: { type: 'string', description: 'Nombre de la universidad' } }, required: ['university'] } },
  { name: 'search_universities', description: 'Busca universidades del directorio con el encaje real del atleta. Solo devuelve universidades existentes.', input_schema: { type: 'object', properties: { state: { type: 'string', description: 'Código de estado de EE. UU. de 2 letras' }, division: { type: 'string', enum: ['ncaa_d1', 'ncaa_d2', 'ncaa_d3', 'naia', 'njcaa'] }, name: { type: 'string' }, max_cost_usd: { type: 'integer' }, active_only: { type: 'boolean' } } } },
  { name: 'compare_universities', description: 'Compara 2-4 universidades por datos objetivos y encaje. Nunca elige una ganadora.', input_schema: { type: 'object', properties: { universities: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4 } }, required: ['universities'] } },
  { name: 'search_knowledge', description: 'Busca en la guía de The Gala Alliance (fuentes oficiales y fecha de revisión).', input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
  { name: 'get_family_overview', description: 'Para familias/tutores: por cada hijo/a vinculado, la acción pendiente de la familia, plazos, ofertas y el coste real de cada opción (con lo que falta) frente al presupuesto privado. Solo lo que cada relación permite ver.', input_schema: { type: 'object', properties: {} } },
  { name: 'get_recruiting_overview', description: 'Para staff de universidades: resumen de su organización (necesidades activas, candidatos por etapa interna, por revisar, tareas que vencen). Solo datos de su organización.', input_schema: { type: 'object', properties: {} } },
  { name: 'propose_action', description: 'Propone al usuario una acción dentro de Gala. NO la ejecuta: el usuario debe confirmarla.', input_schema: { type: 'object', properties: { kind: { type: 'string', enum: ['add_to_pipeline', 'create_task', 'open_page'] }, label: { type: 'string' }, href: { type: 'string', description: 'Ruta interna /app/...' }, university: { type: 'string' }, title: { type: 'string', description: 'Título de la tarea' }, due_date: { type: 'string', description: 'AAAA-MM-DD' } }, required: ['kind', 'label'] } },
  { name: 'present_drafts', description: 'Entrega borradores de un mensaje en 3 tonos (formal, cercano, breve). El usuario los revisa y envía él mismo.', input_schema: { type: 'object', properties: { drafts: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'object', properties: { tone: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' } }, required: ['tone', 'body'] } } }, required: ['drafts'] } },
] as const;

export type ToolName = (typeof TOOL_DEFS)[number]['name'];

export async function runTool(name: string, input: Record<string, unknown>, ctx: ToolCtx): Promise<ToolResult> {
  const s = ctx.session;
  switch (name) {
    case 'get_next_best_action': {
      if (!isAthlete(s)) return { data: { available: false, reason: 'Solo para atletas.' } };
      const d = await loadAthleteDashboard(s.userId, s.isMinor);
      if (!d) return { data: { available: false, reason: 'Passport sin crear.' } };
      return {
        data: { stage: d.stage, actions: d.actions.slice(0, 5).map((a) => ({ title: a.title, why: a.reason, priority: a.priority, href: a.href })) },
        proposals: d.actions[0] ? [{ kind: 'open_page', label: d.actions[0].cta, href: d.actions[0].href }] : [],
      };
    }
    case 'get_pipeline_summary': {
      if (!isAthlete(s)) return { data: { available: false } };
      const rows = await loadPipeline(s.userId);
      const sum = summarize(rows);
      return {
        data: {
          ...sum,
          attention: rows.filter((r) => r.urgency === 'overdue' || r.urgency === 'due_soon' || r.urgency === 'stale').slice(0, 6)
            .map((r) => ({ name: r.name, stage: STAGE_INFO[r.status as Stage]?.label ?? r.status, why: r.urgencyReason, next_action: r.next_action, href: `/app/process/${r.id}` })),
        },
        sources: [{ label: 'Mi pipeline', url: '/app/process', internal: true }],
      };
    }
    case 'get_deadlines': {
      if (!isAthlete(s)) return { data: { available: false } };
      const d = await loadAthleteDashboard(s.userId, s.isMinor);
      return { data: { deadlines: (d?.modules.deadlines.data ?? []).map((x) => ({ title: x.title, date: x.date, type: x.kind, label: x.label, href: x.href })) } };
    }
    case 'get_passport_gaps': {
      const loaded = await athleteCtx(ctx);
      if (!loaded) return { data: { available: false } };
      const r = loaded.passport.readiness;
      return {
        data: { score: r.score, reachable_if_plan_done: Math.min(100, r.target), plan: r.plan.map((p) => ({ action: p.action, points: p.points, href: p.href })) },
        sources: [{ label: 'Mi Passport', url: '/app/athlete/passport', internal: true }],
      };
    }
    case 'explain_match': {
      const loaded = await athleteCtx(ctx);
      if (!loaded) return { data: { available: false, reason: 'Gala Match necesita un Passport de atleta.' } };
      const inst = await findInstitution(String(input.university ?? ''));
      if (!inst) return { data: { found: false, note: 'No está en el directorio. No inventes datos sobre ella.' } };
      const { scored } = await loadInstitutionMatches(s.userId, loaded.ctx, { q: inst.name, allSports: true });
      const x = scored.find((r) => r.inst.id === inst.id);
      if (!x) return { data: { found: false } };
      return {
        data: { university: inst.name, state: inst.state, match: matchBrief(x.m) },
        sources: [{ label: `Gala Match · ${inst.name}`, url: `/app/match/institution/${inst.id}`, internal: true }],
        proposals: x.saved ? [] : [{ kind: 'add_to_pipeline', label: `Añadir ${inst.name} a mi pipeline`, target_kind: 'institution', target_id: inst.id }],
      };
    }
    case 'search_universities': {
      const loaded = await athleteCtx(ctx);
      if (!loaded) return { data: { available: false } };
      const state = typeof input.state === 'string' ? input.state.toUpperCase() : undefined;
      const { scored, totalInDirectory } = await loadInstitutionMatches(s.userId, loaded.ctx, {
        state, division: typeof input.division === 'string' ? input.division : undefined,
        q: typeof input.name === 'string' ? input.name : undefined,
        maxCost: typeof input.max_cost_usd === 'number' ? input.max_cost_usd : undefined,
        activeOnly: input.active_only === true,
      });
      const top = scored.filter((x) => !x.m.blocked).slice(0, 6);
      return {
        data: { directory_size: totalInDirectory, results: top.map((x) => ({ name: x.inst.name, state: x.inst.state, division: x.inst.division, match: x.m.score, confidence: x.m.confidence, active_opportunities: x.activeOpps, href: `/app/universities/${x.inst.id}` })) },
        sources: top.slice(0, 3).map((x) => ({ label: x.inst.name, url: `/app/universities/${x.inst.id}`, internal: true })),
      };
    }
    case 'compare_universities': {
      const loaded = await athleteCtx(ctx);
      const names = Array.isArray(input.universities) ? input.universities.map(String).slice(0, 4) : [];
      const found = (await Promise.all(names.map(findInstitution))).filter((x): x is NonNullable<typeof x> => !!x);
      if (found.length < 2) return { data: { found: found.map((f) => f.name), note: 'Se necesitan al menos 2 universidades del directorio.' } };
      const supabase = await createClient();
      const { data } = await supabase.from('institutions').select('id, name, state, division, enrollment, cost_attendance_usd, net_price_usd, graduation_rate, intl_share').in('id', found.map((f) => f.id));
      const matches = loaded ? await loadInstitutionMatches(s.userId, loaded.ctx, { allSports: true }) : null;
      return {
        data: { rule: 'Comparar datos; no elegir ganadora.', universities: (data ?? []).map((i) => ({ ...i, match: matches?.scored.find((x) => x.inst.id === i.id)?.m.score ?? null })) },
        sources: [{ label: 'Comparador', url: `/app/universities/compare?ids=${found.map((f) => f.id).join(',')}`, internal: true }],
      };
    }
    case 'search_knowledge': {
      const hits = searchKnowledge(String(input.query ?? ''), 3);
      return {
        data: { results: hits.map((h) => ({ chapter: h.chapter, section: h.heading, text: h.text, applies_to: h.systems, version: h.version, reviewed: h.reviewed, review_pending: h.stale, guide_url: `/guia/${h.slug}` })) },
        sources: hits.flatMap((h) => h.sources.map((x) => ({ ...x, reviewed: h.reviewed, stale: h.stale }))).filter((x, i, a) => a.findIndex((y) => y.url === x.url) === i).slice(0, 4),
      };
    }
    case 'get_family_overview': {
      // Misma RLS que la interfaz: cada relación con sus propios permisos; nunca datos de otras familias.
      if (!s.roles.includes('parent')) return { data: { available: false, reason: 'Solo para familias vinculadas.' } };
      const { guardianLinks, loadFamilyChild, familyCostOverview } = await import('@/lib/data/family-home');
      const { familyNextAction } = await import('@/lib/domain/family');
      const today = new Date().toISOString().slice(0, 10);
      const links = await guardianLinks(s);
      const children = await Promise.all(links.map(async (l) => {
        if (!l.active) return { name: l.name, access: l.status === 'restricted' ? 'pausado por el atleta' : 'suspendido hasta que el atleta (ya mayor de edad) lo confirme' };
        const h = await loadFamilyChild(s, l);
        const next = familyNextAction({ today, approvals: h.approvals, deadlines: h.deadlines, offers: h.offers, incompleteCosts: h.scenarios.incomplete, missingDocuments: h.missingDocuments, hasAthlete: true });
        // Costes y presupuesto privado de SU familia, con la RLS del tutor (permiso «costes»).
        const costs: unknown = l.scopes.costs ? await familyCostOverview(l.athleteId, l.scopes.budget) : 'sin permiso de costes';
        return {
          name: l.name, permissions: l.scopes, family_next_action: { title: next.title, why: next.why, href: next.href },
          approvals_pending: h.approvals.length,
          deadlines: h.deadlines.slice(0, 6).map((d) => ({ date: d.date, title: d.label, type: d.kind })),
          offers_pending: h.offers.map((o) => ({ organization: o.org, deadline: o.deadline })),
          process: h.process, missing_documents: h.missingDocuments, costs,
        };
      }));
      return {
        data: {
          children,
          rules: 'La decisión es del atleta y su familia. «budget_fit: unknown» = falta información, no descartes la opción. El presupuesto es privado: nunca lo menciones como algo que vean universidades.',
        },
        sources: [{ label: 'Family Command Center', url: '/app/family', internal: true }, { label: 'Coste real', url: '/app/family/costs', internal: true }],
      };
    }
    case 'get_recruiting_overview': {
      // Mismos permisos que la interfaz: RLS por organización (org_can). Nunca datos de otra universidad.
      const { currentRecruitOrg, loadCoachHome } = await import('@/lib/data/recruit');
      const { org } = await currentRecruitOrg(s.userId);
      if (!org) return { data: { available: false, reason: 'No perteneces a ninguna organización de recruiting.' } };
      const h = await loadCoachHome(org);
      const byStage: Record<string, number> = {};
      for (const c of h.candidates) byStage[c.internal_stage as string] = (byStage[c.internal_stage as string] ?? 0) + 1;
      return {
        data: {
          organization: org.name, verified: org.verified, role: org.role,
          active_needs: h.needs.map((n) => n.title), candidates_by_internal_stage: byStage, to_review_in_shortlists: h.toReview,
          open_tasks: h.tasks.length, overdue_tasks: h.overdueTasks, due_today: h.dueTodayTasks,
          expiring_opportunities: h.expiring.map((o) => ({ title: o.title, days: o.days })),
          rule: 'Compatibilidad no es talento: nunca ordenes personas como mejores o peores.',
        },
        sources: [{ label: 'Portal de recruiting', url: '/app/recruit', internal: true }],
      };
    }
    case 'propose_action': {
      const kind = input.kind as Proposal['kind'];
      const label = String(input.label ?? '').slice(0, 120);
      if (kind === 'open_page') {
        const href = String(input.href ?? '');
        if (!/^\/app\/[A-Za-z0-9/_?=&.-]*$/.test(href)) return { data: { ok: false, reason: 'Ruta no válida' } };
        return { data: { ok: true }, proposals: [{ kind, label, href }] };
      }
      if (kind === 'create_task') {
        const due = typeof input.due_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.due_date) ? input.due_date : undefined;
        return { data: { ok: true, requires_user_confirmation: true }, proposals: [{ kind, label, title: String(input.title ?? label).slice(0, 160), due_date: due }] };
      }
      if (kind === 'add_to_pipeline') {
        const inst = await findInstitution(String(input.university ?? ''));
        if (!inst) return { data: { ok: false, reason: 'Universidad no encontrada en el directorio' } };
        return { data: { ok: true, requires_user_confirmation: true }, proposals: [{ kind, label, target_kind: 'institution', target_id: inst.id }] };
      }
      return { data: { ok: false } };
    }
    case 'present_drafts': {
      const drafts = Array.isArray(input.drafts) ? (input.drafts as Draft[]).slice(0, 3).map((d) => ({ tone: String(d.tone).slice(0, 30), subject: d.subject ? String(d.subject).slice(0, 160) : undefined, body: String(d.body).slice(0, 3000) })) : [];
      return { data: { ok: true, shown_to_user: true }, drafts };
    }
    default:
      return { data: { error: 'unknown_tool' } };
  }
}
