import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { loadPortfolio } from '@/lib/data/portfolio';
import type { AthleteContext, GalaMatch } from '@/lib/domain/gala-match/engine';
import {
  filtersToRecord, parseDiscoveryFilters, passesFilters, projectCard, scoreOpportunity, sortCards,
  type AthleteBase, type DiscoveryCard, type DiscoveryFilters, type DiscoveryOpportunity, type InstitutionFacts,
} from '@/lib/domain/opportunity-discovery';

/*
 * Buscador de oportunidades del agente (servidor).
 * - El contexto del atleta sale SOLO de agent_discovery_athlete (RPC con agent_can 'passport.view'): sin permiso, nada.
 * - Las oportunidades se leen con la sesión del agente (RLS: solo publicadas y visibles) y con columnas no sensibles.
 * - Al navegador solo llega la proyección DiscoveryCard (ver domain/opportunity-discovery.ts).
 */

export interface RosterAthlete { id: string; name: string; sportName: string | null; graduationYear: number | null; agencyId: string }

/** Atletas activos del agente (cartera derivada de representaciones; la RLS decide). */
export async function loadDiscoveryRoster(userId: string): Promise<RosterAthlete[]> {
  const p = await loadPortfolio(userId);
  const seen = new Map<string, RosterAthlete>();
  for (const e of p.entries) {
    if (e.status !== 'active' || seen.has(e.athleteId)) continue;
    seen.set(e.athleteId, { id: e.athleteId, name: e.name, sportName: e.sportName, graduationYear: e.graduationYear, agencyId: e.agencyId });
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

/** Contexto que devuelve la RPC (forma mínima). */
interface RpcContext {
  sport_id: string | null; primary_position_id: number | null; secondary_position_id: number | null; graduation_year: number | null; country: string | null;
  pathways: string[]; countries: string[]; regions: string[]; intended_majors: string[];
  school_size: AthleteContext['school_size']; sport_level: AthleteContext['sport_level']; campus_setting: AthleteContext['campus_setting']; scholarship_need: AthleteContext['scholarship_need'];
  gpa: number | null; gpa_scale: number | null; education_system: string | null;
  has_english_certificate: boolean; has_highlight: boolean; has_full_game: boolean; verified_stats: number;
}

export function toAthleteBase(r: RpcContext): AthleteBase {
  return {
    country: r.country,
    ctx: {
      sport_id: r.sport_id, primary_position_id: r.primary_position_id, secondary_position_id: r.secondary_position_id, graduation_year: r.graduation_year,
      pathways: r.pathways ?? [], countries: r.countries ?? [], regions: r.regions ?? [], intended_majors: r.intended_majors ?? [],
      school_size: r.school_size, sport_level: r.sport_level, campus_setting: r.campus_setting, scholarship_need: r.scholarship_need,
      annual_budget_usd: null, budget_private: true,
      gpa: r.gpa != null ? Number(r.gpa) : null, gpa_scale: r.gpa_scale != null ? Number(r.gpa_scale) : null, education_system: r.education_system,
      has_english_certificate: Boolean(r.has_english_certificate), has_highlight: Boolean(r.has_highlight), has_full_game: Boolean(r.has_full_game),
      verified_stats: Number(r.verified_stats ?? 0),
    },
  };
}

// Columnas permitidas. Nunca: notas de moderación/revisión, autores, dirección, coordenadas, necesidad o programa internos.
const OPP_COLS = 'id, title, type, sport_id, position_ids, graduation_years, division, min_gpa_4, english_required, deadline, annual_cost_usd, aid_amount_usd, aid_kind, financial_source, international_eligible, country, location, published_at, organizations(name, verification_status, institution_id)';
const INST_COLS = 'id, state, sports_offered, division, association, athletic_source, ownership, locale, enrollment, cost_attendance_usd, tuition_in_state_usd, tuition_out_of_state_usd, program_cips';

type InstRow = InstitutionFacts;
const scoreOne = (base: AthleteBase, o: DiscoveryOpportunity, inst: InstRow | null): GalaMatch => scoreOpportunity(base, o, inst);

export type DiscoveryResult =
  | { state: 'forbidden' }
  | { state: 'error' }
  | { state: 'ok'; cards: DiscoveryCard[]; hiddenIneligible: number; effective: DiscoveryFilters; savedSearches: SavedDiscoverySearch[]; activeSearch: SavedDiscoverySearch | null };

export interface SavedDiscoverySearch { id: string; label: string; filters: Record<string, string>; lastSeenAt: string }

/** Carga y puntúa oportunidades para un atleta del agente. */
export async function loadDiscovery(userId: string, athleteId: string, filters: DiscoveryFilters, searchId?: string | null): Promise<DiscoveryResult> {
  const supabase = await createClient();
  const { data: rpc, error: rpcErr } = await supabase.rpc('agent_discovery_athlete', { p_athlete: athleteId });
  if (rpcErr) return rpcErr.code === '42501' || /not_authorized/.test(rpcErr.message) ? { state: 'forbidden' } : { state: 'error' };
  if (!rpc) return { state: 'forbidden' };
  const base = toAthleteBase(rpc as unknown as RpcContext);

  // Por defecto, su deporte: es lo que el agente buscaría de todas formas.
  const effective: DiscoveryFilters = { ...filters, sport: filters.sport ?? base.ctx.sport_id ?? undefined };
  const today = new Date().toISOString().slice(0, 10);

  let q = supabase.from('opportunities').select(OPP_COLS).eq('status', 'published').or(`deadline.is.null,deadline.gte.${today}`).order('deadline', { ascending: true, nullsFirst: false }).limit(300);
  if (effective.sport) q = q.eq('sport_id', effective.sport);
  if (effective.level) q = q.eq('division', effective.level);
  if (effective.type) q = q.eq('type', effective.type);
  if (effective.aid === 'full' || effective.aid === 'partial') q = q.eq('aid_kind', effective.aid);

  const [oppRes, searchRes, casesRes] = await Promise.all([
    q,
    supabase.from('saved_searches').select('id, label, filters, last_seen_at').eq('owner_id', userId).eq('scope', 'opportunities').eq('subject_id', athleteId).order('created_at'),
    supabase.from('recruiting_cases').select('institution_name').eq('athlete_id', athleteId),
  ]);
  if (oppRes.error) return { state: 'error' };

  const rows: DiscoveryOpportunity[] = (oppRes.data ?? []).map((o) => {
    const org = o.organizations as unknown as { name: string; verification_status: string; institution_id: string | null } | null;
    return {
      ...(o as unknown as Omit<DiscoveryOpportunity, 'organization'>),
      organization: { name: org?.name ?? 'Organización', verified: org?.verification_status === 'verified', institutionId: org?.institution_id ?? null },
    };
  }).filter((o) => passesFilters(o, effective, today));

  const instIds = [...new Set(rows.map((r) => r.organization.institutionId).filter((x): x is string => Boolean(x)))];
  const { data: insts } = instIds.length ? await supabase.from('institutions').select(INST_COLS).in('id', instIds) : { data: [] };
  const instMap = new Map(((insts ?? []) as unknown as InstRow[]).map((i) => [i.id, i]));

  const savedSearches: SavedDiscoverySearch[] = (searchRes.data ?? []).map((s) => ({ id: s.id as string, label: s.label as string, filters: s.filters as Record<string, string>, lastSeenAt: s.last_seen_at as string }));
  const activeSearch = searchId ? savedSearches.find((s) => s.id === searchId) ?? null : null;
  const shortlistedOrgs = new Set((casesRes.data ?? []).map((c) => (c.institution_name as string).toLowerCase()));

  const scored = rows.map((o) => {
    const m = scoreOne(base, o, o.organization.institutionId ? instMap.get(o.organization.institutionId) ?? null : null);
    const card = projectCard(o, m, { today, lastSeenAt: activeSearch?.lastSeenAt ?? null });
    card.shortlisted = shortlistedOrgs.has(o.organization.name.toLowerCase());
    return { card, m };
  });
  const sorted = sortCards(scored).map((x) => x.card);
  const visible = effective.eligible ? sorted.filter((c) => c.eligible) : sorted;
  return { state: 'ok', cards: visible, hiddenIneligible: sorted.length - visible.length, effective, savedSearches, activeSearch };
}

/** Una oportunidad concreta para el atleta, recalculada en el servidor (lo usa la acción de shortlist). */
export async function loadOneForShortlist(athleteId: string, opportunityId: string) {
  const supabase = await createClient();
  const { data: rpc, error } = await supabase.rpc('agent_discovery_athlete', { p_athlete: athleteId });
  if (error || !rpc) return { state: 'forbidden' as const };
  const base = toAthleteBase(rpc as unknown as RpcContext);
  const { data: o } = await supabase.from('opportunities').select(OPP_COLS).eq('id', opportunityId).eq('status', 'published').maybeSingle();
  if (!o) return { state: 'not_found' as const };
  const org = o.organizations as unknown as { name: string; verification_status: string; institution_id: string | null } | null;
  const opp: DiscoveryOpportunity = { ...(o as unknown as Omit<DiscoveryOpportunity, 'organization'>), organization: { name: org?.name ?? 'Organización', verified: org?.verification_status === 'verified', institutionId: org?.institution_id ?? null } };
  const { data: inst } = opp.organization.institutionId ? await supabase.from('institutions').select(INST_COLS).eq('id', opp.organization.institutionId).maybeSingle() : { data: null };
  return { state: 'ok' as const, opp, base, m: scoreOne(base, opp, (inst as unknown as InstRow) ?? null) };
}

export { parseDiscoveryFilters, filtersToRecord };
