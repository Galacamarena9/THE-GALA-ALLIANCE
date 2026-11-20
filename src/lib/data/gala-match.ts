import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { loadPassport } from '@/lib/data/athlete';
import { snapshotOf } from '@/lib/domain/gala-match/changes';
import { compareMatches, galaMatch, type AthleteContext, type GalaMatch, type InstitutionTarget, type OpportunityTarget } from '@/lib/domain/gala-match/engine';

const INST_COLS = 'id, name, city, state, sports_offered, division, association, conference, athletic_source, ownership, locale, enrollment, cost_attendance_usd, tuition_in_state_usd, tuition_out_of_state_usd, net_price_usd, graduation_rate, program_cips, website_url, data_source, source_fetched_at';
export type InstitutionRow = Omit<InstitutionTarget, 'kind'> & {
  city: string | null; conference: string | null; net_price_usd: number | null; graduation_rate: number | null; website_url: string | null;
  data_source: string | null; source_fetched_at: string | null;
};

/** Contexto del atleta a partir de su Passport (sus propios datos; RLS de propietario). */
export async function loadAthleteContext(userId: string) {
  const p = await loadPassport(userId);
  if (!p.profile) return null;
  const a = p.academics;
  const g = p.goals;
  const ctx: AthleteContext = {
    sport_id: p.profile.sport_id,
    primary_position_id: p.profile.primary_position_id,
    secondary_position_id: p.profile.secondary_position_id,
    graduation_year: p.profile.graduation_year,
    pathways: g?.pathways?.length ? g.pathways : p.profile.target_divisions,
    countries: g?.countries ?? [],
    regions: g?.regions ?? [],
    intended_majors: g?.intended_majors?.length ? g.intended_majors : p.profile.intended_major ? [p.profile.intended_major] : [],
    school_size: g?.school_size ?? null,
    sport_level: g?.sport_level ?? null,
    campus_setting: g?.campus_setting ?? null,
    scholarship_need: g?.scholarship_need ?? null,
    annual_budget_usd: p.annualBudgetUsd,
    gpa: a?.gpa ?? null,
    gpa_scale: a?.gpa_scale ?? null,
    education_system: a?.education_system ?? null,
    has_english_certificate: Boolean(a && (a.cambridge_level || a.toefl_score != null || a.ielts_score != null || a.duolingo_score != null || (a.english_test && a.english_test !== 'none' && a.english_score))),
    has_highlight: p.videos.some((v) => v.kind === 'highlight'),
    has_full_game: p.videos.some((v) => v.kind === 'full_game'),
    verified_stats: p.stats.filter((s) => s.source === 'club_verified').length,
  };
  return { ctx, passport: p };
}

export interface MatchFilters {
  division?: string; state?: string; size?: string; maxCost?: number; minScore?: number; confidence?: string; program?: string; q?: string;
  /** Directorio: deporte elegido o todos (por defecto, el del atleta). */
  sport?: string; allSports?: boolean; association?: string; family?: string; activeOnly?: boolean;
  sort?: 'match' | 'name' | 'cost' | 'enrollment';
}

export type ScoredInstitution = { inst: InstitutionRow; m: GalaMatch; saved: boolean; activeOpps: number };
export type ScoredOpportunity = { opp: OpportunityRow; m: GalaMatch; saved: boolean };
export type OpportunityRow = Omit<OpportunityTarget, 'kind' | 'institution'> & {
  title: string; type: string; location: string | null; organization_id: string; org_name: string; org_verified: boolean; institution_id: string | null; updated_at: string;
};

/** Estado del atleta respecto a cada destino: guardado / oculto (última señal). */
async function athleteSets(userId: string) {
  const supabase = await createClient();
  const [{ data: saved }, { data: signals }] = await Promise.all([
    supabase.from('saved_items').select('target_kind, target_id, status, shortlist_tier, match_score_at_save, created_at').eq('athlete_id', userId),
    supabase.from('match_signals').select('target_kind, target_id, signal, created_at').eq('athlete_id', userId).in('signal', ['hidden', 'unhidden']).order('created_at', { ascending: false }).limit(1000),
  ]);
  const hidden = new Set<string>();
  const seen = new Set<string>();
  for (const s of signals ?? []) {
    const k = `${s.target_kind}:${s.target_id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    if (s.signal === 'hidden') hidden.add(k);
  }
  return { saved: saved ?? [], savedSet: new Set((saved ?? []).map((s) => `${s.target_kind}:${s.target_id}`)), hidden };
}

const toInstTarget = (i: InstitutionRow): InstitutionTarget => ({ kind: 'institution', ...i, program_cips: i.program_cips ?? [], sports_offered: i.sports_offered ?? [] });

export async function loadInstitutionMatches(userId: string, ctx: AthleteContext, f: MatchFilters) {
  const supabase = await createClient();
  let q = supabase.from('institutions').select(INST_COLS).limit(600);
  const sport = f.sport ?? (f.allSports ? null : ctx.sport_id);
  if (sport) q = q.contains('sports_offered', [sport]);
  if (f.association) q = q.eq('association', f.association);
  if (f.division) q = q.eq('division', f.division);
  if (f.state && /^[A-Z]{2}$/.test(f.state)) q = q.eq('state', f.state);
  if (f.q) q = q.ilike('name', `%${f.q.replace(/[%_,()]/g, '').slice(0, 60)}%`);
  if (f.size === 'small') q = q.lt('enrollment', 5000);
  if (f.size === 'medium') q = q.gte('enrollment', 5000).lt('enrollment', 15000);
  if (f.size === 'large') q = q.gte('enrollment', 15000);
  if (f.maxCost) q = q.lte('cost_attendance_usd', f.maxCost);
  const [{ data, error }, sets, { data: opps }] = await Promise.all([
    q,
    athleteSets(userId),
    supabase.from('opportunities').select('organizations(institution_id)').eq('status', 'published'),
  ]);
  if (error) throw new Error('matches_unavailable');
  const activeByInst = new Map<string, number>();
  for (const o of opps ?? []) {
    const iid = (o.organizations as unknown as { institution_id: string | null } | null)?.institution_id;
    if (iid) activeByInst.set(iid, (activeByInst.get(iid) ?? 0) + 1);
  }
  const rows = (data ?? []) as unknown as InstitutionRow[];
  const scored: ScoredInstitution[] = rows
    .filter((i) => !sets.hidden.has(`institution:${i.id}`))
    .map((inst) => ({ inst, m: galaMatch(ctx, toInstTarget(inst)), saved: sets.savedSet.has(`institution:${inst.id}`), activeOpps: activeByInst.get(inst.id) ?? 0 }))
    .filter((x) => (f.minScore ? (x.m.score ?? 0) >= f.minScore : true))
    .filter((x) => (f.confidence ? x.m.confidence === f.confidence : true))
    .filter((x) => (f.program ? x.m.why.some((w) => w.id === 'program') : true))
    .filter((x) => (f.family ? (x.inst.program_cips ?? []).some((c) => c.startsWith(f.family!)) : true))
    .filter((x) => (f.activeOnly ? x.activeOpps > 0 : true))
    .sort((x, y) => {
      if (f.sort === 'name') return x.inst.name.localeCompare(y.inst.name);
      if (f.sort === 'cost') return (x.inst.cost_attendance_usd ?? Infinity) - (y.inst.cost_attendance_usd ?? Infinity);
      if (f.sort === 'enrollment') return (y.inst.enrollment ?? -1) - (x.inst.enrollment ?? -1);
      return compareMatches(x.m, y.m);
    });
  return { scored, hiddenCount: sets.hidden.size, totalInDirectory: rows.length };
}

const OPP_COLS = 'id, title, type, sport_id, position_ids, graduation_years, division, min_gpa_4, english_required, location, deadline, annual_cost_usd, aid_amount_usd, aid_kind, financial_source, organization_id, updated_at, organizations(name, verification_status, institution_id)';

export async function loadOpportunityMatches(userId: string, ctx: AthleteContext) {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data, error }, sets] = await Promise.all([
    supabase.from('opportunities').select(OPP_COLS).eq('status', 'published').or(`deadline.is.null,deadline.gte.${today}`).limit(300),
    athleteSets(userId),
  ]);
  if (error) throw new Error('matches_unavailable');
  const rows = (data ?? []).map((o) => {
    const org = o.organizations as unknown as { name: string; verification_status: string; institution_id: string | null } | null;
    return { ...(o as unknown as OpportunityRow), name: o.title as string, org_name: org?.name ?? 'Organización', org_verified: org?.verification_status === 'verified', institution_id: org?.institution_id ?? null };
  });
  const instIds = [...new Set(rows.map((r) => r.institution_id).filter(Boolean))] as string[];
  const { data: insts } = instIds.length ? await supabase.from('institutions').select(INST_COLS).in('id', instIds) : { data: [] };
  const instMap = new Map(((insts ?? []) as unknown as InstitutionRow[]).map((i) => [i.id, i]));
  const scored: ScoredOpportunity[] = rows
    .filter((o) => !sets.hidden.has(`opportunity:${o.id}`))
    .map((opp) => {
      const inst = opp.institution_id ? instMap.get(opp.institution_id) : null;
      const target: OpportunityTarget = { kind: 'opportunity', ...opp, institution: inst ? toInstTarget(inst) : null };
      return { opp, m: galaMatch(ctx, target), saved: sets.savedSet.has(`opportunity:${opp.id}`) };
    })
    .sort((x, y) => compareMatches(x.m, y.m));
  return { scored };
}

/** Un destino concreto con su encaje (para la página de detalle). */
export async function loadOneMatch(userId: string, ctx: AthleteContext, kind: 'institution' | 'opportunity', id: string) {
  const supabase = await createClient();
  const sets = await athleteSets(userId);
  if (kind === 'institution') {
    const { data } = await supabase.from('institutions').select(INST_COLS).eq('id', id).maybeSingle();
    if (!data) return null;
    const inst = data as unknown as InstitutionRow;
    return { kind, inst, opp: null, m: galaMatch(ctx, toInstTarget(inst)), saved: sets.savedSet.has(`institution:${id}`), hidden: sets.hidden.has(`institution:${id}`) };
  }
  const { data } = await supabase.from('opportunities').select(OPP_COLS).eq('id', id).eq('status', 'published').maybeSingle();
  if (!data) return null;
  const org = data.organizations as unknown as { name: string; verification_status: string; institution_id: string | null } | null;
  const opp: OpportunityRow = { ...(data as unknown as OpportunityRow), name: data.title as string, org_name: org?.name ?? 'Organización', org_verified: org?.verification_status === 'verified', institution_id: org?.institution_id ?? null };
  const { data: instData } = opp.institution_id ? await supabase.from('institutions').select(INST_COLS).eq('id', opp.institution_id).maybeSingle() : { data: null };
  const inst = (instData ?? null) as unknown as InstitutionRow | null;
  return { kind, inst, opp, m: galaMatch(ctx, { kind: 'opportunity', ...opp, institution: inst ? toInstTarget(inst) : null }), saved: sets.savedSet.has(`opportunity:${id}`), hidden: sets.hidden.has(`opportunity:${id}`) };
}

/**
 * Congela el encaje en el momento de guardar: se calcula aquí, en el servidor, con el motor real (nunca lo envía el navegador).
 * Solo rellena guardados sin foto previa, para no reescribir la historia de uno antiguo. Si falla, el guardado sigue siendo válido.
 */
export async function stampMatchAtSave(athleteId: string, kind: 'institution' | 'opportunity', id: string): Promise<number | null> {
  try {
    const supabase = await createClient();
    // Solo con la sesión del propio atleta: un familiar puede no ver todos los bloques y la foto saldría incompleta.
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id !== athleteId) return null;
    const loaded = await loadAthleteContext(athleteId);
    if (!loaded) return null;
    const one = await loadOneMatch(athleteId, loaded.ctx, kind, id);
    if (!one) return null;
    await supabase.from('saved_items').update({ match_score_at_save: one.m.score, match_snapshot: snapshotOf(one.m) })
      .eq('athlete_id', athleteId).eq('target_kind', kind).eq('target_id', id).is('match_snapshot', null).is('match_score_at_save', null);
    return one.m.score;
  } catch (e) {
    console.error('[gala-match] no se pudo congelar el encaje', e instanceof Error ? e.message : e);
    return null;
  }
}

export type SavedRow = { id: string; target_kind: 'institution' | 'opportunity'; target_id: string; status: string; shortlist_tier: string | null; note: string | null; match_score_at_save: number | null; match_snapshot: unknown; created_at: string; name: string; sub: string };

/** Guardados con nombre (para listas y shortlist). */
export async function loadSaved(userId: string): Promise<SavedRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('saved_items').select('id, target_kind, target_id, status, shortlist_tier, note, match_score_at_save, match_snapshot, created_at').eq('athlete_id', userId).order('created_at', { ascending: false });
  const rows = data ?? [];
  const iIds = rows.filter((r) => r.target_kind === 'institution').map((r) => r.target_id);
  const oIds = rows.filter((r) => r.target_kind === 'opportunity').map((r) => r.target_id);
  const [{ data: insts }, { data: opps }] = await Promise.all([
    iIds.length ? supabase.from('institutions').select('id, name, city, state, division').in('id', iIds) : Promise.resolve({ data: [] as { id: string; name: string; city: string | null; state: string | null; division: string | null }[] }),
    oIds.length ? supabase.from('opportunities').select('id, title, deadline, organizations(name)').in('id', oIds) : Promise.resolve({ data: [] as { id: string; title: string; deadline: string | null; organizations: unknown }[] }),
  ]);
  const im = new Map((insts ?? []).map((i) => [i.id, i]));
  const om = new Map((opps ?? []).map((o) => [o.id, o]));
  return rows.map((r) => {
    if (r.target_kind === 'institution') {
      const i = im.get(r.target_id);
      return { ...r, name: i?.name ?? 'Universidad', sub: [i?.city, i?.state].filter(Boolean).join(', ') } as SavedRow;
    }
    const o = om.get(r.target_id);
    return { ...r, name: o?.title ?? 'Oportunidad no disponible', sub: [(o?.organizations as { name?: string } | null)?.name, o?.deadline && `Plazo ${o.deadline}`].filter(Boolean).join(' · ') } as SavedRow;
  });
}
