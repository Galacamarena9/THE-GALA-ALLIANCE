import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Division } from '@/lib/types';
import { ROLE_CAPS, UNVERIFIED_CAPS, needFit, type AthleteFacts, type Cap, type NeedCriteria, type NeedFit, type OrgRole } from '@/lib/domain/recruit';

/**
 * Datos del Coach & University Portal. Todo con el cliente del usuario: la RLS (org_can) decide qué existe.
 * Lo que aquí se calcula (encaje con una necesidad) se hace solo sobre datos que el coach puede ver.
 */
export interface RecruitOrg {
  id: string; name: string; type: string; verification_status: string; institution_id: string | null;
  /** División NCAA/NAIA/NJCAA declarada (de ella depende la ventana de contacto NCAA). */
  division: Division | null;
  role: OrgRole; program_ids: string[]; verified: boolean; caps: Set<Cap>;
}

export async function loadRecruitOrgs(userId: string): Promise<RecruitOrg[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('organization_members')
    .select('member_role, program_ids, organizations(id, name, type, verification_status, institution_id, division)')
    .eq('user_id', userId);
  return (data ?? []).map((m) => {
    const o = m.organizations as unknown as { id: string; name: string; type: string; verification_status: string; institution_id: string | null; division: Division | null } | null;
    if (!o || !['university', 'college', 'club', 'academy'].includes(o.type)) return null;
    const role = m.member_role as OrgRole;
    const verified = o.verification_status === 'verified';
    const caps = new Set((ROLE_CAPS[role] ?? []).filter((c) => verified || UNVERIFIED_CAPS.includes(c)));
    return { ...o, role, program_ids: (m.program_ids as string[]) ?? [], verified, caps };
  }).filter((x): x is RecruitOrg => !!x);
}

export async function currentRecruitOrg(userId: string, wanted?: string) {
  const orgs = await loadRecruitOrgs(userId);
  return { orgs, org: orgs.find((o) => o.id === wanted) ?? orgs[0] ?? null };
}

const isoDay = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

export async function loadCoachHome(org: RecruitOrg) {
  const supabase = await createClient();
  const today = isoDay(0);
  const [opps, needs, cands, slm, tasks, programs, members, activity, shared] = await Promise.all([
    supabase.from('opportunities').select('id, title, status, deadline, expires_at').eq('organization_id', org.id).in('status', ['published', 'pending_review', 'draft']),
    supabase.from('recruiting_needs').select('id, title, status, sport_id, position_ids, class_years, min_height_cm, requires_video, requires_documented_academics, countries').eq('organization_id', org.id).eq('status', 'active'),
    supabase.from('org_candidates').select('id, internal_stage, source, assigned_to, created_at').eq('organization_id', org.id).is('archived_at', null),
    supabase.from('org_shortlist_members').select('athlete_id, review_status').eq('organization_id', org.id),
    supabase.from('org_tasks').select('id, title, due_date, priority, assignee_id, athlete_id').eq('organization_id', org.id).eq('status', 'open').order('due_date', { ascending: true, nullsFirst: false }).limit(50),
    supabase.from('org_programs').select('id', { count: 'exact', head: true }).eq('organization_id', org.id).is('archived_at', null),
    supabase.from('organization_members').select('user_id', { count: 'exact', head: true }).eq('organization_id', org.id),
    supabase.from('org_activity').select('id, kind, athlete_id, detail, created_at').eq('organization_id', org.id).order('created_at', { ascending: false }).limit(12),
    supabase.from('info_requests').select('id', { count: 'exact', head: true }).eq('organization_id', org.id).eq('status', 'shared').gte('responded_at', new Date(Date.now() - 7 * 86400000).toISOString()),
  ]);
  const oppRows = opps.data ?? [];
  const expiring = oppRows.filter((o) => o.status === 'published').map((o) => {
    const end = (o.expires_at as string | null) ?? (o.deadline as string | null);
    if (!end) return null;
    const days = Math.ceil((new Date(`${end}T23:59:59`).getTime() - Date.now()) / 86400000);
    return days >= 0 && days <= 7 ? { id: o.id as string, title: o.title as string, days } : null;
  }).filter((x): x is { id: string; title: string; days: number } => !!x);
  const taskRows = tasks.data ?? [];

  // Clubes y academias: candidaturas a trials sin revisar y el próximo trial (≤48 h), con 2 consultas más.
  let trialApplications: { id: string; title: string; count: number }[] = [];
  let upcomingTrial: { id: string; title: string; hours: number; confirmed: number; missingDocs: number } | null = null;
  if (['club', 'academy'].includes(org.type)) {
    const { data: trials } = await supabase.from('opportunities').select('id, title, start_at')
      .eq('organization_id', org.id).in('type', ['tryout', 'camp_showcase', 'club_recruitment', 'academy', 'development_program']).eq('status', 'published').limit(60);
    const ids = (trials ?? []).map((t) => t.id as string);
    if (ids.length) {
      const [{ data: apps }, { data: regs }] = await Promise.all([
        supabase.from('applications').select('opportunity_id').in('opportunity_id', ids).in('status', ['applied', 'reviewed', 'information_requested']),
        supabase.from('opportunity_registrations').select('opportunity_id, status, materials_status').in('opportunity_id', ids).in('status', ['registered', 'confirmed', 'pending']),
      ]);
      trialApplications = (trials ?? []).map((t) => ({ id: t.id as string, title: t.title as string, count: (apps ?? []).filter((a) => a.opportunity_id === t.id).length }))
        .filter((t) => t.count > 0).sort((a, b) => b.count - a.count).slice(0, 3);
      const soon = (trials ?? []).map((t) => ({ ...t, hours: t.start_at ? Math.round((new Date(t.start_at as string).getTime() - Date.now()) / 3600000) : null }))
        .filter((t) => t.hours != null && t.hours >= -12 && t.hours <= 48).sort((a, b) => (a.hours ?? 0) - (b.hours ?? 0))[0];
      if (soon) {
        const r = (regs ?? []).filter((x) => x.opportunity_id === soon.id);
        upcomingTrial = { id: soon.id as string, title: soon.title as string, hours: Math.max(0, soon.hours ?? 0),
          confirmed: r.filter((x) => x.status === 'confirmed').length, missingDocs: r.filter((x) => x.materials_status === 'pending').length };
      }
    }
  }
  return {
    trialApplications,
    upcomingTrial,
    activeOpportunities: oppRows.filter((o) => o.status === 'published').length,
    drafts: oppRows.filter((o) => o.status !== 'published').length,
    needs: needs.data ?? [],
    candidates: cands.data ?? [],
    toReview: new Set((slm.data ?? []).filter((m) => m.review_status === 'to_review').map((m) => m.athlete_id)).size,
    shortlisted: new Set((slm.data ?? []).map((m) => m.athlete_id)).size,
    tasks: taskRows,
    overdueTasks: taskRows.filter((t) => t.due_date && t.due_date < today).length,
    dueTodayTasks: taskRows.filter((t) => t.due_date === today).length,
    expiring,
    programs: programs.count ?? 0,
    members: members.count ?? 0,
    activity: activity.data ?? [],
    sharedInfo: shared.count ?? 0,
  };
}

/* ------------------------------------------------------------------ Descubrimiento */
export interface DiscoverFilters {
  sport?: string; position?: number; grad?: number; country?: string; minHeight?: number; video?: boolean;
  academics?: boolean; verifiedStats?: boolean; q?: string; page: number;
}
export interface DiscoverRow {
  user_id: string; display_name: string; avatar_url: string | null; country: string | null; headline: string | null;
  sport_id: string | null; primary_position_id: number | null; secondary_position_id: number | null; graduation_year: number | null;
  height_cm: number | null; current_team: string | null; competitive_level: string | null; has_video: boolean;
  academics_documented: boolean | null; verified_stats: number | null; fit: NeedFit | null;
}
export const PAGE_SIZE = 20;

export async function discoverAthletes(f: DiscoverFilters, need: NeedCriteria | null, orgId?: string) {
  const supabase = await createClient();
  const sport = f.sport ?? need?.sport_id;
  // Sin deporte no se busca: impide listar toda la base de atletas (anti-enumeración).
  if (!sport || !orgId) return { rows: [] as DiscoverRow[], total: 0, needsSport: !sport };
  // La búsqueda se hace en la base de datos con la política de cada atleta: Discovery activado, bloques filtrables
  // y organización verificada con permiso. Aquí solo llegan identificadores autorizados.
  const filters: Record<string, string | number | boolean> = { sport };
  if (f.position) filters.position = f.position;
  if (f.grad) filters.grad = f.grad;
  if (f.country && /^[A-Z]{2}$/.test(f.country)) filters.country = f.country;
  if (f.minHeight) filters.min_height = f.minHeight;
  if (f.video) filters.video = true;
  if (f.academics) filters.academics = true;
  if (f.verifiedStats) filters.verified_stats = true;
  if (f.q) filters.q = f.q.slice(0, 60);
  const { data: hits, error: hitErr } = await supabase.rpc('discover_athlete_ids', { p_org: orgId, p_filters: filters, p_page: Math.min(f.page, 20), p_page_size: PAGE_SIZE });
  // La cuota diaria la aplica la propia RPC (no se puede saltar llamándola directamente).
  if (hitErr) throw new Error(hitErr.message.includes('rate_limited') ? 'discover_quota' : 'discover_unavailable');
  const hitRows = (hits ?? []) as { user_id: string; total: number; match_blocked: string[] }[];
  const blocked = new Map(hitRows.map((h) => [h.user_id, new Set(h.match_blocked ?? [])]));
  const order = new Map(hitRows.map((h, i) => [h.user_id, i]));
  const { data, error } = hitRows.length
    ? await supabase.from('athlete_directory').select('*').in('user_id', hitRows.map((h) => h.user_id))
    : { data: [], error: null };
  if (error) throw new Error('discover_unavailable');
  const count = hitRows[0]?.total ?? 0;
  const rows = ((data ?? []) as Omit<DiscoverRow, 'academics_documented' | 'verified_stats' | 'fit'>[]).sort((a, b) => (order.get(a.user_id) ?? 0) - (order.get(b.user_id) ?? 0));
  const ids = rows.map((r) => r.user_id);
  const [acad, stats] = ids.length ? await Promise.all([
    supabase.from('athlete_academics').select('athlete_id, gpa_source').in('athlete_id', ids),
    supabase.from('athlete_statistics').select('athlete_id, source').in('athlete_id', ids),
  ]) : [{ data: [] }, { data: [] }];
  const acadMap = new Map((acad.data ?? []).map((r) => [r.athlete_id as string, r.gpa_source !== 'self_reported']));
  const statRows = (stats.data ?? []) as { athlete_id: string; source: string }[];
  const visibleStats = new Set(statRows.map((s) => s.athlete_id));
  const out: DiscoverRow[] = rows.map((r) => {
    // Lo que el atleta no permite usar para el encaje cuenta como «desconocido» (baja la confianza, no penaliza).
    const nope = blocked.get(r.user_id) ?? new Set<string>();
    const facts: AthleteFacts = {
      ...r,
      height_cm: nope.has('physical') ? null : r.height_cm,
      has_video: nope.has('videos') ? false : r.has_video,
      academics_documented: nope.has('academics') ? null : acadMap.has(r.user_id) ? acadMap.get(r.user_id)! : null,
      verified_stats: nope.has('stats') ? null : visibleStats.has(r.user_id) ? statRows.filter((s) => s.athlete_id === r.user_id && s.source !== 'self_reported').length : null,
    };
    return { ...r, academics_documented: facts.academics_documented, verified_stats: facts.verified_stats, fit: need ? needFit(need, facts) : null };
  });
  return { rows: out, total: Number(count) || 0, needsSport: false };
}

/** Ficha de candidato: solo los bloques que el coach puede ver (RLS por bloque) + su contexto interno. */
export async function loadCandidate(org: RecruitOrg, athleteId: string) {
  const supabase = await createClient();
  const [dir, prof, acad, stats, videos, achievements, cand, notes, tasks, activity, requests, lists, apps, members] = await Promise.all([
    supabase.from('athlete_directory').select('*').eq('user_id', athleteId).maybeSingle(),
    supabase.from('athlete_profiles').select('user_id, username, nationality').eq('user_id', athleteId).maybeSingle(),
    supabase.from('athlete_academics').select('gpa, gpa_scale, grade_display, education_system, school_name, english_test, english_score, gpa_source, english_source, sat_score, act_score').eq('athlete_id', athleteId).maybeSingle(),
    supabase.from('athlete_statistics').select('season, value, source, team, competition, sport_stat_definitions(label_es, label_en, unit)').eq('athlete_id', athleteId).order('season', { ascending: false }).limit(12),
    supabase.from('athlete_videos').select('id, kind, title, url, is_featured').eq('athlete_id', athleteId).order('is_featured', { ascending: false }).limit(8),
    supabase.from('athlete_achievements').select('title, year').eq('athlete_id', athleteId).order('year', { ascending: false }).limit(6),
    supabase.from('org_candidates').select('*').eq('organization_id', org.id).eq('athlete_id', athleteId).maybeSingle(),
    supabase.from('org_notes').select('id, body, author_id, created_at').eq('organization_id', org.id).eq('athlete_id', athleteId).order('created_at', { ascending: false }),
    supabase.from('org_tasks').select('id, title, due_date, status, assignee_id, priority').eq('organization_id', org.id).eq('athlete_id', athleteId).order('status').order('due_date'),
    supabase.from('org_activity').select('id, kind, actor_id, detail, created_at').eq('organization_id', org.id).eq('athlete_id', athleteId).order('created_at', { ascending: false }).limit(40),
    supabase.from('info_requests').select('id, kind, status, message, shared_until, document_id, created_at').eq('organization_id', org.id).eq('athlete_id', athleteId).order('created_at', { ascending: false }),
    supabase.from('org_shortlist_members').select('shortlist_id, review_status, assigned_to, org_shortlists(name)').eq('organization_id', org.id).eq('athlete_id', athleteId),
    supabase.from('applications').select('id, status, created_at, opportunity_id, opportunities!inner(title, organization_id)').eq('athlete_id', athleteId).eq('opportunities.organization_id', org.id),
    supabase.from('organization_members').select('user_id, member_role, title, profiles(display_name)').eq('organization_id', org.id),
  ]);
  if (!dir.data) return null;
  return {
    dir: dir.data as Omit<DiscoverRow, 'academics_documented' | 'verified_stats' | 'fit'>,
    profile: prof.data ? { ...prof.data, league: dir.data.league ?? null, years_experience: dir.data.years_experience ?? null, weight_kg: dir.data.weight_kg ?? null } : null, academics: acad.data, stats: stats.data ?? [], videos: videos.data ?? [], achievements: achievements.data ?? [],
    candidate: cand.data, notes: notes.data ?? [], tasks: tasks.data ?? [], activity: activity.data ?? [], requests: requests.data ?? [],
    lists: lists.data ?? [], applications: apps.data ?? [],
    members: (members.data ?? []).map((m) => ({ id: m.user_id as string, role: m.member_role as string, title: m.title as string | null, name: (m.profiles as unknown as { display_name: string } | null)?.display_name ?? 'Miembro' })),
  };
}

export async function loadMembers(orgId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('organization_members').select('user_id, member_role, title, program_ids, created_at, profiles(display_name)').eq('organization_id', orgId).order('created_at');
  return (data ?? []).map((m) => ({ id: m.user_id as string, role: m.member_role as string, title: m.title as string | null, program_ids: (m.program_ids as string[]) ?? [], name: (m.profiles as unknown as { display_name: string } | null)?.display_name ?? 'Miembro' }));
}
