import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { myOrganizations } from '@/lib/data/orgs';
import { TRIAL_TYPES, trialFit, type EventDetails, type TrialFit, type TrialStatus } from '@/lib/domain/trials';

const DETAIL_COLS = 'opportunity_id, fee_type, fee_amount, currency, event_start_date, event_end_date, start_time_local, timezone, city, country, age_category, accommodation, meals, travel, minor_policy';

export type TrialOpp = {
  id: string; title: string; type: string; sport_id: string; position_ids: number[]; graduation_years: number[]; deadline: string | null;
  org_name: string; org_verified: boolean; details: EventDetails | null;
};
export type AgentAthlete = { id: string; agencyId: string; name: string; sport_id: string | null; primary_position_id: number | null; secondary_position_id: number | null; graduation_year: number | null };
export type AgentRegistration = {
  id: string; status: TrialStatus; outcome: string | null; origin: string; needs_athlete_ok: boolean; guardian_status: string; updated_at: string;
  athlete: AgentAthlete | null; opp: TrialOpp | null;
};

/**
 * Todo lo que necesita el agente para trabajar trials: sus representados ACTIVOS, sus inscripciones (RLS)
 * y los trials abiertos de organizaciones verificadas que encajan con cada uno. 5 consultas, sin N+1.
 */
export async function loadAgentTrials(userId: string) {
  const supabase = await createClient();
  const agencies = (await myOrganizations(userId)).filter((o) => o.type === 'agency');
  if (!agencies.length) return { agencies, athletes: [] as AgentAthlete[], registrations: [] as AgentRegistration[], suggestions: [] as { opp: TrialOpp; fits: { athlete: AgentAthlete; fit: TrialFit; registered: boolean }[] }[] };

  const { data: reps } = await supabase.from('agent_representations').select('agency_id, athlete_id').in('agency_id', agencies.map((a) => a.id)).eq('status', 'active');
  const ids = [...new Set((reps ?? []).map((r) => r.athlete_id))];
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: dir }, { data: profiles }, { data: regs }, { data: opps }] = await Promise.all([
    ids.length ? supabase.from('athlete_directory').select('user_id, display_name, sport_id, primary_position_id, secondary_position_id, graduation_year').in('user_id', ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from('profiles').select('id, display_name').in('id', ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from('trial_registrations').select('id, opportunity_id, athlete_id, status, outcome, origin, needs_athlete_ok, guardian_status, updated_at').in('athlete_id', ids).order('updated_at', { ascending: false }).limit(500) : Promise.resolve({ data: [] }),
    supabase.from('opportunities').select('id, title, type, sport_id, position_ids, graduation_years, deadline, expires_at, organizations(name, verification_status)')
      .in('type', TRIAL_TYPES as unknown as string[]).eq('status', 'published').or(`deadline.is.null,deadline.gte.${today}`).order('deadline', { ascending: true, nullsFirst: false }).limit(200),
  ]);

  const dirById = new Map((dir ?? []).map((d) => [d.user_id as string, d]));
  const nameById = new Map((profiles ?? []).map((p) => [p.id as string, p.display_name as string]));
  const athletes: AgentAthlete[] = (reps ?? []).map((r) => {
    const d = dirById.get(r.athlete_id) as { display_name?: string; sport_id?: string; primary_position_id?: number; secondary_position_id?: number; graduation_year?: number } | undefined;
    return {
      id: r.athlete_id, agencyId: r.agency_id, name: d?.display_name ?? nameById.get(r.athlete_id) ?? 'Atleta',
      sport_id: d?.sport_id ?? null, primary_position_id: d?.primary_position_id ?? null, secondary_position_id: d?.secondary_position_id ?? null, graduation_year: d?.graduation_year ?? null,
    };
  }).filter((a, i, arr) => arr.findIndex((x) => x.id === a.id) === i);

  // Oportunidades: abiertas (sugerencias) + las de inscripciones existentes (aunque ya hayan cerrado).
  const regOppIds = [...new Set((regs ?? []).map((r) => r.opportunity_id as string))].filter((id) => !(opps ?? []).some((o) => o.id === id));
  const { data: regOpps } = regOppIds.length
    ? await supabase.from('opportunities').select('id, title, type, sport_id, position_ids, graduation_years, deadline, expires_at, organizations(name, verification_status)').in('id', regOppIds)
    : { data: [] };
  const allOpps = [...(opps ?? []), ...(regOpps ?? [])];
  const { data: details } = allOpps.length ? await supabase.from('opportunity_event_details').select(DETAIL_COLS).in('opportunity_id', allOpps.map((o) => o.id)) : { data: [] };
  const detailById = new Map((details ?? []).map((d) => [d.opportunity_id as string, d as unknown as EventDetails]));
  const toOpp = (o: (typeof allOpps)[number]): TrialOpp => {
    const org = o.organizations as unknown as { name: string; verification_status: string } | null;
    return { id: o.id, title: o.title, type: o.type, sport_id: o.sport_id, position_ids: o.position_ids ?? [], graduation_years: o.graduation_years ?? [], deadline: o.deadline, org_name: org?.name ?? 'Organización', org_verified: org?.verification_status === 'verified', details: detailById.get(o.id) ?? null };
  };
  const oppById = new Map(allOpps.map((o) => [o.id as string, toOpp(o)]));
  const athleteById = new Map(athletes.map((a) => [a.id, a]));

  const registrations: AgentRegistration[] = (regs ?? []).map((r) => ({
    id: r.id, status: r.status as TrialStatus, outcome: r.outcome, origin: r.origin, needs_athlete_ok: r.needs_athlete_ok, guardian_status: r.guardian_status, updated_at: r.updated_at,
    athlete: athleteById.get(r.athlete_id) ?? null, opp: oppById.get(r.opportunity_id) ?? null,
  }));
  const regKey = new Set((regs ?? []).map((r) => `${r.opportunity_id}:${r.athlete_id}`));

  // Solo se sugieren trials de organizaciones verificadas (las únicas que aceptan inscripciones).
  const today2 = today;
  const suggestions = (opps ?? []).map(toOpp)
    .filter((o) => o.org_verified && (!o.details?.event_start_date || o.details.event_start_date >= today2))
    .map((opp) => ({ opp, fits: athletes.map((a) => ({ athlete: a, fit: trialFit(a, opp), registered: regKey.has(`${opp.id}:${a.id}`) })).filter((x) => x.fit.ok) }))
    .filter((s) => s.fits.length > 0);

  return { agencies, athletes, registrations, suggestions };
}
